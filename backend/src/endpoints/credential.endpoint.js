// src/endpoints/credential.endpoint.js
import express from 'express';
import { pdfUpload, pdfUploadMemory } from '../guards/upload.guard.js';
import authMiddleware from '../guards/session.guard.js';
import rateLimit from 'express-rate-limit';
import {
  generateCertificate,
  verifyCertificateById,
  verifyCertificatePdf,
  getCertificateMetadata,
  uploadExternalCertificate,
  searchByCID,
  getCertificateStats,
  getOrgCertificates,
  getCertificatePDF,
  debugPdfVerification,
  serveCertificatePDF,
  getCertificatesByEmail,
  resendCertificateEmail,
  checkBulkEmailStatus,
  revokeCertificate,
  unrevokeCertificate
} from '../handlers/credential.handler.js';

import {
  verifyCertificateByShortCode,
  verifyInstitutionalSignature
} from '../handlers/validation.handler.js';

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later'
  }
});

// Protected
router.post('/generate', authMiddleware, generateCertificate);
router.post('/upload/external', authMiddleware, pdfUploadMemory.single('certificate'), uploadExternalCertificate);
router.post('/:certificateId/resend-email', authMiddleware, resendCertificateEmail);
router.post('/check-bulk-status', authMiddleware, checkBulkEmailStatus);
router.patch('/:certificateId/revoke', authMiddleware, revokeCertificate);
router.patch('/:certificateId/unrevoke', authMiddleware, unrevokeCertificate);
router.get('/stats', authMiddleware, getCertificateStats);
router.get('/institution/:institutionName', authMiddleware, getOrgCertificates);
router.get('/organization/:orgName', authMiddleware, getOrgCertificates);

// Public
router.get('/:certificateId/verify', apiLimiter, verifyCertificateById);
router.post('/verify/pdf', apiLimiter, pdfUploadMemory.single('certificate'), verifyCertificatePdf);
router.post('/debug/pdf', apiLimiter, pdfUploadMemory.single('certificate'), debugPdfVerification);
router.get('/code/:verificationCode', apiLimiter, verifyCertificateByShortCode);
router.get('/:certificateId/signature/verify', apiLimiter, verifyInstitutionalSignature);
router.get('/:certificateId/pdf', apiLimiter, getCertificatePDF);
router.get('/:certificateId/view-pdf', apiLimiter, serveCertificatePDF);
router.get('/:certificateId/metadata', apiLimiter, getCertificateMetadata);
router.get('/search/cid/:cid', apiLimiter, searchByCID);
router.get('/email/:email', apiLimiter, getCertificatesByEmail);

export default router;