import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  FiUser, FiMail, FiEdit2, FiSave, FiX,
  FiClipboard, FiAlertCircle, FiCheckCircle,
  FiCalendar, FiShield, FiEye, FiEyeOff, FiLock,
  FiSlash, FiRotateCcw
} from 'react-icons/fi';
import LogoUpload from '../components/LogoUpload';

/* ─── helpers ───────────────────────────────────────────────────── */
const formatMemberSince = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};

const initials = (name) =>
  name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

/* ─── copy button ────────────────────────────────────────────────── */
const CopyButton = ({ value, onCopied }) => (
  <button
    type="button"
    onClick={() => { navigator.clipboard.writeText(value); onCopied(); }}
    className="shrink-0 p-2  text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
    title="Copy to clipboard"
  >
    <FiClipboard className="w-3.5 h-3.5" />
  </button>
);

/* ─── collapsible key block ──────────────────────────────────────── */
const KeyBlock = ({ label, value, sensitive = false, onCopied }) => {
  const [open, setOpen]       = useState(false);
  const [visible, setVisible] = useState(false);

  if (!value) return null;

  return (
    <div
      className={` border overflow-hidden ${
        sensitive
          ? 'border-red-200 bg-red-50/40'
          : 'border-emerald-100 bg-emerald-50/30'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className={`text-xs font-semibold tracking-wide ${sensitive ? 'text-red-700' : 'text-emerald-800'}`}>
          {label}
          {sensitive && (
            <span className="ml-2 text-[10px] font-normal text-red-400">sensitive</span>
          )}
        </span>
        <span className={`text-[10px] font-medium transition-transform duration-200 ${open ? 'rotate-180' : ''} ${sensitive ? 'text-red-400' : 'text-emerald-500'}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {sensitive && (
            <div className="flex items-start gap-2 bg-red-100/60 border border-red-200  px-3 py-2">
              <FiAlertCircle className="shrink-0 w-3.5 h-3.5 mt-0.5 text-red-500" />
              <p className="text-[11px] text-red-700 leading-relaxed">
                Never share your private key. Keep it stored securely offline.
              </p>
            </div>
          )}
          <div className="relative">
            <textarea
              readOnly
              rows={4}
              value={visible ? value : value.replace(/./g, '•').slice(0, 80) + '…'}
              className="w-full text-[11px] font-mono bg-white border border-gray-200 py-2 px-3 pr-16 resize-none focus:outline-none text-gray-700 leading-relaxed"
            />
            <div className="absolute right-2 top-2 flex gap-1">
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="p-1.5  text-gray-400 hover:text-gray-600 transition-colors"
                title={visible ? 'Hide' : 'Reveal'}
              >
                {visible ? <FiEyeOff className="w-3 h-3" /> : <FiEye className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(value); onCopied(label); }}
                className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors"
                title="Copy"
              >
                <FiClipboard className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── activity helpers ───────────────────────────────────────────── */
const ACTIVITY_META = {
  LOGIN:                          { label: 'Login',                      color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  LOGOUT:                         { label: 'Sign Out',                   color: 'text-gray-500',    bg: 'bg-gray-50',     border: 'border-gray-100' },
  SIGNOUT:                        { label: 'Sign Out',                   color: 'text-gray-500',    bg: 'bg-gray-50',     border: 'border-gray-100' },
  SIGN_OUT:                       { label: 'Sign Out',                   color: 'text-gray-500',    bg: 'bg-gray-50',     border: 'border-gray-100' },
  PASSWORD_CHANGE:                { label: 'Password Changed',           color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
  PASSWORD_CHANGED:               { label: 'Password Changed',           color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
  CERTIFICATE_GENERATED:          { label: 'Certificate Generated',      color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-100' },
  CERTIFICATE_BULK_GENERATED:     { label: 'Bulk Certificates',          color: 'text-violet-600',  bg: 'bg-violet-50',   border: 'border-violet-100' },
  DOCUMENT_SIGNED:                { label: 'Document Signed',            color: 'text-teal-600',    bg: 'bg-teal-50',     border: 'border-teal-100' },
  EXTERNAL_CERTIFICATE_GENERATED: { label: 'External Certificate',       color: 'text-indigo-600',  bg: 'bg-indigo-50',   border: 'border-indigo-100' },
  CERTIFICATE_REVOKED:            { label: 'Certificate Revoked',        color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-100' },
  REVOKED:                        { label: 'Certificate Revoked',        color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-100' },
  CERTIFICATE_UNREVOKED:          { label: 'Certificate Unrevoked',      color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  UNREVOKED:                      { label: 'Certificate Unrevoked',      color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  CERTIFICATE_REINSTATED:         { label: 'Certificate Reinstated',     color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
};

const ActivityIcon = ({ type }) => {
  const icons = {
    LOGIN:                          <FiCheckCircle className="w-3.5 h-3.5" />,
    LOGOUT:                         <FiX           className="w-3.5 h-3.5" />,
    SIGNOUT:                        <FiX           className="w-3.5 h-3.5" />,
    SIGN_OUT:                       <FiX           className="w-3.5 h-3.5" />,
    PASSWORD_CHANGE:                <FiLock        className="w-3.5 h-3.5" />,
    PASSWORD_CHANGED:               <FiLock        className="w-3.5 h-3.5" />,
    CERTIFICATE_GENERATED:          <FiShield      className="w-3.5 h-3.5" />,
    CERTIFICATE_BULK_GENERATED:     <FiShield      className="w-3.5 h-3.5" />,
    EXTERNAL_CERTIFICATE_GENERATED: <FiShield      className="w-3.5 h-3.5" />,
    DOCUMENT_SIGNED:                <FiShield      className="w-3.5 h-3.5" />,
    CERTIFICATE_REVOKED:            <FiSlash       className="w-3.5 h-3.5" />,
    REVOKED:                        <FiSlash       className="w-3.5 h-3.5" />,
    CERTIFICATE_UNREVOKED:          <FiRotateCcw   className="w-3.5 h-3.5" />,
    UNREVOKED:                      <FiRotateCcw   className="w-3.5 h-3.5" />,
    CERTIFICATE_REINSTATED:         <FiRotateCcw   className="w-3.5 h-3.5" />,
  };
  return icons[type] || <FiCalendar className="w-3.5 h-3.5" />;
};

const formatExactTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/* ─── ActivitySection component ──────────────────────────────────── */
const PREVIEW_COUNT = 5;

const ActivitySection = ({ activity, loading, error, pagination, onLoadMore, onRefresh }) => {
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? activity : activity.slice(0, PREVIEW_COUNT);
  const hasMore   = activity.length > PREVIEW_COUNT || pagination?.hasMore;

  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-50 flex items-center justify-center">
            <FiCalendar className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Account Activity</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Logins, password changes, certificates &amp; signed documents</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <FiRotateCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="px-6 py-5">
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 mb-4">
            <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </div>
        )}

        {!error && activity.length === 0 && !loading && (
          <p className="text-xs text-gray-400 text-center py-6">No activity recorded yet.</p>
        )}

        {displayed.length > 0 && (
          <div className="space-y-0">
            {displayed.map((log, i) => {
              const meta   = ACTIVITY_META[log.type] || { label: log.type, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-100' };
              const isLast = i === displayed.length - 1;
              return (
                <div key={log._id} className="flex gap-3">
                  {/* timeline spine */}
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center ${meta.bg} ${meta.border} ${meta.color}`}>
                      <ActivityIcon type={log.type} />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-gray-100 my-1" />}
                  </div>

                  {/* content */}
                  <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className={`text-[11px] font-semibold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                        <p className="text-xs text-gray-700 mt-0.5 leading-snug">{log.description}</p>
                        {log.meta && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {log.meta.candidateName && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                {log.meta.candidateName}
                              </span>
                            )}
                            {log.meta.courseName && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                {log.meta.courseName}
                              </span>
                            )}
                            {(log.meta.verificationCode || log.meta.externalVerificationCode) && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">
                                #{log.meta.verificationCode || log.meta.externalVerificationCode}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">
                        {formatExactTime(log.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Show more / collapse controls */}
        {!loading && activity.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            {!showAll && hasMore && (
              <button
                onClick={() => {
                  if (activity.length > PREVIEW_COUNT) {
                    setShowAll(true);
                  } else if (pagination?.hasMore) {
                    onLoadMore();
                    setShowAll(true);
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-600 border border-emerald-100 hover:border-emerald-200 px-3 py-1.5 transition-colors"
              >
                View all activity
                <span className="rotate-90 inline-block">›</span>
              </button>
            )}
            {showAll && (
              <button
                onClick={() => setShowAll(false)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 transition-colors"
              >
                Show less
                <span className="-rotate-90 inline-block">›</span>
              </button>
            )}
            {showAll && pagination?.hasMore && !loading && (
              <button
                onClick={onLoadMore}
                className="text-xs text-emerald-700 hover:text-emerald-600 border border-emerald-100 hover:border-emerald-200 px-3 py-1.5 transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        )}

        {pagination && !pagination.hasMore && activity.length > 0 && showAll && (
          <p className="text-center text-[10px] text-gray-300 mt-3">
            {pagination.total} event{pagination.total !== 1 ? 's' : ''} total
          </p>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
const AccountPage = () => {
  const { user: authUser, authAxios, setUser } = useAuth();

  const [isEditing, setIsEditing]             = useState(false);
  const [formName, setFormName]               = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState('');
  const [localUser, setLocalUser]             = useState(null);
  const [hasInitialFetch, setHasInitialFetch] = useState(false);

  // ── password reset state ──────────────────────────────────────────
  const [pwStep, setPwStep]               = useState('idle');
  const [pwOtp, setPwOtp]                 = useState('');
  const [pwNew, setPwNew]                 = useState('');
  const [pwConfirm, setPwConfirm]         = useState('');
  const [pwError, setPwError]             = useState('');
  const [pwLoading, setPwLoading]         = useState(false);
  const [showPwNew, setShowPwNew]         = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

  const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

  // ── activity log state ────────────────────────────────────────────
  const [activity, setActivity]           = useState([]);
  const [actPage, setActPage]             = useState(1);
  const [actPagination, setActPagination] = useState(null);
  const [actLoading, setActLoading]       = useState(false);
  const [actError, setActError]           = useState('');
  const actFetchedRef                     = useRef(false);

  const user = authUser || localUser;

  /* ── initial load ─────────────────────────────────────────────── */
  useEffect(() => {
    if (authUser && !hasInitialFetch) {
      setLocalUser(authUser);
      setFormName(authUser.name || '');
      fetchUserProfile();
      setHasInitialFetch(true);
    }
  }, [authUser, hasInitialFetch]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await authAxios.get('/users/profile?includeKeys=true');
      if (response.data.success) {
        const profileData = response.data.data;
        const updatedUser = { ...authUser, ...profileData };
        setFormName(profileData.name || '');
        try { localStorage.setItem('userData', JSON.stringify(updatedUser)); } catch {}
        if (setUser) setUser(updatedUser); else setLocalUser(updatedUser);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── save name ────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await authAxios.put('/users/profile', { name: formName });
      if (response.data.success) {
        setSuccess('Name updated successfully');
        setIsEditing(false);
        fetchUserProfile();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(response.data.message || 'Failed to update');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setFormName(user?.name || '');
    setError('');
  };

  /* ── password reset handlers ──────────────────────────────────── */
  const handleSendResetOtp = async () => {
    setPwLoading(true);
    setPwError('');
    setPwStep('sending');
    try {
      const res = await axios.post(`${apiUrl}/auth/send-reset-otp`, { email: user.email });
      if (res.data?.success) {
        setPwStep('otp');
      } else {
        setPwError(res.data?.message || 'Failed to send code');
        setPwStep('idle');
      }
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to send code');
      setPwStep('idle');
    } finally {
      setPwLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) { setPwError('Passwords do not match'); return; }
    if (pwNew.length < 6) { setPwError('Password must be at least 6 characters'); return; }
    setPwLoading(true);
    setPwError('');
    try {
      const res = await axios.post(`${apiUrl}/auth/reset-password`, {
        email: user.email,
        otp: pwOtp,
        newPassword: pwNew
      });
      if (res.data?.success) {
        setPwStep('done');
        setSuccess('Password updated successfully');
        setTimeout(() => {
          setPwStep('idle');
          setPwOtp(''); setPwNew(''); setPwConfirm('');
          setSuccess('');
        }, 3000);
      } else {
        setPwError(res.data?.message || 'Failed to reset password');
      }
    } catch (err) {
      setPwError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setPwLoading(false);
    }
  };

  const cancelPasswordReset = () => {
    setPwStep('idle');
    setPwOtp(''); setPwNew(''); setPwConfirm(''); setPwError('');
  };

  /* ── activity log fetch ──────────────────────────────────────── */
  const fetchActivity = useCallback(async (page = 1) => {
    setActLoading(true);
    setActError('');
    try {
      const res = await authAxios.get(`/activity?page=${page}&limit=20&_=${Date.now()}`);
      if (res.data?.success) {
        const { logs, pagination } = res.data.data;
        setActivity(prev => page === 1 ? logs : [...prev, ...logs]);
        setActPagination(pagination);
        setActPage(page);
      } else {
        setActError('Failed to load activity');
      }
    } catch {
      setActError('Failed to load activity');
    } finally {
      setActLoading(false);
    }
  }, [authAxios]);

  useEffect(() => {
    if (user && !actFetchedRef.current) {
      actFetchedRef.current = true;
      fetchActivity(1);
    }
  }, [user, fetchActivity]);

  // Auto-refresh activity every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchActivity(1);
    }, 60000);
    return () => clearInterval(interval);
  }, [user, fetchActivity]);

  const handleCopied = (label) => {
    setSuccess(`${label} copied to clipboard`);
    setTimeout(() => setSuccess(''), 2500);
  };

  /* ── not logged in ────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white shadow-sm border border-gray-200 p-10 text-center max-w-sm">
          <div className="w-14 h-14 bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="w-7 h-7 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Not Logged In</h2>
          <p className="text-sm text-gray-500">Please log in to view your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/70">

      {/* ── toast notifications ──────────────────────────────────── */}
      {(error || success) && (
        <div className="fixed top-5 right-5 z-50 space-y-2">
          {error && (
            <div className="flex items-center gap-2 bg-white border border-red-200 text-red-700 px-4 py-2.5 shadow-lg text-sm">
              <FiAlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2.5 shadow-lg text-sm">
              <FiCheckCircle className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-5">

        {/* ══ PROFILE HEADER ═════════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 shadow-sm px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              {user.institutionLogo ? (
                <img src={user.institutionLogo} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xl font-bold text-emerald-600 select-none">{initials(user.name)}</span>
              )}
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">{user.name || 'Unnamed Account'}</h1>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                <FiCalendar className="w-3 h-3 text-gray-400" />
                Member since {formatMemberSince(user.createdAt)}
              </div>
            </div>
          </div>
        </div>

        {/* ══ ACCOUNT INFORMATION ════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-50 flex items-center justify-center">
                <FiUser className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900">Account Information</h2>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-white hover:text-white bg-emerald-800 hover:bg-emerald-600 border border-emerald-600 px-3 py-1.5 transition-colors"
              >
                <FiEdit2 className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>

          <div className="px-6 py-5 space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent animate-spin" />
              </div>
            ) : isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      placeholder="Your full name"
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Email Address
                    <span className="ml-1.5 text-gray-400 font-normal">(cannot be changed)</span>
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={user.email || ''}
                      disabled
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin" />
                      : <FiSave className="w-3.5 h-3.5" />
                    }
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium border border-gray-200 transition-colors"
                  >
                    <FiX className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                    <FiUser className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Full Name</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name || 'Not set'}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                    <FiMail className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Email Address</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{user.email || 'Not set'}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                    <FiCalendar className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Member Since</p>
                    <p className="text-sm font-medium text-gray-900">{formatMemberSince(user.createdAt)}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                    <FiLock className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Password</p>

                    {pwStep === 'idle' && (
                      <button
                        onClick={() => setPwStep('confirm')}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium transition-colors"
                      >
                        <FiLock className="w-3 h-3" />
                        Change password
                      </button>
                    )}

                    {pwStep === 'confirm' && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500">A verification code will be sent to <strong>{user.email}</strong>.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSendResetOtp}
                            disabled={pwLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {pwLoading
                              ? <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin" />
                              : <FiMail className="w-3 h-3" />}
                            Send code
                          </button>
                          <button
                            onClick={cancelPasswordReset}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
                          >
                            <FiX className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {pwStep === 'sending' && (
                      <p className="text-xs text-gray-400">Sending code to {user.email}…</p>
                    )}

                    {pwStep === 'otp' && (
                      <form onSubmit={handleResetPassword} className="space-y-3 mt-2">
                        <p className="text-xs text-gray-500">A 6-digit code was sent to <strong>{user.email}</strong>. Enter it below along with your new password.</p>

                        {pwError && (
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">
                            <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />{pwError}
                          </div>
                        )}

                        <div>
                          <label className="block text-[11px] font-medium text-gray-500 mb-1">Verification Code</label>
                          <input
                            type="text"
                            maxLength={6}
                            value={pwOtp}
                            onChange={e => setPwOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="······"
                            required
                            autoFocus
                            className="w-full px-3 py-2 text-lg font-bold tracking-widest text-center border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-500 mb-1">New Password</label>
                          <div className="relative">
                            <input
                              type={showPwNew ? 'text' : 'password'}
                              value={pwNew}
                              onChange={e => setPwNew(e.target.value)}
                              placeholder="New password"
                              required
                              className="w-full px-3 py-2 pr-9 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />
                            <button type="button" onClick={() => setShowPwNew(v => !v)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showPwNew ? <FiEyeOff className="w-3.5 h-3.5" /> : <FiEye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-500 mb-1">Confirm Password</label>
                          <div className="relative">
                            <input
                              type={showPwConfirm ? 'text' : 'password'}
                              value={pwConfirm}
                              onChange={e => setPwConfirm(e.target.value)}
                              placeholder="Confirm new password"
                              required
                              className="w-full px-3 py-2 pr-9 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />
                            <button type="button" onClick={() => setShowPwConfirm(v => !v)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showPwConfirm ? <FiEyeOff className="w-3.5 h-3.5" /> : <FiEye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button type="submit" disabled={pwLoading || pwOtp.length !== 6}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium transition-colors disabled:opacity-50">
                            {pwLoading
                              ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin" />
                              : <FiSave className="w-3.5 h-3.5" />}
                            Update Password
                          </button>
                          <button type="button" onClick={cancelPasswordReset}
                            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                            <FiX className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {pwStep === 'done' && (
                      <div className="flex items-center gap-2 text-xs text-emerald-700">
                        <FiCheckCircle className="w-3.5 h-3.5" /> Password updated successfully
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Logo Upload (always shown, not editing) ──────────── */}
            {!isEditing && (
              <div className="border-t border-gray-100 pt-5">
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-3">Logo</p>
                <LogoUpload
                  currentLogo={user.institutionLogo}
                  compact
                  onLogoUpdated={(newLogoUrl) => {
                    const updatedUser = { ...user, institutionLogo: newLogoUrl };
                    try {
                      const stored = localStorage.getItem('userData');
                      if (stored) {
                        const ud = JSON.parse(stored);
                        ud.institutionLogo = newLogoUrl;
                        localStorage.setItem('userData', JSON.stringify(ud));
                      }
                    } catch {}
                    if (setUser) setUser(updatedUser); else setLocalUser(updatedUser);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ══ ACCOUNT ACTIVITY ═══════════════════════════════════════ */}
        <ActivitySection
          activity={activity}
          loading={actLoading}
          error={actError}
          pagination={actPagination}
          onLoadMore={() => fetchActivity(actPage + 1)}
          onRefresh={() => fetchActivity(1)}
        />
      </div>
    </div>
  );
};

export default AccountPage;