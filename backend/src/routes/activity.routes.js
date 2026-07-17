// src/routes/activity.routes.js
import express from 'express';
import { getMyActivity } from '../controllers/activity.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
const router = express.Router();

router.get('/', authenticate, getMyActivity);

export default router;