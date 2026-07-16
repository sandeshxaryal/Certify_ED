/**
 * Standardized API error handling utilities following industry best practices
 */
import crypto from 'crypto';

/**
 * Error codes mapped to HTTP status codes and default messages
 */
export const ErrorCodes = {
  // 400 - Bad Request errors
  INVALID_INPUT: { status: 400, message: 'Invalid input parameters' },
  MISSING_REQUIRED_FIELD: { status: 400, message: 'Required field is missing' },
  INVALID_FORMAT: { status: 400, message: 'Data format is invalid' },

  // 401 - Authentication errors
  UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  INVALID_CREDENTIALS: { status: 401, message: 'Invalid credentials provided' },
  TOKEN_EXPIRED: { status: 401, message: 'Authentication token has expired' },

  // 403 - Authorization errors
  FORBIDDEN: { status: 403, message: 'Access denied' },
  INSUFFICIENT_PERMISSIONS: { status: 403, message: 'Insufficient permissions' },

  // 404 - Not Found errors
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  CERTIFICATE_NOT_FOUND: { status: 404, message: 'Certificate not found' },
  USER_NOT_FOUND: { status: 404, message: 'User not found' },

  // 409 - Conflict errors
  DUPLICATE_RESOURCE: { status: 409, message: 'Resource already exists' },

  // 422 - Validation errors
  VALIDATION_ERROR: { status: 422, message: 'Validation failed' },

  // 500 - Server errors
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
  DATABASE_ERROR: { status: 500, message: 'Database operation failed' },
  BLOCKCHAIN_ERROR: { status: 500, message: 'Blockchain operation failed' },
  IPFS_ERROR: { status: 500, message: 'IPFS operation failed' },
  VERIFICATION_FAILED: { status: 500, message: 'Certificate verification failed' }
};

/**
 * Creates a standardized error response
 * @param {String} code - Error code (from ErrorCodes or custom)
 * @param {String} message - Error message (overrides default if provided)
 * @param {Object} details - Additional error details
 * @param {String} requestId - Request ID for tracking
 * @returns {Object} Formatted error response with statusCode
 */
export const errorResponse = (code, message, details = null, requestId = null) => {
  const errorInfo = ErrorCodes[code] || { status: 500, message: 'Unknown error' };

  const response = {
    success: false,
    status: 'ERROR',
    code,
    message: message || errorInfo.message,
    timestamp: new Date().toISOString()
  };

  if (details) response.details = details;
  if (requestId) response.requestId = requestId;

  return {
    response,
    statusCode: errorInfo.status
  };
};

/**
 * Creates an API error that includes HTTP status code
 * @param {String} code - Error code
 * @param {String} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Error} Error object with statusCode property
 */
export class ApiError extends Error {
  constructor(code, message, details = null) {
    const errorInfo = ErrorCodes[code] || { status: 500, message: 'Unknown error' };
    super(message || errorInfo.message);

    this.name = 'ApiError';
    this.code = code;
    this.statusCode = errorInfo.status;
    this.details = details;
  }

  toResponse(requestId = null) {
    return errorResponse(this.code, this.message, this.details, requestId);
  }
}

/**
 * Global error handler middleware for Express
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Global error handler:', err);

  // Generate request ID for tracking
  const requestId = req.id || crypto.randomBytes(4).toString('hex');

  if (err instanceof ApiError) {
    const { response, statusCode } = err.toResponse(requestId);
    return res.status(statusCode).json(response);
  }

  // Handle mongoose validation errors
  if (err.name === 'ValidationError') {
    const { response, statusCode } = errorResponse(
      'VALIDATION_ERROR',
      'Validation failed',
      {
        fields: Object.keys(err.errors).reduce((acc, key) => {
          acc[key] = err.errors[key].message;
          return acc;
        }, {})
      },
      requestId
    );
    return res.status(statusCode).json(response);
  }

  // Handle duplicate key errors from MongoDB
  if (err.name === 'MongoError' && err.code === 11000) {
    const { response, statusCode } = errorResponse(
      'DUPLICATE_RESOURCE',
      'Resource already exists',
      { duplicateKey: Object.keys(err.keyValue)[0] },
      requestId
    );
    return res.status(statusCode).json(response);
  }

  // Default server error
  const { response, statusCode } = errorResponse(
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    process.env.NODE_ENV === 'production' ? null : { stack: err.stack },
    requestId
  );

  return res.status(statusCode).json(response);
}; 