// src/routes/certificate.routes.js
import express from 'express';
import { pdfUpload, pdfUploadMemory } from '../middlewares/fileUpload.middleware.js';
import authMiddleware from '../middlewares/auth.middleware.js';
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
} from '../controllers/certificate.controller.js';

import {
  verifyCertificateByShortCode,
  verifyInstitutionalSignature
} from '../controllers/verification.controller.js';

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later'
  }
});

// getCertificatesByEmail lets anyone enumerate a person's certificates (name,
// course, GPA) just by guessing their email. It stays public (recipients need
// a way to look up their own certs without an account) but gets a much
// tighter limiter than the general verification endpoints.
const emailLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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
router.get('/email/:email', emailLookupLimiter, getCertificatesByEmail);

export default router;