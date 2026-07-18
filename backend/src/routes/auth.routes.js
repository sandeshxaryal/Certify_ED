import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, verifyEmail, verifyOtp, sendPasswordResetOtp, resetPasswordWithOtp, refreshToken } from '../controllers/auth.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import ActivityLog from '../models/activityLog.model.js';

const router = express.Router();

// Auth endpoints were previously completely unrestricted, making login/OTP/
// register/reset brute-forceable. 10 requests per 15 minutes per IP is
// generous for a real user but stops automated guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'ERROR',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later'
  }
});

router.post('/send-reset-otp', authLimiter, sendPasswordResetOtp);
router.post('/reset-password', authLimiter, resetPasswordWithOtp);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/verify-email', verifyEmail);
router.post('/verify-otp', authLimiter, verifyOtp);
// NOTE: this endpoint existed in the controller but was never actually routed
// before — the frontend had no way to silently renew a session, which is
// also why the old code leaned on a long-lived token sitting in localStorage
// instead. Now that the refresh token lives in an httpOnly cookie, this is
// what the frontend calls (with credentials included) to get a new access
// token without the user re-entering their password.
router.post('/refresh', refreshToken);

router.post('/logout', authenticate, async (req, res) => {
  try {
    await ActivityLog.create({
      user: req.user.id,
      type: 'LOGOUT',
      description: 'Signed out of account',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  } catch (e) {
    console.error('[logout] Failed to write activity log:', e.message);
  }
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ success: true });
});

export default router;