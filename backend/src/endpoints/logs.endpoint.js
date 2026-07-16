// src/endpoints/logs.endpoint.js
import express from 'express';
import { getMyActivity } from '../handlers/logs.handler.js';
import authenticate from '../guards/session.guard.js';
const router = express.Router();

router.get('/', authenticate, getMyActivity);

export default router;