// src/endpoints/status.endpoint.js
import express from 'express';
import { checkHealth } from '../handlers/status.handler.js';

const router = express.Router();

router.get('/', checkHealth);

export default router;