// src/server.js
import express from 'express';
import authRoutes from './endpoints/session.endpoint.js';
import healthRoutes from './endpoints/status.endpoint.js';
import certificateRoutes from './endpoints/credential.endpoint.js';
import userRoutes from './endpoints/profile.endpoint.js';
import emailRoutes from './endpoints/mailer.endpoint.js';
import cors from 'cors';
import morgan from 'morgan';
import { errorHandler } from './helpers/errorHelpers.js';
import adminRoutes from './endpoints/administration.endpoint.js';
import activityRoutes from './endpoints/logs.endpoint.js';

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5173/', 'http://127.0.0.1:5173/'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/activity', activityRoutes);

// Global error handler
app.use(errorHandler);

export default app;