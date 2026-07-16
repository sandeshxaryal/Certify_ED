import { testEmailSending } from '../utils/emailUtils.js';

/**
 * Test email sending functionality
 * @param {Object} req - Express request object with email in body
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with success or error details
 */
export const testEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELD',
        message: 'Email address is required'
      }
    });
  }

  try {
    const emailResult = await testEmailSending(email);

    if (!emailResult.success) {
      console.error('Email sending failed:', emailResult.error);

      // Check for specific error conditions
      if (emailResult.error.includes('EMAIL_PASSWORD')) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'MISSING_CONFIG',
            message: 'Missing email password in configuration',
            details: emailResult.error
          }
        });
      }

      if (emailResult.error.includes('Email configuration missing')) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'MISSING_CONFIG',
            message: 'Email configuration is incomplete',
            details: emailResult.error
          }
        });
      }

      if (emailResult.error.includes('SMTP connection failed')) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'SMTP_ERROR',
            message: 'Failed to connect to email server',
            details: emailResult.error
          }
        });
      }

      // Generic error
      return res.status(500).json({
        success: false,
        error: {
          code: 'EMAIL_SEND_FAILED',
          message: 'Failed to send test email',
          details: emailResult.error
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      messageId: emailResult.messageId
    });
  } catch (error) {
    console.error('Error in testEmail controller:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error while sending test email',
        details: error.message
      }
    });
  }
};

export default {
  testEmail
}; 