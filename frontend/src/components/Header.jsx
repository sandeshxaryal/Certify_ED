// src/components/Header.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  FiFileText, FiCheckSquare, FiUpload, FiUser,
  FiLogOut, FiMenu, FiX, FiLogIn, FiChevronDown,
  FiCheckCircle, FiSearch
} from 'react-icons/fi';

const dropdownAnimation = `
  @keyframes dropdownAppear {
    0% { opacity: 0; transform: scale(0.95); }
    100% { opacity: 1; transform: scale(1); }
  }
  .dropdown-animate {
    animation: dropdownAppear 0.1s ease-out forwards;
  }
`;

function NavButton({ icon: Icon, label, onClick, isActive = false, to }) {
  if (to) {
    return (
      <Link
        to={to}
        className={`flex items-center px-3 py-2 rounded-sm transition-colors ${
          isActive
            ? 'bg-green-200/20 text-green-100'
            : 'text-gray-300 hover:bg-green-200/20 hover:text-white'
        }`}
        onClick={(e) => {
          if ((e.ctrlKey || e.metaKey) && to) {
            e.preventDefault();
            window.open(to, '_blank');
            return;
          }
          if (onClick) onClick(e);
        }}
      >
        <Icon className="w-5 h-5 mr-2" />
        <span className="text-sm font-medium">{label}</span>
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center px-3 py-2 rounded-sm transition-colors ${
        isActive
          ? 'bg-green-200/20 text-green-100'
          : 'text-gray-300 hover:bg-green-200/20 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5 mr-2" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen]     = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const userDropdownRef = useRef(null);
  const userButtonRef   = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target) &&
        userButtonRef.current &&
        !userButtonRef.current.contains(event.target)
      ) {
        setShowUserInfo(false);
        setConfirmLogout(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
  if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    setShowUserInfo(false);
    setConfirmLogout(false);
    await logout(); // waits for the backend log to be written first
    // AuthContext's logout already calls navigate('/'), so no need to call it here
  };

  const isCurrentPath = (path) => location.pathname === path;

  const navItems = [
    { icon: FiFileText,    label: 'Generate',          path: '/generate' },
    { icon: FiCheckCircle, label: 'Verify',             path: '/verify' },
    { icon: FiUpload,      label: 'Custom Documents',   path: '/upload' },
    { icon: FiSearch,      label: 'Find Certificates',  path: '/find-certificates' },
  ];

  const getUserMenuItems = () => {
    const base = [
      { icon: FiUser,    label: 'Account & Activity',           path: '/account' },
      { icon: FiFileText, label: 'All Certificates', path: '/certificates' },
      { icon: FiLogOut,  label: 'Sign Out',          action: handleLogout, divider: true },
    ];

    if (user?.role === 'VERIFIER') {
      return [
        { icon: FiUser,       label: 'Profile',              path: '/account' },
        { icon: FiFileText,   label: 'Verified Certificates', path: '/certificates' },
        { icon: FiCheckSquare, label: 'Verify Certificate',  path: '/verify' },
        { icon: FiLogOut,     label: 'Sign Out',             action: handleLogout, divider: true },
      ];
    }

    return base;
  };

  const userMenuItems = getUserMenuItems();

  return (
    <>
      <style>{dropdownAnimation}</style>

      <header className="bg-gradient-to-r from-gray-950 via-emerald-950 to-green-900 border-b border-emerald-900 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex justify-between items-center h-16">

            {/* Logo */}
            <Link to="/" className="flex flex-shrink-0 items-center">
              <img src="/favicon.svg" alt="CertifyED" className="w-8 h-8 mr-2" />
              <span className="text-white font-semibold text-lg tracking-tight">CertifyED</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map(item => (
                <NavButton
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  to={item.path}
                  isActive={isCurrentPath(item.path)}
                />
              ))}
            </nav>

            {/* Right Side */}
            <div className="flex items-center">

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden text-gray-300 hover:text-white hover:bg-green-200/20 p-2 rounded-sm transition-colors"
              >
                {isMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
              </button>

              {/* User dropdown */}
              {user ? (
                <div className="hidden md:block relative">

                  <button
                    ref={userButtonRef}
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-sm hover:bg-green-200/20 transition-colors"
                    onClick={() => setShowUserInfo(!showUserInfo)}
                    aria-expanded={showUserInfo}
                  >
                    <div className="w-7 h-7 rounded-full bg-green-200/20 border border-green-800 flex items-center justify-center mr-2">
                      <FiUser className="w-4 h-4 text-gray-300" />
                    </div>
                    <FiChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        showUserInfo ? 'rotate-180 text-white' : 'text-gray-400'
                      }`}
                    />
                  </button>

                  {showUserInfo && (
                    <div
                      ref={userDropdownRef}
                      className="absolute right-0 mt-1 w-52 bg-gradient-to-b from-emerald-950 via-green-900 to-emerald-950 border border-green-700/50 rounded-xl overflow-hidden dropdown-animate backdrop-blur-md"
                      style={{
                        boxShadow: '0 10px 25px rgba(0,0,0,0.35), 0 0 0 1px rgba(34,197,94,0.08)',
                        transformOrigin: 'top right',
                      }}
                    >
                      <div className="absolute inset-0 bg-green-400/5 pointer-events-none" />

                      <div className="py-2 relative z-10">
                        {userMenuItems.map((item, index) =>
                          item.path ? (
                            <Link
                              key={index}
                              to={item.path}
                              className={`w-full text-left px-4 py-2.5 text-sm text-green-100 hover:bg-green-400/10 hover:text-white flex items-center group transition-all duration-200 ${
                                item.divider ? 'border-t border-green-700/40 mt-1 pt-3' : ''
                              }`}
                              onClick={(e) => {
                                if (e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  window.open(item.path, '_blank');
                                  return;
                                }
                                setShowUserInfo(false);
                              }}
                            >
                              <div className="w-7 h-7 rounded-lg bg-green-800/60 border border-green-700/40 flex items-center justify-center mr-3 group-hover:bg-green-500/20 group-hover:border-green-400/40 transition-all duration-200">
                                <item.icon className="w-3.5 h-3.5 text-green-200 group-hover:text-green-100" />
                              </div>
                              <span className="tracking-wide">{item.label}</span>
                            </Link>
                          ) : (
                            <button
                              key={index}
                              onClick={item.action}
                              className={`w-full text-left px-4 py-2.5 text-sm flex items-center group transition-all duration-200 ${
                                item.divider ? 'border-t border-green-700/40 mt-1 pt-3' : ''
                              } ${
                                confirmLogout
                                  ? 'text-red-300 hover:bg-red-500/10 hover:text-red-200'
                                  : 'text-green-100 hover:bg-green-400/10 hover:text-white'
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center mr-3 transition-all duration-200 ${
                                confirmLogout
                                  ? 'bg-red-900/60 border-red-700/40 group-hover:bg-red-500/20'
                                  : 'bg-green-800/60 border-green-700/40 group-hover:bg-green-500/20 group-hover:border-green-400/40'
                              }`}>
                                <item.icon className={`w-3.5 h-3.5 ${
                                  confirmLogout ? 'text-red-300' : 'text-green-200 group-hover:text-green-100'
                                }`} />
                              </div>
                              <span className="tracking-wide">
                                {confirmLogout ? 'Click again to sign out' : item.label}
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="hidden md:flex items-center px-3 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-sm hover:bg-green-200/20 transition-colors"
                >
                  <FiLogIn className="w-5 h-5 mr-2" />
                  Login
                </button>
              )}

            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden pt-2 pb-3 border-t border-gray-700">
              <div className="flex flex-col space-y-1">

                {navItems.map(item => (
                  <NavButton
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    to={item.path}
                    isActive={isCurrentPath(item.path)}
                    onClick={() => setIsMenuOpen(false)}
                  />
                ))}

                {user ? (
                  <>
                    <div className="flex items-center px-3 py-2 text-white border-t border-gray-700 mt-2 pt-2">
                      <div className="w-6 h-6 rounded-full bg-green-200/20 border border-green-800 flex items-center justify-center mr-2">
                        <FiUser className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                      <span className="text-sm font-medium truncate">{user?.name || 'User'}</span>
                    </div>
                    <NavButton
                      icon={FiLogOut}
                      label="Logout"
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                    />
                  </>
                ) : (
                  <NavButton
                    icon={FiLogIn}
                    label="Login"
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                  />
                )}

              </div>
            </div>
          )}

        </div>
      </header>
    </>
  );
}