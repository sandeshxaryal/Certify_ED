import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiFileText,
  FiUpload,
  FiExternalLink,
  FiCheckCircle,
  FiBook,
  FiSearch
} from 'react-icons/fi';
import Header from '../components/Header';

export default function Home() {
  const navigate = useNavigate();

  const mainActions = [
    {
      icon: FiFileText,
      title: 'Generate',
      description: 'Generate a certificate',
      action: () => navigate('/generate'),
    },
    {
      icon: FiCheckCircle,
      title: 'Verify',
      description: 'Check the authenticity of certificates',
      action: () => navigate('/verify'),
    },
    {
      icon: FiUpload,
      title: 'Custom Documents',
      description: 'Upload and verify past/external documents',
      action: () => navigate('/upload'),
    },
    {
      icon: FiSearch,
      title: 'Find Certificates',
      description: 'Find certificates using email address',
      action: () => navigate('/find-certificates'),
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      {/* <Header /> */}

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-gray-950 via-emerald-950 to-green-900 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
              One Stop Solution for
              <span className="text-emerald-400"> Certification & Verification</span>
            </h1>

            <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Securely create, authenticate and manage certificates for institutions.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Actions */}
        <div className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mainActions.map((action, index) => (
              <div
                key={index}
                onClick={action.action}
                className="group relative overflow-hidden border border-gray-200 bg-white rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-emerald-200"
              >
                {/* Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative z-10">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mr-4 transition-transform duration-300 group-hover:scale-110">
                      <action.icon className="w-5 h-5 text-emerald-700" />
                    </div>

                    <h3 className="font-semibold text-gray-900 text-lg">
                      {action.title}
                    </h3>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed mb-5">
                    {action.description}
                  </p>

                  <button className="text-sm flex items-center font-medium text-emerald-700 group-hover:text-emerald-800 transition-colors">
                    <span className="mr-2">Proceed</span>

                    <FiExternalLink className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}