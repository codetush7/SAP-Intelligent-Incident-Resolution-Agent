import React, { useState } from 'react';
import { Activity, TestTube2, PlugZap, Unplug, CheckCircle2, XCircle } from 'lucide-react';
import { Card, Btn, InfoRow, Toast } from '../components/common';

const ITSM_PROVIDERS = ['Jira', 'ServiceNow', 'IRIS'];

const PROVIDER_FIELDS = {
  Jira: [
    { key: 'url', label: 'Jira Instance URL', placeholder: 'https://yourorg.atlassian.net' },
    { key: 'email', label: 'Account Email', placeholder: 'you@company.com' },
    { key: 'apiToken', label: 'API Token', type: 'password' },
    { key: 'project', label: 'Default Project Key', placeholder: 'CPI' },
  ],
  ServiceNow: [
    { key: 'url', label: 'Instance URL', placeholder: 'https://yourorg.service-now.com' },
    { key: 'user', label: 'Username', placeholder: 'sap_cpi_user' },
    { key: 'apiToken', label: 'Password / API Key', type: 'password' },
    { key: 'table', label: 'Incident Table', placeholder: 'incident' },
  ],
  IRIS: [
    { key: 'url', label: 'IRIS Endpoint URL', placeholder: 'https://iris.yourorg.com/api' },
    { key: 'apiToken', label: 'API Token', type: 'password' },
    { key: 'workspace', label: 'Workspace ID', placeholder: 'ws-prod' },
  ],
};

export default function ITSMConnectionPage({ onITSMChange }) {
  const [provider, setProvider] = useState('Jira');
  const [connected, setConnected] = useState(true);
  const [testing, setTesting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [form, setForm] = useState({
    url: 'https://contoso-ag.atlassian.net',
    email: 'cpi-ops@contoso.com',
    apiToken: '',
    project: 'CPIOPS',
  });

  function toast(msg, type = 'success') { setToastMsg(msg); setToastType(type); }
  function setField(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  function testConnection() {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setConnected(true);
      toast(`${provider} connection test successful.`);
      if (onITSMChange) onITSMChange(provider);
    }, 1800);
  }

  function changeProvider(p) {
    setProvider(p);
    setConnected(false);
    setForm({ url: '', email: '', apiToken: '', project: '', user: '', table: '', workspace: '' });
  }

  return (
    <div className="animate-in" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <h1>ITSM Connection</h1>
        <p>Configure the ITSM destination for incident ticket creation. Only one active ITSM destination at a time.</p>
      </div>

      {/* Important notice */}
      <div style={{ background: 'var(--sap-info-soft)', border: '1px solid rgba(0,112,242,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 12.5, color: 'var(--sap-blue)' }}>
        <strong>Business Rule:</strong> Tickets are created ONLY in the currently configured and connected ITSM system.
        If no ITSM is connected, the Proceed action will prompt to configure a connection first.
      </div>

      {/* Provider selector */}
      <Card style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title"><Activity size={15} />ITSM Provider</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {ITSM_PROVIDERS.map(p => (
              <button
                key={p}
                onClick={() => changeProvider(p)}
                style={{
                  flex: 1, padding: '14px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${provider === p ? 'var(--sap-blue)' : 'var(--border)'}`,
                  background: provider === p ? 'var(--sap-blue-light)' : 'var(--bg-card)',
                  color: provider === p ? 'var(--sap-blue)' : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
                }}
              >
                {p}
                {connected && provider === p && (
                  <span style={{ display: 'block', fontSize: 11, marginTop: 3, color: 'var(--sap-success)', fontWeight: 600 }}>● Connected</span>
                )}
              </button>
            ))}
          </div>

          {/* Connection status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 6, marginBottom: 20,
            background: connected ? 'var(--sap-success-soft)' : 'var(--border-soft)',
            border: `1px solid ${connected ? 'rgba(16,120,105,0.25)' : 'var(--border)'}`,
          }}>
            {connected ? <CheckCircle2 size={16} color="var(--sap-success)" /> : <XCircle size={16} color="var(--text-muted)" />}
            <span style={{ fontWeight: 600, fontSize: 13, color: connected ? 'var(--sap-success)' : 'var(--text-muted)' }}>
              {provider} — {connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          {/* Dynamic fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(PROVIDER_FIELDS[provider] || []).map(f => (
              <div className="input-group" key={f.key} style={{ marginBottom: 0 }}>
                <label className="input-label">{f.label}</label>
                <input
                  className="input"
                  type={f.type || 'text'}
                  value={form[f.key] || ''}
                  onChange={setField(f.key)}
                  placeholder={f.placeholder || ''}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            {connected && (
              <Btn variant="danger" size="sm" onClick={() => { setConnected(false); toast(`${provider} disconnected.`, 'error'); }}>
                <Unplug size={13} /> Disconnect
              </Btn>
            )}
            <Btn variant="secondary" size="sm" onClick={testConnection} disabled={testing}>
              <TestTube2 size={13} /> {testing ? 'Testing...' : 'Test Connection'}
            </Btn>
            <Btn variant="primary" size="sm" onClick={() => {
              setConnected(true);
              toast(`${provider} connection saved.`);
              if (onITSMChange) onITSMChange(provider);
            }}>
              Save Connection
            </Btn>
          </div>
        </div>
      </Card>

      {/* Ticket mapping */}
      <Card>
        <div className="card-header"><span className="card-title">Ticket Field Mapping</span></div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            How CPI incident fields map to {provider} ticket fields:
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>CPI Field</th><th>{provider} Field</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {[
                  ['Incident ID', provider === 'Jira' ? 'Summary (prefix)' : 'Short Description', 'Auto-generated'],
                  ['Severity P1→P4', provider === 'Jira' ? 'Priority (Highest→Low)' : 'Priority (1→4)', 'Mapped automatically'],
                  ['Category', provider === 'Jira' ? 'Labels' : 'Category', 'Direct mapping'],
                  ['Artifact Name', provider === 'Jira' ? 'Description (field)' : 'Configuration Item', 'CPI artifact name'],
                  ['Root Cause', 'Description / Work notes', 'AI-generated text'],
                  ['Owner', 'Assignee', 'If user exists in ' + provider],
                ].map(([cpi, itsm, note], i) => (
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
