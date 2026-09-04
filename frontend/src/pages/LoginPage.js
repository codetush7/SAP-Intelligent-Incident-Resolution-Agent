import React, { useState } from 'react';
import { Sparkles, Eye, EyeOff, ShieldCheck, AlertTriangle, Activity, Bot } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onSwitchToSignup }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      {/* Left — Form */}
      <div className="auth-left">
        <div className="auth-card animate-in">
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--sap-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>CPI Intelligent Operations</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SAP Cloud Integration Platform</div>
            </div>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Access your production operations dashboard</p>

          {error && (
            <div style={{
              background: 'var(--sap-critical-soft)', color: 'var(--sap-critical)',
              border: '1px solid rgba(187,0,0,0.2)', borderRadius: 6,
              padding: '10px 12px', fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">Email address</label>
              <input
                className="input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button type="button" className="link-btn" style={{ fontSize: 12.5 }}>Forgot password?</button>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', height: 40, fontSize: 14, fontWeight: 600 }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <button className="link-btn" onClick={onSwitchToSignup}>Create account</button>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-soft)', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Enterprise SSO available · Contact your administrator
              </span>
              <button
                type="button"
                onClick={() => { document.querySelector('input[type="email"]').value = 'demo@company.com'; document.querySelector('input[type="email"]').dispatchEvent(new Event('input', { bubbles: true })); }}
                style={{ fontSize: 11, color: 'var(--sap-blue)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, textDecoration: 'underline', padding: 0 }}
              >
                Demo mode: demo@company.com / demo
              </button>
            </div>
        </div>
      </div>

      {/* Right — Branding Panel */}
      <div className="auth-right">
        <div style={{ position: 'relative', zIndex: 1, color: '#fff', textAlign: 'center', maxWidth: 340 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 36 }}>
            {[
              { icon: <ShieldCheck size={22} />, label: 'AI-Powered\nRemediation' },
              { icon: <Activity size={22} />, label: 'Real-time\nMonitoring' },
              { icon: <Bot size={22} />, label: 'Intelligent\nDecisions' },
            ].map((f, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 8px',
                }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: 11, opacity: 0.85, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{f.label}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, lineHeight: 1.25 }}>
            Intelligent SAP CPI Operations
          </h2>
          <p style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.65, marginBottom: 32 }}>
            Monitor your integrations, detect issues automatically, remediate safely with AI, and escalate to ITSM only when needed.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { v: '89%', l: 'Auto-remediation rate' },
              { v: '22m', l: 'Mean time to resolve' },
              { v: '8%', l: 'Ticket creation rate' },
              { v: '97.4%', l: 'SLA compliance' },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '14px 12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.v}</div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}