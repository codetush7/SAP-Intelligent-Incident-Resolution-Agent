import React, { useState, useEffect } from 'react';
import { Radio, History, GitBranch, Plus, Edit, Check } from 'lucide-react';
import { monitoringAPI } from '../services/api';
import { Card, Btn, Toggle, SeverityBadge, Toast } from '../components/common';

const CATEGORY_STYLE = {
  'Critical':         { bg: 'var(--sap-critical-soft)', color: 'var(--sap-critical)', border: 'var(--sap-critical)' },
  'Action Required':  { bg: 'var(--sap-high-soft)',     color: 'var(--sap-high)',     border: 'var(--sap-high)' },
  'Warning':          { bg: 'var(--sap-medium-soft)',   color: 'var(--sap-medium)',   border: 'var(--sap-medium)' },
  'Informational':    { bg: 'var(--sap-low-soft)',      color: 'var(--sap-low)',      border: 'var(--sap-low)' },
};

const DEFAULT_AUTOMATION_RULES = [
  {
    id: 'RULE-001', name: 'P1 Critical Response', severity: 'P1', enabled: true,
    conditions: [{ field: 'Severity', op: '=', value: 'P1' }],
    actions: ['Create P1 Incident immediately', 'Send critical alert (all channels)', 'Page on-call engineer', 'Create ITSM ticket immediately', 'Start remediation (auto if safe)', 'Escalate if unresolved > 15min'],
    description: 'Any P1 detection triggers an immediate ticket and on-call notification before remediation is attempted.',
  },
  {
    id: 'RULE-002', name: 'P2 High Failure Response', severity: 'P2', enabled: true,
    conditions: [{ field: 'Severity', op: '=', value: 'P2' }, { field: 'Failure rate', op: '>', value: '25%' }, { field: 'Duration', op: '>', value: '10 min' }],
    actions: ['Create P2 Incident', 'Notify support team (email + Teams)', 'Attempt remediation', 'Create ITSM ticket', 'Monitor for recovery'],
    description: 'P2 failures that sustain above 25% error rate for 10+ minutes are ticketed and escalated.',
  },
  {
    id: 'RULE-003', name: 'P3 Repeated Failure Response', severity: 'P3', enabled: true,
    conditions: [{ field: 'Severity', op: '=', value: 'P3' }, { field: 'Failure count', op: '>', value: '10 OR duration > 15 min' }],
    actions: ['Create P3 Incident', 'Notify support team', 'Run AI-guided remediation', 'Create ITSM ticket only if remediation fails', 'Escalate if unresolved > 60min'],
    description: 'P3 failures that repeat or persist are remediated automatically. Ticket is created only if remediation fails.',
  },
  {
    id: 'RULE-004', name: 'P4 Transient Failure Watch', severity: 'P4', enabled: true,
    conditions: [{ field: 'Severity', op: '=', value: 'P4' }, { field: 'Failure count', op: '<', value: '3' }],
    actions: ['Generate alert only', 'Monitor for pattern', 'Attempt safe auto-remediation (retry)', 'Do NOT create ITSM ticket'],
    description: 'P4 low-impact failures below threshold are monitored and auto-retried. No ticket is opened.',
  },
];

function normalizeAlert(a) {
  const sev = (a.severity || '').toUpperCase();
  const cat = a.category || (sev === 'CRITICAL' ? 'Critical' : sev === 'HIGH' ? 'Action Required' : sev === 'MEDIUM' ? 'Warning' : 'Informational');
  const displayId = a.id ? (a.id.length > 8 ? `ALT-${a.id.slice(0, 4).toUpperCase()}` : a.id) : 'ALT-001';

  return {
    rawId: a.id,
    id: displayId,
    category: cat,
    artifact: a.artifact || a.iflow || a.interface || a.type || 'SAP CPI Runtime',
    text: a.message || a.text || a.title || 'Integration Alert',
    detail: a.detail || (a.type ? `Alert type: ${a.type}` : 'System generated signal'),
    t: a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (a.t || '—'),
    action: a.action || (a.acknowledged ? 'Acknowledged' : 'Active — AI triage in progress'),
    incident: a.incident || a.ticketNumber || null,
    acknowledged: !!a.acknowledged,
  };
}

export default function AlertsPage() {
  const [tab, setTab] = useState('active');
  const [catFilter, setCatFilter] = useState('All');
  const [toastMsg, setToastMsg] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    try {
      const data = await monitoringAPI.getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge(alertId) {
    try {
      await monitoringAPI.acknowledgeAlert(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
      setToastMsg('Alert acknowledged successfully.');
    } catch (err) {
      setToastMsg(err.message || 'Failed to acknowledge alert.');
    }
  }

  const normalized = alerts.map(normalizeAlert);
  const activeList = normalized.filter(a => !a.acknowledged);
  const historyList = normalized.filter(a => a.acknowledged);

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Alerts</h1>
        <p>
          Not every CPI signal becomes an incident. This page shows the full alert hierarchy and automation policies.
        </p>
      </div>

      {/* Alert → Incident hierarchy banner */}
      <div style={{ background: 'var(--sap-info-soft)', border: '1px solid rgba(0,112,242,0.15)', borderRadius: 8, padding: '10px 16px', marginBottom: 18, fontSize: 12.5, color: 'var(--sap-blue)' }}>
        <strong>Signal Hierarchy:</strong>
        {' '}CPI Signal → Alert → Incident → AI Analysis → Remediation → ITSM Ticket (if required) → Resolution
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn${tab === 'active' ? ' active' : ''}`} onClick={() => setTab('active')}>
          <Radio size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          Active Alerts ({activeList.length})
        </button>
        <button className={`tab-btn${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          <History size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          Alert History ({historyList.length})
        </button>
        <button className={`tab-btn${tab === 'rules' ? ' active' : ''}`} onClick={() => setTab('rules')}>
          <GitBranch size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          Automation Rules
        </button>
      </div>

      {tab === 'active' && (
        <ActiveAlerts
          alerts={activeList}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          loading={loading}
          onAcknowledge={handleAcknowledge}
        />
      )}
      {tab === 'history' && (
        <AlertHistoryTab alerts={historyList} loading={loading} />
      )}
      {tab === 'rules' && (
        <AutomationRules setToast={setToastMsg} />
      )}

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}

function ActiveAlerts({ alerts, catFilter, setCatFilter, loading, onAcknowledge }) {
  const cats = ['All', 'Critical', 'Action Required', 'Warning', 'Informational'];
  const list = alerts.filter(a => catFilter === 'All' || a.category === catFilter);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {cats.map(c => (
          <button
            key={c}
            className={`pill-btn${catFilter === c ? ' active' : ''}`}
            onClick={() => setCatFilter(c)}
          >
            {c}
            <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 700 }}>
              {c === 'All' ? alerts.length : alerts.filter(a => a.category === c).length}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading live alerts...</div>
        ) : list.map(a => {
          const s = CATEGORY_STYLE[a.category] || CATEGORY_STYLE.Informational;
          return (
            <Card key={a.rawId || a.id} style={{ borderLeft: `3px solid ${s.border}` }}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.4px',
                        background: s.bg, color: s.color,
                        padding: '2px 8px', borderRadius: 3,
                        textTransform: 'uppercase',
                      }}>
                        {a.category}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{a.t}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>{a.artifact}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{a.text}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{a.detail}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', maxWidth: 240, flexShrink: 0, lineHeight: 1.4 }}>
                    {a.action}
                    {a.incident && (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--sap-blue)', fontWeight: 700 }}>
                          {a.incident}
                        </span>
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => onAcknowledge(a.rawId)}
                        style={{ fontSize: 11, color: 'var(--sap-blue)' }}
                      >
                        <Check size={12} style={{ marginRight: 4 }} /> Acknowledge
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {!loading && list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No active alerts in this category.</div>
        )}
      </div>
    </>
  );
}

function AlertHistoryTab({ alerts, loading }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Alert ID</th><th>Category</th><th>Artifact</th><th>Description</th><th>Time</th><th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>Loading alert history...</td></tr>
          ) : alerts.map(a => {
            const s = CATEGORY_STYLE[a.category] || CATEGORY_STYLE.Informational;
            return (
              <tr key={a.rawId || a.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--sap-blue)', fontWeight: 700 }}>{a.id}</td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 3 }}>
                    {a.category}
                  </span>
                </td>
                <td style={{ fontWeight: 600, fontSize: 13 }}>{a.artifact}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{a.text}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{a.t}</td>
                <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{a.action}</td>
              </tr>
            );
          })}
          {!loading && alerts.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>No alert history recorded yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AutomationRules({ setToast }) {
  const [rules, setRules] = useState(DEFAULT_AUTOMATION_RULES);
  const SEV_COLORS = { P1: 'var(--sap-critical)', P2: 'var(--sap-high)', P3: 'var(--sap-medium)', P4: 'var(--sap-low)' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Rules the AI evaluates before deciding what action to take. Applied in severity order.
        </div>
        <Btn variant="primary" size="sm" onClick={() => setToast('Rule builder coming soon.')}>
          <Plus size={13} /> New Rule
        </Btn>
      </div>

      {rules.map(rule => (
        <Card key={rule.id} style={{ marginBottom: 14 }}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SeverityBadge sev={rule.severity} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{rule.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{rule.description}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: rule.enabled ? 'var(--sap-success)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {rule.enabled ? 'Active' : 'Disabled'}
                </span>
                <Toggle on={rule.enabled} onChange={v => {
                  setRules(rs => rs.map(r => r.id === rule.id ? { ...r, enabled: v } : r));
                  setToast(`Rule "${rule.name}" ${v ? 'enabled' : 'disabled'}.`);
                }} />
                <Btn variant="ghost" size="sm" onClick={() => setToast('Edit rule (coming soon).')}>
                  <Edit size={13} />
                </Btn>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* IF */}
              <div style={{ background: 'var(--bg-shell)', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>IF</div>
                {rule.conditions.map((c, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: SEV_COLORS[rule.severity] + '18', color: SEV_COLORS[rule.severity], padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 700 }}>
                      {c.field}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{c.op}</span>
                    <strong>{c.value}</strong>
                  </div>
                ))}
              </div>

              {/* THEN */}
              <div style={{ background: 'var(--sap-info-soft)', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--sap-blue)', marginBottom: 8 }}>THEN</div>
                {rule.actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5, fontSize: 12.5 }}>
                    <span style={{
                      width: 17, height: 17, borderRadius: '50%', background: 'var(--sap-blue)', color: '#fff',
                      fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                    }}>{i + 1}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
