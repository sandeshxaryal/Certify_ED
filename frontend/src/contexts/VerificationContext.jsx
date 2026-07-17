import { createContext, useContext, useState, useCallback, useRef } from 'react';
import axios from 'axios';

// Create a cache to store verification results
const verificationCache = new Map();

// Create context
export const VerificationContext = createContext();

export const VerificationProvider = ({ children }) => {
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingRequests, setHasPendingRequests] = useState(false);

  // Use a ref to track ongoing requests to prevent duplicates
  const pendingRequestsRef = useRef({});

  const apiBase = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/certificates`;

  // Function to get frontend base URL for verification links
  const getFrontendBaseUrl = () => {
    const host = window.location.hostname;
    const port = '5173'; // Frontend runs on port 5173
    const protocol = window.location.protocol;
    return `${protocol}//${host}:${port}`;
  };

  // Create axios instance with default config
  const api = axios.create({
    baseURL: apiBase,
    timeout: 10000, // 10 second timeout
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Add response interceptor to handle rate limiting
  api.interceptors.response.use(
    response => response,
    error => {
      if (error.response && error.response.status === 429) {
        // Handle rate limiting
        const retryAfter = error.response.headers['retry-after'] || 60;
        setError(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
      }
      return Promise.reject(error);
    }
  );

  const resetVerification = useCallback(() => {
    setVerificationResult(null);
    setError('');
    setLoading(false);
  }, []);

  // Debounce function to prevent too many requests
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  // Parse standardized API responses
  const parseVerificationResponse = useCallback((response) => {
    // Check if response follows the new standardized API format
    if (response.data && typeof response.data.success === 'boolean') {
      if (response.data.success) {
        // Extract verification data from the new format
        const verificationData = response.data.data;

        return {
          valid: true,
          status: response.data.status || 'SUCCESS',
          message: response.data.message || 'Certificate is valid',
          certificateId: verificationData.certificateId,
          studentName: verificationData.studentName,
          courseName: verificationData.courseName,
          issueDate: verificationData.issueDate,
          expiryDate: verificationData.expiryDate,
          issuerName: verificationData.issuerName,
          issuerLogo: verificationData.issuerLogo,
          verificationId: verificationData.verificationId,
          verifiedAt: new Date().toISOString(),
          links: verificationData.links || {},
          details: verificationData.details || {}
        };
      } else {
        // Handle verification failure with new format
        return {
          valid: false,
          status: response.data.status || 'ERROR',
          message: response.data.message || 'Certificate verification failed',
          errorCode: response.data.code,
          verificationId: response.data.requestId,
          details: response.data.details || {}
        };
      }
    } else {
      // Handle old response format (fallback)
      console.warn('Received non-standardized API response format');
      return {
        valid: !!response.data.valid,
        status: response.data.valid ? 'SUCCESS' : 'ERROR',
        message: response.data.message || (response.data.valid ? 'Certificate is valid' : 'Certificate verification failed'),
        ...response.data
      };
    }
  }, []);

  const verifyByCertificateId = useCallback(async (certificateId) => {
    if (!certificateId) {
      setError('Certificate ID is required');
      return;
    }

    setLoading(true);
    setError('');

    // Check cache first
    const cacheKey = `id:${certificateId}`;
    if (verificationCache.has(cacheKey)) {
      console.log('Using cached verification result for ID:', certificateId);
      setVerificationResult(verificationCache.get(cacheKey));
      setLoading(false);
      return;
    }

    try {
      const response = await api.get(`/verify/${certificateId}`);
      const result = parseVerificationResponse(response);

      // Cache the result
      verificationCache.set(cacheKey, result);

      setVerificationResult(result);
    } catch (err) {
      handleVerificationError(err);
    } finally {
      setLoading(false);
    }
  }, [api, parseVerificationResponse]);

  const verifyByPdfHash = useCallback(async (pdfFile) => {
    // Generate a unique key for this file
    const fileKey = `pdf:${pdfFile.name}:${pdfFile.size}:${pdfFile.lastModified}`;

    // Check if we already have a pending request for this file
    if (pendingRequestsRef.current[fileKey]) {
      return;
    }

    // Check cache first
    if (verificationCache.has(fileKey)) {
      const cachedResult = verificationCache.get(fileKey);
      setVerificationResult(cachedResult);
      return;
    }

    setLoading(true);
    setError('');
    setVerificationResult(null);

    // Mark this request as pending
    pendingRequestsRef.current[fileKey] = true;

    try {
      const formData = new FormData();
      formData.append('certificate', pdfFile);

      const response = await api.post(`/verify/pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const result = parseVerificationResponse(response);

      // Cache the result
      verificationCache.set(fileKey, result);
      setVerificationResult(result);
    } catch (err) {
      handleVerificationError(err);
    } finally {
      setLoading(false);
      // Remove from pending requests
      delete pendingRequestsRef.current[fileKey];
    }
  }, [api, parseVerificationResponse]);

  // Debounced version of short code verification to prevent too many requests
  const debouncedVerifyByShortCode = useCallback(
    debounce(async (shortCode) => {
      // Normalize the short code
      const normalizedCode = shortCode.trim().toUpperCase();

      // Check if we already have a pending request for this code
      if (pendingRequestsRef.current[normalizedCode]) {
        return;
      }

      // Check cache first
      const cacheKey = `code:${normalizedCode}`;
      if (verificationCache.has(cacheKey)) {
        const cachedResult = verificationCache.get(cacheKey);
        setVerificationResult(cachedResult);
        return;
      }

      setLoading(true);
      setError('');
      setVerificationResult(null);

      // Mark this request as pending
      pendingRequestsRef.current[normalizedCode] = true;

      try {
        const response = await api.get(`/code/${normalizedCode}`);
        const result = parseVerificationResponse(response);

        // Cache the result
        verificationCache.set(cacheKey, result);
        setVerificationResult(result);
      } catch (err) {
        handleVerificationError(err);
      } finally {
        setLoading(false);
        // Remove from pending requests
        delete pendingRequestsRef.current[normalizedCode];
      }
    }, 300), // 300ms debounce delay
    [api, parseVerificationResponse]
  );

  // Public method that uses the debounced implementation
  const verifyByShortCode = useCallback((shortCode) => {
    // Validate input before making API call
    if (!shortCode || shortCode.trim().length !== 4) {
      setError('Verification code must be 4 characters');
      return;
    }

    debouncedVerifyByShortCode(shortCode);
  }, [debouncedVerifyByShortCode]);

  const handleVerificationError = useCallback((error) => {
    // Extract error details from the standardized response
    const errorResponse = error.response?.data;
    let errorMessage = 'Verification process failed';

    if (errorResponse) {
      // Use the standardized message if available
      errorMessage = errorResponse.message || errorMessage;

      // Set the full error response
      setVerificationResult({
        valid: false,
        status: errorResponse.status || 'ERROR',
        message: errorMessage,
        errorCode: errorResponse.code,
        details: errorResponse.details,
        verificationId: errorResponse.requestId,
      });
    } else {
      // Fallback for network errors
      errorMessage = error.message || errorMessage;
      setVerificationResult({
        valid: false,
        status: 'ERROR',
        message: errorMessage
      });
    }

    setError(errorMessage);
  }, []);

  // Clear cache method (useful for testing or when user wants fresh data)
  const clearCache = useCallback(() => {
    verificationCache.clear();
    console.log('Verification cache cleared');
  }, []);

  return (
    <VerificationContext.Provider
      value={{
        verifyByCertificateId,
        verifyByPdfHash,
        verifyByShortCode,
        verificationResult,
        loading,
        error,
        resetVerification,
        clearCache
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
};

export const useVerification = () => {
  const context = useContext(VerificationContext);
  if (!context) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
};