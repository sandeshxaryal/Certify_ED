// src/controllers/admin.controller.js
import { sendEmailsForConfirmedCertificates } from '../utils/blockchain.js';
import nodemailer from 'nodemailer';

/**
 * Manually trigger email sending for confirmed certificates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with email sending results
 */
const sendConfirmedEmails = async (req, res) => {
  try {
    const result = await sendEmailsForConfirmedCertificates();

    return res.status(200).json({
      success: true,
      message: 'Email sending process initiated',
      result
    });
  } catch (error) {
    console.error('Error triggering email sending:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger email sending',
      error: error.message
    });
  }
};

/**
 * Check email configuration and connection status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with email status
 */
const getEmailStatus = async (req, res) => {
  try {
    // Check email configuration
    const emailConfig = {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      user: process.env.EMAIL_USER ? '✓ Configured' : '✗ Missing',
      password: process.env.EMAIL_PASSWORD ? '✓ Configured' : '✗ Missing',
      from: process.env.EMAIL_FROM
    };

    const isConfigured = process.env.EMAIL_HOST &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASSWORD;

    // Test connection if configured
    let connectionStatus = { status: 'not_configured' };

    if (isConfigured) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT || 587,
          secure: process.env.EMAIL_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
          }
        });

        // Try to verify the connection (doesn't actually send an email)
        await transporter.verify();
        connectionStatus = {
          status: 'connected',
          message: 'Successfully connected to email server'
        };
      } catch (emailError) {
        connectionStatus = {
          status: 'error',
          message: 'Failed to connect to email server',
          error: emailError.message
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Email status retrieved successfully',
      data: {
        configuration: emailConfig,
        connection: connectionStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error checking email status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check email status',
      error: error.message
    });
  }
};

export const admin = {
  sendConfirmedEmails,
  getEmailStatus
}; 