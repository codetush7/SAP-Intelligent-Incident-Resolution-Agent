import React, { useEffect, useState, useCallback } from 'react';
import { Link2, Plus, CheckCircle2, XCircle, Loader2, Trash2, RefreshCw, Power, Ticket } from 'lucide-react';
import { tenantsAPI, jiraAPI } from '../services/api';

const emptyForm = {
  name: '',
  environment: 'DEV',
  baseUrl: '',
  tokenUrl: '',
  clientId: '',
  clientSecret: ''
};

const emptyJiraForm = {
  baseUrl: '',
  email: '',
  apiToken: '',
  projectKey: 'CPI'
};

function StatusBadge({ status }) {
  const map = {
    CONNECTED: { cls: 'badge-resolved', label: 'Connected' },
    FAILED: { cls: 'badge-critical', label: 'Failed' },
    UNTESTED: { cls: 'badge-open', label: 'Untested' }
  };
  const s = map[status] || map.UNTESTED;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export default function TenantConnectPage() {
  const [tenants, setTenants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);

  const [jira, setJira] = useState(null);
  const [showJiraForm, setShowJiraForm] = useState(false);
  const [jiraForm, setJiraForm] = useState(emptyJiraForm);
  const [jiraSaving, setJiraSaving] = useState(false);
  const [jiraTesting, setJiraTesting] = useState(false);
  const [jiraError, setJiraError] = useState('');

  const loadTenants = useCallback(async () => {
    try {
      const res = await tenantsAPI.getAll();
      setTenants(res.tenants || []);
    } catch (err) {
      // silent — empty state will show
    } finally {
      setLoading(false);
    }
  }, []);

  const loadJira = useCallback(async () => {
    try {
      const res = await jiraAPI.get();
      setJira(res.jira || null);
    } catch (err) {
      // silent
    }
  }, []);

  useEffect(() => { loadTenants(); loadJira(); }, [loadTenants, loadJira]);

  const handleChange = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const resetForm = () => {
    setForm(emptyForm);
    setFormError('');
    setShowForm(false);
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.name || !form.baseUrl || !form.tokenUrl || !form.clientId || !form.clientSecret) {
      setFormError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      const res = await tenantsAPI.create(form);
      setTenants(prev => [...prev, res.tenant]);
      if (res.test && res.test.tokenObtained === false) {
        setFormError(`Saved, but connection test failed: ${res.test.error}`);
      } else {
        resetForm();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to save tenant.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    try {
      const res = await tenantsAPI.test(id);
      setTenants(prev => prev.map(t => (t.id === id ? res.tenant : t)));
    } finally {
      setTestingId(null);
    }
  };

  const handleActivate = async (id) => {
    const res = await tenantsAPI.activate(id);
    setTenants(prev => prev.map(t => ({ ...t, active: t.id === res.tenant.id })));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this tenant connection?')) return;
    await tenantsAPI.delete(id);
    setTenants(prev => prev.filter(t => t.id !== id));
  };

  const handleJiraChange = (field) => (e) => setJiraForm(f => ({ ...f, [field]: e.target.value }));

  const handleJiraConnect = async () => {
    setJiraError('');
    if (!jiraForm.baseUrl || !jiraForm.email || !jiraForm.apiToken) {
      setJiraError('Please fill in all required fields.');
      return;
    }
    setJiraSaving(true);
    try {
      const res = await jiraAPI.connect(jiraForm);
      setJira(res.jira);
      if (res.test && res.test.connected === false) {
        setJiraError(`Saved, but connection test failed: ${res.test.error}`);
      } else {
        setShowJiraForm(false);
        setJiraForm(emptyJiraForm);
      }
    } catch (err) {
      setJiraError(err.message || 'Failed to connect Jira.');
    } finally {
      setJiraSaving(false);
    }
  };

  const handleJiraTest = async () => {
    setJiraTesting(true);
    try {
      const res = await jiraAPI.test();
      setJira(res.jira);
    } finally {
      setJiraTesting(false);
    }
  };

  const handleJiraDisconnect = async () => {
    if (!window.confirm('Disconnect Jira? Tickets will stop auto-syncing.')) return;
    await jiraAPI.disconnect();
    setJira(null);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>Tenant Connect</h1>
          <p>Connect and manage your SAP CPI tenants</p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={15} /> Add Tenant
          </button>
        )}
      </div>

      {showForm && (
        <div className="card animate-in" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title"><Link2 size={16} /> New Tenant Connection</span>
          </div>

          <div className="flex-col gap-3">
            <div>
              <div className="text-sm mb-1">Tenant Name <span className="text-red">*</span></div>
              <input className="input" placeholder="e.g. My DEV Tenant" value={form.name} onChange={handleChange('name')} />
            </div>

            <div>
              <div className="text-sm mb-1">Environment <span className="text-red">*</span></div>
              <select className="select" style={{ width: '100%' }} value={form.environment} onChange={handleChange('environment')}>
                <option value="DEV">DEV</option>
                <option value="TEST">TEST</option>
                <option value="QA">QA</option>
                <option value="PROD">PROD</option>
              </select>
            </div>

            <div>
              <div className="text-sm mb-1">SAP Host URL <span className="text-red">*</span></div>
              <input className="input" placeholder="https://your-tenant.it-cpi001.cfapps.eu10.hana.ondemand.com" value={form.baseUrl} onChange={handleChange('baseUrl')} />
            </div>

            <div>
              <div className="text-sm mb-1">Token URL <span className="text-red">*</span></div>
              <input className="input" placeholder="https://your-tenant.authentication.eu10.hana.ondemand.com/oauth/token" value={form.tokenUrl} onChange={handleChange('tokenUrl')} />
            </div>

            <div>
              <div className="text-sm mb-1">Client ID <span className="text-red">*</span></div>
              <input className="input" placeholder="sb-your-client-id-here" value={form.clientId} onChange={handleChange('clientId')} />
            </div>

            <div>
              <div className="text-sm mb-1">Client Secret <span className="text-red">*</span></div>
              <input className="input" type="password" placeholder="••••••••••••" value={form.clientSecret} onChange={handleChange('clientSecret')} />
            </div>

            {formError && <div className="text-sm text-red">{formError}</div>}

            <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={resetForm} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={15} className="spin" /> : <Link2 size={15} />}
                {saving ? 'Testing & Saving...' : 'Test & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Connected Tenants</span>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading tenants...</p></div>
        ) : tenants.length === 0 ? (
          <div className="empty-state">
            <Link2 size={28} />
            <p>No tenants connected yet. Click "+ Add Tenant" to connect your SAP CPI tenant.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Environment</th>
                  <th>Host URL</th>
                  <th>Client ID</th>
                  <th>Status</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td className="fw-600">{t.name}</td>
                    <td>{t.environment}</td>
                    <td className="text-secondary text-sm mono">{t.baseUrl}</td>
                    <td className="text-secondary text-sm">{t.clientId}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>
                      {t.active ? (
                        <span className="badge badge-resolved"><CheckCircle2 size={12} /> Active</span>
                      ) : (
                        <button className="btn btn-secondary btn-xs" onClick={() => handleActivate(t.id)}>
                          <Power size={12} /> Set Active
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-xs" onClick={() => handleTest(t.id)} disabled={testingId === t.id}>
                          {testingId === t.id ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
                          Test
                        </button>
                        <button className="btn btn-danger btn-xs" onClick={() => handleDelete(t.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Jira Connect */}
      <div className="card section-gap">
        <div className="card-header">
          <span className="card-title"><Ticket size={16} /> Jira Integration</span>
          {jira?.connected && !showJiraForm && (
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-xs" onClick={handleJiraTest} disabled={jiraTesting}>
                {jiraTesting ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} Test
              </button>
              <button className="btn btn-danger btn-xs" onClick={handleJiraDisconnect}>Disconnect</button>
            </div>
          )}
        </div>

        {!jira && !showJiraForm && (
          <div className="empty-state">
            <Ticket size={28} />
            <p>Not connected. Connect Jira so failures detected by the AI agent auto-create issues.</p>
            <button className="btn btn-primary mt-3" onClick={() => setShowJiraForm(true)}>
              <Plus size={15} /> Connect Jira
            </button>
          </div>
        )}

        {jira && !showJiraForm && (
          <div className="flex items-center justify-between">
            <div>
              <div className="fw-600">{jira.baseUrl}</div>
              <div className="text-sm text-secondary mt-1">{jira.email} · Project {jira.projectKey}</div>
            </div>
            <StatusBadge status={jira.status} />
          </div>
        )}

        {showJiraForm && (
          <div className="flex-col gap-3">
            <div>
              <div className="text-sm mb-1">Jira Base URL <span className="text-red">*</span></div>
              <input className="input" placeholder="https://your-org.atlassian.net" value={jiraForm.baseUrl} onChange={handleJiraChange('baseUrl')} />
            </div>
            <div>
              <div className="text-sm mb-1">Email <span className="text-red">*</span></div>
              <input className="input" placeholder="you@company.com" value={jiraForm.email} onChange={handleJiraChange('email')} />
            </div>
            <div>
              <div className="text-sm mb-1">API Token <span className="text-red">*</span></div>
              <input className="input" type="password" placeholder="Jira API token" value={jiraForm.apiToken} onChange={handleJiraChange('apiToken')} />
              <div className="text-xs text-muted mt-1">Create one at id.atlassian.com → Security → API tokens</div>
            </div>
            <div>
              <div className="text-sm mb-1">Project Key</div>
              <input className="input" placeholder="CPI" value={jiraForm.projectKey} onChange={handleJiraChange('projectKey')} />
            </div>

            {jiraError && <div className="text-sm text-red">{jiraError}</div>}

            <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => { setShowJiraForm(false); setJiraError(''); }} disabled={jiraSaving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleJiraConnect} disabled={jiraSaving}>
                {jiraSaving ? <Loader2 size={15} className="spin" /> : <Link2 size={15} />}
                {jiraSaving ? 'Testing & Saving...' : 'Test & Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}