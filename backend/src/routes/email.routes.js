// src/routes/email.routes.js
import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { testEmail } from '../controllers/email.controller.js';

const router = express.Router();

// Test email sending (protected)
router.post('/test', authMiddleware, testEmail);

export default router; 