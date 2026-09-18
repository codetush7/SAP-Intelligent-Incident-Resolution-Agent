import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, Clock, FileText, TrendingUp, GitCompare, Layers, ShieldAlert, Loader, ChevronRight } from 'lucide-react';
import { ticketsAPI, investigationAPI } from '../../services/api';

function ConfidenceBadge({ level, value }) {
  const map = { HIGH: 'badge-resolved', MEDIUM: 'badge-medium', LOW: 'badge-critical' };
  return <span className={`badge ${map[level] || 'badge-medium'}`}>{level} · {value}%</span>;
}

function EvidenceSourceTag({ source }) {
  return source === 'RETRIEVED'
    ? <span className="badge badge-resolved" style={{ fontSize: 9 }}>RETRIEVED</span>
    : <span className="badge" style={{ fontSize: 9, background: 'var(--bg-card-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>UNAVAILABLE</span>;
}

export default function InvestigationPanel() {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    ticketsAPI.getAll().then(setTickets).catch(console.error);
  }, []);

  async function investigate(ticketId) {
    setSelectedId(ticketId);
    setResult(null);
    setError('');
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await investigationAPI.investigate(ticketId);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-col gap-4">
      {/* Incident picker */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Search size={15} /> Select Incident to Investigate</span>
        </div>
        <select className="select" style={{ width: '100%' }} value={selectedId} onChange={e => investigate(e.target.value)}>
          <option value="">— Choose an incident —</option>
          {tickets.map(t => (
            <option key={t.id} value={t.id}>{t.ticketNumber} — {t.title} ({t.priority})</option>
          ))}
        </select>
        {tickets.length === 0 && <p className="text-sm text-muted mt-2">No incidents yet. They'll appear here once created by the AI Agent or manually.</p>}
      </div>

      {loading && (
        <div className="card flex items-center gap-3" style={{ justifyContent: 'center', padding: 40 }}>
          <Loader size={18} className="spin" /> <span className="text-secondary">Running investigation...</span>
        </div>
      )}

      {error && <div className="card text-sm text-red">{error}</div>}

      {result && !loading && (
        <>
          {/* Incident Summary */}
          <div className="card">
            <div className="card-header"><span className="card-title"><FileText size={15} /> Incident Summary</span></div>
            <div className="grid-3 gap-3">
              <SummaryField label="Ticket" value={result.incident.ticketNumber} />
              <SummaryField label="iFlow" value={result.incident.iflow} />
              <SummaryField label="Error Code" value={result.incident.errorCode} />
              <SummaryField label="Interface" value={result.incident.interface} />
              <SummaryField label="Sender" value={result.incident.sender} />
              <SummaryField label="Receiver" value={result.incident.receiver} />
              <SummaryField label="SAP Message ID" value={result.incident.sapMessageId || 'N/A'} />
              <SummaryField label="Correlation ID" value={result.incident.correlationId || 'N/A'} />
              <SummaryField label="Status" value={result.incident.status} />
              <SummaryField label="Priority" value={result.incident.priority} />
              <SummaryField label="Adapter" value={result.incident.adapter} />
              <SummaryField label="Timestamp" value={result.incident.timestamp ? new Date(result.incident.timestamp).toLocaleString() : 'N/A'} />
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="card-header"><span className="card-title"><Clock size={15} /> Investigation Timeline</span></div>
            <div className="flex" style={{ overflowX: 'auto', gap: 0 }}>
              {result.timeline.map((t, i) => (
                <div key={i} className="flex items-center" style={{ flexShrink: 0 }}>
                  <div className="flex-col items-center" style={{ minWidth: 130 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)' }} />
                    <div className="text-xs fw-600 mt-2" style={{ textAlign: 'center' }}>{t.step}</div>
                    <div className="text-xs text-muted mt-1">{new Date(t.timestamp).toLocaleTimeString()}</div>
                  </div>
                  {i < result.timeline.length - 1 && <ChevronRight size={14} color="var(--border-light)" />}
                </div>
              ))}
            </div>
          </div>

          {/* AI Root Cause */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><AlertTriangle size={15} /> AI Root Cause</span>
              <ConfidenceBadge level={result.rca.confidenceLevel} value={result.rca.confidence} />
            </div>
            {result.rca.humanReviewRecommended && (
              <div className="text-sm text-red mb-3" style={{ padding: '8px 12px', background: 'rgba(220,38,38,0.06)', borderRadius: 8 }}>
                Low confidence — human investigation is recommended before acting on this analysis.
              </div>
            )}
            <p className="text-sm text-secondary mb-3" style={{ lineHeight: 1.6 }}>{result.rca.rootCause}</p>
            <div className="text-xs text-muted" style={{ textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>Technical Explanation</div>
            <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>{result.rca.technicalExplanation}</p>
            <div className="text-xs text-muted mt-3">
              Analyzed by {result.rca.provider?.provider} ({result.rca.provider?.model})
              {!result.rca.aiAvailable && ' — AI was unavailable; this is a fallback response.'}
            </div>
          </div>

          {/* Evidence */}
          <div className="card">
            <div className="card-header"><span className="card-title"><Layers size={15} /> Evidence Supporting RCA</span></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Evidence</th><th>Value</th><th>Source</th></tr></thead>
                <tbody>
                  {result.evidence.map((e, i) => (
                    <tr key={i}>
                      <td className="fw-600 text-sm">{e.label}</td>
                      <td className="text-sm text-secondary">{e.value}</td>
                      <td><EvidenceSourceTag source={e.source} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.rca.supportingEvidence?.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-muted mb-2" style={{ textTransform: 'uppercase', fontWeight: 600 }}>AI-cited evidence</div>
                {result.rca.supportingEvidence.map((e, i) => (
                  <div key={i} className="text-sm text-secondary mb-1">• {e}</div>
                ))}
              </div>
            )}
          </div>

          {/* What Changed */}
          <div className="card">
            <div className="card-header"><span className="card-title"><GitCompare size={15} /> What Changed?</span></div>
            {result.changeAnalysis.changes.length === 0 ? (
              <p className="text-sm text-muted">{result.changeAnalysis.message}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Change</th><th>Time</th><th>Component</th><th>Correlation</th><th>Confidence</th></tr></thead>
                  <tbody>
                    {result.changeAnalysis.changes.map((c, i) => (
                      <tr key={i}>
                        <td>{c.description}</td><td>{c.time}</td><td>{c.component}</td>
                        <td>{c.correlation}</td><td>{c.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Business Impact */}
          <div className="card">
            <div className="card-header"><span className="card-title"><TrendingUp size={15} /> Business Impact</span></div>
            <p className="text-sm text-secondary mb-3">{result.businessImpact.summary}</p>
            {result.businessImpact.affectedComponents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.businessImpact.affectedComponents.map((c, i) => (
                  <span key={i} className="badge badge-open">{c}</span>
                ))}
              </div>
            )}
          </div>

          {/* Similar Incidents */}
          <div className="card">
            <div className="card-header"><span className="card-title"><Search size={15} /> Similar Incidents</span></div>
            {result.similarIncidents.length === 0 ? (
              <p className="text-sm text-muted">No similar historical incidents found.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Ticket</th><th>Similarity</th><th>Matched On</th><th>Previous Root Cause</th><th>Outcome</th></tr></thead>
                  <tbody>
                    {result.similarIncidents.map((s, i) => (
                      <tr key={i}>
                        <td className="fw-600">{s.ticketNumber}</td>
                        <td><span className={`badge ${s.similarity === 'HIGH' ? 'badge-critical' : s.similarity === 'MEDIUM' ? 'badge-medium' : 'badge-low'}`}>{s.similarity}</span></td>
                        <td className="text-sm text-secondary">{s.matchedOn.join(', ')}</td>
                        <td className="text-sm text-secondary">{s.previousRootCause}</td>
                        <td>{s.outcome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recommended Remediation — view only, no execution */}
          <div className="card">
            <div className="card-header"><span className="card-title"><ShieldAlert size={15} /> Recommended Remediation</span></div>
            <ol style={{ paddingLeft: 20 }}>
              {result.recommendedRemediation.map((step, i) => (
                <li key={i} className="text-sm text-secondary mb-2" style={{ lineHeight: 1.6 }}>{step}</li>
              ))}
            </ol>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-secondary btn-sm" onClick={() => alert('Remediation execution is Phase 2 — not implemented yet.')}>
                Proceed to Remediation
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryField({ label, value }) {
  return (
    <div className="flex-col" style={{ gap: 2 }}>
      <span className="text-xs text-muted" style={{ textTransform: 'uppercase' }}>{label}</span>
      <span className="text-sm text-primary fw-600">{value}</span>
    </div>
  );
}