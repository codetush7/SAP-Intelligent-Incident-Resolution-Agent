import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SignupPage({ onSwitchToLogin }) {
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, form.confirmPassword);
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create account</h1>
        <p className="text-secondary">SAP CPI AI Ticketing Agent</p>

        <div className="mb-3">
          <label className="text-sm mb-1">Full Name</label>
          <input className="input" value={form.name} onChange={handleChange('name')} required />
        </div>
        <div className="mb-3">
          <label className="text-sm mb-1">Email</label>
          <input className="input" type="email" value={form.email} onChange={handleChange('email')} required />
        </div>
        <div className="mb-3">
          <label className="text-sm mb-1">Password</label>
          <input className="input" type="password" value={form.password} onChange={handleChange('password')} required />
        </div>
        <div className="mb-3">
          <label className="text-sm mb-1">Confirm Password</label>
          <input className="input" type="password" value={form.confirmPassword} onChange={handleChange('confirmPassword')} required />
        </div>

        {error && <div className="text-sm text-red mb-2">{error}</div>}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        <p className="text-sm text-secondary mt-3">
          Already have an account?{' '}
          <button type="button" className="link-btn" onClick={onSwitchToLogin}>Sign in</button>
        </p>
      </form>
    </div>
  );
}