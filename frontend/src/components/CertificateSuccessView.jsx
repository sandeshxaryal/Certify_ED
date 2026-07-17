import React, { useState } from 'react';
import {
  FiCheck,
  FiCopy,
  FiCheckCircle,
  FiDownload,
  FiFileText,
} from 'react-icons/fi';

const CertificateSuccessView = ({ certificateData, copiedField, onCopy, onReset, formData, mode = 'generated' }) => {
  if (!certificateData) return null;

  const [downloading, setDownloading] = useState(false);

  const verificationCode = certificateData.verificationCode || certificateData.shortCode;
  const pdfLink = certificateData._links?.pdf || certificateData.ipfsGateway;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(pdfLink);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${verificationCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // fallback: open in new tab if fetch/CORS fails
      window.open(pdfLink, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Success Banner */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-6 rounded-sm relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="170" cy="20" r="60" fill="white" />
            <circle cx="30" cy="80" r="40" fill="white" />
          </svg>
        </div>
        <div className="relative flex items-center space-x-4">
          <div className="bg-white/20 p-3 rounded-full border border-white/30 flex-shrink-0">
            <FiCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-1">
              {mode === 'generated' ? 'Certificate Generated Successfully' : 'Certificate Verified Successfully'}
            </h3>
            <p className="text-emerald-100 text-sm">
              {mode === 'generated'
                ? 'Your certificate has been generated and stored on the blockchain.'
                : 'This certificate has been validated and is authentic.'}
            </p>
          </div>
        </div>
      </div>

      {/* Verification Code + Download */}
      {verificationCode && (
        <div className="bg-white border border-stone-200 p-5 rounded-sm shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

            {/* Code block */}
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">
                Verification Code
              </p>
              <button
                onClick={() => onCopy(verificationCode, 'verificationCode')}
                className="flex items-center gap-3 bg-stone-900 text-white px-5 py-3 rounded-sm font-mono text-2xl tracking-widest hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {verificationCode}
                <span className="opacity-60 hover:opacity-100 transition-opacity">
                  {copiedField === 'verificationCode' || copiedField === 'shortCode'
                    ? <FiCheckCircle className="w-5 h-5 text-emerald-400" />
                    : <FiCopy className="w-5 h-5" />
                  }
                </span>
              </button>
              <p className="text-xs text-stone-400 mt-2">
              </p>
            </div>

            {/* Download button */}
            {pdfLink && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center px-5 py-3 bg-emerald-700 text-white rounded-sm hover:bg-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <>
                    <svg
                      className="animate-spin w-5 h-5 mr-2 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    <FiDownload className="w-5 h-5 mr-2" />
                    Download
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Generate Another */}
      <button
        onClick={onReset}
        className="w-full inline-flex items-center justify-center px-5 py-3 bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 font-medium"
      >
        <FiFileText className="w-5 h-5 mr-2" />
        {mode === 'generated' ? 'Generate Another' : 'Verify Another'}
      </button>

    </div>
  );
};

export default CertificateSuccessView;