import React, { useMemo } from 'react';
import {
  AlertTriangle, Ticket, CheckCircle2, Radio,
  Bot, Wrench, TrendingUp, ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { INCIDENTS, ANALYTICS } from '../data/mockData';
import { KpiCard, SeverityBadge, StatusPill, Card, ProgressBar } from '../components/common';

const SEV_COLORS = {
  P1: 'var(--sap-critical)', P2: 'var(--sap-high)',
  P3: 'var(--sap-medium)',   P4: 'var(--sap-low)',
};

const TIMELINE = [
  { tag: 'detect',   icon: AlertTriangle, t: '10:42 AM', text: 'Payment_Order_Integration authentication failures detected' },
  { tag: 'classify', icon: Bot,           t: '10:42 AM', text: 'AI classified as P3 — OAuth token expiration' },
  { tag: 'remediate',icon: Wrench,        t: '10:42 AM', text: 'Safe remediation started — Refresh OAuth 2.0 token' },
  { tag: 'resolve',  icon: CheckCircle2,  t: '10:43 AM', text: 'Remediation successful — all 18 messages retried' },
  { tag: 'ticket',   icon: Ticket,        t: '10:43 AM', text: 'Ticket creation skipped — resolved within policy threshold' },
  { tag: 'escalate', icon: TrendingUp,    t: '10:16 AM', text: 'Customer_Master_Sync escalated — JIRA-4821 created' },
  { tag: 'detect',   icon: AlertTriangle, t: '10:12 AM', text: 'Customer_Master_Sync repeated connectivity failures' },
  { tag: 'classify', icon: Bot,           t: '10:13 AM', text: 'AI classified as P3 — connection timeout' },
];

const TAG_COLOR = {
  detect: { bg: 'var(--sap-critical-soft)', color: 'var(--sap-critical)' },
  classify: { bg: 'var(--sap-info-soft)', color: 'var(--sap-info)' },
  remediate: { bg: 'var(--sap-medium-soft)', color: 'var(--sap-medium)' },
  resolve: { bg: 'var(--sap-success-soft)', color: 'var(--sap-success)' },
  ticket: { bg: 'var(--sap-info-soft)', color: 'var(--sap-info)' },
  escalate: { bg: 'var(--sap-critical-soft)', color: 'var(--sap-critical)' },
};

export default function OverviewPage({ onNavigate, onOpenIncident }) {
  const dist = useMemo(() => {
    const d = { P1: 0, P2: 0, P3: 0, P4: 0 };
    INCIDENTS.forEach(i => { d[i.severity] = (d[i.severity] || 0) + 1; });
    return d;
  }, []);
  const total = Object.values(dist).reduce((s, v) => s + v, 0);
  const maxDist = Math.max(...Object.values(dist));
  const activeIncidents = INCIDENTS.filter(i => !['Resolved', 'Closed'].includes(i.status)).length;

  return (
    <div className="animate-in">
      {/* Page Header */}
      <div className="page-header">
        <h1>CPI Intelligent Operations</h1>
        <p>Production monitoring, intelligent incident management and automated remediation</p>
      </div>

      {/* 4 Primary KPIs */}
      <div className="grid-4 mb-5">
        <KpiCard
          label="Active Incidents"
          value={activeIncidents}
          sub={`P1: ${dist.P1} · P2: ${dist.P2} · P3: ${dist.P3} · P4: ${dist.P4}`}
          icon={<AlertTriangle size={18} />}
          color="var(--sap-critical)"
          onClick={() => onNavigate('incidents')}
        />
        <KpiCard
          label="Total Tickets Created"
          value={116}
          sub="Of 1,323 incidents this month"
          icon={<Ticket size={18} />}
          color="var(--sap-info)"
          onClick={() => onNavigate('tickets')}
        />
        <KpiCard
          label="Total Resolved"
          value={1009}
          sub="Auto + manual resolutions"
          icon={<CheckCircle2 size={18} />}
          color="var(--sap-success)"
        />
        <KpiCard
          label="Active Alerts"
          value={9}
          sub="Across all severity levels"
          icon={<Radio size={18} />}
          color="var(--sap-medium)"
          onClick={() => onNavigate('alerts')}
        />
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Incident Distribution */}
          <Card>
            <div className="card-header">
              <span className="card-title"><AlertTriangle size={15} />Incident Distribution</span>
              <button className="btn btn-ghost btn-xs" onClick={() => onNavigate('analytics')}>
                View analytics <ArrowRight size={12} />
              </button>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                P3/P4 are the majority. P1/P2 are rare by design — most issues are resolved automatically.
              </p>
              {Object.entries(dist).map(([sev, count]) => (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 72 }}>
                    <SeverityBadge sev={sev} size="sm" />
                  </div>
                  <ProgressBar value={count} max={maxDist} color={SEV_COLORS[sev]} height={10} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, width: 20, textAlign: 'right', color: SEV_COLORS[sev] }}>
                    {count}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>1,323</span> incidents this month ·{' '}
                <span style={{ fontWeight: 700, color: 'var(--sap-success)' }}>842</span> auto-resolved ·{' '}
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>365</span> alert-only ·{' '}
                <span style={{ fontWeight: 700, color: 'var(--sap-critical)' }}>116</span> tickets created
              </div>
            </div>
          </Card>

          {/* Resolution & Automation Effectiveness */}
          <Card>
            <div className="card-header">
              <span className="card-title"><ShieldCheck size={15} />Resolution & Automation Effectiveness</span>
            </div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              {ANALYTICS.remediationEffectiveness.map((item, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.color }}>
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                  <ProgressBar value={item.value} max={1323} color={item.color} height={8} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column — CPI → ITSM flow + recent activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Intelligent Decision Flow */}
          <Card>
            <div className="card-header">
              <span className="card-title"><Bot size={15} />Intelligent Decision Flow</span>
              <span style={{ background: 'var(--sap-success-soft)', color: 'var(--sap-success)', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11 }}>Live</span>
            </div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              {/* Flow diagram */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap', marginBottom: 20 }}>
                {[
                  { label: 'CPI Signal', color: 'var(--sap-info)' },
                  { label: 'Alert', color: 'var(--sap-medium)' },
                  { label: 'AI Analysis', color: 'var(--sap-blue)' },
                  { label: 'Decision', color: 'var(--text-secondary)' },
                ].map((step, i, arr) => (
                  <React.Fragment key={i}>
                    <div style={{
                      padding: '5px 10px', borderRadius: 999,
                      background: `${step.color}18`, border: `1px solid ${step.color}40`,
                      fontSize: 11.5, fontWeight: 600, color: step.color,
                      whiteSpace: 'nowrap',
                    }}>
                      {step.label}
                    </div>
                    {i < arr.length - 1 && <ArrowRight size={12} color="var(--border-strong)" style={{ margin: '0 2px' }} />}
                  </React.Fragment>
                ))}
              </div>
              {/* Two outcome branches */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div style={{ background: 'var(--sap-success-soft)', border: '1px solid rgba(16,120,105,0.2)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--sap-success)', marginBottom: 6 }}>
                    ✓ Auto Remediation
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Safe action → Verify → Resolve</div>
                </div>
                <div style={{ background: 'var(--sap-info-soft)', border: '1px solid rgba(0,112,242,0.2)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--sap-info)', marginBottom: 6 }}>
                    → ITSM Required
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Jira · ServiceNow · IRIS</div>
                </div>
              </div>

              {/* Recent activity feed */}
              <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>Recent activity</div>
                {TIMELINE.slice(0, 5).map((e, i) => {
                  const Icon = e.icon;
                  const tc = TAG_COLOR[e.tag] || TAG_COLOR.detect;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 12, position: 'relative' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icon size={12} color={tc.color} />
                        </div>
                        {i < 4 && <div style={{ width: 1, flex: 1, background: 'var(--border-soft)', marginTop: 3 }} />}
                      </div>
                      <div style={{ paddingBottom: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{e.t}</span>
                        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginTop: 1 }}>{e.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate('incidents')}
                style={{ marginTop: 4, color: 'var(--sap-blue)', fontWeight: 600 }}
              >
                View all incidents <ArrowRight size={13} />
              </button>
            </div>
          </Card>

          {/* Current active incidents summary */}
          <Card>
            <div className="card-header">
              <span className="card-title"><AlertTriangle size={15} />Active Incidents Requiring Attention</span>
              <button className="btn btn-ghost btn-xs text-blue" onClick={() => onNavigate('incidents')}>View all</button>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Artifact</th>
                    <th>Sev</th>
                    <th>Status</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {INCIDENTS.filter(i => !['Resolved', 'Closed', 'Monitoring'].includes(i.status)).slice(0, 5).map(inc => (
                    <tr
                      key={inc.id}
                      className="clickable"
                      onClick={() => onOpenIncident(inc.id)}
                    >
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{inc.artifact}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{inc.id}</div>
                      </td>
                      <td><SeverityBadge sev={inc.severity} size="sm" /></td>
                      <td><StatusPill status={inc.status} /></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{inc.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
