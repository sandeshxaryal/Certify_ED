import express from 'express';
import { register, login, verifyEmail, verifyOtp, sendPasswordResetOtp, resetPasswordWithOtp } from '../handlers/session.handler.js';
import authenticate from '../guards/session.guard.js';
import ActivityLog from '../schemas/log.schema.js';

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
