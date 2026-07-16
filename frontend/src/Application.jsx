import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './providers/SessionContext';
import { VerificationProvider } from './providers/ValidationContext';
import ProtectedRoute from './elements/PrivateRoute';
import Layout from './elements/PageLayout';

// Pages
import Home from './views/Landing';
import AuthPage from './views/LoginPage';
import VerifyCertificate from './views/VerifyCredential';
import GenerateCertificate from './views/CreateCredential';
import UploadPDF from './views/UploadDocument';
import CertificateEditor from './elements/CredentialEditor';
import AccountPage from './views/ProfilePage';
import CertificatesPage from './views/CredentialsPage';
import RecipientCertificates from './views/RecipientCredentials';

/**
 * App Component
 * 
 * This is the main application component that sets up routing and context providers.
 * The routing structure is organized as follows:
 * 
 * Public Routes:
 * - /: Home page (accessible to all)
 * - /verify: Certificate verification page (accessible to all)
 * - /login: Authentication page (login/register)
 * - /find-certificates: Recipient's certificates view (accessible to all)
 * 
 * Protected Routes (require authentication):
 * - /account: User account profile (all authenticated users)
 * - /certificates: User certificates or institute's issued certificates (all authenticated users)
 * 
 * Role-Based Protected Routes:
 * - /generate: Certificate generation (Institute only)
 * - /upload: PDF upload (Institute only)
 * - /editor: Certificate editor (Institute only)
 * 
 * The AuthProvider and VerificationProvider wrap the entire application
 * to provide authentication and verification context to all components.
 */
function App() {
  return (
    <AuthProvider>
      <VerificationProvider>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<AuthPage />} />
            <Route path="/" element={<Home />} />
            <Route path="/verify" element={<VerifyCertificate />} />
            <Route path="/find-certificates" element={<RecipientCertificates />} />

            {/* Protected Routes - Any authenticated user */}
            <Route element={<ProtectedRoute />}>
              <Route path="/account" element={<AccountPage />} />
              <Route path="/certificates" element={<CertificatesPage />} />
            </Route>

            {/* Role-Based Routes - Institute Only */}
            <Route element={<ProtectedRoute allowedRoles={['INSTITUTE']} />}>
              <Route path="/generate" element={<GenerateCertificate />} />
              <Route path="/upload" element={<UploadPDF />} />
              <Route path="/editor" element={<CertificateEditor />} />
            </Route>
          </Routes>
        </Layout>
      </VerificationProvider>
    </AuthProvider>
  );
}

export default App;