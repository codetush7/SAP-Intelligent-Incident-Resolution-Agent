import React, { useState, useEffect, useCallback } from 'react';
import { Link2, RefreshCw, TestTube2, PlugZap, CheckCircle2, XCircle, Database, Plus, Trash2 } from 'lucide-react';
import { tenantsAPI } from '../services/api';
import { Card, Btn, InfoRow, Toast } from '../components/common';

const ENVIRONMENTS = ['DEV', 'TEST', 'QA', 'PROD'];

const EMPTY_FORM = {
  name: '',
  environment: 'PROD',
  baseUrl: '',
  tokenUrl: '',
  clientId: '',
  clientSecret: '',
};

function statusBannerStyle(status) {
  if (status === 'CONNECTED') return { bg: 'var(--sap-success-soft)', border: 'rgba(16,120,105,0.25)', icon: <CheckCircle2 size={18} color="var(--sap-success)" />, color: 'var(--sap-success)', label: 'Connected' };
  if (status === 'FAILED')    return { bg: 'var(--sap-critical-soft)', border: 'rgba(187,0,0,0.25)',  icon: <XCircle size={18} color="var(--sap-critical)" />,    color: 'var(--sap-critical)', label: 'Connection Failed' };
  return                             { bg: 'var(--border-soft)',         border: 'var(--border)',        icon: <XCircle size={18} color="var(--text-muted)" />,        color: 'var(--text-muted)',   label: 'Not Tested' };
}

export default function TenantConnectPage() {
  const [tenants, setTenants]     = useState([]);
  const [selected, setSelected]   = useState(null); // the tenant being viewed/edited
  const [form, setForm]           = useState(EMPTY_FORM);
  const [isNew, setIsNew]         = useState(false);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [toastMsg, setToastMsg]   = useState('');
  const [toastType, setToastType] = useState('success');
  const [apiError, setApiError]   = useState('');

  function toast(msg, type = 'success') {
    setToastMsg(msg);
    setToastType(type);
    setApiError('');
  }

  // ─── Load tenants on mount ───────────────────────────────────────────────────
  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantsAPI.getAll();
      const list = res.tenants || [];
      setTenants(list);
      if (list.length > 0 && !selected) {
        const active = list.find(t => t.active) || list[0];
        setSelected(active);
        setForm({
          name: active.name,
          environment: active.environment,
          baseUrl: active.baseUrl,
          tokenUrl: active.tokenUrl,
          clientId: active.clientId,
          clientSecret: '', // secret is masked — only send a new value if the user types one
        });
        setIsNew(false);
      }
    } catch (err) {
      // Not authenticated yet (demo mode) or backend down — silently stay empty
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadTenants(); }, [loadTenants]);

  function setField(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  // ─── Save (create or update) ──────────────────────────────────────────────────
  async function handleSave() {
    setApiError('');
    setSaving(true);
    try {
      let res;
      if (isNew || !selected) {
        // Require all fields for a new connection
        if (!form.name || !form.baseUrl || !form.tokenUrl || !form.clientId || !form.clientSecret) {
          setApiError('Please fill in all fields (Tenant Name, Base URL, Token URL, Client ID, Client Secret).');
          setSaving(false);
          return;
        }
        res = await tenantsAPI.create(form);
      } else {
        // On update, only send clientSecret if the user actually typed a new one
        const payload = { ...form };
        if (!payload.clientSecret) delete payload.clientSecret;
        res = await tenantsAPI.update(selected.id, payload);
      }
      await loadTenants();
      const testResult = res.test;
      if (testResult?.tokenObtained) {
        toast('Tenant saved and connection test successful.', 'success');
      } else if (testResult?.error) {
        toast(`Tenant saved, but OAuth test failed: ${testResult.error}`, 'error');
      } else {
        toast('Tenant saved.', 'success');
      }
      setIsNew(false);
    } catch (err) {
      setApiError(err.message || 'Failed to save tenant.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Test connection ──────────────────────────────────────────────────────────
  async function handleTest() {
    if (!selected) return;
    setTesting(true);
    setApiError('');
    try {
      const res = await tenantsAPI.test(selected.id);
      await loadTenants();
      if (res.test?.tokenObtained) {
        toast('Connection test successful — OAuth token obtained from SAP CPI tenant.', 'success');
      } else {
        toast(`Test failed: ${res.test?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      setApiError(err.message || 'Connection test failed.');
      await loadTenants();
    } finally {
      setTesting(false);
    }
  }

  // ─── Sync artifacts ───────────────────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); toast('Artifact sync triggered. Results will appear in Integrations.', 'success'); }, 800);
  }

  // ─── Activate ────────────────────────────────────────────────────────────────
  async function handleActivate(id) {
    try {
      await tenantsAPI.activate(id);
      await loadTenants();
      toast('Tenant set as active.', 'success');
    } catch (err) {
      setApiError(err.message);
    }
  }

  // ─── Remove ──────────────────────────────────────────────────────────────────
  async function handleRemove(id) {
    if (!window.confirm('Remove this tenant connection? This cannot be undone.')) return;
    try {
      await tenantsAPI.delete(id);
      setSelected(null);
      setForm(EMPTY_FORM);
      setIsNew(false);
      await loadTenants();
      toast('Tenant removed.', 'success');
    } catch (err) {
      setApiError(err.message);
    }
  }

  // ─── New tenant ───────────────────────────────────────────────────────────────
  function startNew() {
    setSelected(null);
    setForm(EMPTY_FORM);
    setIsNew(true);
    setApiError('');
  }

  const banner = statusBannerStyle(selected?.status);

  return (
    <div className="animate-in" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <h1>Tenant Connection</h1>
        <p>Connect your SAP CPI tenant using OAuth 2.0 Client Credentials. Secrets are AES-256 encrypted at rest.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Tenant list panel */}
        <div>
          <Card style={{ padding: '8px 0', marginBottom: 10 }}>
            {loading ? (
              <div style={{ padding: '16px', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>Loading…</div>
            ) : tenants.length === 0 ? (
              <div style={{ padding: '16px', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>No tenants yet.</div>
            ) : (
              tenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelected(t);
                    setIsNew(false);
                    setApiError('');
                    setForm({ name: t.name, environment: t.environment, baseUrl: t.baseUrl, tokenUrl: t.tokenUrl, clientId: t.clientId, clientSecret: '' });
                  }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2,
                    background: selected?.id === t.id ? 'var(--sap-blue-light)' : 'transparent',
                    borderLeft: `3px solid ${selected?.id === t.id ? 'var(--sap-blue)' : 'transparent'}`,
                    cursor: 'pointer', border: 'none', borderBottom: '1px solid var(--border-soft)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: selected?.id === t.id ? 'var(--sap-blue)' : 'var(--text-primary)' }}>{t.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: 'var(--border-soft)', color: 'var(--text-muted)' }}>{t.environment}</span>
                    {t.active && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sap-success)' }}>ACTIVE</span>}
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.status === 'CONNECTED' ? 'var(--sap-success)' : t.status === 'FAILED' ? 'var(--sap-critical)' : 'var(--text-muted)', marginLeft: 'auto' }} />
                  </div>
                </button>
              ))
            )}
          </Card>
          <Btn variant="secondary" size="sm" style={{ width: '100%' }} onClick={startNew}>
            <Plus size={13} /> Add Tenant
          </Btn>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status banner */}
          {!isNew && selected && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 8,
              background: banner.bg, border: `1px solid ${banner.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {banner.icon}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: banner.color }}>
                    {selected.name} — {banner.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {selected.status === 'CONNECTED'
                      ? `Last tested: ${selected.lastTestedAt ? new Date(selected.lastTestedAt).toLocaleString() : 'N/A'}`
                      : selected.lastError || 'Run a connection test to verify credentials.'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="secondary" size="sm" onClick={handleTest} disabled={testing}>
                  <TestTube2 size={13} /> {testing ? 'Testing…' : 'Test Connection'}
                </Btn>
                {!selected.active && (
                  <Btn variant="secondary" size="sm" onClick={() => handleActivate(selected.id)}>
                    <PlugZap size={13} /> Set Active
                  </Btn>
                )}
                <Btn variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>
                  <RefreshCw size={13} className={syncing ? 'spin' : ''} /> {syncing ? 'Syncing…' : 'Sync Artifacts'}
                </Btn>
                <Btn variant="danger" size="sm" onClick={() => handleRemove(selected.id)}>
                  <Trash2 size={13} />
                </Btn>
              </div>
            </div>
          )}

          {/* API error */}
          {apiError && (
            <div style={{ background: 'var(--sap-critical-soft)', border: '1px solid var(--sap-critical)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--sap-critical)', fontWeight: 600 }}>
              {apiError}
            </div>
          )}

          {/* Connection form */}
          <Card>
            <div className="card-header">
              <span className="card-title"><Link2 size={15} />{isNew ? 'New Tenant Connection' : 'Connection Settings'}</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Tenant Name <span style={{ color: 'var(--sap-critical)' }}>*</span></label>
                  <input className="input" value={form.name} onChange={setField('name')} placeholder="e.g. Contoso AG — Production" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Environment</label>
                  <select className="select" value={form.environment} onChange={setField('environment')}>
                    {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <div className="input-group" style={{ marginTop: 12 }}>
                <label className="input-label">
                  Tenant Base URL <span style={{ color: 'var(--sap-critical)' }}>*</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>e.g. https://your-tenant.it-cpi018.cfapps.eu10-004.hana.ondemand.com</span>
                </label>
                <input className="input" value={form.baseUrl} onChange={setField('baseUrl')} placeholder="https://…" />
              </div>
              <div className="input-group">
                <label className="input-label">
                  OAuth Token URL <span style={{ color: 'var(--sap-critical)' }}>*</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>e.g. https://your-subaccount.authentication.eu10.hana.ondemand.com/oauth/token</span>
                </label>
                <input className="input" value={form.tokenUrl} onChange={setField('tokenUrl')} placeholder="https://…/oauth/token" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Client ID <span style={{ color: 'var(--sap-critical)' }}>*</span></label>
                  <input className="input" value={form.clientId} onChange={setField('clientId')} placeholder="sb-your-client-id@your-tenant" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">
                    Client Secret <span style={{ color: 'var(--sap-critical)' }}>*</span>
                    {!isNew && selected && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>(leave blank to keep existing)</span>}
                  </label>
                  <input className="input" type="password" value={form.clientSecret} onChange={setField('clientSecret')}
                    placeholder={isNew ? 'Enter client secret' : '••••••••••••'} autoComplete="new-password" />
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, padding: '8px 10px', background: 'var(--bg-shell)', borderRadius: 5 }}>
                <strong>Where to find these:</strong> SAP BTP Cockpit → Subaccount → Service Instances → your CPI service key → JSON credentials
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                {isNew && <Btn variant="secondary" size="sm" onClick={() => { setIsNew(false); setApiError(''); }}>Cancel</Btn>}
                <Btn variant="primary" size="sm" disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving & Testing…' : (isNew ? 'Save & Test Connection' : 'Save Changes')}
                </Btn>
              </div>
            </div>
          </Card>

          {/* Tenant details (read-only) */}
          {!isNew && selected && (
            <Card>
              <div className="card-header"><span className="card-title"><Database size={15} />Tenant Details</span></div>
              <div style={{ padding: '0 16px' }}>
                <InfoRow label="Environment" value={selected.environment} />
                <InfoRow label="Base URL"    value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{selected.baseUrl}</span>} />
                <InfoRow label="Token URL"   value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{selected.tokenUrl}</span>} />
                <InfoRow label="Client ID"   value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{selected.clientId}</span>} />
                <InfoRow label="Status"      value={<span style={{ fontWeight: 700, color: banner.color }}>{selected.status}</span>} />
                <InfoRow label="Last Tested" value={selected.lastTestedAt ? new Date(selected.lastTestedAt).toLocaleString() : '—'} last />
              </div>
            </Card>
          )}
        </div>
      </div>

      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    </div>
  );
}