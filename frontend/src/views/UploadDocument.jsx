import React, { useState, useRef } from 'react';
import { useAuth } from '../providers/SessionContext';
import axios from 'axios';
import { FiUpload, FiCheck, FiX, FiInfo, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import CertificateSuccessView from '../elements/CredentialSuccessView';

const API_ENDPOINT = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/certificates/upload/external`;

const UploadPDF = () => {
  const { getToken, user } = useAuth();
  const [pdfFile, setPdfFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    candidateName: '',
    courseName: '',
    recipientEmail: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [uploadData, setUploadData] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const [copyError, setCopyError] = useState('');
  const fileInputRef = useRef(null);
  const copyNotificationRef = useRef(null);

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    if (copyNotificationRef.current) {
      copyNotificationRef.current.style.opacity = '1';
      copyNotificationRef.current.style.transform = 'translateY(0)';
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopiedField(fieldName);
          setTimeout(() => {
            setCopiedField('');
            if (copyNotificationRef.current) {
              copyNotificationRef.current.style.opacity = '0';
              copyNotificationRef.current.style.transform = 'translateY(10px)';
            }
          }, 2000);
        })
        .catch(err => {
          setCopyError(`Couldn't copy to clipboard: ${err.message}`);
          setTimeout(() => setCopyError(''), 3000);
        });
    } else {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedField(fieldName);
        setTimeout(() => {
          setCopiedField('');
          if (copyNotificationRef.current) {
            copyNotificationRef.current.style.opacity = '0';
            copyNotificationRef.current.style.transform = 'translateY(10px)';
          }
        }, 2000);
      } catch (err) {
        setCopyError(`Couldn't copy to clipboard: ${err.message}`);
        setTimeout(() => setCopyError(''), 3000);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) setPdfFile(e.target.files[0]);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') setPdfFile(file);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formDataToSend = new FormData();
    formDataToSend.append('certificate', pdfFile);

    // Silently use logged-in institution name as orgName
    const orgName = user?.name || user?.institutionName || '';
    if (orgName) formDataToSend.append('orgName', orgName);

    Object.entries(formData).forEach(([key, value]) => {
      if (value) formDataToSend.append(key, value);
    });

    try {
      const token = getToken();
      const response = await axios.post(API_ENDPOINT, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      setSuccess(true);
      setUploadData(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload certificate');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPdfFile(null);
    setFormData({ candidateName: '', courseName: '', recipientEmail: '' });
    setError('');
    setSuccess(false);
    setUploadData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100">
      {/* Hero */}
      <div className="bg-emerald-800 text-white py-10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-2">Upload & Secure Documents</h1>
          <p className="text-emerald-200 text-base">
            Digitally sign and store any PDF document on the blockchain
          </p>
        </div>
      </div>

      {/* Copy notification */}
      <div
        ref={copyNotificationRef}
        className="fixed top-4 right-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 shadow-md flex items-center transition-all duration-300 opacity-0 transform translate-y-10 z-50"
      >
        <FiCheckCircle className="w-5 h-5 mr-2 text-emerald-600" />
        <span>Copied to clipboard</span>
      </div>

      {copyError && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-800 px-4 py-2 shadow-md flex items-center z-50">
          <FiAlertCircle className="w-5 h-5 mr-2 text-red-600" />
          <span>{copyError}</span>
        </div>
      )}

      <div className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white shadow-sm border border-stone-200 p-6">
            <h2 className="text-xl font-bold text-stone-900 mb-1">Upload External Document</h2>
            <p className="text-stone-500 text-sm mb-6">
              Upload any PDF to digitally sign and verify its authenticity on the blockchain.
            </p>

            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 flex items-start text-sm">
                <FiX className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && uploadData ? (
              <CertificateSuccessView
                certificateData={uploadData}
                copiedField={copiedField}
                onCopy={copyToClipboard}
                onReset={resetForm}
                formData={formData}
                mode="uploaded"
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* PDF Upload */}
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-2">
                    PDF Document <span className="text-emerald-600">*</span>
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed p-8 text-center transition-colors cursor-pointer
                      ${isDragging
                        ? 'border-emerald-500 bg-emerald-50'
                        : pdfFile
                          ? 'border-emerald-400 bg-emerald-50/40'
                          : 'border-stone-300 hover:border-emerald-400 hover:bg-stone-50'
                      }`}
                  >
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept="application/pdf"
                      className="hidden"
                      id="pdfUpload"
                      ref={fileInputRef}
                    />
                    <label htmlFor="pdfUpload" className="cursor-pointer block">
                      <div className="flex flex-col items-center gap-2">
                        <FiUpload className={`w-8 h-8 ${pdfFile ? 'text-emerald-500' : 'text-stone-400'}`} />
                        <span className="text-sm font-medium text-stone-700">
                          {isDragging ? 'Drop your PDF here' : pdfFile ? pdfFile.name : 'Click or drag & drop a PDF'}
                        </span>
                        <span className="text-xs text-stone-400">PDF files only · max 10 MB</span>
                      </div>
                    </label>
                    {pdfFile && (
                      <div className="mt-3 flex flex-col items-center">
                        <p className="text-xs text-stone-500">{(pdfFile.size / 1024).toFixed(2)} KB</p>
                        <button
                          type="button"
                          onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="mt-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          Remove file
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1">
                      Candidate Name <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="candidateName"
                      value={formData.candidateName}
                      onChange={handleInputChange}
                      className="w-full p-2.5 border border-stone-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                      placeholder="Recipient's full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1">
                      Course / Program Name
                    </label>
                    <input
                      type="text"
                      name="courseName"
                      value={formData.courseName}
                      onChange={handleInputChange}
                      className="w-full p-2.5 border border-stone-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                      placeholder="e.g. BSc Computer Science"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-stone-700 mb-1">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      name="recipientEmail"
                      value={formData.recipientEmail}
                      onChange={handleInputChange}
                      className="w-full p-2.5 border border-stone-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                      placeholder="Optional — sends certificate to recipient"
                    />
                    <p className="mt-1 text-xs text-stone-400">
                      If provided, the signed document will be emailed to this address.
                    </p>
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-4 border-t border-stone-200">
                  <button
                    type="submit"
                    disabled={loading || !pdfFile || !formData.candidateName}
                    className="w-full bg-emerald-700 text-white px-6 py-3 font-semibold
                      hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Uploading & Signing…
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <FiUpload className="mr-2 w-4 h-4" />
                        Upload & Sign Document
                      </span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPDF;