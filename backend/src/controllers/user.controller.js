import User from '../models/user.model.js';
import Certificate from '../models/certificate.model.js';
import { successResponse } from '../utils/responseUtils.js';
import { errorResponse, ErrorCodes } from '../utils/errorUtils.js';
import { generateKeyPair, deriveWalletAddress } from '../utils/cryptoUtils.js';
import { encryptSecret } from '../utils/keyEncryption.js';
import mongoose from 'mongoose';

/**
 * Get the current user's profile
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Handle case inconsistency by checking both formats
    const user = await User.findById(userId);

    // Check if this is an institute user (case insensitive check)
    const isInstitute = user.role.toUpperCase() === 'INSTITUTE';

    // For institute users, check if they need cryptographic keys generated
    if (isInstitute) {
      let needsSave = false;

      // Only generate keys if they don't already exist
      if (!user.publicKey || !user.privateKey || !user.walletAddress) {
        console.log('[getUserProfile] Keys missing, generating cryptographic keys for institute user');

        try {
          // Generate a new key pair
          const { publicKey, privateKey } = generateKeyPair();
          const walletAddress = deriveWalletAddress(publicKey);

          // Update the user with the new keys
          user.publicKey = publicKey;
          user.privateKey = encryptSecret(privateKey);
          user.walletAddress = walletAddress;
          needsSave = true;
        } catch (error) {
          console.error('[getUserProfile] Error generating keys:', error.message);
        }
      }

      // Auto-populate institutionName if missing (for existing users)
      if (!user.institutionName && user.name) {
        user.institutionName = user.name;
        needsSave = true;
      }

      // Save if any updates were made
      if (needsSave) {
        await user.save();
        console.log('[getUserProfile] User profile updated and saved to database');
      }
    }

    // The private key must NEVER leave the server. Institutes only ever need
    // their public key (to show on their profile / share with verifiers) and
    // their wallet address; the private key stays server-side and is only
    // ever used internally by signData().
    const profile = await User.findById(userId).select('-password -refreshToken -privateKey');

    if (!profile) {
      console.log(`User not found with ID: ${userId}`);
      const { response, statusCode } = errorResponse('USER_NOT_FOUND', 'User not found');
      return res.status(statusCode).json(response);
    }

    return res.json(successResponse(profile.toObject(), 'User profile retrieved successfully'));
  } catch (error) {
    console.error('[getUserProfile] Error:', error.message);
    const { response, statusCode } = errorResponse('INTERNAL_ERROR', 'Failed to get user profile');
    return res.status(statusCode).json(response);
  }
};

/**
 * Update the current user's profile
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    // Basic validation
    if (!name && !email) {
      const { response, statusCode } = errorResponse('INVALID_INPUT', 'No update data provided');
      return res.status(statusCode).json(response);
    }

    // SECURITY: email is intentionally NOT accepted here. This endpoint used to let an
    // authenticated user set `email` directly with no re-verification — since the admin
    // allowlist (middlewares/admin.middleware.js) grants admin rights purely by matching
    // req.user.email against ADMIN_EMAILS, that meant any institute could PATCH its own
    // email to an address in the allowlist and become an admin on its very next request.
    // Email changes now go through requestEmailChange / confirmEmailChange below, which
    // require proving control of the *new* address via a one-time code before it's applied.
    if (email) {
      const { response, statusCode } = errorResponse(
        'INVALID_INPUT',
        'Email cannot be changed here. Use /api/users/email-change/request to change your email.'
      );
      return res.status(statusCode).json(response);
    }

    // Get user to check role
    const user = await User.findById(userId);
    if (!user) {
      const { response, statusCode } = errorResponse('USER_NOT_FOUND', 'User not found');
      return res.status(statusCode).json(response);
    }

    // Create update object with only provided fields
    const updateData = {};
    if (name) {
      updateData.name = name;
      // For INSTITUTE users, also update institutionName when name changes
      if (user.role.toUpperCase() === 'INSTITUTE') {
        updateData.institutionName = name;
        console.log(`[updateUserProfile] Updating institutionName to: ${name}`);
      }
    }

    // Update user and return updated document
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password -refreshToken');

    if (!updatedUser) {
      const { response, statusCode } = errorResponse('USER_NOT_FOUND', 'User not found');
      return res.status(statusCode).json(response);
    }

    return res.json(successResponse(updatedUser, 'Profile updated successfully'));
  } catch (error) {
    console.error('Error updating user profile:', error);
    const { response, statusCode } = errorResponse('INTERNAL_ERROR', 'Failed to update profile');
    return res.status(statusCode).json(response);
  }
};

/**
 * Step 1 of email change: send a one-time code to the NEW address to prove
 * the user actually controls it before anything in the DB changes.
 */
export const requestEmailChange = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newEmail } = req.body;

    if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) {
      const { response, statusCode } = errorResponse('INVALID_INPUT', 'A valid newEmail is required');
      return res.status(statusCode).json(response);
    }

    const normalizedEmail = newEmail.trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      const { response, statusCode } = errorResponse('DUPLICATE_RESOURCE', 'Email already in use');
      return res.status(statusCode).json(response);
    }

    const user = await User.findById(userId);
    if (!user) {
      const { response, statusCode } = errorResponse('USER_NOT_FOUND', 'User not found');
      return res.status(statusCode).json(response);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.pendingEmail = normalizedEmail;
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const { sendOtpEmail } = await import('../utils/emailUtils.js');
    await sendOtpEmail(normalizedEmail, user.name, otp);

    return res.json(successResponse(
      { newEmail: normalizedEmail },
      'Verification code sent to the new email address'
    ));
  } catch (error) {
    console.error('Error requesting email change:', error);
    const { response, statusCode } = errorResponse('INTERNAL_ERROR', 'Failed to start email change');
    return res.status(statusCode).json(response);
  }
};

/**
 * Step 2 of email change: apply the change only after the code sent to the
 * new address is confirmed.
 */
export const confirmEmailChange = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otp } = req.body;

    if (!otp) {
      const { response, statusCode } = errorResponse('INVALID_INPUT', 'Verification code is required');
      return res.status(statusCode).json(response);
    }

    const user = await User.findById(userId).select('+otp +otpExpiry');
    if (!user || !user.pendingEmail) {
      const { response, statusCode } = errorResponse('INVALID_INPUT', 'No pending email change');
      return res.status(statusCode).json(response);
    }

    if (!user.otp || user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      const { response, statusCode } = errorResponse('INVALID_OTP', 'Invalid or expired verification code');
      return res.status(statusCode).json(response);
    }

    const stillFree = await User.findOne({ email: user.pendingEmail, _id: { $ne: user._id } });
    if (stillFree) {
      const { response, statusCode } = errorResponse('DUPLICATE_RESOURCE', 'Email already in use');
      return res.status(statusCode).json(response);
    }

    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    return res.json(successResponse(
      { email: user.email },
      'Email address updated successfully'
    ));
  } catch (error) {
    console.error('Error confirming email change:', error);
    const { response, statusCode } = errorResponse('INTERNAL_ERROR', 'Failed to confirm email change');
    return res.status(statusCode).json(response);
  }
};

/**
 * Get statistics for the current user
 */
export const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      const { response, statusCode } = errorResponse('USER_NOT_FOUND', 'User not found');
      return res.status(statusCode).json(response);
    }

    // Get different stats based on user role
    let stats = {};

    if (user.role === 'INSTITUTE') {
      // For institute users, get counts of issued certificates by status
      const certificateCounts = await Certificate.aggregate([
        { $match: { issuer: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        },
      ]);

      // Format the results
      const formattedCounts = {
        total: 0,
        pending: 0,
        confirmed: 0,
        failed: 0
      };

      certificateCounts.forEach(item => {
        if (item._id === 'PENDING') formattedCounts.pending = item.count;
        if (item._id === 'CONFIRMED') formattedCounts.confirmed = item.count;
        if (item._id === 'FAILED') formattedCounts.failed = item.count;
        formattedCounts.total += item.count;
      });

      stats = {
        certificatesIssued: formattedCounts,
        lastLogin: user.lastLogin,
        accountCreated: user.createdAt
      };
    } else {
      // For regular users, get counts of certificates they own
      const certificateCount = await Certificate.countDocuments({
        candidateName: user.name
      });

      stats = {
        certificatesOwned: certificateCount,
        lastLogin: user.lastLogin,
        accountCreated: user.createdAt,
        loginHistory: user.loginHistory?.slice(0, 5) || []
      };
    }

    return res.json(successResponse(stats, 'User statistics retrieved successfully'));
  } catch (error) {
    console.error('Error getting user stats:', error);
    const { response, statusCode } = errorResponse('INTERNAL_ERROR', 'Failed to get user statistics');
    return res.status(statusCode).json(response);
  }
};

/**
 * List all certificates for the current user
 * - For regular users: certificates where they are the candidate
 * - For institutes: certificates they have issued
 */
export const getUserCertificates = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      const { response, statusCode } = errorResponse('USER_NOT_FOUND', 'User not found');
      return res.status(statusCode).json(response);
    }

    let certificates = [];
    const { status, search } = req.query;

    // Build the query based on user role and optional filters
    let query = {};

    if (user.role === 'INSTITUTE') {
      console.log(`[getUserCertificates] Fetching certificates for INSTITUTE user: ${userId}`);
      // Try using ObjectId or string depending on what works
      query.issuer = new mongoose.Types.ObjectId(userId);
    } else {
      console.log(`[getUserCertificates] Fetching certificates for ${user.role} user: ${userId}, name: ${user.name}`);
      query.candidateName = user.name;
    }

    console.log('[getUserCertificates] Query:', JSON.stringify(query));

    // Add status filter if provided
    if (status && ['PENDING', 'CONFIRMED', 'FAILED'].includes(status.toUpperCase())) {
      query.status = status.toUpperCase();
      console.log(`[getUserCertificates] Adding status filter: ${status.toUpperCase()}`);
    }

    // Add search filter if provided
    if (search) {
      query.$or = [
        { courseName: { $regex: search, $options: 'i' } },
        { certificateId: { $regex: search, $options: 'i' } },
        { shortCode: { $regex: search, $options: 'i' } }
      ];

      // For institutes, also search by candidate name
      if (user.role === 'INSTITUTE') {
        query.$or.push({ candidateName: { $regex: search, $options: 'i' } });
      }
      console.log(`[getUserCertificates] Adding search filter: ${search}`);
    }

    // Execute the query
    certificates = await Certificate.find(query).sort({ createdAt: -1 });

    console.log(`[getUserCertificates] Found ${certificates.length} certificates`);

    // If no certificates found for institute user, try alternative query
    if (certificates.length === 0 && user.role === 'INSTITUTE') {
      console.log('[getUserCertificates] No certificates found for INSTITUTE, trying alternative query with orgName');

      // Try finding by organization name as fallback
      const altQuery = { orgName: user.name };
      if (status) altQuery.status = status.toUpperCase();

      const altCertificates = await Certificate.find(altQuery).sort({ createdAt: -1 });
      console.log(`[getUserCertificates] Alternative query found ${altCertificates.length} certificates`);

      if (altCertificates.length > 0) {
        // Update certificates with issuer field for future queries
        console.log('[getUserCertificates] Updating certificates with issuer field');
        for (const cert of altCertificates) {
          cert.issuer = userId;
          await cert.save();
        }
        certificates = altCertificates;
      }
    }

    return res.json(successResponse(certificates, 'Certificates retrieved successfully'));
  } catch (error) {
    console.error('Error getting user certificates:', error);
    const { response, statusCode } = errorResponse('INTERNAL_ERROR', 'Failed to get certificates');
    return res.status(statusCode).json(response);
  }
}; 

/**
 * Update user's institution logo
 */
export const updateUserLogo = async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No logo file provided'
      });
    }

    // Upload logo to IPFS
    const { uploadBufferToPinata } = await import('../utils/pinata.js');
    const ipfsHash = await uploadBufferToPinata(req.file.buffer, `logo_${userId}_${Date.now()}.${req.file.mimetype.split('/')[1]}`);
    
    const logoUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    // Update user's logo
    const user = await User.findByIdAndUpdate(
      userId,
      { institutionLogo: logoUrl },
      { new: true, select: '-password -refreshToken -privateKey' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Logo updated successfully',
      data: {
        institutionLogo: user.institutionLogo
      }
    });
  } catch (error) {
    console.error('Error updating logo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update logo',
      error: error.message
    });
  }
};