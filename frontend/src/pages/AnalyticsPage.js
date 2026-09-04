import React from 'react';
import { BarChart2, TrendingUp, CheckCircle2, Ticket, ShieldCheck } from 'lucide-react';
import { ANALYTICS } from '../data/mockData';
import { KpiCard, Card, ProgressBar } from '../components/common';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

export default function AnalyticsPage() {
  const { incidentDistribution: dist, trends, topFailingArtifacts, remediationEffectiveness } = ANALYTICS;
  const maxFail = Math.max(...topFailingArtifacts.map(a => a.failed));

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Analytics</h1>
        <p>Operational performance metrics, resolution trends, and automation effectiveness.</p>
      </div>

      {/* KPIs */}
      <div className="grid-4 mb-5">
        <KpiCard label="Mean Time to Resolve" value={ANALYTICS.mttr} sub="Including auto + manual" icon={<TrendingUp size={18} />} color="var(--sap-blue)" />
        <KpiCard label="Mean Time to Alert" value={ANALYTICS.mtta} icon={<ShieldCheck size={18} />} color="var(--sap-success)" />
        <KpiCard label="Auto-Remediation Success" value={ANALYTICS.autoRemediationSuccess} sub={`${ANALYTICS.autoResolved} auto-resolved`} icon={<CheckCircle2 size={18} />} color="var(--sap-success)" />
        <KpiCard label="Ticket Creation Rate" value={ANALYTICS.ticketCreationRate} sub={`${ANALYTICS.ticketsCreated} of ${ANALYTICS.totalIncidents} incidents`} icon={<Ticket size={18} />} color="var(--sap-info)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Incident trend */}
        <Card>
          <div className="card-header"><span className="card-title"><BarChart2 size={15} />Incident Volume (Last 7 Days)</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trends} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--border)" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
                />
                <Bar dataKey="total" fill="var(--sap-blue)" radius={[3, 3, 0, 0]} name="Total" />
                <Bar dataKey="tickets" fill="var(--sap-critical)" radius={[3, 3, 0, 0]} name="Tickets Created" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Resolution trend */}
        <Card>
          <div className="card-header"><span className="card-title"><TrendingUp size={15} />P1 Incidents Trend</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trends} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--border)" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }} />
                <Line type="monotone" dataKey="p1" stroke="var(--sap-critical)" strokeWidth={2.5} dot={{ fill: 'var(--sap-critical)', r: 3 }} name="P1 Incidents" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Top failing artifacts */}
        <Card>
          <div className="card-header"><span className="card-title">Top Failing Artifacts</span></div>
          <div className="card-body">
            {topFailingArtifacts.map((a, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{a.name}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: a.color, fontFamily: 'var(--font-mono)' }}>{a.failed}</span>
                </div>
                <ProgressBar value={a.failed} max={maxFail} color={a.color} height={8} />
              </div>
            ))}
          </div>
        </Card>

        {/* Automation effectiveness */}
        <Card>
          <div className="card-header"><span className="card-title">Automation Effectiveness</span></div>
          <div className="card-body">
            {[
              { label: 'Automatically Resolved', value: ANALYTICS.autoResolved, total: ANALYTICS.totalIncidents, color: 'var(--sap-success)' },
              { label: 'Manually Resolved', value: ANALYTICS.manualResolved, total: ANALYTICS.totalIncidents, color: 'var(--sap-info)' },
              { label: 'Alert Only (no remediation)', value: ANALYTICS.alertsOnly, total: ANALYTICS.totalIncidents, color: 'var(--sap-medium)' },
              { label: 'Escalated to ITSM', value: ANALYTICS.ticketsCreated, total: ANALYTICS.totalIncidents, color: 'var(--sap-critical)' },
            ].map((e, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5 }}>{e.label}</span>
                  <span style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: e.color }}>
                    {e.value.toLocaleString()} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>({((e.value / e.total) * 100).toFixed(1)}%)</span>
                  </span>
                </div>
                <ProgressBar value={e.value} max={e.total} color={e.color} height={8} />
              </div>
            ))}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-soft)', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{ANALYTICS.totalIncidents.toLocaleString()}</strong> incidents this month ·
              SLA compliance: <strong style={{ color: 'var(--sap-success)' }}>{ANALYTICS.slaCompliance}</strong>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
