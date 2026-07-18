import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import LogoUpload from '../components/LogoUpload';
import { FiUser, FiMail, FiLock, FiUsers, FiExternalLink, FiEye, FiEyeOff, FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';

export default function AuthPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('INSTITUTE');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [showLogoOnboarding, setShowLogoOnboarding] = useState(false);
  const { login, register, verifyOtp, loading, error: authError } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /* ── forgot password state ──────────────────────────────────── */
  const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;
  const [forgotMode, setForgotMode] = useState(false);
  const [fpStep, setFpStep] = useState('request'); // request | otp | done
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpShowNew, setFpShowNew] = useState(false);
  const [fpShowConfirm, setFpShowConfirm] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  useEffect(() => { setError(''); }, [isRegistering]);

  const openForgotPassword = () => {
    setForgotMode(true);
    setFpStep('request');
    setFpEmail(email || '');
    setFpOtp(''); setFpNewPassword(''); setFpConfirmPassword('');
    setFpError('');
  };

  const closeForgotPassword = () => {
    setForgotMode(false);
    setFpStep('request');
    setFpEmail(''); setFpOtp(''); setFpNewPassword(''); setFpConfirmPassword('');
    setFpError('');
  };

  const handleSendForgotOtp = async (e) => {
    e.preventDefault();
    if (!fpEmail) { setFpError('Please enter your email address'); return; }
    setFpLoading(true);
    setFpError('');
    try {
      const res = await axios.post(`${apiUrl}/auth/send-reset-otp`, { email: fpEmail });
      if (res.data?.success) {
        setFpStep('otp');
      } else {
        setFpError(res.data?.message || 'Failed to send code');
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to send code');
    } finally {
      setFpLoading(false);
    }
  };

  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    if (fpNewPassword !== fpConfirmPassword) { setFpError('Passwords do not match'); return; }
    if (fpNewPassword.length < 6) { setFpError('Password must be at least 6 characters'); return; }
    setFpLoading(true);
    setFpError('');
    try {
      const res = await axios.post(`${apiUrl}/auth/reset-password`, {
        email: fpEmail,
        otp: fpOtp,
        newPassword: fpNewPassword
      });
      if (res.data?.success) {
        setFpStep('done');
      } else {
        setFpError(res.data?.message || 'Failed to reset password');
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setFpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (otpMode) {
        const success = await verifyOtp(otpEmail, otp);
        if (success) {
          // Fresh registrations get one extra beat to add a logo before landing
          // on the dashboard — logins skip straight through, they already have
          // whatever setup they had before.
          if (isRegistering) {
            setShowLogoOnboarding(true);
          } else {
            navigate('/');
          }
        } else {
          setError(authError || 'Invalid or expired verification code. Please try again.');
        }
        return;
      }

      if (isRegistering) {
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        const result = await register(name, email, password, role);
        if (result?.requiresOtp) {
          setOtpEmail(result.email);
          setOtpMode(true);
        } else {
          setError(authError || 'Registration failed. Please check your information and try again.');
        }
      } else {
        const result = await login(email, password, rememberMe);
        if (result?.requiresOtp) {
          setOtpEmail(result.email);
          setOtpMode(true);
        } else {
          setError(authError || 'Invalid email or password. Please try again.');
        }
      }
    } catch (err) {
      setError(err.message || (isRegistering ? 'Registration failed' : 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipLogin = () => navigate('/');

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setError(''); setShowPassword(false); setShowConfirmPassword(false);
    setRole('INSTITUTE');
  };

  const inputClass = "w-full pl-9 pr-4 py-2.5 bg-white border border-stone-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none transition-all";

  if (forgotMode) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-r from-gray-950 via-emerald-950 to-green-900">
        <div className="w-full max-w-md mx-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-8">
              {fpStep === 'request' && (
                <>
                  <h2 className="text-lg font-bold text-stone-900 mb-2">Reset your password</h2>
                  <p className="text-sm text-stone-500 mb-6">
                    Enter the email address associated with your account and we'll send you a verification code.
                  </p>

                  {fpError && (
                    <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                      <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{fpError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSendForgotOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Email Address</label>
                      <div className="relative">
                        <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                        <input
                          type="email"
                          autoComplete="email"
                          className={inputClass}
                          value={fpEmail}
                          onChange={e => setFpEmail(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={fpLoading}
                      className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {fpLoading ? 'Sending…' : 'Send verification code'}
                    </button>
                  </form>
                </>
              )}

              {fpStep === 'otp' && (
                <>
                  <h2 className="text-lg font-bold text-stone-900 mb-2">Enter code & new password</h2>
                  <p className="text-sm text-stone-500 mb-6">
                    A 6-digit code was sent to <strong>{fpEmail}</strong>. Enter it below along with your new password.
                  </p>

                  {fpError && (
                    <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                      <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{fpError}</span>
                    </div>
                  )}

                  <form onSubmit={handleForgotResetPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Verification Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        className="w-full px-4 py-3 bg-white border border-stone-300 text-2xl font-bold tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none transition-all"
                        value={fpOtp}
                        onChange={e => setFpOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="······"
                        required
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">New Password</label>
                      <div className="relative">
                        <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                        <input
                          type={fpShowNew ? 'text' : 'password'}
                          className={inputClass}
                          value={fpNewPassword}
                          onChange={e => setFpNewPassword(e.target.value)}
                          required
                        />
                        <button type="button" onClick={() => setFpShowNew(p => !p)} tabIndex={-1}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-600">
                          {fpShowNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Confirm New Password</label>
                      <div className="relative">
                        <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                        <input
                          type={fpShowConfirm ? 'text' : 'password'}
                          className={inputClass}
                          value={fpConfirmPassword}
                          onChange={e => setFpConfirmPassword(e.target.value)}
                          required
                        />
                        <button type="button" onClick={() => setFpShowConfirm(p => !p)} tabIndex={-1}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-600">
                          {fpShowConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={fpLoading || fpOtp.length !== 6}
                      className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {fpLoading ? 'Updating…' : 'Update Password'}
                    </button>
                  </form>

                  <div className="mt-4 text-center">
                    <button type="button" onClick={() => { setFpStep('request'); setFpOtp(''); setFpError(''); }}
                      className="text-sm text-stone-500 hover:text-stone-700 transition-colors">
                      ← Use a different email
                    </button>
                  </div>
                </>
              )}

              {fpStep === 'done' && (
                <>
                  <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm mb-6">
                    <FiCheckCircle className="w-4 h-4 shrink-0" />
                    <span>Your password has been updated successfully.</span>
                  </div>
                  <button type="button" onClick={closeForgotPassword}
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                    Back to sign in
                  </button>
                </>
              )}

              {fpStep !== 'done' && (
                <div className="mt-4 text-center">
                  <button type="button" onClick={closeForgotPassword}
                    className="text-sm text-stone-500 hover:text-stone-700 transition-colors inline-flex items-center gap-1">
                    <FiX className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (otpMode) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-r from-gray-950 via-emerald-950 to-green-900">
        <div className="w-full max-w-md mx-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-8">
              <h2 className="text-lg font-bold text-stone-900 mb-2">Enter verification code</h2>
              <p className="text-sm text-stone-500 mb-6">
                A 6-digit code was sent to <strong>{otpEmail}</strong>. Enter it below to continue.
              </p>

              {(authError || error) && (
                <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                  <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{authError || error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-white border border-stone-300 text-2xl font-bold tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none transition-all"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="······"
                    required
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={loading || submitting || otp.length !== 6}
                  className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading || submitting ? 'Verifying…' : 'Verify & Continue'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button type="button" onClick={() => { setOtpMode(false); setOtp(''); setError(''); }}
                  className="text-sm text-stone-500 hover:text-stone-700 transition-colors">
                  ← Back to sign in
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-r from-gray-950 via-emerald-950 to-green-900">

      <div className="w-full max-w-md mx-4">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-8">
            <h2 className="text-lg font-bold text-stone-900 mb-6">
              {isRegistering ? 'Create Account' : 'Sign in to access your dashboard'}
            </h2>

            {/* Error */}
            {(authError || error) && (
              <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{authError || error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {isRegistering && (
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Instituition Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                    <input type="text" className={inputClass} value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Email Address</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                  <input type="email" name="email" autoComplete="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                  <input type={showPassword ? 'text' : 'password'} className={inputClass} value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-600">
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
                {isRegistering && <p className="mt-1.5 text-xs text-stone-400">Minimum 8 characters with at least 1 letter and 1 number</p>}
                {!isRegistering && (
                  <div className="mt-1.5 text-right">
                    <button type="button" onClick={openForgotPassword} className="text-xs text-emerald-700 hover:text-emerald-600 font-medium transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              {isRegistering && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Confirm Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                      <input type={showConfirmPassword ? 'text' : 'password'} className={inputClass} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowConfirmPassword(p => !p)} tabIndex={-1}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-600">
                        {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center">
                <input type="checkbox" id="remember" className="w-4 h-4 text-emerald-600 border-stone-300 rounded focus:ring-emerald-500"
                  checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                <label htmlFor="remember" className="ml-2 text-sm text-stone-600">Remember me</label>
              </div>

              <button type="submit" disabled={loading || submitting}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {loading || submitting ? 'Processing…' : isRegistering ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="mt-5 space-y-4">
              <div className="text-center">
                <button type="button" onClick={toggleMode} className="text-sm text-emerald-700 hover:text-emerald-600 font-medium transition-colors">
                  {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-stone-400">or</span>
                </div>
              </div>

              <button type="button" onClick={() => navigate('/verify')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-stone-300 text-stone-600 text-sm hover:bg-stone-50 transition-colors">
                Verify without login
                <FiExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Post-registration logo onboarding ──────────────────────
            Shown once, right after a fresh institute account verifies its
            OTP. Skippable — the logo can always be added later from the
            Account page's Verification/Profile section. */}
        {showLogoOnboarding && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6">
              <h3 className="text-lg font-bold text-stone-900 mb-1">Add your institution's logo</h3>
              <p className="text-sm text-stone-500 mb-5">
                This logo will appear on every certificate you generate. You can skip this and add it anytime from your account settings.
              </p>

              <LogoUpload
                compact
                onLogoUpdated={() => navigate('/')}
              />

              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full mt-5 text-center text-sm text-stone-500 hover:text-stone-700 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}