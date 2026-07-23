import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  FiSearch, FiDownload, FiPlus,
  FiAlertCircle, FiFileText, FiRefreshCw, FiUpload,
  FiMail, FiX, FiCheckCircle, FiSlash, FiRotateCcw
} from 'react-icons/fi';

/* ─── helpers ────────────────────────────────────────────────────── */
const Spinner = ({ small }) => (
  <svg className={`animate-spin ${small ? 'h-4 w-4' : 'h-8 w-8'} text-emerald-600`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const buildPdfUrl = (cert) =>
  cert?.ipfsHash
    ? `https://gateway.pinata.cloud/ipfs/${cert.ipfsHash}`
    : `/api/certificates/${cert.certificateId}/view-pdf?download=true&timestamp=${Date.now()}`;

const downloadCert = async (cert) => {
  const pdfUrl = buildPdfUrl(cert);
  try {
    const response = await fetch(pdfUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificate-${cert.verificationCode || cert.shortCode || cert.certificateId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    window.open(pdfUrl, '_blank');
  }
};

/* ─── Toast ──────────────────────────────────────────────────────── */
const Toast = ({ message, type, onClose }) => (
  <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 shadow-lg text-sm border
    ${type === 'success' ? 'bg-white border-emerald-200 text-emerald-700' : 'bg-white border-red-200 text-red-700'}`}>
    {type === 'success'
      ? <FiCheckCircle className="w-4 h-4 shrink-0" />
      : <FiAlertCircle className="w-4 h-4 shrink-0" />}
    {message}
    <button onClick={onClose} className="ml-2 text-stone-400 hover:text-stone-600"><FiX className="w-3.5 h-3.5" /></button>
  </div>
);

/* ─── Revoke Confirmation Dialog ─────────────────────────────────── */
const RevokeDialog = ({ cert, onClose, onConfirm, revoking }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="bg-white shadow-xl w-full max-w-md">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-100 flex items-center justify-center">
            <FiSlash className="w-4 h-4 text-red-600" />
          </div>
          <h3 className="text-sm font-semibold text-stone-900">Revoke Certificate</h3>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-stone-100 transition-colors">
          <FiX className="w-4 h-4 text-stone-500" />
        </button>
      </div>
      <div className="px-5 py-5 space-y-4">
        <p className="text-sm text-stone-600">
          Are you sure you want to revoke this certificate? It will be marked as invalid and
          verification will be blocked. You can unrevoke it later.
        </p>
        <div className="bg-stone-50 border border-stone-200 px-4 py-3 text-sm">
          <div className="font-semibold text-stone-900">{cert?.candidateName}</div>
          <div className="text-stone-500 text-xs mt-0.5">{cert?.courseName}</div>
          <div className="font-mono text-emerald-700 text-xs mt-1">{cert?.verificationCode || cert?.shortCode}</div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-600 text-sm hover:bg-stone-50 transition-colors font-medium">
            Cancel
          </button>
          <button onClick={() => onConfirm(cert)} disabled={revoking}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {revoking
              ? <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Revoking…</>
              : <><FiSlash className="w-4 h-4" />Revoke Certificate</>}
          </button>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Mail Dialog ────────────────────────────────────────────────── */
const MailDialog = ({ cert, onClose, onSend, sending }) => {
  const [email, setEmail] = useState(cert?.recipientEmail || '');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
  const handleSubmit = (e) => { e.preventDefault(); onSend(cert, email); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Send Certificate</h3>
            <p className="text-xs text-stone-400 mt-0.5">{cert?.candidateName} — {cert?.courseName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 transition-colors">
            <FiX className="w-4 h-4 text-stone-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Recipient Email</label>
            <input ref={inputRef} type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="recipient@example.com" required />
            {cert?.recipientEmail && email !== cert.recipientEmail && (
              <button type="button" onClick={() => setEmail(cert.recipientEmail)}
                className="mt-1 text-xs text-emerald-600 hover:text-emerald-700">
                ↩ Reset to original ({cert.recipientEmail})
              </button>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-600 text-sm hover:bg-stone-50 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={sending}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {sending
                ? <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending…</>
                : <><FiMail className="w-4 h-4" />Send Certificate</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Action buttons (active cert) ──────────────────────────────── */
const ActionBtns = ({ cert, downloading, mailing, revoking, onDownload, onMail, onRevoke }) => (
  <div className="inline-flex items-center gap-1.5 justify-end">
    <button onClick={() => onDownload(cert)} disabled={downloading === cert.certificateId}
      title="Download PDF"
      className="inline-flex items-center justify-center w-8 h-8 bg-emerald-700 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {downloading === cert.certificateId ? <Spinner small /> : <FiDownload className="w-3.5 h-3.5" />}
    </button>
    <button onClick={() => onMail(cert)} disabled={mailing === cert.certificateId}
      title="Send via email"
      className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {mailing === cert.certificateId ? <Spinner small /> : <FiMail className="w-3.5 h-3.5" />}
    </button>
    <button onClick={() => onRevoke(cert)} disabled={revoking === cert.certificateId}
      title="Revoke certificate"
      className="inline-flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {revoking === cert.certificateId ? <Spinner small /> : <FiSlash className="w-3.5 h-3.5" />}
    </button>
  </div>
);

/* ─── Revoked row badge ──────────────────────────────────────────── */
const RevokedBadge = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold">
    <FiSlash className="w-3 h-3" /> Revoked
  </span>
);

/* ─── Generated Table ────────────────────────────────────────────── */
const GeneratedTable = ({ certs, downloading, mailing, revoking, onDownloadOne, onMailOne, onRevoke, onUnrevoke }) => {
  const active  = certs.filter(c => !c.revoked);
  const revoked = certs.filter(c => c.revoked);
  const rows = [...active, ...revoked];

  return (
    <div className="bg-white border border-stone-200 shadow-sm overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200">
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider w-10">#</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Code</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Candidate</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden md:table-cell">Institution</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">Course</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden lg:table-cell">GPA</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">Issued</th>
            <th className="py-3.5 px-5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((cert, i) => (
            <tr key={cert.certificateId || cert._id}
              className={`transition-colors ${cert.revoked ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-stone-50/70'}`}>
              <td className="py-4 px-5 text-sm text-stone-400">{i + 1}</td>
              <td className="py-4 px-5 text-sm">
                <span className={`font-mono font-bold tracking-widest ${cert.revoked ? 'text-red-400 line-through' : 'text-emerald-700'}`}>
                  {cert.verificationCode || cert.shortCode || '—'}
                </span>
                {cert.revoked && <div className="mt-1"><RevokedBadge /></div>}
              </td>
              <td className="py-4 px-5 text-sm">
                <div className={`font-medium ${cert.revoked ? 'text-stone-400' : 'text-stone-900'}`}>{cert.candidateName || '—'}</div>
                <div className="text-xs text-stone-400 mt-0.5">{cert.recipientEmail || ''}</div>
              </td>
              <td className={`py-4 px-5 text-sm hidden md:table-cell ${cert.revoked ? 'text-stone-400' : 'text-stone-700'}`}>
                {cert.orgName || cert.institutionName || '—'}
              </td>
              <td className={`py-4 px-5 text-sm hidden sm:table-cell ${cert.revoked ? 'text-stone-400' : 'text-stone-700'}`}>
                {cert.courseName || '—'}
              </td>
              <td className="py-4 px-5 text-sm hidden lg:table-cell">
                {cert.gpa !== null && cert.gpa !== undefined
                  ? <span className={`font-medium ${cert.revoked ? 'text-stone-400' : 'text-stone-800'}`}>{parseFloat(cert.gpa).toFixed(2)}</span>
                  : <span className="text-stone-400">—</span>}
              </td>
              <td className={`py-4 px-5 text-sm hidden sm:table-cell ${cert.revoked ? 'text-stone-400' : 'text-stone-600'}`}>
                {formatDate(cert.issuedDate || cert.createdAt)}
              </td>
              <td className="py-4 px-5 text-right">
                {cert.revoked ? (
                  <button onClick={() => onUnrevoke(cert)} disabled={revoking === cert.certificateId}
                    title="Unrevoke certificate"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 text-stone-600 text-xs hover:bg-emerald-100 hover:text-emerald-700 transition-colors disabled:opacity-50 font-medium">
                    {revoking === cert.certificateId ? <Spinner small /> : <FiRotateCcw className="w-3.5 h-3.5" />}
                    Unrevoke
                  </button>
                ) : (
                  <ActionBtns cert={cert} downloading={downloading} mailing={mailing} revoking={revoking}
                    onDownload={onDownloadOne} onMail={onMailOne} onRevoke={onRevoke} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─── External Table ─────────────────────────────────────────────── */
const ExternalTable = ({ certs, downloading, mailing, revoking, onDownloadOne, onMailOne, onRevoke, onUnrevoke }) => {
  const active  = certs.filter(c => !c.revoked);
  const revoked = certs.filter(c => c.revoked);
  const rows = [...active, ...revoked];

  return (
    <div className="bg-white border border-stone-200 shadow-sm overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200">
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider w-10">#</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Code</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Candidate</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">Course / Program</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden md:table-cell">Recipient Email</th>
            <th className="py-3.5 px-5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">Signed Date</th>
            <th className="py-3.5 px-5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((cert, i) => (
            <tr key={cert.certificateId || cert._id}
              className={`transition-colors ${cert.revoked ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-stone-50/70'}`}>
              <td className="py-4 px-5 text-sm text-stone-400">{i + 1}</td>
              <td className="py-4 px-5 text-sm">
                <span className={`font-mono font-bold tracking-widest ${cert.revoked ? 'text-red-400 line-through' : 'text-emerald-700'}`}>
                  {cert.verificationCode || cert.shortCode || '—'}
                </span>
                {cert.revoked && <div className="mt-1"><RevokedBadge /></div>}
              </td>
              <td className="py-4 px-5 text-sm">
                <div className={`font-medium ${cert.revoked ? 'text-stone-400' : 'text-stone-900'}`}>{cert.candidateName || '—'}</div>
              </td>
              <td className={`py-4 px-5 text-sm hidden sm:table-cell ${cert.revoked ? 'text-stone-400' : 'text-stone-700'}`}>
                {cert.courseName || '—'}
              </td>
              <td className={`py-4 px-5 text-sm hidden md:table-cell ${cert.revoked ? 'text-stone-400' : 'text-stone-500'}`}>
                {cert.recipientEmail || '—'}
              </td>
              <td className={`py-4 px-5 text-sm hidden sm:table-cell ${cert.revoked ? 'text-stone-400' : 'text-stone-600'}`}>
                {formatDate(cert.createdAt)}
              </td>
              <td className="py-4 px-5 text-right">
                {cert.revoked ? (
                  <button onClick={() => onUnrevoke(cert)} disabled={revoking === cert.certificateId}
                    title="Unrevoke"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 text-stone-600 text-xs hover:bg-emerald-100 hover:text-emerald-700 transition-colors disabled:opacity-50 font-medium">
                    {revoking === cert.certificateId ? <Spinner small /> : <FiRotateCcw className="w-3.5 h-3.5" />}
                    Unrevoke
                  </button>
                ) : (
                  <ActionBtns cert={cert} downloading={downloading} mailing={mailing} revoking={revoking}
                    onDownload={onDownloadOne} onMail={onMailOne} onRevoke={onRevoke} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─── Section wrapper ────────────────────────────────────────────── */
const Section = ({ title, badge, icon: Icon, accentClass, children, count, certs, onDownloadAll, onMailAll, onExportExcel, downloading, mailing }) => (
  <div className="space-y-3">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accentClass}`} />
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        <span className={`text-xs font-semibold px-2 py-0.5 ${badge}`}>{count}</span>
      </div>
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
          <button onClick={onDownloadAll} disabled={downloading === 'all'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white text-xs hover:bg-emerald-600 transition-colors disabled:opacity-60 font-medium whitespace-nowrap">
            <FiDownload className="w-3.5 h-3.5" /> Download All (PDF)
          </button>
          <button onClick={onMailAll} disabled={mailing === 'all'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs hover:bg-blue-500 transition-colors disabled:opacity-60 font-medium whitespace-nowrap">
            <FiMail className="w-3.5 h-3.5" />
            {mailing === 'all' ? 'Sending…' : 'Mail All'}
          </button>
          <button onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-700 text-white text-xs hover:bg-stone-600 transition-colors font-medium whitespace-nowrap">
            <FiDownload className="w-3.5 h-3.5" /> Export Excel
          </button>
        </div>
      )}
    </div>
    {children}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
const CertificatesPage = () => {
  const { user, authAxios } = useAuth();
  const location = useLocation();

  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [searchTerm, setSearchTerm]     = useState('');
  const [downloading, setDownloading]   = useState(null);
  const [mailing, setMailing]           = useState(null);
  const [revoking, setRevoking]         = useState(null);
  const [filter, setFilter]             = useState('all');
  const [mailTarget, setMailTarget]     = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [toast, setToast]               = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { if (user) fetchCertificates(); }, [user]);
  useEffect(() => {
    if (user && location.pathname === '/certificates') fetchCertificates();
  }, [location.pathname]);
  useEffect(() => {
    const onVisible = () => { if (user && document.visibilityState === 'visible') fetchCertificates(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', fetchCertificates);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', fetchCertificates);
    };
  }, [user]);

  const fetchCertificates = async () => {
    setLoading(true); setError('');
    try {
      const response = await authAxios.get('/users/certificates', {
        params: { search: searchTerm || undefined },
      });
      if (response.data.success) setCertificates(response.data.data);
      else throw new Error(response.data.message || 'Failed to load certificates');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load certificates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOne = async (cert) => {
    setDownloading(cert.certificateId);
    await downloadCert(cert);
    setDownloading(null);
  };

  const handleDownloadAll = async (certs) => {
    setDownloading('all');
    for (const cert of certs.filter(c => !c.revoked)) {
      await downloadCert(cert);
      await new Promise(r => setTimeout(r, 800));
    }
    setDownloading(null);
  };

  const handleMailOne = (cert) => setMailTarget(cert);

  const handleMailSend = async (cert, email) => {
    setMailing(cert.certificateId);
    try {
      const res = await authAxios.post(`/certificates/${cert.certificateId}/resend-email`, { email });
      if (res.data?.success) { showToast(`Certificate sent to ${email}`); setMailTarget(null); }
      else showToast(res.data?.message || 'Failed to send email', 'error');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send email', 'error');
    } finally { setMailing(null); }
  };

  const handleMailAll = async (certs) => {
    setMailing('all');
    let sent = 0, failed = 0;
    for (const cert of certs.filter(c => !c.revoked)) {
      if (!cert.recipientEmail) { failed++; continue; }
      try {
        const res = await authAxios.post(`/certificates/${cert.certificateId}/resend-email`, { email: cert.recipientEmail });
        if (res.data?.success) sent++; else failed++;
      } catch { failed++; }
      await new Promise(r => setTimeout(r, 400));
    }
    setMailing(null);
    showToast(
      failed === 0 ? `All ${sent} certificate${sent !== 1 ? 's' : ''} sent successfully`
        : `${sent} sent, ${failed} failed`,
      failed === 0 ? 'success' : 'error'
    );
  };

  const handleRevokeClick = (cert) => setRevokeTarget(cert);

  const handleRevokeConfirm = async (cert) => {
    setRevoking(cert.certificateId);
    try {
      const res = await authAxios.patch(`/certificates/${cert.certificateId}/revoke`);
      if (res.data?.success) {
        setCertificates(prev => prev.map(c =>
          c.certificateId === cert.certificateId ? { ...c, revoked: true } : c
        ));
        showToast('Certificate revoked successfully');
        setRevokeTarget(null);
      } else {
        showToast(res.data?.message || 'Failed to revoke', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to revoke', 'error');
    } finally { setRevoking(null); }
  };

  const handleUnrevoke = async (cert) => {
    setRevoking(cert.certificateId);
    try {
      const res = await authAxios.patch(`/certificates/${cert.certificateId}/unrevoke`);
      if (res.data?.success) {
        setCertificates(prev => prev.map(c =>
          c.certificateId === cert.certificateId ? { ...c, revoked: false } : c
        ));
        showToast('Certificate unrevoked successfully');
      } else {
        showToast(res.data?.message || 'Failed to unrevoke', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to unrevoke', 'error');
    } finally { setRevoking(null); }
  };

  const handleExportExcel = (certs, label) => {
    const rows = certs.map(cert => ({
      'Verification Code': cert.verificationCode || cert.shortCode || '',
      'Candidate Name': cert.candidateName || '',
      'Recipient Email': cert.recipientEmail || '',
      'Course Name': cert.courseName || '',
      'Institution': cert.institutionName || cert.orgName || '',
      'GPA': cert.gpa != null ? parseFloat(cert.gpa).toFixed(2) : '',
      'Issued Date': formatDate(cert.issuedDate || cert.createdAt),
      'Status': cert.revoked ? 'REVOKED' : 'VALID',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, label);
    XLSX.writeFile(wb, `certifyed_${label.toLowerCase().replace(' ', '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filtered = certificates.filter(cert =>
    [cert.courseName, cert.candidateName, cert.orgName, cert.institutionName, cert.certificateId, cert.shortCode, cert.verificationCode]
      .some(v => v?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const generated = filtered.filter(c => c.source !== 'external');
  const external  = filtered.filter(c => c.source === 'external');

  const showGenerated = filter === 'all' || filter === 'generated';
  const showExternal  = filter === 'all' || filter === 'external';
  const visibleCount  = (showGenerated ? generated.length : 0) + (showExternal ? external.length : 0);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="bg-white border border-stone-200 shadow-sm p-10 text-center max-w-sm">
        <FiAlertCircle className="mx-auto h-10 w-10 text-stone-300 mb-4" />
        <h2 className="text-lg font-semibold text-stone-900 mb-1">Not Logged In</h2>
        <p className="text-sm text-stone-500">Please log in to view your certificates</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-stone-100">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {mailTarget && (
        <MailDialog cert={mailTarget} onClose={() => setMailTarget(null)}
          onSend={handleMailSend} sending={mailing === mailTarget.certificateId} />
      )}

      {revokeTarget && (
        <RevokeDialog cert={revokeTarget} onClose={() => setRevokeTarget(null)}
          onConfirm={handleRevokeConfirm} revoking={revoking === revokeTarget.certificateId} />
      )}

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-stone-900">All Certificates</h1>
          <button onClick={fetchCertificates} disabled={loading} title="Refresh"
            className="p-2 border border-stone-300 hover:bg-stone-100 transition-colors">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : 'text-stone-600'}`} />
          </button>
        </div>

        <div className="bg-white border border-stone-200 shadow-sm px-5 py-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input type="text" placeholder="Search by name, course, or ID…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-stone-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
          </div>
          <div className="flex items-center gap-1 bg-stone-100 p-1 shrink-0">
            {[
              { key: 'all',       label: 'All',       count: filtered.length },
              { key: 'generated', label: 'Generated', count: generated.length },
              { key: 'external',  label: 'External',  count: external.length },
            ].map(({ key, label, count }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors
                  ${filter === key ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                {label}
                <span className={`text-xs px-1.5 py-0.5 font-medium
                  ${filter === key ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-stone-200 p-14 flex justify-center"><Spinner /></div>
        ) : visibleCount === 0 ? (
          <div className="bg-white border border-stone-200 p-14 text-center shadow-sm">
            <FiFileText className="mx-auto h-12 w-12 text-stone-300 mb-3" />
            <h3 className="text-base font-semibold text-stone-800 mb-1">No Certificates Found</h3>
            <p className="text-sm text-stone-500 mb-5">
              {searchTerm ? 'No certificates match your search.'
                : filter !== 'all' ? `You have no ${filter} certificates.`
                : "You haven't issued any certificates yet."}
            </p>
            {filter === 'all' && (
              <Link to="/generate"
                className="inline-flex items-center gap-2 bg-emerald-700 text-white text-sm px-4 py-2 hover:bg-emerald-600 transition-colors">
                <FiPlus className="w-4 h-4" /> Create Certificate
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-10">

            {showGenerated && generated.length > 0 && (
              <Section title="Generated Certificates" icon={FiFileText}
                accentClass="text-emerald-600" badge="bg-emerald-100 text-emerald-700"
                count={generated.length} certs={generated}
                downloading={downloading} mailing={mailing}
                onDownloadAll={() => handleDownloadAll(generated)}
                onMailAll={() => handleMailAll(generated)}
                onExportExcel={() => handleExportExcel(generated, 'Generated Certificates')}>
                <GeneratedTable certs={generated} downloading={downloading} mailing={mailing} revoking={revoking}
                  onDownloadOne={handleDownloadOne} onMailOne={handleMailOne}
                  onRevoke={handleRevokeClick} onUnrevoke={handleUnrevoke} />
              </Section>
            )}

            {showExternal && external.length > 0 && (
              <Section title="Uploaded & Signed Documents" icon={FiUpload}
                accentClass="text-sky-600" badge="bg-sky-100 text-sky-700"
                count={external.length} certs={external}
                downloading={downloading} mailing={mailing}
                onDownloadAll={() => handleDownloadAll(external)}
                onMailAll={() => handleMailAll(external)}
                onExportExcel={() => handleExportExcel(external, 'External Certificates')}>
                <ExternalTable certs={external} downloading={downloading} mailing={mailing} revoking={revoking}
                  onDownloadOne={handleDownloadOne} onMailOne={handleMailOne}
                  onRevoke={handleRevokeClick} onUnrevoke={handleUnrevoke} />
              </Section>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default CertificatesPage;