import React, { useState } from 'react';
import { Sparkles, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SignupPage({ onSwitchToLogin }) {
  const { signup } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', organization: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const { firstName, lastName, email, password, confirmPassword } = form;
    if (!firstName || !email || !password) { setError('First name, email, and password are required.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await (signup ? signup(form) : Promise.resolve());
      setSuccess(true);
      setTimeout(onSwitchToLogin, 2000);
    } catch (err) {
      setError(err.message || 'Account creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-wrap">
        <div className="auth-left">
          <div className="auth-card animate-in" style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--sap-success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle2 size={28} color="var(--sap-success)" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Account created!</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Redirecting you to sign in...</p>
          </div>
        </div>
        <div className="auth-right" />
      </div>
    );
  }

  const Field = ({ label, id, type = 'text', value, onChange, placeholder, extra }) => (
    <div className="input-group">
      <label className="input-label" htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input id={id} className="input" type={type} value={value} onChange={onChange} placeholder={placeholder} />
        {extra}
      </div>
    </div>
  );

  return (
    <div className="auth-wrap">
      <div className="auth-left">
        <div className="auth-card animate-in" style={{ maxWidth: 440 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--sap-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>CPI Intelligent Operations</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SAP Cloud Integration Platform</div>
            </div>
          </div>

          <h1 style={{ fontSize: 21, fontWeight: 700, marginBottom: 4 }}>Create account</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22 }}>Set up your operations workspace</p>

          {error && (
            <div style={{
              background: 'var(--sap-critical-soft)', color: 'var(--sap-critical)',
              border: '1px solid rgba(187,0,0,0.2)', borderRadius: 6,
              padding: '10px 12px', fontSize: 13, marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={14} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 0 }}>
              <div className="input-group">
                <label className="input-label">First Name *</label>
                <input className="input" placeholder="First" value={form.firstName} onChange={set('firstName')} />
              </div>
              <div className="input-group">
                <label className="input-label">Last Name</label>
                <input className="input" placeholder="Last" value={form.lastName} onChange={set('lastName')} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Email address *</label>
              <input className="input" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} />
            </div>

            <div className="input-group">
              <label className="input-label">Organization / Tenant</label>
              <input className="input" placeholder="Contoso AG" value={form.organization} onChange={set('organization')} />
            </div>

            <div className="input-group">
              <label className="input-label">Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={set('password')}
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Confirm Password *</label>
              <input
                className="input"
                type="password"
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', height: 40, fontSize: 14, fontWeight: 600, marginTop: 8 }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <button className="link-btn" onClick={onSwitchToLogin}>Sign in</button>
          </div>
        </div>
      </div>
      <div className="auth-right" />
    </div>
  );
}