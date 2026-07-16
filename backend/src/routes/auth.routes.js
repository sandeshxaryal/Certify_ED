import express from 'express';
import { register, login, verifyEmail, verifyOtp, sendPasswordResetOtp, resetPasswordWithOtp } from '../controllers/auth.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import ActivityLog from '../models/activityLog.model.js';

const router = express.Router();

router.post('/send-reset-otp', sendPasswordResetOtp);
router.post('/reset-password', resetPasswordWithOtp);
router.post('/register', register);
router.post('/login', login);
router.get('/verify-email', verifyEmail);
router.post('/verify-otp', verifyOtp);

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
  res.json({ success: true });
});

export default router;
