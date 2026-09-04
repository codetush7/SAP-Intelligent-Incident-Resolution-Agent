import React, { useState } from 'react';
import { CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { TICKETS, TICKET_STAGES } from '../data/mockData';
import { SeverityBadge, StatusPill, CategoryChip, Card, Btn, Breadcrumb, InfoRow, Field, Toast } from '../components/common';

export default function TicketDetailPage({ ticketId, onBack }) {
  const [toastMsg, setToastMsg] = useState('');
  const tk = TICKETS.find(t => t.id === ticketId) || TICKETS[1];
  const toast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3200); };

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
            <span style={{ fontSize: 12.5, fontWeight: 600, color: tk.status === 'In Progress' ? 'var(--sap-info)' : tk.status === 'Closed' ? 'var(--text-muted)' : 'var(--sap-high)' }}>
              {tk.status}
            </span>
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{tk.problem}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{tk.artifact} · {tk.category}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" size="sm" onClick={() => toast(`${tk.id} synced with latest incident state.`)}>
            <RefreshCw size={13} /> Sync Now
          </Btn>
          <Btn variant="primary" size="sm" disabled={tk.status === 'Closed'} onClick={() => toast(`${tk.id} marked resolved.`)}>
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
