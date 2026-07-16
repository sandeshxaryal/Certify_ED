import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import { FiX, FiSave, FiCheckCircle, FiAlertCircle, FiUpload, FiFileText, FiDownload } from 'react-icons/fi';
import CertificateSuccessView from '../components/certificatesuccessView';

const API_ENDPOINT = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/certificates/generate`;

// ─── Single Form ─────────────────────────────────────────────────────────────

const SingleForm = ({ getToken, socketRef }) => {
  const [formData, setFormData] = useState({
    candidateName: '',
    courseName: '',
    referenceId: '',
    recipientEmail: '',
    gpa: '',
    certificateType: 'COMPLETION',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [certificateData, setCertificateData] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const [copyError, setCopyError] = useState('');
  const [certificateStatus, setCertificateStatus] = useState('PENDING');
  const copyNotificationRef = useRef(null);
  const currentCertificateId = useRef(null);

  useEffect(() => {
    if (!socketRef.current) return;
    const handler = (data) => {
      if (data.certificateId === currentCertificateId.current) setCertificateStatus(data.status);
    };
    socketRef.current.on('certificate:status', handler);
    return () => socketRef.current?.off('certificate:status', handler);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const copyToClipboard = (text, fieldName) => {
    setCopyError('');
    if (copyNotificationRef.current) {
      copyNotificationRef.current.style.opacity = '1';
      copyNotificationRef.current.style.transform = 'translateY(0)';
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedField(fieldName);
        setTimeout(() => {
          setCopiedField('');
          if (copyNotificationRef.current) {
            copyNotificationRef.current.style.opacity = '0';
            copyNotificationRef.current.style.transform = 'translateY(10px)';
          }
        }, 2000);
      }).catch(err => {
        setCopyError(`Couldn't copy: ${err.message}`);
        setTimeout(() => setCopyError(''), 3000);
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.gpa === '' || formData.gpa === null || formData.gpa === undefined) {
      setError('GPA is required.');
      return;
    }
    const gpaValue = parseFloat(formData.gpa);
    if (isNaN(gpaValue) || gpaValue < 0 || gpaValue > 4.0) {
      setError('GPA must be a decimal value between 0.0 and 4.0');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const payload = { ...formData, gpa: gpaValue };
      const response = await axios.post(API_ENDPOINT, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data?.success) {
        setSuccess(true);
        const transformedData = {
          certificateId: response.data.data.certificateId,
          shortCode: response.data.data.verificationCode,
          _links: {
            verification: response.data.data.verificationUrl,
            pdf: response.data.data.ipfsGateway
          },
          transaction: response.data.data.transaction,
          sha256Hash: response.data.data.computedHashes?.sha256Hash,
          cidHash: response.data.data.computedHashes?.cidHash,
          ipfsHash: response.data.data.computedHashes?.ipfsHash
        };
        setCertificateData(transformedData);
        currentCertificateId.current = response.data.data.certificateId;
        setCertificateStatus('PENDING');
      } else {
        throw new Error(response.data?.message || 'Failed to generate certificate');
      }
    } catch (err) {
      let errorMessage = 'Failed to generate certificate. Please try again.';
      if (err.response?.status === 404) errorMessage = 'API endpoint not found.';
      else if (err.response?.status === 401 || err.response?.status === 403) errorMessage = 'Authentication error. Please log in again.';
      else if (err.response?.data?.message) errorMessage = err.response.data.message;
      else if (err.message) errorMessage = err.message;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ candidateName: '', courseName: '', referenceId: '', recipientEmail: '', gpa: '', certificateType: 'COMPLETION' });
    setSuccess(false);
    setCertificateData(null);
  };

  return (
    <>
      <div ref={copyNotificationRef}
        className="fixed top-4 right-4 bg-emerald-100 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-sm shadow-md flex items-center transition-all duration-300 opacity-0 transform translate-y-10 z-50">
        <FiCheckCircle className="w-5 h-5 mr-2 text-emerald-600" />
        <span>Copied to clipboard</span>
      </div>
      {copyError && (
        <div className="fixed top-4 right-4 bg-rose-100 border border-rose-200 text-rose-800 px-4 py-2 rounded-sm shadow-md flex items-center z-50">
          <FiAlertCircle className="w-5 h-5 mr-2 text-rose-600" />
          <span>{copyError}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-sm flex items-start">
          <FiX className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && certificateData ? (
        <CertificateSuccessView
          certificateData={certificateData}
          copiedField={copiedField}
          onCopy={copyToClipboard}
          onReset={resetForm}
          formData={formData}
          mode="generated"
          status={certificateStatus}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-b border-stone-200 pb-4 mb-4">
            <h3 className="text-md font-medium text-stone-700 mb-3">Required Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Candidate Name*</label>
                <input type="text" name="candidateName" value={formData.candidateName} onChange={handleInputChange}
                  className="w-full p-2.5 border border-stone-300 rounded-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Enter recipient's full name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Recipient Email*</label>
                <input type="email" name="recipientEmail" value={formData.recipientEmail} onChange={handleInputChange}
                  className="w-full p-2.5 border border-stone-300 rounded-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Enter recipient's email address" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Course Name*</label>
                <input type="text" name="courseName" value={formData.courseName} onChange={handleInputChange}
                  className="w-full p-2.5 border border-stone-300 rounded-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Enter course or program name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Reference ID</label>
                <input type="text" name="referenceId" value={formData.referenceId} onChange={handleInputChange}
                  className="w-full p-2.5 border border-stone-300 rounded-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. COMP2022A" />
                <p className="text-xs text-stone-500 mt-1">Auto generated if empty</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">GPA*</label>
                <input type="number" name="gpa" value={formData.gpa} onChange={handleInputChange}
                  className="w-full p-2.5 border border-stone-300 rounded-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. 3.75" min="0" max="4.0" step="0.01" required />
              </div>
            </div>
          </div>
          <div className="pt-4">
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-800 text-white px-6 py-3 rounded-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium">
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                <span className="flex items-center"><FiSave className="mr-2" />Generate Certificate</span>
              )}
            </button>
          </div>
        </form>
      )}
    </>
  );
};

// ─── Bulk Upload Form ─────────────────────────────────────────────────────────

const REQUIRED_COLUMNS = ['candidateName', 'recipientEmail', 'courseName', 'gpa'];
const OPTIONAL_COLUMNS = ['referenceId'];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const STATUS_COLORS = {
  pending: 'bg-stone-100 text-stone-600',
  processing: 'bg-blue-50 text-blue-700',
  success: 'bg-emerald-50 text-emerald-700',
  error: 'bg-rose-50 text-rose-700',
  issued: 'bg-amber-50 text-amber-700',
};

const BulkForm = ({ getToken }) => {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [bulkStatus, setBulkStatus] = useState([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);
  const fileInputRef = useRef(null);

  const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ALL_COLUMNS,
      ['Jane Doe', 'jane@example.com', 'Computer Science', '3.75', 'REF-001'],
      ['John Smith', 'john@example.com', 'Data Science', '3.50', 'REF-002'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Certificates');
    XLSX.writeFile(wb, 'certifyed_bulk_template.xlsx');
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setParseError('');
    setRows([]);
    setBulkStatus([]);
    setBulkDone(false);
    setProgress(0);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (raw.length === 0) { setParseError('The file appears to be empty.'); return; }

        const normalized = raw.map(row => {
          const out = {};
          for (const k of Object.keys(row)) out[k.trim()] = String(row[k]).trim();
          return out;
        });

        const firstRow = normalized[0];
        const missing = REQUIRED_COLUMNS.filter(c => !(c in firstRow));
        if (missing.length > 0) {
          setParseError(`Missing required columns: ${missing.join(', ')}. Download the template to see the correct format.`);
          return;
        }

        const validated = normalized.map((row, i) => {
          const errors = [];
          if (!row.candidateName) errors.push('candidateName is empty');
          if (!row.recipientEmail || !row.recipientEmail.match(/\S+@\S+\.\S+/)) errors.push('invalid recipientEmail');
          if (!row.courseName) errors.push('courseName is empty');
          const gpa = parseFloat(row.gpa);
          if (isNaN(gpa) || gpa < 0 || gpa > 4.0) errors.push('gpa must be 0.0–4.0');
          return { ...row, gpa: isNaN(gpa) ? '' : gpa, _rowIndex: i + 1, _errors: errors };
        });

        // Check which emails already have certificates
        setChecking(true);
        const emails = validated
          .filter(r => r._errors.length === 0)
          .map(r => r.recipientEmail);

        let issuedSet = {};
        try {
          const token = getToken();
          const res = await axios.post(
            `${API_BASE}/certificates/check-bulk-status`,
            { emails },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.data?.success) issuedSet = res.data.data.issued;
        } catch {
          // silently ignore — just treat all as unissued if check fails
        }
        setChecking(false);

        const initialStatus = validated.map(row => {
          if (row._errors.length > 0) return 'pending';
          return issuedSet[row.recipientEmail?.toLowerCase()] ? 'issued' : 'pending';
        });

        setRows(validated);
        setBulkStatus(initialStatus);
      } catch (err) {
        setChecking(false);
        setParseError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkGenerate = async () => {
    if (!rows.length) return;
    setBulkRunning(true);
    setBulkDone(false);
    setProgress(0);
    const token = getToken();
    const newStatus = rows.map(() => 'pending');
    setBulkStatus([...newStatus]);

    let done = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row._errors.length > 0 || bulkStatus[i] === 'issued') {
        newStatus[i] = bulkStatus[i] === 'issued' ? 'issued' : 'error';
        setBulkStatus([...newStatus]);
        done++;
        setProgress(Math.round((done / rows.length) * 100));
        continue;
      }
      newStatus[i] = 'processing';
      setBulkStatus([...newStatus]);
      try {
        const payload = {
          candidateName: row.candidateName,
          recipientEmail: row.recipientEmail,
          courseName: row.courseName,
          gpa: row.gpa,
          referenceId: row.referenceId || undefined,
          certificateType: 'COMPLETION',
        };
        const response = await axios.post(API_ENDPOINT, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        newStatus[i] = response.data?.success ? 'success' : 'error';
      } catch {
        newStatus[i] = 'error';
      }
      setBulkStatus([...newStatus]);
      done++;
      setProgress(Math.round((done / rows.length) * 100));
    }
    setBulkRunning(false);
    setBulkDone(true);
  };

  const clearAll = () => {
    setRows([]); setFileName(''); setBulkStatus([]);
    setBulkDone(false); setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const successCount = bulkStatus.filter(s => s === 'success').length;
  const errorCount = bulkStatus.filter(s => s === 'error').length;
  const issuedCount = bulkStatus.filter(s => s === 'issued').length;
  const validRows = rows.filter((r, i) => r._errors.length === 0 && bulkStatus[i] !== 'issued').length;

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="bg-emerald-900 rounded-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-white mb-1">How to use bulk generation</p>
          <p className="text-xs text-emerald-300 leading-relaxed">
            Upload the file with columns:
            <code className="mx-1 bg-emerald-800 px-1 rounded text-emerald-200">candidateName</code>
            <code className="mx-1 bg-emerald-800 px-1 rounded text-emerald-200">recipientEmail</code>
            <code className="mx-1 bg-emerald-800 px-1 rounded text-emerald-200">courseName</code>
            <code className="mx-1 bg-emerald-800 px-1 rounded text-emerald-200">gpa</code>
            and optionally <code className="mx-1 bg-emerald-800 px-1 rounded text-emerald-200">referenceId</code>.
          </p>
        </div>
        <button onClick={downloadTemplate}
          className="shrink-0 flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-3 py-2 rounded-sm transition-colors font-medium">
          <FiDownload className="w-4 h-4" /> Download Template
        </button>
      </div>

      {/* Dropzone */}
      <div onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-stone-300 rounded-sm p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
        <FiUpload className="w-8 h-8 text-stone-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-stone-700">
          {checking ? 'Checking certificates…' : fileName ? fileName : 'Click to upload Excel or CSV file'}
        </p>
        <p className="text-xs text-stone-400 mt-1">.xlsx, .xls, .csv supported</p>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
      </div>

      {parseError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-sm flex items-start gap-2 text-sm">
          <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-stone-700">
              {rows.length} row{rows.length !== 1 ? 's' : ''} loaded
              {issuedCount > 0 && <span className="ml-2 text-amber-600">({issuedCount} already issued)</span>}
              {rows.filter(r => r._errors.length > 0).length > 0 && (
                <span className="ml-2 text-rose-600">({rows.filter(r => r._errors.length > 0).length} invalid)</span>
              )}
            </p>
            {!bulkRunning && !bulkDone && (
              <button onClick={clearAll} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                Clear
              </button>
            )}
          </div>

          {/* Progress bar */}
          {(bulkRunning || bulkDone) && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-stone-500">
                <span>{bulkDone ? 'Complete' : 'Processing…'}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-2">
                <div className="bg-emerald-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              {bulkDone && (
                <p className="text-xs text-stone-600">
                  <span className="text-emerald-700 font-medium">{successCount} succeeded</span>
                  {errorCount > 0 && <span className="text-rose-600 font-medium ml-2">{errorCount} failed</span>}
                </p>
              )}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto border border-stone-200 rounded-sm">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-stone-600 w-8">#</th>
                  <th className="text-left px-3 py-2 font-semibold text-stone-600">Name</th>
                  <th className="text-left px-3 py-2 font-semibold text-stone-600">Email</th>
                  <th className="text-left px-3 py-2 font-semibold text-stone-600">Course</th>
                  <th className="text-left px-3 py-2 font-semibold text-stone-600">GPA</th>
                  <th className="text-left px-3 py-2 font-semibold text-stone-600">Ref ID</th>
                  <th className="text-left px-3 py-2 font-semibold text-stone-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-stone-100 last:border-0 ${row._errors.length > 0 ? 'bg-rose-50' : ''}`}>
                    <td className="px-3 py-2 text-stone-400">{row._rowIndex}</td>
                    <td className="px-3 py-2 text-stone-800">{row.candidateName || <span className="text-rose-500">—</span>}</td>
                    <td className="px-3 py-2 text-stone-600">{row.recipientEmail || <span className="text-rose-500">—</span>}</td>
                    <td className="px-3 py-2 text-stone-600">{row.courseName || <span className="text-rose-500">—</span>}</td>
                    <td className="px-3 py-2 text-stone-600">{row.gpa !== '' ? row.gpa : <span className="text-rose-500">—</span>}</td>
                    <td className="px-3 py-2 text-stone-400">{row.referenceId || '—'}</td>
                    <td className="px-3 py-2">
                      {row._errors.length > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-xs" title={row._errors.join(', ')}>
                          Invalid
                        </span>
                      ) : bulkStatus[i] === 'issued' ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">
                          Already Issued
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[bulkStatus[i]] || STATUS_COLORS.pending}`}>
                          {bulkStatus[i] === 'processing' && (
                            <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                          )}
                          {bulkStatus[i] === 'success' && <FiCheckCircle className="w-3 h-3" />}
                          {bulkStatus[i] === 'error' && <FiX className="w-3 h-3" />}
                          {(bulkStatus[i] || 'pending').charAt(0).toUpperCase() + (bulkStatus[i] || 'pending').slice(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!bulkDone && (
            <button onClick={handleBulkGenerate} disabled={bulkRunning || validRows === 0}
              className="w-full bg-emerald-800 text-white px-6 py-3 rounded-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium">
              {bulkRunning ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating {progress}%…
                </span>
              ) : (
                <span className="flex items-center">
                  <FiSave className="mr-2" />
                  Generate {validRows} Certificate{validRows !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          )}

          {bulkDone && (
            <button onClick={clearAll}
              className="w-full border border-stone-300 text-stone-600 px-6 py-3 rounded-sm hover:bg-stone-50 transition-colors flex items-center justify-center font-medium text-sm">
              Upload Another File
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const GenerateCertificate = () => {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('single');
  const socketRef = useRef(null);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    socketRef.current = io(API_URL, { transports: ['websocket', 'polling'] });
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="bg-emerald-800 text-white py-10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-2">Generate Certificates</h1>
          <p className="text-emerald-200 text-base">
            Enter candidate information or upload a spreadsheet to generate blockchain-secured certificates
          </p>
        </div>
      </div>

      <div className="flex-1 py-6 px-4 bg-stone-100">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-sm shadow-sm border border-stone-300 p-5 mb-6">
            <div className="flex border-b border-stone-200 mb-5">
              <button onClick={() => setActiveTab('single')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === 'single' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}>
                <FiFileText className="w-4 h-4" />
                Single Certificate
              </button>
              <button onClick={() => setActiveTab('bulk')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === 'bulk' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}>
                <FiUpload className="w-4 h-4" />
                Bulk Upload
              </button>
            </div>

            {activeTab === 'single' && <SingleForm getToken={getToken} socketRef={socketRef} />}
            {activeTab === 'bulk' && <BulkForm getToken={getToken} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateCertificate;