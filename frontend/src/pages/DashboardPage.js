import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, Ticket, Activity, Bot, CheckCircle, Zap, TrendingUp } from 'lucide-react';
import { dashboardAPI } from '../services/api';

const PIE_COLORS = {
  API_CONNECTIVITY: '#3b82f6',
  JMS_QUEUE: '#f59e0b',
  CERTIFICATE_EXPIRY: '#ef4444',
  SFTP_CONNECTION: '#8b5cf6',
  MESSAGE_MAPPING: '#06b6d4',
  OAUTH_TOKEN: '#f97316',
  GENERAL: '#64748b'
};

export default function DashboardPage({ liveEvents = [], wsConnected }) {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const s = await dashboardAPI.getStats();
      setStats(s || {});
      setTrends(Array.isArray(s?.trends) ? s.trends : []);
    } catch (err) {
      console.error(err);
      setStats({});
      setTrends([]);
    } finally {
      setLoading(false);
    }
  }

  // Guard: don't render until stats is loaded
  if (loading || !stats) return <LoadingSkeleton />;

  const t = stats.tickets || {};
  const categoryData = Array.isArray(stats.categories) ? stats.categories : [];
  const recentActivity = Array.isArray(stats.recentActivity) ? stats.recentActivity : [];
  const safeTrends = Array.isArray(trends) ? trends : [];
  const safeLiveEvents = Array.isArray(liveEvents) ? liveEvents : [];

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>SAP CPI Ticketing Agent</h1>
          <p>AI-powered incident management — monitoring your integrations 24×7</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {wsConnected && <><div className="live-dot" /><span style={{ fontSize: 12, color: 'var(--accent-green)' }}>Live</span></>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-4 mb-4">
        <StatCard label="Total Tickets" value={t.total || 0} color="blue" icon={<Ticket size={36} />} sub={`${t.aiAnalyzed || 0} AI analyzed`} />
        <StatCard label="Open Incidents" value={t.open || 0} color="red" icon={<AlertTriangle size={36} />} sub={`${t.inProgress || 0} in progress`} />
        <StatCard label="Resolved" value={t.resolved || 0} color="green" icon={<CheckCircle size={36} />} sub="Auto + manual" />
        <StatCard label="Active Alerts" value={stats.monitoring?.alerts ?? stats.monitoring?.activeAlerts ?? 0} color="amber" icon={<Activity size={36} />} sub="Unacknowledged" />
      </div>

      {/* Priority row */}
      <div className="grid-4 mb-4">
        <MiniStat label="Critical" value={t.critical || 0} color="var(--critical)" />
        <MiniStat label="High" value={t.high || 0} color="var(--high)" />
        <MiniStat label="Medium" value={t.medium || 0} color="var(--medium)" />
        <MiniStat label="Low" value={t.low || 0} color="var(--low)" />
      </div>

      {/* Charts */}
      <div className="grid-2 mb-4">
        {/* Trend chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrendingUp size={16} /> Ticket Trends (7 days)</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={safeTrends} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d ? d.slice(5) : ''} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#totalGrad)" strokeWidth={2} name="Total" />
              <Area type="monotone" dataKey="critical" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Critical" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Zap size={16} /> Issue Categories</span>
          </div>
          {categoryData.length === 0 ? (
            <div className="empty-state"><p>No category data yet</p></div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <PieChart width={140} height={140}>
                <Pie data={categoryData} cx={65} cy={65} innerRadius={40} outerRadius={60} dataKey="count" paddingAngle={3}>
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[entry.name] || '#64748b'} />
                  ))}
                </Pie>
              </PieChart>
              <div style={{ flex: 1 }}>
                {categoryData.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[c.name] || '#64748b', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{(c.name || '').replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent CPI Errors */}
      <div className="grid-2 mb-4">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <span className="card-title"><AlertTriangle size={16} /> Recent CPI Errors</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {stats.recentIssues && stats.recentIssues.length > 0 ? (
              stats.recentIssues.map((issue, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid rgba(30,45,74,0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{issue.iflow || issue.title || 'Unknown Issue'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {issue.interface ? `${issue.interface}` : ''}
                        {issue.packageName ? ` • Package: ${issue.packageName}` : ''}
                      </p>
                      {issue.iflowId && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>iFlow ID: {issue.iflowId}</p>}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{issue.timestamp ? new Date(issue.timestamp).toLocaleString() : ''}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                    <DetailLabel label="Error Code" value={issue.errorCode || 'N/A'} />
                    <DetailLabel label="Error ID" value={issue.errorId || 'N/A'} />
                    <DetailLabel label="Protocol" value={issue.protocol || 'N/A'} />
                    <DetailLabel label="Adapter" value={issue.adapterDetails || 'N/A'} />
                    <DetailLabel label="Ticket" value={issue.ticketNumber || 'N/A'} />
                    <DetailLabel label="Status" value={issue.status || 'N/A'} />
                    <DetailLabel label="Priority" value={issue.priority || 'N/A'} />
                    <DetailLabel label="Sender" value={issue.sender || 'N/A'} />
                    <DetailLabel label="Receiver" value={issue.receiver || 'N/A'} />
                    <DetailLabel label="Correlation ID" value={issue.correlationId || 'N/A'} />
                    <DetailLabel label="Package" value={issue.packageName || 'N/A'} />
                    <DetailLabel label="iFlow ID" value={issue.iflowId || 'N/A'} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{issue.errorMessage || 'No error detail available'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state"><p>No CPI issue details available yet.</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Activity size={16} /> Recent System Activity</span>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {recentActivity.length === 0 ? (
              <div className="empty-state"><p>No recent activity</p></div>
            ) : recentActivity.map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(30,45,74,0.4)' }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                  background: log.status === 'OK' ? 'var(--accent-green)' : log.status === 'ERROR' ? 'var(--critical)' : 'var(--accent-amber)'
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.message}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title"><Bot size={16} /> Live Feed</span>
            {wsConnected && <div className="live-dot" />}
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {safeLiveEvents.length === 0 ? (
              <div className="empty-state">
                <Activity size={28} />
                <p>Waiting for live events...</p>
              </div>
            ) : safeLiveEvents.map((e, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(30,45,74,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: e.type === 'ticket_created' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                    color: e.type === 'ticket_created' ? 'var(--accent-green)' : 'var(--accent-blue)',
                    fontWeight: 600
                  }}>{(e.type || '').toUpperCase().replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ''}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {e.data?.message || (e.data ? JSON.stringify(e.data).slice(0, 80) : '')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon, sub }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function DetailLabel({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ height: 40, background: 'var(--bg-card)', borderRadius: 8, marginBottom: 24, width: 300 }} />
      <div className="grid-4 mb-4">
        {[1,2,3,4].map(i => <div key={i} style={{ height: 100, background: 'var(--bg-card)', borderRadius: 12 }} />)}
      </div>
    </div>
  );
}
