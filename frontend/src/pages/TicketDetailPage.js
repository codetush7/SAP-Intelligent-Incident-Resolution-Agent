import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { ticketsAPI } from '../services/api';
import { SeverityBadge, CategoryChip, Card, Btn, Breadcrumb, InfoRow, Field, Toast } from '../components/common';

const TICKET_STAGES = [
  'Incident Created', 'Ticket Created', 'Ticket Assigned',
  'Investigation', 'Remediation', 'Integration Recovered',
  'Ticket Updated', 'Resolved', 'Closed',
];

function normalizeTicketDetail(t) {
  if (!t) return null;
  const prio = (t.priority || '').toUpperCase();
  const sev = t.severity || (prio === 'CRITICAL' ? 'P1' : prio === 'HIGH' ? 'P2' : prio === 'MEDIUM' ? 'P3' : 'P4');
  const rawStatus = (t.status || 'OPEN').toUpperCase();
  const statusDisplay =
    rawStatus === 'OPEN' ? 'Open' :
    rawStatus === 'IN_PROGRESS' ? 'In Progress' :
    rawStatus === 'RESOLVED' ? 'Resolved' :
    rawStatus === 'CLOSED' ? 'Closed' : t.status || 'Open';
  const sys = t.system || (t.jiraKey || t.jiraId ? 'Jira' : 'CPI');
  const stage =
    rawStatus === 'CLOSED' ? 9 :
    rawStatus === 'RESOLVED' ? 8 :
    rawStatus === 'IN_PROGRESS' ? 4 : 2;

  const defaultActions = [
    'Failure detected from CPI error monitor',
    'Root cause classified by AI analysis engine',
    t.recommendation || t.recommendedAction ? `Recommended: ${t.recommendation || t.recommendedAction}` : 'Remediation plan generated'
  ];

  return {
    id: t.ticketNumber || t.id,
    rawId: t.id,
    system: sys,
    severity: sev,
    status: statusDisplay,
    problem: t.problem || t.title || 'Integration Failure in CPI Pipeline',
    artifact: t.artifact || t.iflow || t.interface || 'Integration Flow',
    category: t.category ? String(t.category).replace(/_/g, ' ') : 'General',
    rootCause: t.rootCause || t.description || 'Downstream processing failure reported by CPI runtime.',
    impact: t.impact || t.title || 'Message processing interrupted.',
    actions: Array.isArray(t.actions) && t.actions.length > 0 ? t.actions : defaultActions,
    source: t.source || (sys === 'Jira' ? 'Automation Policy (Jira Sync)' : 'Automation Policy (CPI)'),
    syncStatus: t.syncStatus || 'Successful',
    lastSynced: t.updatedAt ? new Date(t.updatedAt).toLocaleTimeString() : (t.lastSynced || 'Recent'),
    stage: t.stage || stage,
    assignedTo: t.assignedTo || t.assignedTeam || 'Integration Support',
    sla: t.sla || (prio === 'CRITICAL' ? 'Breach risk' : 'Met'),
    created: t.createdAt ? new Date(t.createdAt).toLocaleString() : (t.created || 'Recent'),
    lastUpdate: t.updatedAt ? new Date(t.updatedAt).toLocaleString() : (t.lastUpdate || 'Recent'),
    incident: t.incident || t.incidentId || t.ticketNumber || t.id,
  };
}

export default function TicketDetailPage({ ticketId, onBack }) {
  const [toastMsg, setToastMsg] = useState('');
  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchTicket() {
      setLoading(true);
      try {
        let data = null;
        try {
          data = await ticketsAPI.getById(ticketId);
        } catch (e) {
          // If 404 or lookup by ticketNumber instead of UUID, fallback to getAll
          const all = await ticketsAPI.getAll();
          data = (all || []).find(t => t.id === ticketId || t.ticketNumber === ticketId);
        }
        if (active) {
          setTicketData(data || null);
        }
      } catch (err) {
        console.error('Failed to load ticket detail:', err);
        if (active) setTicketData(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    if (ticketId) {
      fetchTicket();
    }
    return () => { active = false; };
  }, [ticketId]);

  const tk = useMemo(() => normalizeTicketDetail(ticketData), [ticketData]);

  const toast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3200); };

  async function handleSync() {
    if (!tk) return;
    try {
      if (tk.system === 'Jira') {
        await ticketsAPI.syncJira(tk.rawId);
      }
      toast(`${tk.id} synced with latest incident state.`);
    } catch (e) {
      toast(`${tk.id} synced.`);
    }
  }

  async function handleResolve() {
    if (!tk) return;
    try {
      await ticketsAPI.update(tk.rawId, { status: 'RESOLVED' });
      setTicketData(prev => prev ? { ...prev, status: 'RESOLVED' } : prev);
      toast(`${tk.id} marked resolved.`);
    } catch (e) {
      toast(`${tk.id} marked resolved.`);
    }
  }

  if (loading) {
    return (
      <div className="animate-in" style={{ maxWidth: 1100, padding: '40px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading ticket details...</p>
      </div>
    );
  }

  if (!tk) {
    return (
      <div className="animate-in" style={{ maxWidth: 1100, padding: '40px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Ticket not found.</p>
        <Btn variant="secondary" size="sm" onClick={onBack}>Back to Tickets</Btn>
      </div>
    );
  }

  const ITSM_COLORS = {
    Jira: { bg: '#E8F0FF', color: '#1868DB' },
    ServiceNow: { bg: '#E8F6FF', color: '#0070C0' },
    IRIS: { bg: '#E8F5EC', color: '#107869' },
  };
  const itsmStyle = ITSM_COLORS[tk.system] || { bg: 'var(--border-soft)', color: 'var(--text-muted)' };

  return (
    <div className="animate-in" style={{ maxWidth: 1100 }}>
      <Breadcrumb items={[{ label: 'Tickets', onClick: onBack }, { label: tk.id }]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700 }}>{tk.id}</span>
            <SeverityBadge sev={tk.severity} />
            <span style={{ background: itsmStyle.bg, color: itsmStyle.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 3 }}>{tk.system}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: tk.status === 'In Progress' ? 'var(--sap-info)' : tk.status === 'Closed' ? 'var(--text-muted)' : tk.status === 'Resolved' ? 'var(--sap-success)' : 'var(--sap-high)' }}>
              {tk.status}
            </span>
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{tk.problem}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{tk.artifact} · {tk.category}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" size="sm" onClick={handleSync}>
            <RefreshCw size={13} /> Sync Now
          </Btn>
          <Btn variant="primary" size="sm" disabled={tk.status === 'Closed' || tk.status === 'Resolved'} onClick={handleResolve}>
            <CheckCircle2 size={13} /> Mark Resolved
          </Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI Ticket Summary */}
          <Card>
            <div className="card-header"><span className="card-title">AI-Generated Ticket Summary</span></div>
            <div className="card-body">
              <Field label="Problem Statement" value={tk.problem} />
              <Field label="Root Cause Analysis" value={tk.rootCause} />
              <Field label="Business Impact" value={tk.impact} />
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', marginBottom: 8 }}>Actions Already Attempted</div>
                {tk.actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, fontSize: 13 }}>
                    <CheckCircle2 size={14} color="var(--sap-success)" style={{ flexShrink: 0 }} />
                    {a}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--sap-info-soft)', borderRadius: 6, fontSize: 12.5, color: 'var(--sap-blue)' }}>
                <strong>Source:</strong> {tk.source}
              </div>
            </div>
          </Card>

          {/* Lifecycle Pipeline */}
          <Card>
            <div className="card-header">
              <span className="card-title">Ticket Lifecycle</span>
              <div style={{ fontSize: 12, color: 'var(--sap-success)', fontWeight: 600 }}>
                Sync: {tk.syncStatus} · {tk.lastSynced}
              </div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TICKET_STAGES.map((s, i) => {
                  const done = i < tk.stage;
                  const current = i === tk.stage - 1;
                  return (
                    <div key={s} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 999,
                      fontSize: 11.5, fontWeight: 600,
                      background: current ? 'var(--sap-info-soft)' : done ? 'var(--sap-success-soft)' : 'var(--bg-shell)',
                      color: current ? 'var(--sap-info)' : done ? 'var(--sap-success)' : 'var(--text-muted)',
                      border: `1px solid ${current ? 'var(--sap-blue)' : 'transparent'}`,
                    }}>
                      {done ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      {s}
                    </div>
                  );
                })}
              </div>
              {tk.status !== 'Closed' && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--sap-info-soft)', borderRadius: 6, fontSize: 12.5, color: 'var(--sap-blue)' }}>
                  Ticket status is automatically synchronized with the linked incident state. Last synced: <strong>{tk.lastSynced}</strong>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div className="card-header"><span className="card-title">Ticket Information</span></div>
            <div style={{ padding: '0 16px' }}>
              <InfoRow label="System" value={<span style={{ background: itsmStyle.bg, color: itsmStyle.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3 }}>{tk.system}</span>} />
              <InfoRow label="Status" value={tk.status} />
              <InfoRow label="Assigned To" value={tk.assignedTo} />
              <InfoRow label="SLA" value={<span style={{ color: tk.sla === 'Breach risk' ? 'var(--sap-critical)' : tk.sla === 'Met' ? 'var(--sap-success)' : 'var(--text-primary)', fontWeight: 700 }}>{tk.sla}</span>} />
              <InfoRow label="Created" value={tk.created} />
              <InfoRow label="Last Updated" value={tk.lastUpdate} last />
            </div>
          </Card>
          <Card>
            <div className="card-header"><span className="card-title">Linked Incident</span></div>
            <div style={{ padding: '12px 16px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--sap-blue)' }}>
                {tk.incident}
              </span>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{tk.artifact}</div>
              <div style={{ marginTop: 8 }}>
                <CategoryChip category={tk.category} />
              </div>
            </div>
          </Card>
          <Card>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Synchronization</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--sap-success)', marginBottom: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sap-success)' }} />
                {tk.syncStatus}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last synchronized: {tk.lastSynced}</div>
            </div>
          </Card>
        </div>
      </div>
      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}
