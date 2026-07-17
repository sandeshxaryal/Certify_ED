import React, { useState, useRef } from 'react';
import { FiUpload, FiImage, FiCheck, FiX } from 'react-icons/fi';
import axios from 'axios';

/**
 * LogoUpload
 * Props:
 *   currentLogo   – current logo URL (string | null)
 *   onLogoUpdated – callback(newUrl)
 *   compact       – when true, renders inline row style (for embedding in AccountPage)
 */
const LogoUpload = ({ currentLogo, onLogoUpdated, compact = false }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState(currentLogo);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const fileInputRef              = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('logo', file);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const token   = localStorage.getItem('token');

      const response = await axios.post(
        `${API_URL}/api/users/profile/logo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setSuccess('Logo uploaded successfully!');
        setPreview(response.data.data.institutionLogo);
        if (onLogoUpdated) onLogoUpdated(response.data.data.institutionLogo);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload logo');
      setTimeout(() => setError(''), 5000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={compact ? '' : 'bg-white border border-gray-200 rounded-2xl p-6'}>

      {/* ── full (standalone) heading ── */}
      {!compact && (
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FiImage className="w-4 h-4 text-emerald-600" />
          Institution Logo
        </h3>
      )}

      <div className={compact ? 'flex items-center gap-4' : 'space-y-4'}>

        {/* preview thumbnail */}
        <div className="w-14 h-14 rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
          {preview ? (
            <img src={preview} alt="Institution Logo" className="w-full h-full object-contain" />
          ) : (
            <FiImage className="w-6 h-6 text-gray-300" />
          )}
        </div>

        <div className={compact ? 'flex-1 space-y-2' : 'space-y-3'}>
          {!compact && (
            <p className="text-xs text-gray-500">
              Square PNG or JPG, max 5 MB. Appears on all certificates you issue.
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-xs font-medium  transition-colors disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <FiUpload className="w-3 h-3" />
                {preview ? 'Change Logo' : 'Upload Logo'}
              </>
            )}
          </button>

          {success && (
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs">
              <FiCheck className="w-3 h-3" />
              {success}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-red-600 text-xs">
              <FiX className="w-3 h-3" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogoUpload;