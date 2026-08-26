import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onSwitchToSignup }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Sign in</h1>
        <p className="text-secondary">SAP CPI AI Ticketing Agent</p>

        <div className="mb-3">
          <label className="text-sm mb-1">Email</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="text-sm mb-1">Password</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>

        {error && <div className="text-sm text-red mb-2">{error}</div>}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="text-sm text-secondary mt-3">
          Don't have an account?{' '}
          <button type="button" className="link-btn" onClick={onSwitchToSignup}>Sign up</button>
        </p>
      </form>
    </div>
  );
}