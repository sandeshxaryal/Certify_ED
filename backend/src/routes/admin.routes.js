// src/routes/admin.routes.js
import express from 'express';
import { admin } from '../controllers/admin.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import adminMiddleware from '../middlewares/admin.middleware.js';

const router = express.Router();

/**
 * @route POST /api/admin/send-confirmed-emails
 * @desc Manually trigger email sending for confirmed certificates
 * @access Private (Admin only)
 */
router.post('/send-confirmed-emails', authMiddleware, adminMiddleware, admin.sendConfirmedEmails);

/**
 * @route GET /api/admin/email-status
 * @desc Check email configuration and connection status
 * @access Private (Admin only)
 */
router.get('/email-status', authMiddleware, adminMiddleware, admin.getEmailStatus);

export default router;