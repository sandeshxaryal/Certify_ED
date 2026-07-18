// src/routes/user.routes.js
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import authMiddleware from '../middlewares/auth.middleware.js';
import { getUserProfile, updateUserProfile, getUserStats, getUserCertificates, updateUserLogo, requestEmailChange, confirmEmailChange } from '../controllers/user.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// OTP endpoints are brute-forceable in principle (6-digit code); rate-limit
// confirm attempts per authenticated user's IP.
const emailChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes in this file require authentication
router.use(authMiddleware);

// User profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.post('/profile/logo', upload.single('logo'), updateUserLogo);

// Verified email-change flow (replaces the old direct email field on PUT /profile —
// see SECURITY_FIXES.md for why that was a privilege-escalation path)
router.post('/email-change/request', requestEmailChange);
router.post('/email-change/confirm', confirmEmailChange);

// User statistics route
router.get('/stats', getUserStats);

// User certificates route
router.get('/certificates', getUserCertificates);

export default router;