import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Play, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import { agentAPI } from '../services/api';

const SCENARIOS = [
  { id: 'api_failure', label: 'API Auth Failure', icon: '🔐', desc: 'Salesforce HTTP 401' },
  { id: 'queue_buildup', label: 'JMS Queue Buildup', icon: '📦', desc: '6500 messages stuck' },
  { id: 'cert_expiry', label: 'Certificate Expiry', icon: '🔒', desc: 'Expiring in 5 days' },
  { id: 'sftp_failure', label: 'SFTP Failure', icon: '📁', desc: 'SSH key mismatch' },
  { id: 'mapping_error', label: 'Mapping Error', icon: '🗺️', desc: 'Null CustomerID field' }
];

const QUICK_PROMPTS = [
  "What are the most common SAP CPI integration errors?",
  "How do I fix PKIX path building failed error?",
  "What should I do when JMS queue builds up?",
  "Explain the steps to renew an SSL certificate in SAP CPI",
  "How to troubleshoot OAuth 401 errors in CPI?"
];

export default function AgentPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 Hi! I\'m the SAP CPI AI Agent. I can help you analyze integration failures, diagnose errors, and manage incidents. You can also simulate real incidents using the buttons on the right.\n\nWhat do you need help with today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [simLoading, setSimLoading] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { loadLogs(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadLogs() {
    try { setAgentLogs(await agentAPI.getLogs()); } catch {}
  }

  async function sendMessage(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
      const { response } = await agentAPI.chat(apiMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function simulateIncident(scenario) {
    setSimLoading(scenario);
    setSimResult(null);
    try {
      const result = await agentAPI.simulate(scenario);
      setSimResult(result);
      await loadLogs();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Incident Simulated & Processed**\n\n**Ticket Created:** ${result.ticket.ticketNumber}\n**Priority:** ${result.ticket.priority}\n**Team:** ${result.ticket.assignedTeam}\n\n**Root Cause:** ${result.analysis?.rootCause || result.ticket.rootCause}\n\n**Recommendation:** ${result.analysis?.recommendation || result.ticket.recommendation}`
      }]);
    } catch (err) {
      alert(err.message);
    } finally {
      setSimLoading(null);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, height: 'calc(100vh - 48px)' }}>
      {/* Chat panel */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="page-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={22} /> AI Support Agent</h1>
          <p>Chat with the SAP CPI expert AI for diagnosis and resolution guidance</p>
        </div>

        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0, overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, marginBottom: 16,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user' ? 'var(--accent-blue)' : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12
                }}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'user' ? 'rgba(59,130,246,0.15)' : 'var(--bg-card)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.2)' : 'var(--border)'}`,
                  borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  padding: '10px 14px',
                  fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7,
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px 12px 12px 12px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)', animation: `pulse-dot 1.2s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => sendMessage(p)} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 20,
                background: 'var(--bg-card-hover)', color: 'var(--text-muted)',
                border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s'
              }}
                onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
              >{p.slice(0, 40)}{p.length > 40 ? '...' : ''}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <textarea
              ref={inputRef}
              className="input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about SAP CPI errors, get diagnosis, request help... (Enter to send)"
              rows={2}
              style={{ resize: 'none', flex: 1 }}
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ alignSelf: 'flex-end' }}>
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        {/* Simulate incidents */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Zap size={15} /> Simulate Incidents</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Trigger demo incidents for AI to auto-process and create tickets</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => simulateIncident(s.id)}
                disabled={!!simLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: simLoading === s.id ? 'rgba(59,130,246,0.1)' : 'var(--bg-card-hover)',
                  border: `1px solid ${simLoading === s.id ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                  borderRadius: 8, cursor: simLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s', opacity: simLoading && simLoading !== s.id ? 0.5 : 1
                }}
              >
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
                </div>
                {simLoading === s.id
                  ? <div style={{ width: 14, height: 14, border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', borderRadius: '50%' }} className="spin" />
                  : <Play size={12} color="var(--text-muted)" />
                }
              </button>
            ))}
          </div>

          {simResult && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <CheckCircle size={14} color="var(--accent-green)" />
                <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>Ticket Created!</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {simResult.ticket?.ticketNumber} · {simResult.ticket?.priority} · {simResult.ticket?.assignedTeam}
              </div>
            </div>
          )}
        </div>

        {/* Agent logs */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-header">
            <span className="card-title"><Bot size={15} /> Agent Activity</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {agentLogs.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No agent activity yet</p>
            ) : agentLogs.map((log, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(30,45,74,0.4)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: log.action === 'TICKET_CREATED' ? 'var(--accent-green)' : 'var(--accent-blue)' }}>{log.action}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{log.message}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
