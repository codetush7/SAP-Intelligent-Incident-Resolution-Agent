import React, { useState, useEffect } from 'react';
import { Search, Zap, AlertTriangle, CheckCircle, BookOpen, ChevronRight, Loader } from 'lucide-react';
import { analysisAPI, agentAPI } from '../services/api';

const ERROR_CODES = [
  'HTTP_401', 'HTTP_403', 'HTTP_500', 'HTTP_503',
  'SFTP_AUTH_FAILURE', 'SFTP_HOST_UNREACHABLE',
  'MAPPING_EXCEPTION', 'QUEUE_THRESHOLD_EXCEEDED',
  'DATA_STORE_FAILURE', 'CERT_EXPIRY_WARNING',
  'PKIX_CERT_ERROR', 'OAUTH_TOKEN_EXPIRED'
];

const INTERFACES = ['Salesforce', 'SAP ECC', 'S/4HANA', 'SFTP', 'Banking API', 'Workday', 'Other'];

export default function AnalysisPage() {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [form, setForm] = useState({
    errorCode: 'HTTP_401',
    interface: 'Salesforce',
    iflow: '',
    errorMessage: '',
    payload: ''
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoTicket, setAutoTicket] = useState(false);
  const [ticketResult, setTicketResult] = useState(null);

  useEffect(() => {
    analysisAPI.getScenarios().then(setScenarios).catch(console.error);
  }, []);

  async function runAnalysis() {
    setLoading(true);
    setResult(null);
    setTicketResult(null);
    try {
      const payload = form.payload ? JSON.parse(form.payload) : {};
      const res = await analysisAPI.analyze({ ...form, payload });
      setResult(res.analysis);

      if (autoTicket) {
        const ticketRes = await agentAPI.processIncident({ ...form, payload, timestamp: new Date().toISOString() });
        setTicketResult(ticketRes);
      }
    } catch (err) {
      alert('Analysis failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function fillFromScenario(s) {
    setSelectedScenario(s.id);
    setForm(f => ({
      ...f,
      errorCode: s.errorCode,
      errorMessage: s.description,
      iflow: ''
    }));
    setResult(null);
    setTicketResult(null);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Root Cause Analysis</h1>
        <p>AI-powered diagnosis for SAP CPI integration failures — get instant root cause, evidence and fix recommendations</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Scenario library */}
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title"><BookOpen size={15} /> Scenario Library</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Click to pre-fill the analysis form</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {scenarios.map(s => (
                <button
                  key={s.id}
                  onClick={() => fillFromScenario(s)}
                  style={{
                    textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    background: selectedScenario === s.id ? 'rgba(59,130,246,0.1)' : 'var(--bg-card-hover)',
                    border: `1px solid ${selectedScenario === s.id ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: selectedScenario === s.id ? 'var(--accent-blue)' : 'var(--text-primary)', marginBottom: 3 }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.description}</div>
                  <div style={{ marginTop: 6 }}>
                    <span className="mono" style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg-input)', borderRadius: 4, color: 'var(--accent-cyan)' }}>
                      {s.errorCode}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main analysis panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Input form */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Search size={15} /> Analyze Incident</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Error Code *</label>
                <select className="select" style={{ width: '100%' }} value={form.errorCode} onChange={e => setForm(f => ({ ...f, errorCode: e.target.value }))}>
                  {ERROR_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Interface</label>
                <select className="select" style={{ width: '100%' }} value={form.interface} onChange={e => setForm(f => ({ ...f, interface: e.target.value }))}>
                  {INTERFACES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>iFlow Name</label>
                <input className="input" placeholder="e.g. SF_Order_Sync_v2" value={form.iflow} onChange={e => setForm(f => ({ ...f, iflow: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Error Message</label>
                <input className="input" placeholder="Paste the error message" value={form.errorMessage} onChange={e => setForm(f => ({ ...f, errorMessage: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Payload / Context (JSON)</label>
                <textarea
                  className="input mono"
                  rows={3}
                  placeholder='{"endpoint": "https://api.example.com", "statusCode": 401}'
                  value={form.payload}
                  onChange={e => setForm(f => ({ ...f, payload: e.target.value }))}
                  style={{ resize: 'vertical', fontSize: 12 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={autoTicket}
                  onChange={e => setAutoTicket(e.target.checked)}
                  style={{ accentColor: 'var(--accent-blue)', width: 15, height: 15 }}
                />
                Auto-create ticket after analysis
              </label>
              <button className="btn btn-primary" onClick={runAnalysis} disabled={loading}>
                {loading ? <><Loader size={14} className="spin" /> Analyzing...</> : <><Zap size={14} /> Run AI Analysis</>}
              </button>
            </div>
          </div>

          {/* Analysis result */}
          {result && (
            <div className="card animate-in">
              <div className="card-header">
                <span className="card-title"><CheckCircle size={15} color="var(--accent-green)" /> AI Analysis Complete</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date().toLocaleTimeString()}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <AnalysisBlock label="🔍 Root Cause" value={result.rootCause} color="var(--accent-blue)" />
                <AnalysisBlock label="📋 Evidence" value={result.evidence} color="var(--accent-amber)" />
                <AnalysisBlock label="💥 Business Impact" value={result.impact} color="var(--critical)" />
                <AnalysisBlock label="✅ Recommendation" value={result.recommendation} color="var(--accent-green)" />
              </div>

              {result.additionalContext && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(139,92,246,0.07)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.15)' }}>
                  <div style={{ fontSize: 11, color: 'var(--accent-purple)', fontWeight: 600, marginBottom: 4 }}>📎 Additional Context</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.additionalContext}</div>
                </div>
              )}
            </div>
          )}

          {/* Ticket result */}
          {ticketResult && (
            <div className="card animate-in" style={{ border: '1px solid rgba(16,185,129,0.25)' }}>
              <div className="card-header">
                <span className="card-title"><CheckCircle size={15} color="var(--accent-green)" /> Ticket Auto-Created</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Ticket #</div>
                  <div className="mono" style={{ fontSize: 14, color: 'var(--accent-blue)', fontWeight: 700 }}>{ticketResult.ticket?.ticketNumber}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Priority</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ticketResult.ticket?.priority === 'CRITICAL' ? 'var(--critical)' : ticketResult.ticket?.priority === 'HIGH' ? 'var(--high)' : 'var(--medium)' }}>
                    {ticketResult.ticket?.priority}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Assigned To</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ticketResult.ticket?.assignedTeam}</div>
                </div>
              </div>
            </div>
          )}

          {/* Known fixes for selected scenario */}
          {selectedScenario && scenarios.find(s => s.id === selectedScenario) && (
            <div className="card animate-in">
              <div className="card-header">
                <span className="card-title"><AlertTriangle size={15} /> Common Causes & Quick Fixes</span>
              </div>
              {(() => {
                const s = scenarios.find(sc => sc.id === selectedScenario);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Known Causes</div>
                      {s.commonCauses.map((c, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                          <ChevronRight size={12} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Quick Fixes</div>
                      {s.quickFixes.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                          <CheckCircle size={12} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisBlock({ label, value, color }) {
  if (!value) return null;
  return (
    <div style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: 10, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{value}</div>
    </div>
  );
}
