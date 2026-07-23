import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiFileText,
  FiUpload,
  FiCheckCircle,
  FiSearch
} from 'react-icons/fi';
import Header from '../components/Header';

export default function Home() {
  const navigate = useNavigate();

  const mainActions = [
    {
      icon: FiFileText,
      title: 'Generate',
      description: 'Create a new certificate',
      action: () => navigate('/generate'),
    },
    {
      icon: FiCheckCircle,
      title: 'Verify',
      description: 'Check authenticity',
      action: () => navigate('/verify'),
    },
    {
      icon: FiUpload,
      title: 'Custom Documents',
      description: 'Upload & verify past docs',
      action: () => navigate('/upload'),
    },
    {
      icon: FiSearch,
      title: 'Find Certificates',
      description: 'Search by email',
      action: () => navigate('/find-certificates'),
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-950 via-emerald-950 to-green-900">
      {/* Header */}
      {/* <Header /> */}

      {/* Hero Section */}
      <div className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
              One Stop Solution for Certification & Verification
            </h1>

            <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Securely create, authenticate and manage certificates for institutions.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Actions */}
        <div className="mb-12">
          <div className="grid grid-cols-2 gap-4">
            {mainActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 bg-white text-emerald-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 px-4"
              >
                <action.icon className="w-7 h-7 text-emerald-700" />
                <span className="text-sm font-semibold text-center text-emerald-800">{action.title}</span>
                <span className="text-xs text-emerald-600 text-center leading-snug">{action.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}