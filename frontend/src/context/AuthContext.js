import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    return sessionStorage.getItem('auth_token');
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    axios.get(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUser(res.data.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, logout]);

  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    sessionStorage.setItem('auth_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const signup = async (name, email, password, confirmPassword) => {
    const res = await axios.post(`${API_URL}/api/auth/signup`, { name, email, password, confirmPassword });
    sessionStorage.setItem('auth_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
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