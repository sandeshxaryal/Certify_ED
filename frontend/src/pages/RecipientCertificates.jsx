import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FiSearch, FiAward, FiDownload, FiAlertCircle,
  FiMail, FiCheckCircle, FiClock, FiRefreshCw, FiX
} from 'react-icons/fi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Spinner = ({ small }) => (
  <svg className={`animate-spin ${small ? 'h-4 w-4' : 'h-8 w-8'} text-emerald-600`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

const RecipientCertificates = () => {
  const [email, setEmail]               = useState('');
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [downloading, setDownloading]   = useState(null);
  const [error, setError]               = useState('');
  const [searched, setSearched]         = useState(false);

  useEffect(() => {
    if (!email || !searched) return;
    const interval = setInterval(() => handleRefresh(), 30000);
    return () => clearInterval(interval);
  }, [email, searched]);

  const fetchCertificates = async (emailValue) => {
    const response = await axios.get(
      `${API_URL}/api/certificates/email/${encodeURIComponent(emailValue)}`
    );
    const all = response.data?.data?.certificates || [];
return all.filter(c => !c.revoked);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!email || !email.match(/\S+@\S+\.\S+/)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    setCertificates([]);
    try {
      const certs = await fetchCertificates(email);
      setCertificates(certs);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch certificates. Please try again.');
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const certs = await fetchCertificates(email);
      setCertificates(certs);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCert = async (pdfUrl, code) => {
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${code || 'download'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadOne = async (cert) => {
    const pdfUrl = cert._links?.pdf;
    if (!pdfUrl) return;
    setDownloading(cert.certificateId);
    await downloadCert(pdfUrl, cert.verificationCode);
    setDownloading(null);
  };

  const handleDownloadAll = async () => {
    setDownloading('all');
    for (const cert of certificates) {
      const pdfUrl = cert._links?.pdf;
      if (!pdfUrl) continue;
      await downloadCert(pdfUrl, cert.verificationCode);
      await new Promise(r => setTimeout(r, 800));
    }
    setDownloading(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100">

      {/* Hero */}
      <div className="bg-emerald-800 text-white py-10">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-3xl font-bold mb-2">Find Your Certificates</h1>
          <p className="text-emerald-200 text-base">
            View &amp; download all digital certificates issued to your email address
          </p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">

        {/* Search box — narrower, centered */}
        <div className="max-w-3xl mx-auto bg-white border border-stone-200 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-stone-800 mb-4">Enter your email address</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                autoFocus
                required
                className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {loading ? <Spinner small /> : <FiSearch className="w-4 h-4" />}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {error && (
            <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-200 text-sm">
              <FiAlertCircle className="flex-shrink-0 w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {searched && (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-stone-800">
                  {certificates.length > 0 ? `Certificates for ${email}` : 'No certificates found'}
                </h2>
                {certificates.length > 0 && (
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {certificates.length} certificate{certificates.length !== 1 ? 's' : ''} found
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {certificates.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    disabled={downloading === 'all'}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-60 font-medium"
                  >
                    {downloading === 'all' ? 'Downloading…' : 'Download All'}
                  </button>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  title="Refresh"
                  className="p-2 border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : 'text-stone-600'}`} />
                </button>
              </div>
            </div>

            {/* Loading */}
            {loading ? (
              <div className="bg-white border border-stone-200 rounded-xl p-12 flex justify-center items-center">
                <Spinner />
              </div>
            ) : certificates.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-xl p-12 text-center shadow-sm">
                <FiAward className="mx-auto text-stone-300 mb-3 w-12 h-12" />
                <h3 className="text-base font-semibold text-stone-800 mb-1">No certificates found</h3>
                <p className="text-sm text-stone-500 mb-1">
                  We couldn't find any certificates associated with this email address.
                </p>
                <p className="text-xs text-stone-400 mb-5">
                  If you believe you should have certificates, please contact the issuing institution.
                </p>
                <button
                  onClick={() => { setEmail(''); setSearched(false); setError(''); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <FiX className="w-4 h-4" /> Try a different email
                </button>
              </div>
            ) : (
              /* Table */
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
                      <th className="py-3.5 px-5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {certificates.map((cert, index) => (
                      <tr key={cert.certificateId} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-4 px-5 text-sm text-stone-400">{index + 1}</td>
                        <td className="py-4 px-5 text-sm">
                          <span className="font-mono font-bold text-emerald-700 tracking-widest">
                            {cert.verificationCode || '—'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm">
                          <div className="font-medium text-stone-900">{cert.candidateName || '—'}</div>
                          <div className="text-xs text-stone-400 mt-0.5">{cert.recipientEmail || ''}</div>
                        </td>
                        <td className="py-4 px-5 text-sm text-stone-700 hidden md:table-cell">
                          {cert.institutionName || '—'}
                        </td>
                        <td className="py-4 px-5 text-sm text-stone-700 hidden sm:table-cell">
                          {cert.courseName || '—'}
                        </td>
                        <td className="py-4 px-5 text-sm hidden lg:table-cell">
                          {cert.gpa !== null && cert.gpa !== undefined
                            ? <span className="font-medium text-stone-800">{parseFloat(cert.gpa).toFixed(2)}</span>
                            : <span className="text-stone-400">—</span>
                          }
                        </td>
                        <td className="py-4 px-5 text-sm text-stone-600 hidden sm:table-cell">
                          {formatDate(cert.issuedDate || cert.createdAt)}
                        </td>
                        
                        <td className="py-4 px-5 text-center">
                          <button
                            onClick={() => handleDownloadOne(cert)}
                            disabled={!cert._links?.pdf || downloading === cert.certificateId}
                            title="Download certificate"
                            className="inline-flex items-center justify-center w-8 h-8 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {downloading === cert.certificateId
                              ? <Spinner small />
                              : <FiDownload className="w-3.5 h-3.5" />
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecipientCertificates;