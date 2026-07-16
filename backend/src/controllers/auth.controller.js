import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { successResponse } from '../utils/responseUtils.js';
import { errorResponse, ErrorCodes } from '../utils/errorUtils.js';
import crypto from 'crypto';
import { generateKeyPair, deriveWalletAddress } from '../utils/cryptoUtils.js';
import { sendVerificationEmail, sendOtpEmail } from '../utils/emailUtils.js';
import logActivity from '../utils/logActivity.js';

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
dotenv.config();

export const register = async (req, res) => {
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    const { name, email, password } = req.body;
    const role = 'INSTITUTE';
    console.log(`[${requestId}] Registration attempt for email: ${email}`);

    if (!name || !email || !password) {
      const { response, statusCode } = errorResponse(
        'MISSING_REQUIRED_FIELD',
        'All fields are required',
        { required: ['name', 'email', 'password'] },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`[${requestId}] Email already exists: ${email}`);
      const { response, statusCode } = errorResponse(
        'DUPLICATE_RESOURCE',
        'Email already exists',
        { email },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    const userFields = { name, email, password, role };

    if (role.toUpperCase() === 'INSTITUTE') {
      try {
        console.log(`[${requestId}] Generating cryptographic keys for institute: ${email}`);
        const { publicKey, privateKey } = generateKeyPair();
        const walletAddress = deriveWalletAddress(publicKey);

        userFields.publicKey = publicKey;
        userFields.privateKey = privateKey;
        userFields.walletAddress = walletAddress;
        userFields.institutionName = name;

        console.log(`[${requestId}] Cryptographic keys generated successfully`);
      } catch (keyError) {
        console.error(`[${requestId}] Error generating keys:`, keyError);
      }
    }

    userFields.role = role.toUpperCase();

    const user = new User(userFields);
    await user.save();
    console.log(`[${requestId}] New user created with ID: ${user._id}`);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    user.refreshToken = refreshToken;
    await user.save();
    console.log(`[${requestId}] Tokens generated for new user`);

    try {
      const otp = generateOtp();
      user.otp = otp;
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await sendOtpEmail(email, name, otp);
      console.log(`[${requestId}] OTP sent to ${email}`);
    } catch (emailError) {
      console.error(`[${requestId}] Failed to send OTP:`, emailError.message);
    }

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    if (user.role.toUpperCase() === 'INSTITUTE' && user.walletAddress) {
      userData.walletAddress = user.walletAddress;
    }

    return res.status(201).json(successResponse({
      user: userData,
      requiresOtp: true,
      email: user.email
    }, 'Registration successful. Please check your email for a verification code.', 201));

  } catch (error) {
    console.error(`[${requestId}] Registration error:`, error);
    const { response, statusCode } = errorResponse(
      'INTERNAL_ERROR',
      'Registration failed',
      process.env.NODE_ENV === 'development' ? { error: error.message } : {},
      requestId
    );
    return res.status(statusCode).json(response);
  }
};

export const login = async (req, res) => {
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    const { email, password } = req.body;
    console.log(`[${requestId}] Login attempt for email: ${email}`);

    if (!email || !password) {
      const { response, statusCode } = errorResponse(
        'MISSING_REQUIRED_FIELD',
        'Email and password are required',
        { required: ['email', 'password'] },
        requestId
      );
      return res.status(statusCode).json(response);
    }

    let user;
    try {
      user = await User.findByEmail(email);
    } catch (dbError) {
      console.error(`[${requestId}] Database error while finding user:`, dbError);
      const { response, statusCode } = errorResponse(
        'DATABASE_ERROR',
        'Error accessing user database',
        process.env.NODE_ENV === 'development' ? { error: dbError.message } : {},
        requestId
      );
      return res.status(statusCode).json(response);
    }

    if (!user) {
      console.log(`[${requestId}] No user found with email: ${email}`);
      const { response, statusCode } = errorResponse(
        'INVALID_CREDENTIALS',
        'Invalid email or password',
        null,
        requestId
      );
      return res.status(statusCode).json(response);
    }

    console.log(`[${requestId}] User found: ${user._id}`);

    let isPasswordValid = false;
    try {
      isPasswordValid = await user.comparePassword(password);
    } catch (passwordError) {
      console.error(`[${requestId}] Error comparing passwords:`, passwordError);
      const { response, statusCode } = errorResponse(
        'AUTHENTICATION_ERROR',
        'Error verifying password',
        process.env.NODE_ENV === 'development' ? { error: passwordError.message } : {},
        requestId
      );
      return res.status(statusCode).json(response);
    }

    if (!isPasswordValid) {
      console.log(`[${requestId}] Invalid password for user: ${user._id}`);
      const { response, statusCode } = errorResponse(
        'INVALID_CREDENTIALS',
        'Invalid email or password',
        null,
        requestId
      );
      return res.status(statusCode).json(response);
    }

    console.log(`[${requestId}] Password validation successful`);

    let token, refreshToken;
    try {
      token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
    } catch (tokenError) {
      console.error(`[${requestId}] Error generating tokens:`, tokenError);
      const { response, statusCode } = errorResponse(
        'TOKEN_GENERATION_ERROR',
        'Error generating authentication tokens',
        process.env.NODE_ENV === 'development' ? { error: tokenError.message } : {},
        requestId
      );
      return res.status(statusCode).json(response);
    }

    try {
      user.refreshToken = refreshToken;
      await user.save();
    } catch (saveError) {
      console.error(`[${requestId}] Error saving refresh token:`, saveError);
    }

    console.log(`[${requestId}] Tokens generated successfully`);

    try {
      user.lastLogin = Date.now();
      if (Array.isArray(user.loginHistory)) {
        user.loginHistory.push({
          timestamp: Date.now(),
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown'
        });
        if (user.loginHistory.length > 10) user.loginHistory.shift();
      }
      await user.save();
    } catch (trackError) {
      console.error(`[${requestId}] Login tracking error:`, trackError);
    }

    try {
      const otp = generateOtp();
      user.otp = otp;
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await sendOtpEmail(user.email, user.name, otp);
      console.log(`[${requestId}] OTP sent to ${user.email}`);
    } catch (emailError) {
      console.error(`[${requestId}] Failed to send OTP:`, emailError.message);
    }

    return res.status(200).json(successResponse({
      requiresOtp: true,
      email: user.email
    }, 'Verification code sent to your email.'));

  } catch (error) {
    console.error(`[${requestId}] Login error:`, error);

    let errorCode = 'INTERNAL_ERROR';
    let errorMessage = 'Login failed due to an internal error';

    if (error.name === 'ValidationError') {
      errorCode = 'VALIDATION_ERROR';
      errorMessage = 'Validation failed: ' + (error.message || '');
    } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      errorCode = 'DATABASE_ERROR';
      errorMessage = 'Database operation failed';
    } else if (error.name === 'JsonWebTokenError') {
      errorCode = 'TOKEN_ERROR';
      errorMessage = 'Error with authentication token';
    }

    const { response, statusCode } = errorResponse(
      errorCode,
      errorMessage,
      process.env.NODE_ENV === 'development' ? { error: error.message, stack: error.stack } : {},
      requestId
    );
    return res.status(statusCode).json(response);
  }
};

export const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    if (!refreshToken) {
      const { response, statusCode } = errorResponse(
        'MISSING_REQUIRED_FIELD',
        'Refresh token is required',
        null,
        requestId
      );
      return res.status(statusCode).json(response);
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    } catch (err) {
      const { response, statusCode } = errorResponse(
        'TOKEN_EXPIRED',
        'Invalid or expired refresh token',
        null,
        requestId
      );
      return res.status(statusCode).json(response);
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      const { response, statusCode } = errorResponse(
        'UNAUTHORIZED',
        'Invalid refresh token',
        null,
        requestId
      );
      return res.status(statusCode).json(response);
    }

    const newAccessToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();
    await user.save();

    return res.status(200).json(successResponse({
      tokens: {
        access: newAccessToken,
        refresh: newRefreshToken
      }
    }, 'Tokens refreshed successfully'));

  } catch (error) {
    console.error('Token refresh error:', error);
    const { response, statusCode } = errorResponse(
      'INTERNAL_ERROR',
      'Failed to refresh token',
      {
        errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      requestId
    );
    return res.status(statusCode).json(response);
  }
};

export const verifyEmail = async (req, res) => {
  const { token, email } = req.query;
  const requestId = crypto.randomBytes(4).toString('hex');
  try {
    if (!token || !email) {
      return res.status(400).json({ success: false, message: 'Invalid verification link' });
    }
    const user = await User.findOne({
      email,
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Verification link is invalid or has expired' });
    }
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();
    return res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error(`[${requestId}] Email verification error:`, error);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const requestId = crypto.randomBytes(4).toString('hex');

  try {
    if (!email || !otp) {
      const { response, statusCode } = errorResponse(
        'MISSING_REQUIRED_FIELD',
        'Email and OTP are required',
        null,
        requestId
      );
      return res.status(statusCode).json(response);
    }

    const user = await User.findOne({ email }).select('+password +refreshToken +otp +otpExpiry');

    if (!user) {
      const { response, statusCode } = errorResponse(
        'INVALID_OTP',
        'Invalid or expired verification code',
        null,
        requestId
      );
      return res.status(statusCode).json(response);
    }

    if (!user.otp || user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      const { response, statusCode } = errorResponse(
        'INVALID_OTP',
        'Invalid or expired verification code',
        null,
        requestId
      );
      return res.status(statusCode).json(response);
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    user.refreshToken = refreshToken;
    await user.save();

    // ── log login activity ────────────────────────────────────────
    await logActivity({
      userId: user._id,
      type: 'LOGIN',
      description: 'Logged in successfully',
      meta: { email: user.email },
      req
    });

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      ...(user.walletAddress && { walletAddress: user.walletAddress })
    };

    console.log(`[${requestId}] OTP verified for ${email}`);

    return res.status(200).json(successResponse({
      user: userData,
      tokens: {
        access: token,
        refresh: refreshToken
      }
    }, 'Login successful'));

  } catch (error) {
    console.error(`[${requestId}] OTP verification error:`, error);
    const { response, statusCode } = errorResponse(
      'INTERNAL_ERROR',
      'OTP verification failed',
      null,
      requestId
    );
    return res.status(statusCode).json(response);
  }
};

export const sendPasswordResetOtp = async (req, res) => {
  const { email } = req.body;
  const requestId = crypto.randomBytes(4).toString('hex');
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'This email does not exist.' });
    }
    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOtpEmail(email, user.name, otp);
    console.log(`[${requestId}] Password reset OTP sent to ${email}`);
    return res.status(200).json({ success: true, message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error(`[${requestId}] Send reset OTP error:`, error);
    return res.status(500).json({ success: false, message: 'Failed to send code' });
  }
};

export const resetPasswordWithOtp = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const requestId = crypto.randomBytes(4).toString('hex');
  try {
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, code and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const user = await User.findOne({
      email,
      otp,
      otpExpiry: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }
    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // ── log password change activity ──────────────────────────────
    await logActivity({
      userId: user._id,
      type: 'PASSWORD_CHANGE',
      description: 'Password changed via email verification code',
      meta: { email: user.email },
      req
    });

    console.log(`[${requestId}] Password reset for ${email}`);
    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error(`[${requestId}] Reset password error:`, error);
    return res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};