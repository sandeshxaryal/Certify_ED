// -------------------------------
// File: utils/pdfHashUtils.js
// -------------------------------
import crypto from "crypto";
import Certificate from '../models/certificate.model.js';
import { contract } from './blockchain.js';
import { CID } from 'multiformats/cid';
import * as Block from 'multiformats/block';
import { sha256 } from 'multiformats/hashes/sha2';

/**
 * Compute the hash of a PDF file
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<{sha256Hash: string, cidHash: string}>} - The computed hash
 */
export const computePDFHash = async (pdfBuffer) => {
  // Log the buffer size and first few bytes for debugging
  console.log(`PDF buffer size: ${pdfBuffer.length} bytes`);
  console.log(`First 20 bytes: ${pdfBuffer.slice(0, 20).toString("hex")}`);

  // Compute SHA-256 hash
  const sha256Hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
  console.log(`SHA-256 hash: ${sha256Hash}`);

  // Compute IPFS-compatible CID using the correct method
  // Pinata uses CIDv0 format which is a base58btc encoded multihash
  const bytes = await sha256.digest(pdfBuffer);
  const cid = CID.createV0(bytes);
  const cidHash = cid.toString();
  console.log(`IPFS CID: ${cidHash}`);

  // Check if this hash exists in the database
  const certificate = await Certificate.findOne({ ipfsHash: sha256Hash });
  if (certificate) {
    console.log(`Found certificate with SHA-256 hash: ${certificate.certificateId}`);
  } else {
    console.log("No certificate found with this SHA-256 hash");
  }

  // Also check if the CID exists in the database
  const certificateByCID = await Certificate.findOne({ ipfsHash: cidHash });
  if (certificateByCID) {
    console.log(`Found certificate with CID hash: ${certificateByCID.certificateId}`);
  } else {
    console.log("No certificate found with this CID hash");
  }

  return { sha256Hash, cidHash };
};

/**
 * Search for a certificate hash in the blockchain
 * This function will search through recent blocks to find a matching hash
 * 
 * @param {string} hash - The hash to search for
 * @returns {Promise<{certificateId: string, txHash: string} | null>} - The certificate ID and transaction hash if found
 */
export const getStoredHashFromBlockchain = async (hash) => {
  try {
    // Get the latest block number
    const latestBlock = await contract.methods.getLatestBlockNumber().call();

    // Search through the last 1000 blocks (adjust as needed)
    const startBlock = Math.max(0, latestBlock - 1000);

    // Get all certificate events in the range
    const events = await contract.getPastEvents('CertificateIssued', {
      fromBlock: startBlock,
      toBlock: 'latest'
    });

    // Search through events for matching hash
    for (const event of events) {
      const certificateData = await contract.methods.getCertificate(event.returnValues.certificateId).call();
      const storedHash = certificateData[4] || certificateData._ipfs_hash;

      // Check for exact match
      if (storedHash === hash) {
        return {
          certificateId: event.returnValues.certificateId,
          txHash: event.transactionHash
        };
      }

      // Check for partial match
      if (storedHash && hash &&
        (storedHash.includes(hash) || hash.includes(storedHash))) {
        console.log(`Found partial match: ${storedHash} and ${hash}`);
        return {
          certificateId: event.returnValues.certificateId,
          txHash: event.transactionHash
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error searching blockchain for hash:', error);
    return null;
  }
};

/**
 * Verify a certificate hash against the blockchain
 * 
 * @param {string} hash - The hash to verify
 * @returns {Promise<boolean>} - Whether the hash is valid
 */
export const verifyHashOnBlockchain = async (hash) => {
  try {
    const storedHash = await getStoredHashFromBlockchain(hash);
    return !!storedHash;
  } catch (error) {
    console.error('Error verifying hash on blockchain:', error);
    return false;
  }
};