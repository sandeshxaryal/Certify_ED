// src/endpoints/administration.endpoint.js
import express from 'express';
import { admin } from '../handlers/administration.handler.js';
import authMiddleware from '../guards/session.guard.js';
import adminMiddleware from '../guards/admin.guard.js';

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