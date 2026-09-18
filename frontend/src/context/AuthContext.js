import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const AuthContext = createContext(null);

function extractMessage(err) {
  return err.response?.data?.error || err.message || 'Request failed';
}

export function AuthProvider({ children }) {
  const [token, setToken]     = useState(() => localStorage.getItem('auth_token'));
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  // On mount: restore session from stored token
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    axios.get(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUser(res.data.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, logout]);

  // ─── Login ──────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      localStorage.setItem('auth_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err) {
      // Always surface the real error — never silently fall through
      throw new Error(extractMessage(err));
    }
  };

  // ─── Signup ─────────────────────────────────────────────────────────────────
  const signup = async (form) => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/signup`, form);
      localStorage.setItem('auth_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  };

  const updateUser = useCallback((updated) => {
    setUser(prev => ({ ...prev, ...updated }));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}