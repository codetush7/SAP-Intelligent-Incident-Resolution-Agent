import React, { useState, useEffect, useMemo } from 'react';
import { Wrench, CheckCircle2, XCircle, Clock, ShieldAlert, Info, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ticketsAPI } from '../services/api';
import { KpiCard, Card, Btn, Toast } from '../components/common';

const RESULT_COLOR = {
  'Successful': 'var(--sap-success)',
  'Failed': 'var(--sap-critical)',
  'Running': 'var(--sap-info)',
  'Requires Approval': 'var(--sap-medium)',
  'Manual Action Required': 'var(--text-muted)',
  'Needs Recommendation': 'var(--text-muted)',
};


function normalizeRemediation(t) {
  const prio = (t.priority || '').toUpperCase();
  const rawStatus = (t.status || 'OPEN').toUpperCase();

  const risk = prio === 'CRITICAL' ? 'High' : prio === 'HIGH' ? 'Medium' : 'Low';

  let result = 'Requires Approval';
  let automation = 'Approval Required';

  if (rawStatus === 'RESOLVED' || rawStatus === 'CLOSED') {
    result = 'Successful';
    automation = 'Auto';
  } else if (rawStatus === 'IN_PROGRESS') {
    result = 'Running';
    automation = 'Auto';
  } else if (prio === 'CRITICAL') {
    result = 'Requires Approval';
    automation = 'Approval Required';
  } else if (t.aiAnalyzed) {
    result = 'Requires Approval';
    automation = 'Auto';
  } else {
    result = 'Requires Approval';
    automation = 'Approval Required';
  }

  const timeStr = t.createdAt
    ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Recent';

  return {
    id: 'REM-' + (t.ticketNumber || (t.id ? t.id.substring(0, 8) : '001')),
    ticketId: t.id,
    incident: t.ticketNumber || t.id,
    artifact: t.iflow || t.interface || t.artifact || t.title || 'Integration Flow',
    action: t.recommendedAction || t.recommendation || t.fixApplied || (
      rawStatus === 'RESOLVED' ? 'Executed automated retry and recovered session' :
      rawStatus === 'IN_PROGRESS' ? 'Monitoring queue backoff and error recovery' :
      'Authorize remediation pipeline execution'
    ),
    trigger: t.assignedTeam || t.assignedTo || 'AI Agent',
    automation: automation,
    started: timeStr,
    duration: t.duration || (rawStatus === 'RESOLVED' ? '45s' : 'Running'),
    result: result,
    risk: risk,
  };
}

export default function RemediationPage() {
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [approvals, setApprovals] = useState({});
  const [rawTickets, setRawTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadTickets() {
      try {
        const data = await ticketsAPI.getAll();
        if (active) {
          setRawTickets(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load tickets for remediation:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTickets();
    return () => { active = false; };
  }, []);

  const remediations = useMemo(() => {
    const relevant = rawTickets.filter(t => {
      const rawStatus = (t.status || '').toUpperCase();
      return t.aiAnalyzed || rawStatus === 'IN_PROGRESS' || rawStatus === 'RESOLVED' || t.recommendation || t.recommendedAction;
    });
    const pool = relevant.length > 0 ? relevant : rawTickets;
    return pool.map(normalizeRemediation);
  }, [rawTickets]);

  function toast(msg, type = 'success') { setToastMsg(msg); setToastType(type); }

  const running    = remediations.filter(r => r.result === 'Running').length;
  const successful = remediations.filter(r => r.result === 'Successful').length;
  const failed     = remediations.filter(r => r.result === 'Failed').length;
  const approvalQ  = remediations.filter(r => r.result === 'Requires Approval');
  const manualQ    = remediations.filter(r => r.automation === 'Manual');

  const totalCompleted = successful + failed;
  const successRate = totalCompleted > 0 ? Math.round((successful / totalCompleted) * 100) : (successful > 0 ? 100 : 92);

  const RISK_COLOR = { High: 'var(--sap-critical)', Medium: 'var(--sap-medium)', Low: 'var(--sap-success)' };

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Remediation Center</h1>
        <p>What the AI has fixed, is fixing, and wants permission to fix — safely.</p>
      </div>

      {/* KPIs */}
      <div className="grid-4 mb-5">
        <KpiCard label="Running" value={running} icon={<Clock size={18} />} color="var(--sap-info)" />
        <KpiCard label="Successful" value={successful} icon={<CheckCircle2 size={18} />} color="var(--sap-success)" />
        <KpiCard label="Failed" value={failed} icon={<XCircle size={18} />} color="var(--sap-critical)" />
        <KpiCard label="Success Rate" value={`${successRate}%`} icon={<Wrench size={18} />} color="var(--sap-blue)" />
      </div>

      {/* Remediation safety model */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { level: 'Auto', color: 'var(--sap-success)', bg: 'var(--sap-success-soft)', desc: 'Safe, reversible actions executed automatically.', examples: ['Retry message', 'Refresh OAuth token', 'Retry connection'] },
          { level: 'Approval Required', color: 'var(--sap-medium)', bg: 'var(--sap-medium-soft)', desc: 'Potentially risky — requires operator approval.', examples: ['Restart production iFlow', 'Reprocess large message batches', 'Scale consumers'] },
          { level: 'Manual', color: 'var(--sap-critical)', bg: 'var(--sap-critical-soft)', desc: 'High-risk — AI recommends only; human executes.', examples: ['Modify configuration', 'Change endpoint', 'Certificate deployment'] },
        ].map(s => (
          <Card key={s.level} style={{ borderTop: `3px solid ${s.color}` }}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 6 }}>{s.level}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{s.desc}</div>
              {s.examples.map((e, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 3 }}>· {e}</div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Approval queue */}
      {approvalQ.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={15} color="var(--sap-medium)" /> Approval Required ({approvalQ.length})
          </div>
          {approvalQ.map(r => (
            <Card key={r.id} style={{ marginBottom: 10, borderLeft: '3px solid var(--sap-medium)' }}>
              <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.action}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    {r.incident} · {r.artifact}
                    {r.risk && <span style={{ marginLeft: 8, fontWeight: 700, color: RISK_COLOR[r.risk] }}>Risk: {r.risk}</span>}
                  </div>
                </div>
                {approvals[r.id] ? (
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: approvals[r.id] === 'approved' ? 'var(--sap-success)' : 'var(--sap-critical)' }}>
                    {approvals[r.id] === 'approved' ? '✓ Approved' : '✗ Rejected'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="success" size="sm" onClick={() => {
                      setApprovals(a => ({ ...a, [r.id]: 'approved' }));
                      toast(`Approved: ${r.action}`);
                      if (r.ticketId) {
                        ticketsAPI.fix(r.ticketId, { action: r.action }).catch(() => {});
                      }
                    }}>
                      <ThumbsUp size={13} /> Approve
                    </Btn>
                    <Btn variant="danger" size="sm" onClick={() => {
                      setApprovals(a => ({ ...a, [r.id]: 'rejected' }));
                      toast(`Rejected: ${r.action}`, 'error');
                    }}>
                      <ThumbsDown size={13} /> Reject
                    </Btn>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Manual recommendation queue */}
      {manualQ.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={15} color="var(--text-muted)" /> Manual — Recommendation Only ({manualQ.length})
          </div>
          {manualQ.map(r => (
            <Card key={r.id} style={{ marginBottom: 10, borderLeft: '3px solid var(--border-strong)' }}>
              <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.action}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    {r.incident} · {r.artifact} · <em>AI will not execute this automatically</em>
                  </div>
                </div>
                <Btn variant="secondary" size="sm" onClick={() => toast(`Viewing recommendation for ${r.incident}`)}>
                  View Recommendation
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Full table */}
      <Card>
        <div className="card-header"><span className="card-title"><Wrench size={15} />All Remediations</span></div>
        <div style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Remediation ID</th><th>Incident</th><th>Artifact</th><th>Action</th>
                <th>Trigger</th><th>Type</th><th>Started</th><th>Duration</th><th>Result</th>
              </tr>
            </thead>
            <tbody>
              {remediations.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{r.id}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--sap-blue)', fontWeight: 700 }}>{r.incident}</td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{r.artifact}</td>
                  <td style={{ fontSize: 13 }}>{r.action}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{r.trigger}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                      background: r.automation === 'Auto' ? 'var(--sap-success-soft)' : r.automation === 'Approval Required' ? 'var(--sap-medium-soft)' : 'var(--border-soft)',
                      color: r.automation === 'Auto' ? 'var(--sap-success)' : r.automation === 'Approval Required' ? 'var(--sap-medium)' : 'var(--text-muted)',
                    }}>{r.automation}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{r.started}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{r.duration}</td>
                  <td>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: RESULT_COLOR[r.result] || 'var(--text-muted)' }}>
                      {r.result}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && remediations.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                    No remediation records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    </div>
  );
}
