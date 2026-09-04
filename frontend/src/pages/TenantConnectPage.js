import React, { useState } from 'react';
import { Link2, RefreshCw, TestTube2, PlugZap, CheckCircle2, XCircle, Database } from 'lucide-react';
import { Card, Btn, InfoRow, Toggle, Toast } from '../components/common';

export default function TenantConnectionPage() {
  const [connected, setConnected] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [form, setForm] = useState({
    tenantName: 'Contoso AG — Production',
    tenantUrl: 'https://contoso-ag.it-cpi018.cfapps.eu10-004.hana.ondemand.com',
    clientId: 'cpi-ops-svc@contoso.tenant',
    authMethod: 'OAuth 2.0 Client Credentials',
  });
  const [lastSync] = useState('01 Sep 2026, 10:54 AM');
  const [artifacts] = useState([
    { name: 'Customer_Master_Sync', status: 'Synced', version: 'v2.4', pkg: 'Master Data' },
    { name: 'Payment_Order_Integration', status: 'Synced', version: 'v3.1', pkg: 'Finance' },
    { name: 'Vendor_Invoice_Sync', status: 'Synced', version: 'v1.8', pkg: 'Procurement' },
    { name: 'Employee_Master_Update', status: 'Synced', version: 'v2.0', pkg: 'HCM' },
    { name: 'Sales_Order_Processing', status: 'Synced', version: 'v4.2', pkg: 'Sales' },
    { name: 'Shipment_Status_Update', status: 'Synced', version: 'v1.5', pkg: 'Logistics' },
  ]);

  function toast(msg, type = 'success') { setToastMsg(msg); setToastType(type); }
  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  function testConnection() {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setConnected(true);
      toast('Connection test successful. SAP CPI tenant is reachable.');
    }, 1800);
  }

  function syncNow() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast('Artifact synchronization complete. 10 artifacts updated.');
    }, 2200);
  }

  return (
    <div className="animate-in" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <h1>Tenant Connection</h1>
        <p>Configure and manage the SAP Cloud Integration tenant connection for this environment.</p>
      </div>

      {/* Connection status banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderRadius: 8, marginBottom: 20,
        background: connected ? 'var(--sap-success-soft)' : 'var(--sap-critical-soft)',
        border: `1px solid ${connected ? 'rgba(16,120,105,0.25)' : 'rgba(187,0,0,0.25)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {connected ? <CheckCircle2 size={18} color="var(--sap-success)" /> : <XCircle size={18} color="var(--sap-critical)" />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: connected ? 'var(--sap-success)' : 'var(--sap-critical)' }}>
              CPI Tenant — {connected ? 'Connected' : 'Disconnected'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
              Last synchronized: {lastSync}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" size="sm" onClick={testConnection} disabled={testing}>
            <TestTube2 size={13} /> {testing ? 'Testing...' : 'Test Connection'}
          </Btn>
          {!connected && (
            <Btn variant="primary" size="sm" onClick={() => { setConnected(true); toast('Reconnected successfully.'); }}>
              <PlugZap size={13} /> Reconnect
            </Btn>
          )}
          <Btn variant="secondary" size="sm" onClick={syncNow} disabled={syncing}>
            <RefreshCw size={13} className={syncing ? 'spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Now'}
          </Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Connection Settings */}
        <Card>
          <div className="card-header"><span className="card-title"><Link2 size={15} />Connection Settings</span></div>
          <div className="card-body">
            <div className="input-group">
              <label className="input-label">Tenant Name</label>
              <input className="input" value={form.tenantName} onChange={set('tenantName')} />
            </div>
            <div className="input-group">
              <label className="input-label">Tenant URL</label>
              <input className="input" value={form.tenantUrl} onChange={set('tenantUrl')} placeholder="https://*.cfapps.*.hana.ondemand.com" />
            </div>
            <div className="input-group">
              <label className="input-label">Client ID</label>
              <input className="input" value={form.clientId} onChange={set('clientId')} />
            </div>
            <div className="input-group">
              <label className="input-label">Authentication Method</label>
              <select className="select" value={form.authMethod} onChange={set('authMethod')}>
                <option>OAuth 2.0 Client Credentials</option>
                <option>Basic Authentication</option>
                <option>mTLS Certificate</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Client Secret</label>
              <input className="input" type="password" value="••••••••••••••••••" readOnly />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Btn variant="secondary" size="sm">Reset</Btn>
              <Btn variant="primary" size="sm" onClick={() => toast('Connection settings saved.')}>Save Settings</Btn>
            </div>
          </div>
        </Card>

        {/* Tenant info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div className="card-header"><span className="card-title">Tenant Details</span></div>
            <div style={{ padding: '0 16px' }}>
              <InfoRow label="Environment" value="Production" />
              <InfoRow label="Region" value="EU10 — Europe (Frankfurt)" />
              <InfoRow label="Data Center" value="cfapps.eu10-004.hana.ondemand.com" />
              <InfoRow label="Connection Status" value={<span style={{ color: connected ? 'var(--sap-success)' : 'var(--sap-critical)', fontWeight: 700 }}>{connected ? 'Connected' : 'Disconnected'}</span>} />
              <InfoRow label="Last Synchronized" value={lastSync} last />
            </div>
          </Card>

          <Card>
            <div className="card-header">
              <span className="card-title"><Database size={15} />Artifact Synchronization</span>
              <span style={{ fontSize: 12, color: 'var(--sap-success)', fontWeight: 600 }}>{artifacts.length} synced</span>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {artifacts.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid var(--border-soft)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.pkg} · {a.version}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sap-success)', background: 'var(--sap-success-soft)', padding: '2px 7px', borderRadius: 3 }}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    </div>
  );
}