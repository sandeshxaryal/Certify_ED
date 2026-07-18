// src/controllers/certificate.controller.js
/* 
generateCertificateHash
generateCertificate
verifyCertificateById
verifyCertificatePdf
getCertificateMetadata
uploadExternalCertificate
searchByCID
getCertificateStats
getOrgCertificates


certificate.controller.js
  generateCertificate (main flow)
  getCertificateMetadata
  getCertificateStats
  getOrgCertificates
  handleCertificateWebhook
*/
import logActivity from '../utils/logActivity.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { generateCertificatePdf } from '../utils/pdfUtils.js';
import * as pinata from '../utils/pinata.js';
import { web3, contract, getWeb3, getContract } from '../utils/blockchain.js';
import { PINATA_GATEWAY_BASE_URL } from '../constants.js';
import Certificate from '../models/certificate.model.js';
import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'
import { pdfUpload } from '../middlewares/fileUpload.middleware.js';
import multer from 'multer';
import { computePDFHash, getStoredHashFromBlockchain } from '../utils/pdfHashUtils.js';
import {
  isValidCID,
  computePDFHashes,
  formatCertificateResponse,
  findCertificateByHash,
  uploadToIPFS,
  findCertificateByAnyHash,
  buildSigningPayload
} from '../utils/certificateUtils.js';
import User from '../models/user.model.js';
import {
  successResponse,
  verificationResponse,
  warningResponse
} from '../utils/responseUtils.js';
import { errorResponse, ErrorCodes } from '../utils/errorUtils.js';
import { uploadBufferToPinata } from '../utils/pinata.js';
import { sendCertificateEmail } from '../utils/emailUtils.js';
import { estimateCost } from '../utils/ether.js'

BigInt.prototype.toJSON = function () { return this.toString(); };
const BLOCK_EXPLORER_URL = 'http://localhost:8545'

// Helper functions
const generateCertificateHash = (
  referenceId,
  candidateName,
  courseName,
  institutionName,
  issuedDate = "") => {
  const normalizedData = `${referenceId}|${candidateName.trim().toLowerCase()}|${courseName.trim().toLowerCase()}|${institutionName.trim().toLowerCase()}|${issuedDate}`;
  return crypto.createHash('sha256').update(normalizedData).digest('hex');
};

const parseCertificateData = (data) => {
  if (Array.isArray(data)) {
    return {
      referenceId: data[0],
      candidateName: data[1],
      courseName: data[2],
      institutionName: data[3],
      issuedDate: data[4],
      institutionLogo: data[5],
      generationDate: data[6],
      blockchainTxId: data[7],
      cryptographicSignature: data[8],
      ipfsHash: data[9],
      timestamp: data[10],
      revoked: data[11] || false
    };
  }
  return {
    referenceId: data.referenceId || data.uid,
    candidateName: data.candidateName,
    courseName: data.courseName,
    institutionName: data.institutionName || data.orgName,
    issuedDate: data.issuedDate,
    institutionLogo: data.institutionLogo || data.collegeLogo,
    generationDate: data.generationDate,
    blockchainTxId: data.blockchainTxId || data.transactionId,
    cryptographicSignature: data.cryptographicSignature || data.digitalSignature,
    ipfsHash: data.ipfsHash,
    timestamp: data.timestamp,
    revoked: data.revoked || false
  };
};

const blockchainErrorHandler = (error, certificateId) => {
  console.error(`[${certificateId}] Blockchain Error:`, error);

  const isRevert = error.data?.startsWith('0x08c379a0');
  const statusCode = isRevert ? 404 : 500;
  const errorCodes = {
    'Certificate not found': 'NOT_FOUND',
    'Already revoked': 'REVOKED',
    default: 'BLOCKCHAIN_ERROR'
  };

  return {
    statusCode,
    error: {
      code: errorCodes[error.reason] || errorCodes.default,
      message: isRevert ? 'Blockchain operation reverted' : 'Blockchain operation failed',
      details: error.reason || error.message
    }
  };
};

const generateVerificationShortCode = () => {
  try {
    console.log('[ShortCode] Generating new verification short code');
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    const randomBytes = crypto.randomBytes(8);
    for (let i = 0; i < 4; i++) {
      const randomIndex = randomBytes[i] % characters.length;
      result += characters.charAt(randomIndex);
    }
    if (!/^[A-Z0-9]{4}$/.test(result)) {
      console.warn('[ShortCode] Generated invalid code format, retrying');
      return generateVerificationShortCode();
    }
    console.log(`[ShortCode] Generated code: ${result}`);
    return result;
  } catch (error) {
    console.error('[ShortCode] Error generating verification code:', error);
    const fallback = `${Math.floor(Math.random() * 9000) + 1000}`.toUpperCase();
    console.warn(`[ShortCode] Using fallback code: ${fallback}`);
    return fallback;
  }
};

// NOTE: an unused `createInstitutionalSignature(data, privateKey)` helper used to live here,
// taking a raw private key directly and never being called. Removed as part of the private-key
// encryption-at-rest fix so nothing in this file can be wired up to sign with a raw key again —
// all signing goes through `signingInstitute.signData()` on the User model, which decrypts
// internally and never returns the plaintext key.

// Certificate Generation and Upload
export const generateCertificate = async (req, res) => {
  const startTime = Date.now();
  const generationId = crypto.randomBytes(8).toString('hex');
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 STARTING CERTIFICATE GENERATION [${generationId}]`);
  console.log(`${'='.repeat(70)}`);

  console.log(`\n📝 [${generationId}] STEP 1/5: Preparing metadata...`);
  
  try {
    const {
            referenceId,
            candidateName,
            courseName,
            institutionName: requestInstitutionName,
            issuedDate,
            institutionLogo: requestInstitutionLogo,
            recipientEmail,
            gpa
          } = req.body;

    const institutionName = req.user?.institutionName || requestInstitutionName || '';

    if (!institutionName) {
      return res.status(400).json({
        error: {
          code: 'MISSING_INSTITUTION',
          message: 'Institution name is required',
          details: 'Please update your profile with institution name'
        },
        meta: { generationId }
      });
    }

    const institutionLogo = req.user?.institutionLogo || requestInstitutionLogo || '';
    console.log(`[${generationId}] Institution: ${institutionName}`);
    console.log(`[${generationId}] Using logo: ${institutionLogo || 'Default logo'}`);

    const metadata = {
      referenceId: referenceId || `REF-${Date.now().toString(36).toUpperCase()}`,
      candidateName,
      courseName,
      institutionName
    };

    const additionalMetadata = {
      issuedDate: issuedDate || new Date().toISOString(),
      institutionLogo,
      generationDate: new Date().toISOString(),
      blockchainTxId: "",
      cryptographicSignature: ""
    };

    const missingFields = Object.entries(metadata)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (recipientEmail && !recipientEmail.match(/\S+@\S+\.\S+/)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid recipient email address',
          fields: ['recipientEmail'],
          documentation: 'https://api.yourservice.com/docs/certificates#required-fields'
        },
        meta: { generationId }
      });
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Required fields are missing',
          fields: missingFields,
          documentation: 'https://api.yourservice.com/docs/certificates#required-fields'
        },
        meta: { generationId }
      });
    }

    const certificateId = generateCertificateHash(
      metadata.referenceId,
      candidateName,
      courseName,
      metadata.institutionName,
      additionalMetadata.issuedDate
    );

    let verificationCode;
    let retries = 0;
    const maxRetries = 5;

    do {
      verificationCode = generateVerificationShortCode();
      console.log(`[${generationId}] Generated verification code: ${verificationCode}`);
      if (!/^[A-Z0-9]{4}$/.test(verificationCode)) {
        console.error(`[${generationId}] Invalid verification code format: ${verificationCode}, regenerating...`);
        continue;
      }
      const codeExists = await Certificate.findOne({ verificationCode });
      if (!codeExists) break;
      console.log(`[${generationId}] Verification code ${verificationCode} already exists, regenerating...`);
      retries++;
    } while (retries < maxRetries);

    if (!verificationCode || !/^[A-Z0-9]{4}$/.test(verificationCode)) {
      console.error(`[${generationId}] Failed to generate valid verification code after ${retries} attempts`);
      return res.status(500).json({
        error: {
          code: 'VERIFICATION_CODE_GENERATION_FAILED',
          message: 'Failed to generate valid verification code',
          details: `Verification code generation failed after ${retries} attempts`
        },
        meta: { generationId }
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'A signed-in institute account is required to issue certificates'
        },
        meta: { generationId }
      });
    }

    const signingInstitute = await User.findWithKeys(req.user.id);
    if (!signingInstitute?.privateKey) {
      console.error(`[${generationId}] Institute ${req.user.id} has no private key on file`);
      return res.status(500).json({
        error: {
          code: 'SIGNING_KEY_MISSING',
          message: 'Institute account is missing its signing key. Please reload your profile page to have one generated, then try again.'
        },
        meta: { generationId }
      });
    }

    const instituteId = req.user.id;
    const dataToSign = buildSigningPayload(
      certificateId,
      metadata.referenceId,
      candidateName,
      metadata.institutionName,
      additionalMetadata.issuedDate,
      instituteId
    );
    // Real institutional signature: RSA-SHA256 signed with the institute's own
    // private key, verifiable by anyone holding the institute's public key.
    additionalMetadata.institutionalSignature = await signingInstitute.signData(dataToSign);
    // Kept only as a non-authoritative content fingerprint for display/debugging;
    // it is NOT used for verification and carries no shared secret.
    additionalMetadata.cryptographicSignature = crypto.createHash('sha256').update(dataToSign).digest('hex');

    console.log(`[${generationId}] Created RSA institutional signature`);

    const certificateData = {
      certificateId,
      verificationCode,
      ...metadata,
      ...additionalMetadata,
      generationId,
      createdAt: new Date().toISOString()
    };

    try {
      const contractInstance = getContract();
      const [blockchainExists, dbExists] = await Promise.all([
        contractInstance.methods.isVerified(certificateId).call(),
        Certificate.findOne({ certificateId }).lean()
      ]);

      if (blockchainExists) {
        return res.status(409).json({
          error: {
            code: 'CERTIFICATE_EXISTS',
            message: 'Certificate already exists on blockchain',
            resolution: [
              'If this is an update, revoke the existing certificate first',
              'Use different metadata for new certificate'
            ],
            existingRecord: dbExists || null,
            verificationUrl: `/api/certificates/${certificateId}/verify`
          },
          meta: certificateData
        });
      }
    } catch (checkError) {
      console.error(`[${generationId}] Existence check failed:`, checkError);
      console.log(`[${generationId}] Continuing certificate generation despite blockchain check error`);
    }

    console.log(`\n📄 [${generationId}] STEP 2/4: Generating PDF...`);
    const pdfStartTime = Date.now();
    const outputDir = path.resolve('uploads');
    const pdfFilePath = path.join(outputDir, `cert_${generationId}.pdf`);

    const validCertTypes = ["ACHIEVEMENT", "COMPLETION", "PARTICIPATION"];
    let certificateType = (req.body.certificateType || "ACHIEVEMENT").toUpperCase();
    if (!validCertTypes.includes(certificateType)) {
      certificateType = "ACHIEVEMENT";
    }
    console.log(`[${generationId}] Creating certificate of type: ${certificateType}`);

    try {
      await fs.promises.mkdir(outputDir, { recursive: true });
      await generateCertificatePdf(
        pdfFilePath,
        metadata.referenceId,
        candidateName,
        courseName,
        metadata.institutionName,
        path.resolve('public/assets/logo.jpg'),
        verificationCode,
        `${req.protocol}://${req.get('host')}/api/certificates/code/${verificationCode}`,
        additionalMetadata.issuedDate,
        additionalMetadata.institutionLogo,
        additionalMetadata.cryptographicSignature,
        certificateId,
        additionalMetadata,
        certificateType,
        gpa
      );
      const pdfTime = ((Date.now() - pdfStartTime) / 1000).toFixed(2);
      console.log(`✅ [${generationId}] PDF generated in ${pdfTime}s`);
    } catch (pdfError) {
      console.error(`❌ [${generationId}] PDF generation failed:`, pdfError.message);
      return res.status(500).json({
        error: {
          code: 'PDF_GENERATION_FAILED',
          message: 'Failed to create certificate PDF',
          details: pdfError.message,
          temporaryFile: pdfFilePath
        },
        meta: certificateData
      });
    }

    console.log(`\n📤 [${generationId}] STEP 3/4: Uploading to IPFS...`);
    const ipfsStartTime = Date.now();
    let ipfsData;
    try {
      const pdfBuffer = await fs.promises.readFile(pdfFilePath);
      ipfsData = await uploadToIPFS(pdfBuffer, `cert_${generationId}.pdf`);
      const ipfsTime = ((Date.now() - ipfsStartTime) / 1000).toFixed(2);
      console.log(`✅ [${generationId}] IPFS upload completed in ${ipfsTime}s`);
      console.log(`   📦 IPFS Hash: ${ipfsData.ipfsHash}`);
    } catch (ipfsError) {
      console.error(`❌ [${generationId}] IPFS upload failed:`, ipfsError.message);
      return res.status(500).json({
        error: {
          code: 'IPFS_UPLOAD_FAILED',
          message: 'Failed to upload certificate to IPFS',
          details: ipfsError.message
        },
        meta: certificateData
      });
    }

    let tx = null;

    console.log(`\n⛓️  [${generationId}] STEP 4/4: Registering on blockchain...`);
    const blockchainStartTime = Date.now();
    
    try {
      const contractInstance = getContract();
      const web3Instance = getWeb3();
      const accounts = await web3Instance.eth.getAccounts();

      const txRequest = {
        to: contractInstance.options.address,
        data: contractInstance.methods
          .generateCertificate(
            certificateId,
            metadata.referenceId,
            candidateName,
            courseName,
            metadata.institutionName,
            additionalMetadata.issuedDate,
            additionalMetadata.institutionLogo,
            additionalMetadata.generationDate,
            "pending",
            additionalMetadata.cryptographicSignature,
            ipfsData.ipfsHash
          )
          .encodeABI(),
      };

      const cost = await estimateCost(txRequest);
      console.log(`   ⛽ Gas: ${cost.gasLimit} units | Cost: ${cost.costEth.toFixed(6)} ETH (₹${cost.costInr.toFixed(2)})`);

      tx = await contractInstance.methods
        .generateCertificate(
          certificateId,
          metadata.referenceId,
          candidateName,
          courseName,
          metadata.institutionName,
          additionalMetadata.issuedDate,
          additionalMetadata.institutionLogo,
          additionalMetadata.generationDate,
          "pending",
          additionalMetadata.cryptographicSignature,
          ipfsData.ipfsHash
        )
        .send({ from: accounts[0], gas: 1000000 });

      const blockchainTime = ((Date.now() - blockchainStartTime) / 1000).toFixed(2);
      console.log(`✅ [${generationId}] Blockchain registration completed in ${blockchainTime}s`);
      console.log(`   🔗 TX Hash: ${tx.transactionHash}`);
      console.log(`   📦 Block: ${tx.blockNumber}`);

      certificateData.blockchainTx = tx.transactionHash;
      certificateData.blockchainTxId = tx.transactionHash;
      certificateData.blockNumber = tx.blockNumber;

    } catch (blockchainError) {
      console.error(`❌ [${generationId}] Blockchain registration failed:`, blockchainError.message);
      return res.status(500).json({
        error: {
          code: 'BLOCKCHAIN_REGISTRATION_FAILED',
          message: 'Failed to register certificate on blockchain',
          details: blockchainError.message
        },
        meta: certificateData
      });
    }

    console.log(`\n💾 [${generationId}] STEP 5/5: Saving to database...`);
    try {
      const newCertificate = await Certificate.create({
        certificateId,
        verificationCode,
        referenceId: metadata.referenceId,
        candidateName,
        courseName,
        institutionName: metadata.institutionName,
        issuedDate: additionalMetadata.issuedDate,
        institutionLogo: additionalMetadata.institutionLogo,
        generationDate: additionalMetadata.generationDate,
        blockchainTxId: tx?.transactionHash || '',
        cryptographicSignature: additionalMetadata.cryptographicSignature,
        institutionalSignature: additionalMetadata.institutionalSignature,
        issuer: req.user?.id,
        recipientEmail: recipientEmail,
        gpa: gpa !== undefined ? parseFloat(gpa) : undefined,
        ipfsHash: ipfsData.ipfsHash,
        sha256Hash: ipfsData.sha256Hash,
        cidHash: ipfsData.cidHash,
        blockchainTx: tx?.transactionHash,
        status: 'PENDING'
      });

      console.log(`✅ [${generationId}] Saved to database with ID: ${newCertificate._id}`);
    } catch (dbError) {
      console.error(`❌ [${generationId}] Database save failed:`, dbError.message);
      return res.status(500).json({
        error: {
          code: 'DATABASE_SAVE_FAILED',
          message: 'Failed to save certificate to database',
          details: dbError.message
        },
        meta: certificateData
      });
    }

    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎉 [${generationId}] CERTIFICATE GENERATED SUCCESSFULLY`);
    console.log(`${'='.repeat(70)}`);
    console.log(`⏱️  Total Time: ${processingTime}s`);
    console.log(`📋 Certificate ID: ${certificateId}`);
    console.log(`🔐 Verification Code: ${verificationCode}`);
    console.log(`${'='.repeat(70)}\n`);

    await logActivity({
      userId: req.user?.id,
      type: 'CERTIFICATE_GENERATED',
      description: `Certificate generated for ${candidateName} — ${courseName}`,
      meta: { certificateId, candidateName, courseName, institutionName: metadata.institutionName, verificationCode, recipientEmail: recipientEmail || null, transactionHash: tx?.transactionHash || null },
      req
    });

    let emailSent = false;
    if (recipientEmail) {
      try {
        const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(':3000', ':5173');
        const verificationUrl = `${baseUrl}/verify?code=${verificationCode}&auto=true`;
        const certLink = `${PINATA_GATEWAY_BASE_URL}/ipfs/${ipfsData.ipfsHash}`;
        const emailResult = await sendCertificateEmail(
          recipientEmail,
          candidateName,
          courseName,
          certLink,
          verificationUrl,
          {
            certificateId,
            institutionName: metadata.institutionName,
            issuedDate: additionalMetadata.issuedDate,
            verificationCode,
            certificateType: req.body.certificateType || 'ACHIEVEMENT',
            gpa: gpa != null ? parseFloat(gpa) : null
          }
        );
        emailSent = emailResult.success;
        if (emailSent) {
          await Certificate.findOneAndUpdate({ certificateId }, { emailSent: true, emailSentAt: new Date() });
          console.log(`[${generationId}] Certificate email sent to ${recipientEmail}`);
        } else {
          console.warn(`[${generationId}] Certificate email failed: ${emailResult.error}`);
        }
      } catch (emailError) {
        console.error(`[${generationId}] Email error:`, emailError.message);
      }
    }

    return res.status(201).json({
      success: true,
      status: "SUCCESS",
      message: "Certificate generated and registered successfully",
      data: {
        certificateId,
        referenceId: metadata.referenceId,
        verificationCode,
        sha256Hash: ipfsData.sha256Hash,
        ipfsHash: ipfsData.ipfsHash,
        cidHash: ipfsData.cidHash,
        transaction: {
          hash: certificateData.blockchainTx,
          block: certificateData.blockNumber,
          confirmations: 1
        },
        verificationUrl: `/api/certificates/${certificateId}/verify`,
        ipfsGateway: `${PINATA_GATEWAY_BASE_URL}/ipfs/${ipfsData.ipfsHash}`,
        emailSent,
        computedHashes: {
          sha256Hash: ipfsData.sha256Hash,
          cidHash: ipfsData.cidHash,
          ipfsHash: ipfsData.ipfsHash
        }
      },
      _links: {
        self: `/api/certificates/generate`,
        certificate: `/api/certificates/${certificateId}`,
        verification: `/api/certificates/${certificateId}/verify`,
        shortCode: `/api/certificates/code/${verificationCode}`,
        transaction: `https://etherscan.io/tx/${certificateData.blockchainTx}`
      },
      meta: {
        generationId,
        processingTime: `${processingTime}s`,
        blockchain: {
          network: process.env.NETWORK || 'development',
          contract: process.env.CONTRACT_ADDRESS
        }
      }
    });
  } catch (error) {
    console.error(`[${generationId}] Critical failure:`, error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected system failure',
        details: error.message
      },
      meta: { generationId }
    });
  }
};

export const uploadExternalCertificate = async (req, res) => {
  const uploadId = crypto.randomBytes(4).toString('hex');
  console.log(`[${uploadId}] Processing external certificate upload`);

  try {
    if (!req.file) {
      console.log(`[${uploadId}] No file uploaded`);
      return res.status(400).json({
        code: 'MISSING_FILE',
        message: 'No PDF file uploaded',
        uploadId
      });
    }

    const {
      orgName,
      candidateName,
      courseName,
      validUntil,
      certificateType = "",
      referenceId,
      recipientEmail,
      additionalFields = {}
    } = req.body;

    if (!orgName || !candidateName) {
      console.log(`[${uploadId}] Missing required fields: orgName=${orgName}, candidateName=${candidateName}`);
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Organization name and candidate name are required',
        uploadId
      });
    }

    if (recipientEmail && !recipientEmail.match(/\S+@\S+\.\S+/)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid recipient email address',
          fields: ['recipientEmail']
        },
        meta: { uploadId }
      });
    }

    const validCertTypes = ["ACHIEVEMENT", "COMPLETION", "PARTICIPATION"];
    let finalCertificateType = (certificateType || "").toUpperCase();
    if (certificateType && !validCertTypes.includes(finalCertificateType)) {
      finalCertificateType = "ACHIEVEMENT";
    }
    if (certificateType) {
      console.log(`[${uploadId}] Certificate type: ${finalCertificateType}`);
    }

    const pdfBuffer = req.file.buffer;
    console.log(`[${uploadId}] PDF received, size: ${pdfBuffer.length} bytes`);

    let hashData;
    try {
      hashData = await uploadToIPFS(pdfBuffer, req.file.originalname);
      const { sha256Hash, cidHash, ipfsHash } = hashData;
      console.log(`[${uploadId}] Computed hashes:`, { sha256Hash, cidHash, ipfsHash });
    } catch (ipfsError) {
      console.error(`[${uploadId}] IPFS upload failed:`, ipfsError);
      return res.status(500).json({
        code: 'IPFS_ERROR',
        message: 'Failed to upload to IPFS',
        uploadId,
        details: ipfsError.message
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        code: 'UNAUTHENTICATED',
        message: 'A signed-in institute account is required to upload certificates',
        uploadId
      });
    }

    const signingInstitute = await User.findWithKeys(req.user.id);
    if (!signingInstitute?.privateKey) {
      console.error(`[${uploadId}] Institute ${req.user.id} has no private key on file`);
      return res.status(500).json({
        code: 'SIGNING_KEY_MISSING',
        message: 'Institute account is missing its signing key. Please reload your profile page to have one generated, then try again.',
        uploadId
      });
    }

    const uid = crypto.randomBytes(16).toString('hex');
    const issuedDate = new Date().toISOString();
    const generationDate = new Date().toISOString();

    const certificateId = generateCertificateHash(
      uid,
      candidateName,
      courseName || 'External Certificate',
      orgName,
      issuedDate
    );
    console.log(`[${uploadId}] Generated certificateId: ${certificateId}`);

    const dataToSign = buildSigningPayload(
      certificateId,
      referenceId || uid,
      candidateName,
      orgName,
      issuedDate,
      req.user.id
    );
    // Real institutional signature: RSA-SHA256 signed with the institute's own private key.
    const institutionalSignature = await signingInstitute.signData(dataToSign);
    // Non-authoritative content fingerprint kept for display only.
    const digitalSignature = crypto.createHash('sha256').update(dataToSign).digest('hex');

    const shortCode = generateVerificationShortCode();
    console.log(`[${uploadId}] Generated short code: ${shortCode}`);

    let tx = null;
    try {
      const contractInstance = getContract();
      const web3Instance = getWeb3();
      const accounts = await web3Instance.eth.getAccounts();
      console.log(`[${uploadId}] Using account for transaction: ${accounts[0]}`);

      tx = await contractInstance.methods
        .generateCertificate(
          certificateId,
          uid,
          candidateName,
          courseName || 'External Certificate',
          orgName,
          issuedDate,
          '',
          generationDate,
          'pending',
          digitalSignature,
          hashData.ipfsHash
        )
        .send({ from: accounts[0], gas: 1000000 });

      console.log(`[${uploadId}] Certificate stored on blockchain: ${tx.transactionHash}`);
    } catch (blockchainError) {
      console.error(`[${uploadId}] Blockchain storage failed:`, blockchainError);
      return res.status(500).json({
        code: 'BLOCKCHAIN_ERROR',
        message: 'Failed to store certificate on blockchain',
        uploadId,
        details: blockchainError.message
      });
    }

    try {
      const newCertificate = await Certificate.create({
        certificateId,
        verificationCode: shortCode,
        uid,
        referenceId: referenceId || uid,
        candidateName,
        courseName: courseName || 'External Certificate',
        institutionName: orgName,
        issuer: req.user?.id,
        issuedDate,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        generationDate,
        blockchainTxId: tx?.transactionHash,
        cryptographicSignature: digitalSignature,
        institutionalSignature,
        recipientEmail: recipientEmail,
        ipfsHash: hashData.ipfsHash,
        sha256Hash: hashData.sha256Hash,
        cidHash: hashData.cidHash,
        blockchainTx: tx?.transactionHash,
        shortCode,
        source: 'external',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        additionalMetadata: additionalFields
      });

      console.log(`[${uploadId}] External certificate saved to database with ID: ${newCertificate._id}`);

      await logActivity({
        userId: req.user?.id,
        type: 'DOCUMENT_SIGNED',
        description: `Document signed on blockchain for ${candidateName}`,
        meta: { certificateId, candidateName, courseName: courseName || 'External Certificate', institutionName: orgName, shortCode, recipientEmail: recipientEmail || null, transactionHash: tx?.transactionHash || null },
        req
      });

      let emailSent = false;
      if (recipientEmail) {
        try {
          const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(':3000', ':5173');
          const verificationUrl = `${baseUrl}/verify?code=${shortCode}&auto=true`;
          const certLink = `${PINATA_GATEWAY_BASE_URL}/ipfs/${hashData.ipfsHash}`;
          const emailResult = await sendCertificateEmail(
            recipientEmail,
            candidateName,
            courseName || 'External Certificate',
            certLink,
            verificationUrl,
            {
              certificateId,
              institutionName: orgName,
              issuedDate,
              verificationCode: shortCode,
              certificateType: finalCertificateType || 'ACHIEVEMENT',
              gpa: req.body.gpa != null ? parseFloat(req.body.gpa) : null
            }
          );
          emailSent = emailResult.success;
          if (emailSent) {
            await Certificate.findOneAndUpdate({ certificateId }, { emailSent: true, emailSentAt: new Date() });
            console.log(`[${uploadId}] Certificate email sent to ${recipientEmail}`);
          } else {
            console.warn(`[${uploadId}] Certificate email failed: ${emailResult.error}`);
          }
        } catch (emailError) {
          console.error(`[${uploadId}] Email error:`, emailError.message);
        }
      }

      return res.status(201).json({
        success: true,
        status: 'SUCCESS',
        message: 'Certificate uploaded and verified successfully',
        data: {
          certificateId,
          referenceId: referenceId || uid,
          shortCode,
          verificationCode: shortCode,
          verificationUrl: `/api/certificates/${certificateId}/verify`,
          ipfsGateway: `${PINATA_GATEWAY_BASE_URL}/ipfs/${hashData.ipfsHash}`,
          transaction: tx ? {
            hash: tx.transactionHash,
            block: tx.blockNumber
          } : null,
          emailSent: emailSent || false,
          computedHashes: {
            sha256Hash: hashData.sha256Hash,
            cidHash: hashData.cidHash,
            ipfsHash: hashData.ipfsHash
          },
          metadata: {
            candidateName,
            courseName: courseName || 'External Certificate',
            institutionName: orgName,
            certificateType: finalCertificateType || undefined,
            validUntil: validUntil || undefined
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      console.error(`[${uploadId}] Database sync failed:`, dbError);

      return res.status(201).json({
        success: true,
        status: 'SUCCESS_WITH_WARNING',
        message: 'Certificate uploaded but database sync failed',
        data: {
          certificateId,
          referenceId: referenceId || uid,
          shortCode,
          verificationCode: shortCode,
          verificationUrl: `/api/certificates/${certificateId}/verify`,
          ipfsGateway: `${PINATA_GATEWAY_BASE_URL}/ipfs/${hashData.ipfsHash}`,
          transaction: tx ? {
            hash: tx.transactionHash,
            block: tx.blockNumber
          } : null,
          emailSent: false,
          computedHashes: {
            sha256Hash: hashData.sha256Hash,
            cidHash: hashData.cidHash,
            ipfsHash: hashData.ipfsHash
          },
          metadata: {
            candidateName,
            courseName: courseName || 'External Certificate',
            institutionName: orgName,
            certificateType: finalCertificateType || undefined,
            validUntil: validUntil || undefined
          }
        },
        warning: 'Certificate exists on blockchain but may not be retrievable from database',
        warningDetails: process.env.NODE_ENV === 'development' ? dbError.message : 'Database sync failed',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error(`[${uploadId}] Unhandled upload error:`, error);
    console.error(`[${uploadId}] Error stack:`, error.stack);

    return res.status(500).json({
      success: false,
      status: 'ERROR',
      code: 'UPLOAD_FAILED',
      message: 'Failed to store external certificate',
      requestId: uploadId,
      details: process.env.NODE_ENV === 'development' ? {
        error: error.message,
        stack: error.stack
      } : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

// Certificate Verification
export const verifyCertificateById = async (req, res) => {
  const { certificateId } = req.params;
  const verificationId = crypto.randomBytes(4).toString('hex');

  console.log(`[${verificationId}] Verifying certificate by ID: ${certificateId}`);

  try {
    const certificate = await Certificate.findOne({ certificateId });

    if (certificate) {
      console.log(`[${verificationId}] Certificate found in database: ${certificate._id}`);

      try {
        const contractInstance = getContract();
        const blockchainData = await contractInstance.methods.getCertificate(certificateId).call();
        console.log(`[${verificationId}] Blockchain data:`, blockchainData);

        const parsedData = parseCertificateData(blockchainData);

        return res.json({
          status: 'VALID',
          certificate: {
            uid: certificate.uid,
            certificateId: certificate.certificateId,
            candidateName: certificate.candidateName,
            courseName: certificate.courseName,
            orgName: certificate.orgName,
            issuedDate: certificate.issuedDate,
            generationDate: certificate.generationDate,
            transactionId: certificate.transactionId,
            digitalSignature: certificate.digitalSignature,
            ipfsHash: certificate.ipfsHash,
            timestamp: parsedData.timestamp,
            revoked: parsedData.revoked
          },
          verificationId,
          _links: {
            pdf: `https://gateway.pinata.cloud/ipfs/${certificate.ipfsHash}`,
            blockchain: `${BLOCK_EXPLORER_URL}/tx/${certificate.blockchainTx}`
          }
        });
      } catch (blockchainError) {
        console.error(`[${verificationId}] Blockchain verification failed:`, blockchainError);

        return res.status(200).json({
          status: 'VALID_WITH_WARNING',
          certificate: {
            uid: certificate.uid,
            certificateId: certificate.certificateId,
            candidateName: certificate.candidateName,
            courseName: certificate.courseName,
            orgName: certificate.orgName,
            issuedDate: certificate.issuedDate,
            generationDate: certificate.generationDate,
            transactionId: certificate.transactionId,
            digitalSignature: certificate.digitalSignature,
            ipfsHash: certificate.ipfsHash
          },
          verificationId,
          warning: 'Certificate found in database but blockchain verification failed',
          blockchainError: blockchainError.message,
          _links: {
            pdf: `https://gateway.pinata.cloud/ipfs/${certificate.ipfsHash}`
          }
        });
      }
    }

    console.log(`[${verificationId}] Certificate not found in database, checking blockchain`);

    try {
      const contractInstance = getContract();
      const blockchainData = await contractInstance.methods.getCertificate(certificateId).call();
      console.log(`[${verificationId}] Certificate found on blockchain:`, blockchainData);

      const parsedData = parseCertificateData(blockchainData);

      return res.json({
        status: 'VALID',
        certificate: {
          ...parsedData,
          certificateId
        },
        verificationId,
        warning: 'Certificate verified on blockchain but not found in database',
        _links: {
          pdf: `https://gateway.pinata.cloud/ipfs/${parsedData.ipfsHash}`
        }
      });
    } catch (blockchainError) {
      console.error(`[${verificationId}] Blockchain verification failed:`, blockchainError);

      return res.status(404).json({
        status: 'INVALID',
        code: 'CERTIFICATE_NOT_FOUND',
        message: 'Certificate not found in database or blockchain',
        verificationId,
        certificateId
      });
    }
  } catch (error) {
    console.error(`[${verificationId}] Verification error:`, error);

    return res.status(500).json({
      status: 'ERROR',
      code: 'VERIFICATION_FAILED',
      message: 'Failed to verify certificate',
      verificationId,
      certificateId,
      details: error.message
    });
  }
};

export const verifyCertificatePdf = async (req, res) => {
  const verificationId = crypto.randomBytes(4).toString('hex');

  try {
    if (!req.file) {
      console.log(`[${verificationId}] No file uploaded for verification`);
      const { response, statusCode } = errorResponse(
        'MISSING_REQUIRED_FIELD',
        'No PDF file uploaded',
        null,
        verificationId
      );
      return res.status(statusCode).json(response);
    }

    const fileInfo = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      fieldname: req.file.fieldname
    };

    console.log(`[${verificationId}] Verifying PDF: ${fileInfo.originalName} (${fileInfo.size} bytes), field: ${fileInfo.fieldname}`);

    const pdfBuffer = req.file.buffer;
    const { sha256Hash, cidHash } = await computePDFHashes(pdfBuffer);

    console.log(`[${verificationId}] Computed SHA-256 hash: ${sha256Hash}`);
    console.log(`[${verificationId}] Computed CID hash: ${cidHash}`);

    const hashResult = await findCertificateByHash(sha256Hash, cidHash);
    let certificate = hashResult.certificate;
    let matchType = hashResult.matchType || 'exact_match';

    if (!certificate) {
      const { response, statusCode } = errorResponse(
        'CERTIFICATE_NOT_FOUND',
        'Certificate not found in our records',
        {
          computedHash: sha256Hash,
          cidHash
        },
        verificationId
      );
      return res.status(statusCode).json(response);
    }

    const status = certificate.revoked ? 'REVOKED' : 'VALID';

    return res.json(verificationResponse(
      status,
      {
        certificateId: certificate.certificateId,
        candidateName: certificate.candidateName,
        courseName: certificate.courseName,
        orgName: certificate.orgName,
        issuedAt: certificate.createdAt,
        ipfsHash: certificate.ipfsHash,
        shortCode: certificate.shortCode,
        verificationCode: certificate.verificationCode || certificate.shortCode,
        gpa: certificate.gpa ?? null,
        recipientEmail: certificate.recipientEmail || ''
      },
      verificationId,
      {
        verification: `/api/certificates/${certificate.certificateId}/verify`,
        pdf: `/api/certificates/${certificate.certificateId}/pdf`,
        blockchain: `/api/certificates/${certificate.certificateId}/blockchain`
      },
      {
        computedHash: sha256Hash,
        cidHash,
        matchType
      }
    ));
  } catch (error) {
    console.error(`[${verificationId}] PDF Verification Error:`, error);
    const { response, statusCode } = errorResponse(
      'VERIFICATION_FAILED',
      'Failed to verify certificate PDF',
      { errorDetails: error.message },
      verificationId
    );
    return res.status(statusCode).json(response);
  }
};

export const debugPdfVerification = async (req, res) => {
  const debugId = crypto.randomBytes(4).toString('hex');

  try {
    if (!req.file) {
      const { response, statusCode } = errorResponse(
        'MISSING_REQUIRED_FIELD',
        'No PDF file uploaded',
        null,
        debugId
      );
      return res.status(statusCode).json(response);
    }

    const fileInfo = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    };

    console.log(`[${debugId}] Debugging PDF: ${fileInfo.originalName} (${fileInfo.size} bytes)`);

    const pdfBuffer = req.file.buffer;
    const { sha256Hash, cidHash } = await computePDFHashes(pdfBuffer);

    console.log(`[${debugId}] Computed SHA-256 hash: ${sha256Hash}`);
    console.log(`[${debugId}] Computed CID hash: ${cidHash}`);

    const allCertificates = await Certificate.find({});
    console.log(`[${debugId}] Found ${allCertificates.length} certificates in database`);

    const matches = [];

    for (const cert of allCertificates) {
      if (cert.sha256Hash === sha256Hash) {
        matches.push({ certificateId: cert.certificateId, matchType: 'exact_sha256', hash: cert.sha256Hash });
      }
      if (cert.cidHash === cidHash) {
        matches.push({ certificateId: cert.certificateId, matchType: 'exact_cid', hash: cert.cidHash });
      }
      if (cert.ipfsHash === sha256Hash) {
        matches.push({ certificateId: cert.certificateId, matchType: 'exact_ipfs_sha256', hash: cert.ipfsHash });
      }
      if (cert.ipfsHash === cidHash) {
        matches.push({ certificateId: cert.certificateId, matchType: 'exact_ipfs_cid', hash: cert.ipfsHash });
      }
    }

    for (const cert of allCertificates) {
      if (cert.sha256Hash && (cert.sha256Hash.includes(sha256Hash) || sha256Hash.includes(cert.sha256Hash))) {
        matches.push({ certificateId: cert.certificateId, matchType: 'partial_sha256', hash: cert.sha256Hash });
      }
      if (cert.cidHash && cidHash && (cert.cidHash.includes(cidHash) || cidHash.includes(cert.cidHash))) {
        matches.push({ certificateId: cert.certificateId, matchType: 'partial_cid', hash: cert.cidHash });
      }
      if (cert.ipfsHash && (cert.ipfsHash.includes(sha256Hash) || sha256Hash.includes(cert.ipfsHash))) {
        matches.push({ certificateId: cert.certificateId, matchType: 'partial_ipfs_sha256', hash: cert.ipfsHash });
      }
      if (cert.ipfsHash && cidHash && (cert.ipfsHash.includes(cidHash) || cidHash.includes(cert.ipfsHash))) {
        matches.push({ certificateId: cert.certificateId, matchType: 'partial_ipfs_cid', hash: cert.ipfsHash });
      }
    }

    if (/^[a-f0-9]{64}$/i.test(sha256Hash)) {
      const certById = allCertificates.find(cert => cert.certificateId === sha256Hash);
      if (certById) {
        matches.push({ certificateId: certById.certificateId, matchType: 'certificate_id', hash: certById.ipfsHash });
      }
    }

    return res.status(200).json(successResponse({
      fileInfo,
      hashes: { sha256Hash, cidHash },
      matches
    }, 'PDF verification debug information', 200));

  } catch (error) {
    console.error(`[${debugId}] Debug Error:`, error);
    const { response, statusCode } = errorResponse(
      'INTERNAL_ERROR',
      'Failed to process PDF for debugging',
      { errorDetails: error.message },
      debugId
    );
    return res.status(statusCode).json(response);
  }
};

// Certificate Retrieval
export const getCertificatePDF = async (req, res) => {
  const { certificateId } = req.params;
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    if (!/^[a-f0-9]{64}$/i.test(certificateId)) {
      const { response, statusCode } = errorResponse(
        'INVALID_FORMAT',
        'Certificate ID must be 64-character hexadecimal string',
        { certificateId, example: '817759607228da54a922e4160f9d1b8f646e02360fc0f08372063510e87a45d6' },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    const contractInstance = getContract();
    const certificateData = await contractInstance.methods.getCertificate(certificateId).call();

    const ipfsHash = (
      certificateData[4] ||
      certificateData.ipfsHash ||
      certificateData._ipfs_hash ||
      certificateData.ipfs
    )?.trim();

    if (!ipfsHash) {
      const { response, statusCode } = errorResponse(
        'NOT_FOUND',
        'No IPFS hash associated with certificate',
        { certificateId, resolution: 'Regenerate certificate with valid PDF upload' },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    try {
      const cid = CID.parse(ipfsHash);
      console.log('Valid CID:', { version: cid.version, codec: cid.code, type: cid.type });
    } catch (e) {
      const { response, statusCode } = errorResponse(
        'INVALID_FORMAT',
        'Malformed IPFS Content Identifier',
        { certificateId, ipfsHash, documentation: 'https://docs.ipfs.tech/concepts/content-addressing/' },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    const pdfUrl = `${PINATA_GATEWAY_BASE_URL}/${ipfsHash}`;
    res
      .set({
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000',
        'Content-Security-Policy': "default-src 'none'",
        'X-Content-Type-Options': 'nosniff',
        'Link': `<${pdfUrl}>; rel="canonical"`
      })
      .redirect(301, pdfUrl);

  } catch (error) {
    console.error(`[${requestId}] PDF Retrieval Error:`, error);
    const { response, statusCode } = errorResponse(
      'INTERNAL_ERROR',
      'Failed to retrieve certificate PDF',
      {
        certificateId,
        errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      requestId
    );
    return res.status(statusCode).json(response);
  }
};

export const getCertificateMetadata = async (req, res) => {
  const { certificateId } = req.params;
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    if (!/^[a-f0-9]{64}$/i.test(certificateId)) {
      const { response, statusCode } = errorResponse(
        'INVALID_FORMAT',
        'Certificate ID must be 64-character hexadecimal string',
        { certificateId, example: '817759607228da54a922e4160f9d1b8f646e02360fc0f08372063510e87a45d6' },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    const certificate = await Certificate.findOne({ certificateId });

    if (!certificate) {
      const { response, statusCode } = errorResponse(
        'CERTIFICATE_NOT_FOUND',
        'Certificate not found in database',
        { certificateId },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    return res.json(successResponse({
      certificateId: certificate.certificateId,
      candidateName: certificate.candidateName,
      courseName: certificate.courseName,
      orgName: certificate.orgName,
      issueDate: certificate.createdAt,
      hashes: {
        ipfsHash: certificate.ipfsHash,
        sha256Hash: certificate.sha256Hash,
        cidHash: certificate.cidHash
      },
      shortCode: certificate.shortCode,
      status: certificate.revoked ? 'REVOKED' : 'VALID',
      _links: {
        verification: `/api/certificates/${certificateId}/verify`,
        shortCodeVerification: `/api/certificates/code/${certificate.shortCode}`,
        pdf: `/api/certificates/${certificateId}/pdf`,
        blockchain: `/api/certificates/${certificateId}/blockchain`
      }
    }, 'Certificate metadata retrieved successfully'));
  } catch (error) {
    console.error(`[${requestId}] Metadata Retrieval Error:`, error);
    const { response, statusCode } = errorResponse(
      'INTERNAL_ERROR',
      'Failed to retrieve certificate metadata',
      {
        certificateId,
        errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      requestId
    );
    return res.status(statusCode).json(response);
  }
};

export const searchByCID = async (req, res) => {
  const { cid } = req.params;
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    const certificate = await findCertificateByAnyHash(cid);

    if (!certificate) {
      const { response, statusCode } = errorResponse(
        'CERTIFICATE_NOT_FOUND',
        'No certificate found with this identifier',
        { searchValue: cid, tip: 'Try searching with the IPFS hash (starts with Qm) or the certificate ID' },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    let isValid = false;
    let blockchainError = null;

    try {
      const contractInstance = getContract();
      isValid = await contractInstance.methods.isVerified(certificate.certificateId).call();
    } catch (error) {
      console.error(`[${requestId}] Blockchain verification error:`, error);
      blockchainError = error.message;
    }

    const status = certificate.revoked ? 'REVOKED' : (isValid ? 'VALID' : 'VALID_WITH_WARNING');
    const blockchainData = blockchainError ?
      { blockchainError, errorDetails: blockchainError } :
      { blockchainVerified: isValid };

    return res.json(verificationResponse(
      status,
      {
        certificateId: certificate.certificateId,
        candidateName: certificate.candidateName,
        courseName: certificate.courseName,
        orgName: certificate.orgName,
        issuedAt: certificate.createdAt,
        ipfsHash: certificate.ipfsHash,
        shortCode: certificate.shortCode,
        revoked: certificate.revoked || false
      },
      requestId,
      {
        verification: `/api/certificates/${certificate.certificateId}/verify`,
        pdf: `https://gateway.pinata.cloud/ipfs/${certificate.ipfsHash}`,
        blockchain: `http://localhost:8545/tx/${certificate.transactionHash || certificate.certificateId}`
      },
      blockchainData
    ));

  } catch (error) {
    console.error(`[${requestId}] Search Error:`, error);
    const { response, statusCode } = errorResponse(
      'INTERNAL_ERROR',
      'Failed to search for certificate',
      {
        searchValue: cid,
        errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      requestId
    );
    return res.status(statusCode).json(response);
  }
};

// Certificate Management
export const getCertificateStats = async (req, res) => {
  try {
    if (statsCache && statsCache.has('latest')) {
      const { timestamp, data } = statsCache.get('latest');
      if (Date.now() - timestamp < 60000) {
        return res.json(data);
      }
    }

    const stats = await Certificate.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          // $exists is a query-language operator; it isn't valid inside an aggregation
          // $cond expression, so this threw (or silently misbehaved depending on Mongo
          // version) instead of counting anything. $ifNull correctly treats a missing/null
          // field as "not present".
          internal: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$certificateId", null] }, null] }, 1, 0] } },
          external: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$cid", null] }, null] }, 1, 0] } },
          organizations: { $addToSet: "$orgName" }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          internal: 1,
          external: 1,
          organizations: { $size: "$organizations" }
        }
      }
    ]);

    const result = stats[0] || { total: 0, internal: 0, external: 0, organizations: 0 };
    if (statsCache) {
      statsCache.set('latest', { timestamp: Date.now(), data: result });
    }

    res.json(result);

  } catch (error) {
    res.status(500).json({
      code: 'STATS_ERROR',
      message: 'Failed to fetch statistics',
      details: error.message
    });
  }
};

export const getOrgCertificates = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const institutionName = req.params.institutionName || req.params.orgName;
  const limit = parseInt(req.query.limit) || 10;

  // An institute should only be able to list its own certificates, not any
  // institution's, by swapping the URL param. (Admins, once an ADMIN role
  // exists, would be exempt from this check.)
  if (req.user?.role !== 'ADMIN' &&
      req.user?.institutionName?.trim().toLowerCase() !== institutionName?.trim().toLowerCase()) {
    return res.status(403).json({
      success: false,
      status: 'ERROR',
      code: 'FORBIDDEN',
      message: 'You are not authorized to view another institution\'s certificates'
    });
  }

  try {
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safePattern = new RegExp(`^${escapeRegex(institutionName)}$`, 'i');
    const query = {
      $or: [
        { institutionName: safePattern },
        { orgName: safePattern }
      ]
    };

    const [certificates, count] = await Promise.all([
      Certificate.find(query)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Certificate.countDocuments(query)
    ]);

    res.json({
      success: true,
      status: "SUCCESS",
      message: "Institution certificates retrieved",
      data: {
        institution: institutionName,
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        certificates: certificates.map(cert => ({
          certificateId: cert.certificateId || cert.cid,
          candidateName: cert.candidateName,
          courseName: cert.courseName,
          issuedDate: cert.createdAt,
          verificationCode: cert.verificationCode || cert.shortCode,
          status: cert.revoked ? "REVOKED" : "VALID"
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      status: "ERROR",
      code: 'INSTITUTION_CERTS_ERROR',
      message: 'Failed to fetch institution certificates',
      details: { institutionName, errorDetails: error.message },
      timestamp: new Date().toISOString()
    });
  }
};

// NOTE: institutional signature verification lives in verification.controller.js
// (that is the function actually wired into routes/certificate.routes.js).
// A second, stub copy used to live here returning SIGNATURE_VALID unconditionally;
// it has been removed so it can never be mistakenly wired up again.

export const serveCertificatePDF = async (req, res) => {
  const { certificateId } = req.params;
  const requestId = crypto.randomBytes(4).toString('hex');
  const isDownload = req.query.download === 'true';

  console.log(`[${requestId}] PDF request for ${certificateId}, download=${isDownload}`);

  try {
    if (!/^[a-f0-9]{64}$/i.test(certificateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid certificate ID format',
        details: 'Certificate ID must be a 64-character hexadecimal string'
      });
    }

    const certificate = await Certificate.findOne({ certificateId });
    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found', certificateId });
    }

    if (!certificate.ipfsHash) {
      return res.status(404).json({ success: false, message: 'Certificate has no associated PDF', certificateId });
    }

    const ipfsUrl = `${PINATA_GATEWAY_BASE_URL}/${certificate.ipfsHash}`;
    console.log(`[${requestId}] Redirecting to IPFS: ${ipfsUrl}`);

    if (isDownload) {
      const filename = `certificate-${certificate.shortCode || certificate.certificateId.substring(0, 8)}.pdf`;
      return res.set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }).send(`
        <html>
          <head>
            <title>Downloading Certificate</title>
            <script>
              window.onload = function() {
                const link = document.createElement('a');
                link.href = "${ipfsUrl}";
                link.download = "${filename}";
                document.body.appendChild(link);
                link.click();
                setTimeout(function() { window.close(); }, 1000);
              }
            </script>
          </head>
          <body>
            <p>Your download should start automatically. If not, <a href="${ipfsUrl}" download="${filename}">click here</a>.</p>
          </body>
        </html>
      `);
    } else {
      return res.redirect(ipfsUrl);
    }

  } catch (error) {
    console.error(`[${requestId}] Error serving PDF:`, error);
    return res.status(500).json({ success: false, message: 'Failed to serve certificate PDF', details: error.message });
  }
};

// Get certificates by recipient email
// Get certificates by recipient email
export const getCertificatesByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const requestId = crypto.randomBytes(4).toString('hex');

    if (!email || !email.match(/\S+@\S+\.\S+/)) {
      const { response, statusCode } = errorResponse(
        'INVALID_EMAIL',
        'Invalid email format',
        { email },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    const certificates = await Certificate.find({ recipientEmail: email })
      .sort({ createdAt: -1 })
      .lean();

    if (!certificates || certificates.length === 0) {
      return res.status(200).json(successResponse({
        certificates: [],
        count: 0
      }, 'No certificates found for this email'));
    }

    // Cross-check against the blockchain before trusting the DB record.
    // A certificate row can outlive its on-chain record (e.g. a dev-chain
    // reset, or the contract being redeployed), and without this check
    // those stale rows would be returned here as if they were still valid.
    let contractInstance = null;
    try {
      contractInstance = getContract();
    } catch (e) {
      console.warn(`[${requestId}] Blockchain contract unavailable, skipping on-chain existence check:`, e.message);
    }

    const candidates = certificates.filter(cert => !cert.revoked && cert.status !== 'FAILED');

    const existenceChecks = contractInstance
      ? await Promise.all(candidates.map(async (cert) => {
          try {
            const exists = await contractInstance.methods.isVerified(cert.certificateId).call();
            return { cert, exists };
          } catch (chainErr) {
            console.warn(`[${requestId}] On-chain check failed for ${cert.certificateId}, excluding from results:`, chainErr.message);
            return { cert, exists: false };
          }
        }))
      : candidates.map(cert => ({ cert, exists: true })); // if the chain is unreachable, fall back to DB-only rather than hiding everything

    const liveCertificates = existenceChecks
      .filter(({ exists }) => exists)
      .map(({ cert }) => cert);

    const formattedCertificates = liveCertificates
      .map(cert => ({
        certificateId: cert.certificateId,
        verificationCode: cert.verificationCode,
        candidateName: cert.candidateName,
        courseName: cert.courseName,
        institutionName: cert.institutionName,
        issuedDate: cert.issuedDate,
        gpa: cert.gpa ?? null,
        recipientEmail: cert.recipientEmail || '',
        status: cert.status,
        createdAt: cert.createdAt,
        _links: {
          pdf: `${PINATA_GATEWAY_BASE_URL}/${cert.ipfsHash}`
        }
      }));

    return res.status(200).json(successResponse({
      certificates: formattedCertificates,
      count: formattedCertificates.length
    }, 'Certificates retrieved successfully'));
  } catch (error) {
    console.error('Error fetching certificates by email:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch certificates',
        details: error.message
      }
    });
  }
};

export const checkBulkEmailStatus = async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, message: 'emails array is required' });
    }

    const certificates = await Certificate.find(
      { recipientEmail: { $in: emails } },
      { recipientEmail: 1, candidateName: 1, courseName: 1, _id: 0 }
    ).lean();

    const issued = {};
    for (const cert of certificates) {
      if (cert.recipientEmail) {
        issued[cert.recipientEmail.toLowerCase()] = true;
      }
    }

    return res.status(200).json({ success: true, data: { issued } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resendCertificateEmail = async (req, res) => {
  const { certificateId } = req.params;
  const { email } = req.body;
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    const certificate = await Certificate.findOne({ certificateId });
    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    const recipientEmail = email || certificate.recipientEmail;
    if (!recipientEmail || !recipientEmail.match(/\S+@\S+\.\S+/)) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }

    const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(':3000', ':5173');
    const verificationUrl = `${baseUrl}/verify?code=${certificate.verificationCode || certificate.shortCode}&auto=true`;
    const certLink = `${PINATA_GATEWAY_BASE_URL}/ipfs/${certificate.ipfsHash}`;

    const emailResult = await sendCertificateEmail(
      recipientEmail,
      certificate.candidateName,
      certificate.courseName,
      certLink,
      verificationUrl,
      {
        certificateId,
        institutionName: certificate.institutionName,
        issuedDate: certificate.issuedDate,
        verificationCode: certificate.verificationCode || certificate.shortCode,
        certificateType: 'COMPLETION',
        gpa: certificate.gpa != null ? certificate.gpa : null
      }
    );

    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: emailResult.error || 'Failed to send email' });
    }

    console.log(`[${requestId}] Certificate email resent to ${recipientEmail}`);
    return res.status(200).json({ success: true, message: `Certificate sent to ${recipientEmail}` });
  } catch (error) {
    console.error(`[${requestId}] Resend email error:`, error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────

export const revokeCertificate = async (req, res) => {
  const { certificateId } = req.params;
  const requestId = crypto.randomBytes(4).toString('hex');
  try {
    const certificate = await Certificate.findOne({ certificateId });
    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    if (certificate.issuer?.toString() !== req.user?.id?.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to revoke this certificate' });
    }
    if (certificate.revoked) {
      return res.status(400).json({ success: false, message: 'Certificate is already revoked' });
    }
    certificate.revoked = true;
    certificate.revokedAt = new Date();
    certificate.revokedBy = req.user?.id;
    await certificate.save();
    await logActivity({
      userId: req.user?.id,
      type: 'CERTIFICATE_REVOKED',
      description: `Certificate revoked for ${certificate.candidateName} — ${certificate.courseName}`,
      meta: {
        certificateId,
        candidateName: certificate.candidateName,
        courseName: certificate.courseName,
        verificationCode: certificate.verificationCode
      },
      req
    });
    console.log(`[${requestId}] Certificate revoked: ${certificateId}`);
    return res.status(200).json({ success: true, message: 'Certificate revoked successfully' });
  } catch (error) {
    console.error(`[${requestId}] Revoke error:`, error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const unrevokeCertificate = async (req, res) => {
  const { certificateId } = req.params;
  const requestId = crypto.randomBytes(4).toString('hex');
  try {
    const certificate = await Certificate.findOne({ certificateId });
    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    if (certificate.issuer?.toString() !== req.user?.id?.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to unrevoke this certificate' });
    }
    if (!certificate.revoked) {
      return res.status(400).json({ success: false, message: 'Certificate is not revoked' });
    }
    certificate.revoked = false;
    certificate.revokedAt = undefined;
    certificate.revokedBy = undefined;
    await certificate.save();
    await logActivity({
      userId: req.user?.id,
      type: 'CERTIFICATE_UNREVOKED',
      description: `Certificate unrevoked for ${certificate.candidateName} — ${certificate.courseName}`,
      meta: {
        certificateId,
        candidateName: certificate.candidateName,
        courseName: certificate.courseName,
        verificationCode: certificate.verificationCode
      },
      req
    });
    console.log(`[${requestId}] Certificate unrevoked: ${certificateId}`);
    return res.status(200).json({ success: true, message: 'Certificate unrevoked successfully' });
  } catch (error) {
    console.error(`[${requestId}] Unrevoke error:`, error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Export helper functions for use in other controllers
export const helpers = {
  generateCertificateHash,
  blockchainErrorHandler,
  generateVerificationShortCode
};