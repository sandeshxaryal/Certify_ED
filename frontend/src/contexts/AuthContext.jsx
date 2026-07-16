// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const navigate = useNavigate();

  const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

  // Create axios instance with auth header
  const authAxios = axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  // Update headers when token changes
  useEffect(() => {
    authAxios.defaults.headers.Authorization = token ? `Bearer ${token}` : '';
  }, [token]);

  // Validate auth on mount
  useEffect(() => {
    const validateAuth = async () => {
      // First try to get saved user data
      try {
        const storedUser = localStorage.getItem('userData');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          console.log('Using stored user data:', parsedUser);
          setUser(parsedUser);
          setLoading(false);
          return;
        }
      } catch {
        console.log('Error parsing stored user data');
      }

      // If no stored data, try to use token
      if (token) {
        try {
          const decoded = jwtDecode(token);
          console.log('Decoded token:', decoded);

          // Token might not have all user fields, but should at least have ID and role
          setUser({
            id: decoded.id,
            role: decoded.role
          });

          // If token is expired, logout
          const currentTime = Date.now() / 1000;
          if (decoded.exp < currentTime) {
            console.log('Token expired, logging out');
            logout();
          }
        } catch (err) {
          console.error('Token validation failed:', err);
          logout();
        }
      }

      setLoading(false);
    };

    validateAuth();
  }, []);

  // Login function - fixed to match the API response structure
  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${apiUrl}/auth/login`, { email, password });
      console.log('Login response:', response.data);

      if (response.data.success && response.data.data) {
        const data = response.data.data;

        // OTP step required
        if (data.requiresOtp) {
          return { requiresOtp: true, email: data.email };
        }

        // Full login (shouldn't happen now but kept as fallback)
        localStorage.setItem('userData', JSON.stringify(data.user));
        localStorage.setItem('token', data.tokens.access);
        setUser(data.user);
        setToken(data.tokens.access);
        return true;
      } else {
        setError(response.data.message || 'Invalid email or password');
        return false;
      }
    } catch (err) {
      console.error('Login error:', err);

      // Extract the error message from the response if available
      if (err.response) {
        console.log('Error response data:', err.response.data);

        // Handle specific status codes
        if (err.response.status === 401) {
          setError('Invalid email or password');
        } else if (err.response.status === 404) {
          setError('User not found');
        } else if (err.response.data && err.response.data.message) {
          setError(err.response.data.message);
        } else {
          setError('Login failed. Please try again.');
        }
      } else if (err.request) {
        // Request was made but no response was received
        console.error('No response received:', err.request);
        setError('No response from server. Please check your internet connection.');
      } else {
        // Error in setting up the request
        setError(err.message || 'Login failed');
      }

      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Register function - fixed to match the API response structure
  const register = useCallback(async (name, email, password, role) => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${apiUrl}/auth/register`, { name, email, password, role });
      console.log('Register response:', response.data);

      if (response.data.success && response.data.data) {
        const data = response.data.data;

        // OTP step required
        if (data.requiresOtp) {
          return { requiresOtp: true, email: data.email };
        }

        localStorage.setItem('userData', JSON.stringify(data.user));
        localStorage.setItem('token', data.tokens.access);
        setUser(data.user);
        setToken(data.tokens.access);
        return true;
      } else {
        setError(response.data.message || 'Registration failed');
        return false;
      }
    } catch (err) {
      console.error('Registration error:', err);

      // Extract the error message from the response if available
      if (err.response) {
        console.log('Error response data:', err.response.data);

        // Handle specific status codes
        if (err.response.status === 409) {
          setError('Email already in use');
        } else if (err.response.status === 400) {
          if (err.response.data.message && err.response.data.message.includes('role')) {
            setError('Invalid role selected');
          } else {
            setError(err.response.data.message || 'Invalid registration information');
          }
        } else if (err.response.data && err.response.data.message) {
          setError(err.response.data.message);
        } else {
          setError('Registration failed. Please try again.');
        }
      } else if (err.request) {
        // Request was made but no response was received
        console.error('No response received:', err.request);
        setError('No response from server. Please check your internet connection.');
      } else {
        // Error in setting up the request
        setError(err.message || 'Registration failed');
      }

      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
  // Write the logout activity log before clearing the token
  if (token) {
      try {
        await axios.post(`${apiUrl}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        // Don't block logout if the request fails
        console.error('[logout] Could not log logout event:', e.message);
      }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setUser(null);
    setToken('');
    navigate('/');
  }, [navigate, token, apiUrl]);

  const verifyOtp = useCallback(async (email, otp) => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${apiUrl}/auth/verify-otp`, { email, otp });
      console.log('OTP verify response:', response.data);

      if (response.data.success && response.data.data) {
        const { user: userData, tokens } = response.data.data;

        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('token', tokens.access);
        setUser(userData);
        setToken(tokens.access);
        return true;
      } else {
        setError(response.data.message || 'Invalid verification code');
        return false;
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Invalid or expired verification code');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        verifyOtp,
        logout,
        authAxios,
        isAuthenticated: !!user,
        getToken: () => token,
        setUser: (userData) => setUser(userData)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;