import React, { useState, useMemo } from 'react';
import {
  Bot, Wrench, Ticket, AlertTriangle, ArrowRight, CheckCircle2,
  XCircle, Clock, ShieldCheck, ShieldAlert, Edit2, Users, TrendingUp,
  Info,
} from 'lucide-react';
import { INCIDENTS } from '../data/mockData';
import {
  SeverityBadge, StatusPill, CategoryChip, Card, Btn, Breadcrumb,
  InfoRow, Field, TimelineItem, Toast, AlertBox,
} from '../components/common';

function buildTimeline(inc) {
  const base = [
    { status: 'done',  title: 'Incident detected',   detail: `${inc.category} on ${inc.artifact}`, time: inc.detected.split(', ')[1] },
    { status: 'done',  title: 'AI analysis complete', detail: `Classified ${inc.severity} · Confidence ${inc.aiConfidence}%`, time: inc.detected.split(', ')[1] },
  ];
  const resolved = ['Resolved', 'Auto-Remediated'].includes(inc.status);
  const hasTicket = !!inc.ticket;
  const escalated = inc.status === 'Escalated';

  if (resolved) {
    return [...base,
      { status: 'done', title: 'Remediation started', detail: inc.recommendedAction, time: '+' + inc.duration },
      { status: 'done', title: 'Remediation succeeded', detail: `${inc.failureCount} messages retried — all successful`, time: '+' + inc.duration },
      { status: 'done', title: 'Incident resolved', detail: 'No human intervention required', time: '+' + inc.duration },
    ];
  }
  if (escalated) {
    return [...base,
      { status: 'done', title: 'Critical alert sent & on-call paged', detail: inc.owner, time: inc.detected.split(', ')[1] },
      { status: 'done', title: `${inc.ticketSystem} ticket created immediately`, detail: inc.ticket, time: '+1m' },
      { status: 'pending', title: 'Remediation in progress', detail: inc.recommendedAction, time: 'now' },
      { status: 'failed', title: 'Escalated', detail: 'Continuing to monitor', time: 'now' },
    ];
  }
  // investigating / open
  return [...base,
    { status: 'done',    title: 'Remediation attempted', detail: inc.recommendedAction, time: '+2m' },
    { status: 'failed',  title: 'Remediation unsuccessful', detail: 'Failure persisted past policy threshold', time: '+' + inc.duration },
    { status: hasTicket ? 'done' : 'pending', title: hasTicket ? `${inc.ticketSystem} ticket created` : 'Ticket pending', detail: hasTicket ? inc.ticket : 'Awaiting policy evaluation', time: '+' + inc.duration },
    { status: 'pending', title: 'Awaiting resolution', detail: `Owner: ${inc.owner}`, time: 'now' },
  ];
}

export default function IncidentDetailPage({ incidentId, onBack, showToast, itsmSystem = 'Jira', onCreateTicket }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [localToast, setLocalToast] = useState('');

  const inc = useMemo(() => INCIDENTS.find(i => i.id === incidentId) || INCIDENTS[2], [incidentId]);
  const steps = useMemo(() => buildTimeline(inc), [inc]);
  const resolved = ['Resolved', 'Auto-Remediated'].includes(inc.status);
  const hasTicket = !!inc.ticket;
  const needsTicket = inc.decision === 'ticket';

  function toast(msg) { setLocalToast(msg); setTimeout(() => setLocalToast(''), 3200); }

  return (
    <div className="animate-in" style={{ maxWidth: 1200 }}>
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Incidents', onClick: onBack },
        { label: inc.id },
      ]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{inc.id}</span>
            <SeverityBadge sev={inc.severity} />
            <StatusPill status={inc.status} />
            <CategoryChip category={inc.category} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            {inc.artifact} — {inc.category}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {inc.pkg} · {inc.iface} · Detected {inc.detected}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="secondary" size="sm" onClick={() => toast('Edit drawer would open.')}>
            <Edit2 size={13} /> Edit
          </Btn>
          {!hasTicket && (
            <Btn variant="secondary" size="sm" onClick={() => toast('Proceed to ITSM would open.')}>
              <ArrowRight size={13} /> Proceed
            </Btn>
          )}
          <Btn variant="secondary" size="sm" onClick={() => toast('Remediation started.')}>
            <Wrench size={13} /> Run Remediation
          </Btn>
          <Btn variant="secondary" size="sm" onClick={() => toast('Assigned to support team.')}>
            <Users size={13} /> Assign
          </Btn>
          <Btn variant="danger" size="sm" onClick={() => toast(`${inc.id} escalated to on-call.`)}>
            <TrendingUp size={13} /> Escalate
          </Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI Analysis */}
          <Card>
            <div className="card-header">
              <span className="card-title"><Bot size={15} /> AI Diagnosis</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Confidence <strong style={{ fontFamily: 'var(--font-mono)' }}>{inc.aiConfidence}%</strong>
              </span>
            </div>
            <div className="card-body">
              <Field label="Root Cause" value={inc.rootCause} />
              <Field label="Business Impact" value={inc.impact} />
              <Field label="Recommended Action" value={inc.recommendedAction} />
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Btn variant="secondary" size="sm" onClick={() => setReasoningOpen(o => !o)}>
                  {reasoningOpen ? 'Hide' : 'View'} AI Explanation
                </Btn>
                <Btn variant="primary" size="sm" disabled={resolved} onClick={() => toast('Remediation started.')}>
                  <Wrench size={13} /> Run Remediation
                </Btn>
                {!hasTicket && !resolved && (
                  <Btn variant="secondary" size="sm" onClick={() => toast('Proceeding to ITSM...')}>
                    <Ticket size={13} /> Create Ticket
                  </Btn>
                )}
              </div>

              {reasoningOpen && (
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-shell)', borderRadius: 6, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65, borderLeft: '3px solid var(--sap-blue)' }}>
                  <strong style={{ color: 'var(--sap-blue)' }}>AI Reasoning:</strong>{' '}
                  The agent classified this incident as <strong>{inc.severity}</strong> based on business impact ({inc.businessImpact})
                  and observed {inc.failureCount} failed message(s) over {inc.failureDurationMin} minutes.
                  This was compared against the automation policy thresholds for {inc.severity} to determine whether
                  to auto-remediate, alert only, or open an ITSM ticket. The decision was: <strong>{inc.decision === 'ticket' ? 'Ticket Required' : 'No Ticket Required'}</strong>.
                </div>
              )}
            </div>
          </Card>

          {/* Remediation Timeline */}
          <Card>
            <div className="card-header">
              <span className="card-title"><Wrench size={15} /> Remediation Timeline</span>
            </div>
            <div className="card-body">
              {steps.map((s, i) => (
                <TimelineItem key={i} {...s} isLast={i === steps.length - 1} />
              ))}
            </div>
          </Card>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Incident Information */}
          <Card>
            <div className="card-header"><span className="card-title"><AlertTriangle size={15} /> Incident Information</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ padding: '0 16px' }}>
                <InfoRow label="Incident ID" value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{inc.id}</span>} />
                <InfoRow label="Severity" value={<SeverityBadge sev={inc.severity} size="sm" />} />
                <InfoRow label="Artifact" value={inc.artifact} />
                <InfoRow label="Category" value={<CategoryChip category={inc.category} />} />
                <InfoRow label="Detected" value={inc.detected} />
                <InfoRow label="Duration" value={inc.duration} />
                <InfoRow label="Failure Count" value={inc.failureCount} />
                <InfoRow label="Owner" value={inc.owner} />
                <InfoRow label="Status" value={<StatusPill status={inc.status} />} last />
              </div>
            </div>
          </Card>

          {/* AI Decision */}
          <Card style={{ borderColor: hasTicket ? 'rgba(209,73,0,0.3)' : 'rgba(16,120,105,0.3)' }}>
            <div className="card-header">
              <span className="card-title">
                {hasTicket ? <ShieldAlert size={15} color="var(--sap-high)" /> : <ShieldCheck size={15} color="var(--sap-success)" />}
                Incident Action Decision
              </span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ padding: '0 16px' }}>
                <InfoRow label="Severity" value={<SeverityBadge sev={inc.severity} size="sm" />} />
                <InfoRow label="Failure count" value={inc.failureCount} />
                <InfoRow label="Duration" value={`${inc.failureDurationMin} min`} />
                <InfoRow label="Remediation" value={resolved ? 'Successful' : 'Unsuccessful'} last />
              </div>

              <div style={{
                margin: '12px 16px',
                padding: '10px 12px',
                borderRadius: 6,
                background: hasTicket ? 'var(--sap-high-soft)' : 'var(--sap-success-soft)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {hasTicket ? <Ticket size={15} color="var(--sap-high)" /> : <ShieldCheck size={15} color="var(--sap-success)" />}
                <span style={{ fontWeight: 700, fontSize: 13, color: hasTicket ? 'var(--sap-high)' : 'var(--sap-success)' }}>
                  {hasTicket ? 'Ticket Required' : 'No Ticket Required'}
                </span>
              </div>
              <p style={{ padding: '0 16px 12px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {inc.decisionReason}
              </p>
              {hasTicket && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inc.ticketSystem}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--sap-blue)', fontSize: 13 }}>{inc.ticket}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Auto-resolved card */}
          {resolved && (
            <Card>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CheckCircle2 size={16} color="var(--sap-success)" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Automatically Resolved</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {inc.failureCount} messages retried · {inc.failureCount} successful · 0 failed<br />
                  No human intervention required. Ticket was not created.
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Toast message={localToast} type="success" onClose={() => setLocalToast('')} />
    </div>
  );
}
