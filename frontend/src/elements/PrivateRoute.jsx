// src/elements/PrivateRoute.jsx
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/SessionContext';
import { FiX, FiLock, FiArrowRight, FiAlertCircle } from 'react-icons/fi';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const hasAccess = user && (!allowedRoles || allowedRoles.includes(user.role));

  if (!user) {
    return (
      <div className="relative">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white p-6 max-w-md w-full mx-4 shadow-md rounded-xl">
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-50">
                  <FiLock className="h-5 w-5 text-emerald-700" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900">Authentication Required</h3>
              </div>
              <button
                onClick={() => navigate('/')}
                className="text-stone-400 hover:text-stone-600 transition-colors p-1 hover:bg-stone-100"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <p className="text-stone-500 mb-5 text-sm leading-relaxed">
              To access this feature, please sign in to your account or create a new one.
            </p>

            <div className="flex flex-col space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-600 transition-colors group"
              >
                <span>Continue to Login</span>
                <FiArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/')}
                className="w-full px-4 py-2.5 border border-stone-300 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="relative">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 max-w-md w-full mx-4 shadow-md">
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-50">
                  <FiAlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900">Access Denied</h3>
              </div>
              <button
                onClick={() => navigate('/')}
                className="text-stone-400 hover:text-stone-600 transition-colors p-1 hover:bg-stone-100"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <p className="text-stone-500 mb-5 text-sm leading-relaxed">
              Sorry, you don't have permission to access this page. This feature is only available to users with {allowedRoles?.join(' or ')} role.
            </p>

            <div className="flex flex-col space-y-3">
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}