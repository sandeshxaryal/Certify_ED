// src/endpoints/profile.endpoint.js
import express from 'express';
import multer from 'multer';
import authMiddleware from '../guards/session.guard.js';
import { getUserProfile, updateUserProfile, getUserStats, getUserCertificates, updateUserLogo } from '../handlers/profile.handler.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes in this file require authentication
router.use(authMiddleware);

// User profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.post('/profile/logo', upload.single('logo'), updateUserLogo);

// User statistics route
router.get('/stats', getUserStats);

// User certificates route
router.get('/certificates', getUserCertificates);

export default router; 