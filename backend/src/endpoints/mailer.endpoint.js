// src/endpoints/mailer.endpoint.js
import express from 'express';
import authMiddleware from '../guards/session.guard.js';
import { testEmail } from '../handlers/mailer.handler.js';

const router = express.Router();

// Test email sending (protected)
router.post('/test', authMiddleware, testEmail);

export default router; 