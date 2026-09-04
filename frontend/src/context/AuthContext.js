import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const AuthContext = createContext(null);

// Demo mode: use these credentials to bypass backend
const DEMO_EMAIL    = 'demo@company.com';
const DEMO_PASSWORD = 'demo';
const DEMO_USER = {
  firstName: 'Priya',
  lastName: 'Nair',
  email: DEMO_EMAIL,
  role: 'Integration Ops Lead',
  organization: 'Contoso AG',
};

export function AuthProvider({ children }) {
  const [token, setToken]     = useState(() => localStorage.getItem('auth_token'));
  const [user, setUser]       = useState(() => {
    try { const s = localStorage.getItem('demo_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('demo_user');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // If a demo user is stored, skip backend check
    const saved = localStorage.getItem('demo_user');
    if (saved) { setLoading(false); return; }
    if (!token) { setLoading(false); return; }
    axios.get(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUser(res.data.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, logout]);

  const login = async (email, password) => {
    // Demo mode bypass — works without backend
    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      localStorage.setItem('demo_user', JSON.stringify(DEMO_USER));
      setUser(DEMO_USER);
      setToken('demo-token');
      return;
    }
    const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    localStorage.setItem('auth_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const signup = async (form) => {
    const demoUser = {
      firstName: form.firstName || 'User',
      lastName: form.lastName || '',
      email: form.email,
      role: 'Integration Ops',
      organization: form.organization || '',
    };
    try {
      const res = await axios.post(`${API_URL}/api/auth/signup`, form);
      localStorage.setItem('auth_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    } catch {
      // Fallback to demo mode when backend not available
      localStorage.setItem('demo_user', JSON.stringify(demoUser));
      setUser(demoUser);
      setToken('demo-token');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}