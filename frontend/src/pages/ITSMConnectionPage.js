import React, { useState, useEffect, useCallback } from 'react';
import { Activity, TestTube2, Unplug, CheckCircle2, XCircle } from 'lucide-react';
import { jiraAPI } from '../services/api';
import { Card, Btn, Toast } from '../components/common';

// ServiceNow and IRIS are future — Jira is the live one
const PROVIDERS = ['Jira', 'ServiceNow', 'IRIS'];

// Field definitions per provider
const PROVIDER_FIELDS = {
  Jira: [
    { key: 'baseUrl',    label: 'Jira Instance URL',  placeholder: 'https://yourorg.atlassian.net', type: 'text' },
    { key: 'email',      label: 'Account Email',       placeholder: 'you@company.com',               type: 'email' },
    { key: 'apiToken',   label: 'API Token',           placeholder: 'Jira API token (not your password)', type: 'password' },
    { key: 'projectKey', label: 'Default Project Key', placeholder: 'e.g. CPIOPS',                   type: 'text' },
  ],
  ServiceNow: [
    { key: 'baseUrl',  label: 'Instance URL', placeholder: 'https://yourorg.service-now.com', type: 'text' },
    { key: 'email',    label: 'Username',     placeholder: 'sap_cpi_user',                    type: 'text' },
    { key: 'apiToken', label: 'Password / API Key', placeholder: '…',                         type: 'password' },
  ],
  IRIS: [
    { key: 'baseUrl',  label: 'IRIS Endpoint URL', placeholder: 'https://iris.yourorg.com/api', type: 'text' },
    { key: 'apiToken', label: 'API Token',          placeholder: '…',                            type: 'password' },
  ],
};

const FIELD_MAPPING = {
  Jira: [
    ['Incident ID',  'Summary (prefix)',  'Auto-generated'],
    ['Severity P1→P4', 'Priority (Highest→Low)', 'Mapped automatically'],
    ['Category',     'Labels',           'Direct mapping'],
    ['Artifact Name','Description field','CPI artifact name'],
    ['Root Cause',   'Description body', 'AI-generated text'],
    ['Owner',        'Assignee',         'If user exists in Jira'],
  ],
  ServiceNow: [
    ['Incident ID',  'Short Description', 'Auto-generated'],
    ['Severity P1→P4', 'Priority (1→4)',  'Mapped automatically'],
    ['Category',     'Category',          'Direct mapping'],
    ['Artifact Name','Configuration Item','CPI artifact name'],
    ['Root Cause',   'Work notes',        'AI-generated text'],
  ],
  IRIS: [
    ['Incident ID',  'Ticket Number',   'Auto-generated'],
    ['Severity',     'Priority',        'Mapped automatically'],
    ['Root Cause',   'Description',     'AI-generated text'],
  ],
};

export default function ITSMConnectionPage({ onITSMChange }) {
  const [provider, setProvider]   = useState('Jira');
  const [jiraStatus, setJiraStatus] = useState(null); // {baseUrl, email, status, projectKey, ...}
  const [form, setForm]           = useState({ baseUrl: '', email: '', apiToken: '', projectKey: 'CPIOPS' });
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [toastMsg, setToastMsg]   = useState('');
  const [toastType, setToastType] = useState('success');
  const [apiError, setApiError]   = useState('');

  function toast(msg, type = 'success') { setToastMsg(msg); setToastType(type); setApiError(''); }

  // ─── Load current Jira status ─────────────────────────────────────────────────
  const loadJiraStatus = useCallback(async () => {
    try {
      const res = await jiraAPI.get();
      setJiraStatus(res.jira || null);
    } catch {
      setJiraStatus(null);
    }
  }, []);

  useEffect(() => { loadJiraStatus(); }, [loadJiraStatus]);

  // Pre-populate form with stored values when jiraStatus loads
  useEffect(() => {
    if (jiraStatus) {
      setForm(f => ({
        ...f,
        baseUrl:    jiraStatus.baseUrl    || f.baseUrl,
        email:      jiraStatus.email      || f.email,
        projectKey: jiraStatus.projectKey || f.projectKey,
        // apiToken is masked server-side — don't overwrite user entry
      }));
    }
  }, [jiraStatus]);


  const isJiraConnected = jiraStatus?.status === 'CONNECTED';

  function setField(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  // ─── Save Jira connection ─────────────────────────────────────────────────────
  async function handleSave() {
    if (provider !== 'Jira') {
      toast(`${provider} connection is planned for a future release.`, 'error');
      return;
    }
    if (!form.baseUrl || !form.email || !form.apiToken) {
      setApiError('Instance URL, email, and API token are all required.');
      return;
    }
    setSaving(true);
    setApiError('');
    try {
      const res = await jiraAPI.connect({
        baseUrl:    form.baseUrl,
        email:      form.email,
        apiToken:   form.apiToken,
        projectKey: form.projectKey || 'CPIOPS',
      });
      setJiraStatus(res.jira);
      if (res.test?.connected) {
        toast(`Jira connected successfully as ${res.test.user} → ${form.baseUrl}`, 'success');
        if (onITSMChange) onITSMChange('Jira');
      } else {
        toast(`Saved, but test failed: ${res.test?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      setApiError(err.message || 'Failed to connect to Jira.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Re-test ──────────────────────────────────────────────────────────────────
  async function handleTest() {
    if (provider !== 'Jira') { toast('Only Jira is live. ServiceNow and IRIS are coming soon.', 'error'); return; }
    if (!jiraStatus) { setApiError('Save connection details first.'); return; }
    setTesting(true);
    setApiError('');
    try {
      const res = await jiraAPI.test();
      await loadJiraStatus();
      if (res.test?.connected) {
        toast(`Connection test successful — logged in as ${res.test.user}`, 'success');
      } else {
        toast(`Test failed: ${res.test?.error}`, 'error');
      }
    } catch (err) {
      setApiError(err.message);
      await loadJiraStatus();
    } finally {
      setTesting(false);
    }
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────────
  async function handleDisconnect() {
    if (!window.confirm('Disconnect Jira? Ticket creation will stop working until you reconnect.')) return;
    try {
      await jiraAPI.disconnect();
      setJiraStatus(null);
      setForm({ baseUrl: '', email: '', apiToken: '', projectKey: 'CPIOPS' });
      toast('Jira disconnected.', 'success');
      if (onITSMChange) onITSMChange('');
    } catch (err) {
      setApiError(err.message);
    }
  }

  return (
    <div className="animate-in" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <h1>ITSM Connection</h1>
        <p>
          Configure the ITSM destination for incident ticket creation.
          Jira is fully integrated. ServiceNow and IRIS are planned.
        </p>
      </div>

      {/* Business rule notice */}
      <div style={{ background: 'var(--sap-info-soft)', border: '1px solid rgba(0,112,242,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 12.5, color: 'var(--sap-blue)' }}>
        <strong>Business Rule:</strong> Tickets are created ONLY in the currently configured and connected ITSM system.
        If no ITSM is connected, the Proceed action will prompt to configure a connection first.
      </div>

      {/* Provider selector */}
      <Card style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title"><Activity size={15} />ITSM Provider</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {PROVIDERS.map(p => {
              const isLive = p === 'Jira';
              const isConnected = p === 'Jira' && isJiraConnected;
              return (
                <button
                  key={p}
                  onClick={() => { setProvider(p); setApiError(''); }}
                  style={{
                    flex: 1, padding: '14px 10px', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${provider === p ? 'var(--sap-blue)' : 'var(--border)'}`,
                    background: provider === p ? 'var(--sap-blue-light)' : 'var(--bg-card)',
                    color: provider === p ? 'var(--sap-blue)' : 'var(--text-secondary)',
                    fontWeight: 700, fontSize: 14, transition: 'all 0.15s', position: 'relative',
                  }}
                >
                  {p}
                  <span style={{ display: 'block', fontSize: 10.5, marginTop: 4, fontWeight: 600,
                    color: isConnected ? 'var(--sap-success)' : isLive ? 'var(--text-muted)' : 'var(--text-muted)' }}>
                    {isConnected ? '● Connected' : isLive ? '○ Not Connected' : 'Coming Soon'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Jira status banner */}
          {provider === 'Jira' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 6, marginBottom: 20,
              background: isJiraConnected ? 'var(--sap-success-soft)' : 'var(--border-soft)',
              border: `1px solid ${isJiraConnected ? 'rgba(16,120,105,0.25)' : 'var(--border)'}`,
            }}>
              {isJiraConnected
                ? <CheckCircle2 size={16} color="var(--sap-success)" />
                : <XCircle size={16} color="var(--text-muted)" />}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: isJiraConnected ? 'var(--sap-success)' : 'var(--text-muted)' }}>
                  Jira — {isJiraConnected ? 'Connected' : 'Not Connected'}
                </div>
                {isJiraConnected && jiraStatus && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    {jiraStatus.baseUrl} · Project: <strong>{jiraStatus.projectKey}</strong> · {jiraStatus.email}
                  </div>
                )}
                {jiraStatus?.lastError && (
                  <div style={{ fontSize: 11.5, color: 'var(--sap-critical)' }}>Last error: {jiraStatus.lastError}</div>
                )}
              </div>
            </div>
          )}

          {/* Coming soon overlay for non-Jira */}
          {provider !== 'Jira' ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔜</div>
              <strong>{provider} integration is planned for a future release.</strong>
              <div style={{ fontSize: 13, marginTop: 4 }}>Only Jira is fully integrated right now.</div>
            </div>
          ) : (
            <>
              {/* API error */}
              {apiError && (
                <div style={{ background: 'var(--sap-critical-soft)', border: '1px solid var(--sap-critical)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--sap-critical)', fontWeight: 600, marginBottom: 14 }}>
                  {apiError}
                </div>
              )}

              {/* Jira connection form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {PROVIDER_FIELDS.Jira.map(f => (
                  <div className="input-group" key={f.key} style={{ marginBottom: 0, gridColumn: f.key === 'baseUrl' ? '1 / -1' : undefined }}>
                    <label className="input-label">{f.label} <span style={{ color: 'var(--sap-critical)' }}>*</span></label>
                    <input
                      className="input"
                      type={f.type}
                      value={form[f.key] || ''}
                      onChange={setField(f.key)}
                      placeholder={f.placeholder}
                      autoComplete={f.type === 'password' ? 'new-password' : undefined}
                    />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, padding: '8px 10px', background: 'var(--bg-shell)', borderRadius: 5 }}>
                <strong>Jira API Token:</strong> Atlassian Account → Security → Create API token.
                Use your email + API token (not your Atlassian password).
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                {isJiraConnected && (
                  <Btn variant="danger" size="sm" onClick={handleDisconnect}>
                    <Unplug size={13} /> Disconnect
                  </Btn>
                )}
                <Btn variant="secondary" size="sm" onClick={handleTest} disabled={testing || !isJiraConnected}>
                  <TestTube2 size={13} /> {testing ? 'Testing…' : 'Test Connection'}
                </Btn>
                <Btn variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Connecting…' : 'Save & Connect'}
                </Btn>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Field mapping table */}
      <Card>
        <div className="card-header"><span className="card-title">Ticket Field Mapping — {provider}</span></div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            How CPI incident fields map to {provider} ticket fields when you Proceed or create via automation policy:
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>CPI Field</th><th>{provider} Field</th><th>Notes</th></tr></thead>
              <tbody>
                {(FIELD_MAPPING[provider] || []).map(([cpi, itsm, note], i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{cpi}</td>
                    <td style={{ color: 'var(--sap-blue)', fontWeight: 500 }}>{itsm}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    </div>
  );
}
