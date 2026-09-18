import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Play, Square, RefreshCw, Bell, BellOff, Wifi } from 'lucide-react';
import { monitoringAPI } from '../services/api';

const statusColors = { RUNNING: 'var(--accent-green)', FAILED: 'var(--critical)', WARNING: 'var(--accent-amber)', OK: 'var(--accent-green)' };

export default function MonitoringPage({ wsConnected }) {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [iflows, setIflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [s, l, a, f] = await Promise.all([
        monitoringAPI.getStatus(),
        monitoringAPI.getLogs(30),
        monitoringAPI.getAlerts(),
        monitoringAPI.getIflows()
      ]);
      setStatus(s);
      setLogs(l);
      setAlerts(a);
      setIflows(f);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function triggerScan() {
    setScanLoading(true);
    try {
      await monitoringAPI.triggerScan();
      setTimeout(loadAll, 1000);
    } catch (err) { alert(err.message); }
    finally { setScanLoading(false); }
  }

  async function acknowledgeAlert(id) {
    try {
      await monitoringAPI.acknowledgeAlert(id);
      setAlerts(a => a.map(alert => alert.id === id ? { ...alert, acknowledged: true } : alert));
    } catch (err) { alert(err.message); }
  }

  const activeAlerts = alerts.filter(a => !a.acknowledged);
  const iflowStats = {
    running: iflows.filter(f => f.status === 'RUNNING').length,
    failed: iflows.filter(f => f.status === 'FAILED').length,
    warning: iflows.filter(f => f.status === 'WARNING').length
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading monitoring data...</div>;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>System Monitoring</h1>
          <p>Real-time SAP CPI integration health and alert management</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={loadAll}><RefreshCw size={14} /></button>
          <button className="btn btn-primary btn-sm" onClick={triggerScan} disabled={scanLoading}>
            {scanLoading ? <><span className="spin" style={{ display: 'inline-block' }}>⟳</span> Scanning...</> : <><Play size={14} /> Trigger Scan</>}
          </button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid-4 mb-4">
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: status?.active ? 'var(--accent-green)' : 'var(--critical)', animation: status?.active ? 'pulse-dot 1.5s infinite' : 'none' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Monitor</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{status?.active ? 'Active' : 'Stopped'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Every {status?.intervalSeconds}s</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Alerts</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: activeAlerts.length > 0 ? 'var(--critical)' : 'var(--accent-green)', marginTop: 6 }}>{activeAlerts.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{alerts.length} total</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>iFlows</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>{iflows.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{iflowStats.failed} failed · {iflowStats.warning} warning</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wifi size={12} color={wsConnected ? 'var(--accent-green)' : 'var(--critical)'} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>WebSocket</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: wsConnected ? 'var(--accent-green)' : 'var(--critical)', marginTop: 6 }}>{wsConnected ? 'Live' : 'Offline'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Real-time events</div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Active Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><AlertTriangle size={15} /> Active Alerts ({activeAlerts.length})</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {activeAlerts.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <CheckCircle size={24} color="var(--accent-green)" />
                <p style={{ color: 'var(--accent-green)', marginTop: 8 }}>No active alerts</p>
              </div>
            ) : activeAlerts.map(alert => (
              <div key={alert.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(30,45,74,0.4)' }}>
                <AlertTriangle size={14} color={alert.severity === 'CRITICAL' ? 'var(--critical)' : 'var(--accent-amber)'} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{alert.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    <span className={`badge badge-${alert.severity === 'CRITICAL' ? 'critical' : 'medium'}`} style={{ padding: '1px 5px', fontSize: 10 }}>{alert.severity}</span>
                    {' '}{new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <button className="btn btn-secondary btn-xs" onClick={() => acknowledgeAlert(alert.id)} title="Acknowledge">
                  <BellOff size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* iFlow status */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Activity size={15} /> iFlow Status</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {iflows.map(flow => (
              <div key={flow.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(30,45,74,0.4)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[flow.status] || '#64748b', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{flow.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{flow.interface} · {new Date(flow.lastRun).toLocaleTimeString()}</div>
                </div>
                <span className={`badge badge-${flow.status === 'RUNNING' ? 'resolved' : flow.status === 'FAILED' ? 'critical' : 'medium'}`} style={{ fontSize: 10 }}>
                  {flow.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monitoring logs */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Activity size={15} /> Monitoring Logs</span>
          <button className="btn btn-secondary btn-xs" onClick={loadAll}><RefreshCw size={11} /></button>
        </div>
        <div style={{ maxHeight: 350, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td><span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-card-hover)', color: 'var(--text-muted)', fontWeight: 600 }}>{log.type}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.message}</td>
                  <td>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                      color: log.status === 'OK' ? 'var(--accent-green)' : log.status === 'ERROR' ? 'var(--critical)' : log.status === 'TICKET_CREATED' ? 'var(--accent-blue)' : 'var(--accent-amber)',
                      background: log.status === 'OK' ? 'rgba(16,185,129,0.1)' : log.status === 'ERROR' ? 'rgba(239,68,68,0.1)' : log.status === 'TICKET_CREATED' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)'
                    }}>{log.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
