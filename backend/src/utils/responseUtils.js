/**
 * Standardized API response utilities following industry best practices
 */

/**
 * Creates a standardized success response
 * @param {Object} data - The response payload
 * @param {String} message - Optional success message
 * @param {Number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Formatted success response
 */
export const successResponse = (data = {}, message = 'Success', statusCode = 200) => {
  return {
    success: true,
    status: 'SUCCESS',
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

/**
 * Creates a standardized verification response
 * @param {String} status - Verification status (VALID, INVALID, etc)
 * @param {Object} certificate - Certificate data
 * @param {String} verificationId - Verification request ID
 * @param {Object} links - Related resource links
 * @param {Object} additionalData - Any additional metadata
 * @returns {Object} Formatted verification response
 */
export const verificationResponse = (
  status,
  certificate,
  verificationId,
  links = {},
  additionalData = {}
) => {
  return {
    success: status === 'VALID' || status === 'VALID_WITH_WARNING',
    status,
    message: getVerificationMessage(status),
    verificationId,
    certificate,
    _links: links,
    ...additionalData,
    timestamp: new Date().toISOString()
  };
};

/**
 * Creates a standardized partial success response with warning
 * @param {String} status - Status code (usually 'SUCCESS_WITH_WARNING')
 * @param {Object} data - The success data payload
 * @param {String} warning - Warning message
 * @param {Object} warningDetails - Additional warning details
 * @returns {Object} Formatted warning response
 */
export const warningResponse = (
  status = 'SUCCESS_WITH_WARNING',
  data = {},
  warning,
  warningDetails = null
) => {
  const response = {
    success: true,
    status,
    message: warning,
    data,
    timestamp: new Date().toISOString()
  };

  if (warningDetails) response.warningDetails = warningDetails;

  return response;
};

/**
 * Creates a standardized list response with pagination
 * @param {Array} items - The list items
 * @param {Number} total - Total number of items (for pagination)
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Formatted list response with pagination
 */
export const paginatedResponse = (
  items = [],
  total = 0,
  page = 1,
  limit = 10,
  metadata = {}
) => {
  return successResponse({
    items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    },
    ...metadata
  });
};

/**
 * Generates a human-readable message for verification status codes
 * @param {String} status - Verification status code 
 * @returns {String} Human-readable message
 */
const getVerificationMessage = (status) => {
  const messages = {
    'VALID': 'Certificate is valid and verified',
    'VALID_WITH_WARNING': 'Certificate is valid but with some minor issues',
    'INVALID': 'Certificate is invalid',
    'REVOKED': 'Certificate has been revoked',
    'ERROR': 'Error occurred during verification',
    'NOT_FOUND': 'Certificate not found'
  };

  return messages[status] || 'Certificate verification completed';
};
