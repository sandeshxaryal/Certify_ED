import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  FiUpload, FiCheck, FiX, FiSearch, FiFileText,
  FiCheckCircle, FiAlertCircle, FiDownload, FiSlash
} from 'react-icons/fi';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/certificates`;

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true
  }).format(date);
};

const Spinner = () => (
  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const VerifyCertificate = () => {
  const [verificationMethod, setVerificationMethod] = useState('code');
  const [certificateCode, setCertificateCode] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const fileInputRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const codeParam = queryParams.get('code');
    const autoVerify = queryParams.get('auto') === 'true';
    if (codeParam) {
      setCertificateCode(codeParam);
      setVerificationMethod('code');
      if (autoVerify) verifyByCode(codeParam);
    }
  }, []);

  const normalizeResponseData = (data) => {
    const cert = data.certificate || {};
    return {
      status: cert.revoked ? 'revoked' : 'verified',
      revoked: !!cert.revoked,
      certificate: {
        candidateName: cert.candidateName || '',
        courseName: cert.courseName || '',
        issuedAt: cert.issuedAt || cert.createdAt || '',
        timestamp: cert.timestamp || '',
        shortCode: cert.verificationCode || cert.shortCode || '',
        ipfsHash: cert.ipfsHash || '',
        gpa: cert.gpa ?? null,
        recipientEmail: cert.recipientEmail || '',
      },
      pdfLink: data._links?.pdf || (cert.ipfsHash ? `https://gateway.pinata.cloud/ipfs/${cert.ipfsHash}` : ''),
    };
  };

  const verifyByCode = async (code) => {
    if (!code?.trim()) return;
    setLoading(true); setError(''); setVerificationResult(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/code/${code.trim()}`);
      if (response.data.success === false) throw new Error(response.data.message || 'Verification failed');
      setVerificationResult(normalizeResponseData(response.data));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      let msg = 'Verification failed';
      if (err.response?.status === 404) msg = 'Certificate not found. Please check your code and try again.';
      else if (err.response?.data?.message) msg = err.response.data.message;
      else if (err.message) msg = err.message;
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (verificationMethod === 'code') return verifyByCode(certificateCode);
    setLoading(true); setError(''); setVerificationResult(null);
    try {
      if (!file) throw new Error('Please select a PDF certificate to verify');
      const formData = new FormData();
      formData.append('certificate', file);
      const response = await axios.post(`${API_BASE_URL}/verify/pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (!response.data.success || response.data.status === 'CERTIFICATE_NOT_FOUND' || response.data.status === 'ERROR') {
        throw new Error(response.data.message || 'Certificate not found or invalid');
      }
      setVerificationResult(normalizeResponseData(response.data));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      let msg = 'Verification failed';
      if (err.response?.status === 404) msg = 'Certificate not found. Please check and try again.';
      else if (err.response?.status === 400) msg = 'Invalid PDF file. Please check and try again.';
      else if (err.response?.data?.message) msg = err.response.data.message;
      else if (err.message) msg = err.message;
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleDownload = async (pdfLink, code) => {
    setDownloading(true);
    try {
      const response = await fetch(pdfLink);
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
      window.open(pdfLink, '_blank', 'noopener,noreferrer');
    } finally { setDownloading(false); }
  };

  const resetVerification = () => {
    setVerificationResult(null); setError('');
    setCertificateCode(''); setFile(null);
  };

  const cert = verificationResult?.certificate;
  const pdfLink = verificationResult?.pdfLink;
  const isRevoked = verificationResult?.revoked;

  return (
    <div className="min-h-screen flex flex-col bg-stone-100">
      {/* Hero */}
      <div className="bg-emerald-800 text-white py-10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-2">Verify Certificates</h1>
          <p className="text-emerald-200 text-base">Use code or pdf file to check authenticity of certificates</p>
        </div>
      </div>

      {error && !verificationResult && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-200 text-red-800 px-4 py-2 rounded-sm shadow-md flex items-center z-50">
          <FiAlertCircle className="w-5 h-5 mr-2 text-red-600" /><span>{error}</span>
        </div>
      )}

      <div className="flex-1 py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-sm shadow-sm border border-stone-300 p-5 mb-6">
            <h2 className="text-xl font-bold text-stone-900 mb-5">Verify Certificate</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-sm flex items-start">
                <FiX className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" /><span>{error}</span>
              </div>
            )}

            {!verificationResult && (
              <>
                <div className="flex gap-2 mb-5">
                  <button
                    className={`px-4 py-2 rounded-sm text-sm font-medium flex items-center transition-colors ${
                      verificationMethod === 'code' ? 'bg-emerald-700 text-white' : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'}`}
                    onClick={() => { setVerificationMethod('code'); setError(''); }}>
                    <FiFileText className="mr-2 w-4 h-4" /> Verify by Code
                  </button>
                  <button
                    className={`px-4 py-2 rounded-sm text-sm font-medium flex items-center transition-colors ${
                      verificationMethod === 'file' ? 'bg-emerald-700 text-white' : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'}`}
                    onClick={() => { setVerificationMethod('file'); setError(''); }}>
                    <FiUpload className="mr-2 w-4 h-4" /> Verify PDF Certificate
                  </button>
                </div>

                {verificationMethod === 'code' && (
                  <form onSubmit={handleVerify} className="space-y-3">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Certificate Verification Code</label>
                    <div className="flex">
                      <input type="text" autoComplete="off" autoCorrect="off" spellCheck="false"
                        autoCapitalize="characters" maxLength={4} required
                        value={certificateCode} onChange={(e) => setCertificateCode(e.target.value.toUpperCase())}
                        placeholder="e.g. AB12" autoFocus
                        className="flex-1 p-2.5 border border-stone-300 rounded-sm rounded-r-none focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-center uppercase text-lg tracking-widest" />
                      <button type="submit" disabled={loading || !certificateCode}
                        className="bg-emerald-700 text-white px-6 py-2.5 rounded-sm rounded-l-none hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                        {loading ? <Spinner /> : <FiSearch className="w-4 h-4" />}
                        {loading ? 'Verifying' : 'Verify'}
                      </button>
                    </div>
                    <p className="text-xs text-stone-500">Enter the 4-character code shown on the certificate.</p>
                  </form>
                )}

                {verificationMethod === 'file' && (
                  <form onSubmit={handleVerify} className="space-y-4">
                    <div className="border-dashed border-2 border-stone-300 rounded-sm p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors"
                      onClick={() => fileInputRef.current?.click()}>
                      <input type="file" onChange={(e) => { if (e.target.files.length > 0) { setFile(e.target.files[0]); setError(''); } }}
                        className="hidden" accept="application/pdf" ref={fileInputRef} />
                      <FiUpload className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-stone-700">
                        {file ? file.name : 'Click to select a PDF certificate'}
                      </p>
                      <p className="text-xs text-stone-400 mt-1">or drag and drop here</p>
                      {file && (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="mt-3 text-xs text-red-600 hover:text-red-700 inline-flex items-center px-2 py-1 rounded-sm border border-red-200 bg-white hover:bg-red-50">
                          <FiX className="w-3 h-3 mr-1" /> Remove File
                        </button>
                      )}
                    </div>
                    <button type="submit" disabled={loading || !file}
                      className="w-full bg-emerald-700 text-white px-6 py-2.5 rounded-sm hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                      {loading ? <><Spinner /> Verifying...</> : <><FiSearch className="w-4 h-4" /> Verify PDF Certificate</>}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* ── RESULT ── */}
            {verificationResult && (
              <div className="space-y-5" ref={resultRef}>

                {/* Banner — green if valid, red if revoked */}
                {isRevoked ? (
                  <div className="bg-gradient-to-r from-red-600 to-red-500 text-white p-6 rounded-sm relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                      <svg className="w-full h-full" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="170" cy="20" r="60" fill="white" />
                        <circle cx="30" cy="80" r="40" fill="white" />
                      </svg>
                    </div>
                    <div className="relative flex items-center gap-4">
                      <div className="bg-white/20 p-3 rounded-full border border-white/30 flex-shrink-0">
                        <FiSlash className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">Certificate Revoked</h3>
                        <p className="text-red-100 text-sm">
                          This certificate has been revoked by the issuing institution and is no longer valid.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-6 rounded-sm relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                      <svg className="w-full h-full" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="170" cy="20" r="60" fill="white" />
                        <circle cx="30" cy="80" r="40" fill="white" />
                      </svg>
                    </div>
                    <div className="relative flex items-center gap-4">
                      <div className="bg-white/20 p-3 rounded-full border border-white/30 flex-shrink-0">
                        <FiCheck className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">Certificate Verified Successfully</h3>
                        <p className="text-emerald-100 text-sm">
                          This certificate has been validated on the blockchain and is authentic.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Certificate details */}
                <div className={`bg-white border rounded-sm shadow-sm overflow-hidden ${isRevoked ? 'border-red-200' : 'border-stone-200'}`}>
                  <div className={`border-b px-5 py-3 ${isRevoked ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200'}`}>
                    <h4 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Certificate Details</h4>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {cert?.shortCode && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Verification Code</p>
                        <p className={`font-mono text-lg font-bold tracking-widest ${isRevoked ? 'text-red-400 line-through' : 'text-emerald-700'}`}>{cert.shortCode}</p>
                      </div>
                    )}
                    {cert?.candidateName && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Candidate Name</p>
                        <p className="font-semibold text-stone-900">{cert.candidateName}</p>
                      </div>
                    )}
                    {cert?.courseName && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Course Name</p>
                        <p className="font-semibold text-stone-900">{cert.courseName}</p>
                      </div>
                    )}
                    {(cert?.issuedAt || cert?.timestamp) && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Issue Date</p>
                        <p className="font-semibold text-stone-900">{formatDateTime(cert.issuedAt || cert.timestamp)}</p>
                      </div>
                    )}
                    {cert?.gpa !== null && cert?.gpa !== undefined && cert?.gpa !== '' && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">GPA</p>
                        <p className="font-semibold text-stone-900">
                          {parseFloat(cert.gpa).toFixed(2)} <span className="text-stone-400 font-normal">/ 4.00</span>
                        </p>
                      </div>
                    )}
                    {cert?.recipientEmail && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Recipient Email</p>
                        <p className="font-semibold text-stone-900">{cert.recipientEmail}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions — hide download if revoked */}
                <div className="flex gap-3">
                  {pdfLink && !isRevoked && (
                    <button onClick={() => handleDownload(pdfLink, cert?.shortCode)} disabled={downloading}
                      className="flex-1 inline-flex items-center justify-center px-5 py-3 bg-emerald-700 text-white rounded-sm hover:bg-emerald-600 transition-colors font-medium disabled:opacity-70 disabled:cursor-not-allowed">
                      {downloading ? <><Spinner /><span className="ml-2">Downloading...</span></> : <><FiDownload className="w-5 h-5 mr-2" />Download Certificate</>}
                    </button>
                  )}
                  <button onClick={resetVerification}
                    className="flex-1 inline-flex items-center justify-center px-5 py-3 bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors font-medium">
                    <FiSearch className="w-5 h-5 mr-2" /> Verify Another
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyCertificate;