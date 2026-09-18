import React, { useState, useEffect } from 'react';
import { User, Bot, Bell, Shield, Cog, Save } from 'lucide-react';
import { Card, Toggle, Btn, Toast } from '../components/common';
import { authAPI, agentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SECTIONS = ['General', 'User Profile', 'AI Configuration', 'Notifications', 'Security', 'System'];

export default function SettingsPage({ user }) {
  const [section, setSection] = useState('General');
  const [toastMsg, setToastMsg] = useState('');
  const toast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure the platform, your profile, AI provider, and notification preferences.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Nav */}
        <Card style={{ padding: '8px 0' }}>
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setSection(s)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 16px',
                fontSize: 13, fontWeight: section === s ? 600 : 400,
                background: section === s ? 'var(--sap-blue-light)' : 'transparent',
                color: section === s ? 'var(--sap-blue)' : 'var(--text-secondary)',
                border: 'none', borderLeft: `3px solid ${section === s ? 'var(--sap-blue)' : 'transparent'}`,
                cursor: 'pointer', display: 'block',
              }}>
              {s}
            </button>
          ))}
        </Card>

        {/* Content */}
        <div>
          {section === 'General' && <GeneralSettings toast={toast} />}
          {section === 'User Profile' && <UserProfileSettings user={user} toast={toast} />}
          {section === 'AI Configuration' && <AISettings toast={toast} />}
          {section === 'Notifications' && <NotificationSettings toast={toast} />}
          {section === 'Security' && <SecuritySettings toast={toast} />}
          {section === 'System' && <SystemSettings toast={toast} />}
        </div>
      </div>
      <Toast message={toastMsg} onClose={() => setToastMsg('')} />
    </div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, desc, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      {desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{desc}</div>}
      <input className="input" style={{ maxWidth: 340 }} type={type} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function GeneralSettings({ toast }) {
  const [theme, setTheme] = useState('Light (SAP Quartz)');
  const [tz, setTz] = useState('UTC+00:00 (London, Dublin)');
  const [dateFormat, setDateFormat] = useState('DD MMM YYYY, HH:mm');
  return (
    <Card>
      <div className="card-header"><span className="card-title"><Cog size={15} />General Settings</span></div>
      <div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Theme</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['Light (SAP Quartz)', 'Dark (SAP Morning Horizon)', 'System Default'].map(t => (
              <button key={t} onClick={() => setTheme(t)}
                className={`pill-btn${theme === t ? ' active' : ''}`}
                style={{ fontSize: 12.5 }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Timezone</div>
          <select className="select" style={{ maxWidth: 340 }} value={tz} onChange={e => setTz(e.target.value)}>
            <option>UTC+00:00 (London, Dublin)</option>
            <option>UTC+01:00 (Frankfurt, Paris)</option>
            <option>UTC+05:30 (Mumbai, New Delhi)</option>
            <option>UTC-05:00 (New York, Eastern)</option>
            <option>UTC-08:00 (San Francisco, Pacific)</option>
          </select>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Date Format</div>
          <select className="select" style={{ maxWidth: 340 }} value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
            <option>DD MMM YYYY, HH:mm</option>
            <option>MM/DD/YYYY HH:mm</option>
            <option>YYYY-MM-DD HH:mm:ss</option>
          </select>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-soft)' }}>
          <Btn variant="primary" size="sm" onClick={() => toast('General settings saved.')}>
            <Save size={13} /> Save
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function UserProfileSettings({ user, toast }) {
  const { updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || user?.name?.split(' ')[0] || user?.name || '',
    lastName: user?.lastName || (user?.name?.split(' ').slice(1).join(' ') || ''),
    email: user?.email || '',
    org: user?.organization || '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || user.name?.split(' ')[0] || user.name || '',
        lastName: user.lastName || (user.name?.split(' ').slice(1).join(' ') || ''),
        email: user.email || '',
        org: user.organization || '',
      });
    }
  }, [user]);

  async function handleSave() {
    setSaving(true);
    try {
      const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
      const res = await authAPI.updateProfile({
        name: fullName,
        organization: form.org
      });
      if (updateUser && res?.user) {
        updateUser(res.user);
      }
      toast('Profile updated successfully.');
    } catch (err) {
      toast(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="card-header"><span className="card-title"><User size={15} />User Profile</span></div>
      <div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">First Name</label>
            <input className="input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Last Name</label>
            <input className="input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </div>
        </div>
        <FieldRow label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" />
        <FieldRow label="Organization" value={form.org} onChange={e => setForm(f => ({ ...f, org: e.target.value }))} />
        <div style={{ padding: '16px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border-soft)' }}>
          <Btn variant="secondary" size="sm" onClick={() => toast('Change password email sent.')}>Change Password</Btn>
          <Btn variant="primary" size="sm" disabled={saving} onClick={handleSave}>
            <Save size={13} /> {saving ? 'Saving...' : 'Save Profile'}
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function AISettings({ toast }) {
  // Only providers with a real backend adapter. Keep in sync with
  // backend/src/services/ai/providerFactory.js SUPPORTED list — adding a
  // provider there (+ a providers/xyzProvider.js file) is what unlocks a
  // new entry here, not the other way around.
  const PROVIDERS = [
    { id: 'groq', label: 'Groq', models: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'] },
    { id: 'gemini', label: 'Google Gemini', models: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'] },
  ];

  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('openai/gpt-oss-20b');
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [status, setStatus] = useState({}); // { groq: true/false, gemini: true/false } — has a usable key anywhere
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    agentAPI.getAiConfig()
      .then(res => {
        if (cancelled) return;
        const statusMap = {};
        (res.providers || []).forEach(p => { statusMap[p.provider] = p.configured; });
        setStatus(statusMap);
        if (res.active?.provider) {
          setProvider(res.active.provider);
          setModel(res.active.model);
        }
        setHasStoredKey(!!statusMap[res.active?.provider]);
      })
      .catch(() => { /* backend unreachable — form still usable, will error on Save */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const provModels = PROVIDERS.find(p => p.id === provider)?.models || [];

  async function handleSave() {
    if (!apiKey && !hasStoredKey) {
      toast(`Enter your ${provider === 'gemini' ? 'Gemini' : 'Groq'} API key first.`);
      return;
    }
    setSaving(true);
    try {
      await agentAPI.saveAiConfig({ provider, model, apiKey: apiKey || undefined });
      setApiKey('');
      setHasStoredKey(true);
      setStatus(s => ({ ...s, [provider]: true }));
      toast(`AI configuration saved — ${provider === 'gemini' ? 'Google Gemini' : 'Groq'} / ${model} is now active.`);
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save AI configuration.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="card-header"><span className="card-title"><Bot size={15} />AI Configuration</span></div>
      <div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>AI Provider</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => { setProvider(p.id); setModel(p.models[0]); setApiKey(''); setHasStoredKey(!!status[p.id]); }}
                style={{ padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `2px solid ${provider === p.id ? 'var(--sap-blue)' : 'var(--border)'}`,
                  background: provider === p.id ? 'var(--sap-blue-light)' : 'var(--bg-card)',
                  color: provider === p.id ? 'var(--sap-blue)' : 'var(--text-secondary)',
                  transition: 'all 0.1s',
                }}>
                {p.label}{status[p.id] ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Model</div>
          <select className="select" style={{ maxWidth: 280 }} value={model} onChange={e => setModel(e.target.value)} disabled={loading}>
            {provModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>API Key</div>
          <input
            className="input" type="password" style={{ maxWidth: 340 }}
            value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder={hasStoredKey ? '•••••••••••••••••••••• (already saved — enter a new key to replace it)' : `Enter your ${provider === 'gemini' ? 'Gemini' : 'Groq'} API key...`}
            disabled={loading}
          />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            {provider === 'gemini'
              ? 'Free key: Google AI Studio → API Keys → Create API key.'
              : 'Free key: console.groq.com → API Keys → Create API Key.'}
          </div>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="primary" size="sm" onClick={handleSave} disabled={saving || loading}>
            <Save size={13} /> {saving ? 'Saving...' : 'Save'}
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function NotificationSettings({ toast }) {
  const [prefs, setPrefs] = useState({ email: true, teams: false, p1: true, p2: true, p3: false, p4: false, ticketCreated: true, resolved: false });
  const set = k => v => setPrefs(p => ({ ...p, [k]: v }));
  return (
    <Card>
      <div className="card-header"><span className="card-title"><Bell size={15} />Notification Preferences</span></div>
      <div>
        <SettingRow label="Email Notifications" desc="Send notifications to your email address"><Toggle on={prefs.email} onChange={set('email')} /></SettingRow>
        <SettingRow label="Microsoft Teams" desc="Webhook integration for Teams"><Toggle on={prefs.teams} onChange={set('teams')} /></SettingRow>
        <div style={{ padding: '10px 20px', background: 'var(--bg-shell)', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Alert on severity</div>
        </div>
        <SettingRow label="P1 — Critical"><Toggle on={prefs.p1} onChange={set('p1')} /></SettingRow>
        <SettingRow label="P2 — High"><Toggle on={prefs.p2} onChange={set('p2')} /></SettingRow>
        <SettingRow label="P3 — Medium"><Toggle on={prefs.p3} onChange={set('p3')} /></SettingRow>
        <SettingRow label="P4 — Low" desc="Informational only"><Toggle on={prefs.p4} onChange={set('p4')} /></SettingRow>
        <div style={{ padding: '10px 20px', background: 'var(--bg-shell)', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Events</div>
        </div>
        <SettingRow label="Ticket Created"><Toggle on={prefs.ticketCreated} onChange={set('ticketCreated')} /></SettingRow>
        <SettingRow label="Incident Resolved"><Toggle on={prefs.resolved} onChange={set('resolved')} /></SettingRow>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="primary" size="sm" onClick={() => toast('Notification preferences saved.')}>
            <Save size={13} /> Save
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function SecuritySettings({ toast }) {
  const [mfa, setMfa] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('8h');
  return (
    <Card>
      <div className="card-header"><span className="card-title"><Shield size={15} />Security</span></div>
      <div>
        <SettingRow label="Multi-Factor Authentication" desc="Require MFA for all sign-ins">
          <Toggle on={mfa} onChange={setMfa} />
        </SettingRow>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Session Timeout</div>
          <select className="select" style={{ maxWidth: 200 }} value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}>
            <option value="1h">1 hour</option>
            <option value="4h">4 hours</option>
            <option value="8h">8 hours</option>
            <option value="24h">24 hours</option>
          </select>
        </div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>IP Allowlist</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Restrict access to specific IP ranges (optional)</div>
          <input className="input" style={{ maxWidth: 340 }} placeholder="0.0.0.0/0 (allow all)" />
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="primary" size="sm" onClick={() => toast('Security settings saved.')}>
            <Save size={13} /> Save
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function SystemSettings({ toast }) {
  const [autoRetry, setAutoRetry] = useState(true);
  const [maxRetries, setMaxRetries] = useState('3');
  const [syncInterval, setSyncInterval] = useState('5');
  return (
    <Card>
      <div className="card-header"><span className="card-title"><Cog size={15} />System Configuration</span></div>
      <div>
        <SettingRow label="Auto-Retry Failed Messages" desc="Automatically retry transient failures">
          <Toggle on={autoRetry} onChange={setAutoRetry} />
        </SettingRow>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Max Retry Attempts</div>
          <input className="input" type="number" min={1} max={10} style={{ maxWidth: 120 }} value={maxRetries} onChange={e => setMaxRetries(e.target.value)} />
        </div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Artifact Sync Interval</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>How often to poll CPI for artifact and monitoring updates (minutes)</div>
          <input className="input" type="number" min={1} style={{ maxWidth: 120 }} value={syncInterval} onChange={e => setSyncInterval(e.target.value)} />
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="primary" size="sm" onClick={() => toast('System settings saved.')}>
            <Save size={13} /> Save
          </Btn>
        </div>
      </div>
    </Card>
  );
}