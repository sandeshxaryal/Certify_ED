// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // SECURITY: the access token now lives only in React state, never in
  // localStorage. Previously both the access token and the long-lived
  // refresh token were written to localStorage, which any XSS on the page
  // can read in full — that turned a script-injection bug into full account
  // takeover for as long as the refresh token was valid (7 days). The
  // refresh token now lives in an httpOnly cookie the backend sets (see
  // POST /api/auth/verify-otp and /api/auth/refresh), which JavaScript
  // cannot read at all. The access token is still readable by XSS while it
  // sits in memory, but it's short-lived and disappears on tab close/reload,
  // which is the best you can do for a token JS needs to attach to requests.
  const [token, setToken] = useState('');
  const navigate = useNavigate();

  const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

  // Create axios instance with auth header. withCredentials is required so
  // the httpOnly refreshToken cookie is sent on /auth/refresh and /auth/logout.
  const authAxios = axios.create({
    baseURL: apiUrl,
    withCredentials: true,
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  // Update headers when token changes
  useEffect(() => {
    authAxios.defaults.headers.Authorization = token ? `Bearer ${token}` : '';
  }, [token]);

  // On mount: try to silently restore a session from the httpOnly refresh
  // cookie. This replaces the old "read token/userData back out of
  // localStorage" restore path.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await axios.post(
          `${apiUrl}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        if (response.data.success && response.data.data) {
          const { user: userData, tokens } = response.data.data;
          setUser(userData);
          setToken(tokens.access);
        }
      } catch {
        // No valid refresh cookie (never logged in, expired, or logged out
        // elsewhere) — this is a normal, expected case, not an error to show.
        setUser(null);
        setToken('');
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Login function - fixed to match the API response structure
  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${apiUrl}/auth/login`, { email, password }, { withCredentials: true });
      console.log('Login response:', response.data);

      if (response.data.success && response.data.data) {
        const data = response.data.data;

        // OTP step required
        if (data.requiresOtp) {
          return { requiresOtp: true, email: data.email };
        }

        // Full login (shouldn't happen now but kept as fallback)
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

      const response = await axios.post(`${apiUrl}/auth/register`, { name, email, password, role }, { withCredentials: true });
      console.log('Register response:', response.data);

      if (response.data.success && response.data.data) {
        const data = response.data.data;

        // OTP step required
        if (data.requiresOtp) {
          return { requiresOtp: true, email: data.email };
        }

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
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true, // needed so the server can clear the refreshToken cookie
        });
      } catch (e) {
        // Don't block logout if the request fails
        console.error('[logout] Could not log logout event:', e.message);
      }
    }
    setUser(null);
    setToken('');
    navigate('/');
  }, [navigate, token, apiUrl]);

  const verifyOtp = useCallback(async (email, otp) => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${apiUrl}/auth/verify-otp`, { email, otp }, { withCredentials: true });
      console.log('OTP verify response:', response.data);

      if (response.data.success && response.data.data) {
        const { user: userData, tokens } = response.data.data;

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