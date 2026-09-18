import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Wrench, Ticket, Sparkles, CheckCircle2, GitBranch, ShieldCheck } from 'lucide-react';
import { Btn, Card, SeverityBadge, CategoryChip, Toast } from '../components/common';
import { agentAPI } from '../services/api';

// Providers with verified active models for the user's API keys
const PROVIDERS = [
  { id: 'groq', label: 'Groq', models: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'] },
  { id: 'gemini', label: 'Google Gemini', models: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'] },
];

const SELF_HEALING = [
  { label: 'Detect', desc: 'CPI artifact failure telemetry captured', color: 'var(--sap-critical)' },
  { label: 'Analyze', desc: 'AI root cause diagnosis & impact branch', color: 'var(--sap-info)' },
  { label: 'Validate', desc: 'Pre-flight safety check for remediation', color: 'var(--sap-medium)' },
  { label: 'Remediate', desc: 'Execute approved action / script fix', color: 'var(--sap-success)' },
  { label: 'Verify', desc: 'Inspect CPI MPL message processing logs', color: 'var(--sap-info)' },
  { label: 'Resolve', desc: 'Mark ticket resolved with audit trail', color: 'var(--sap-success)' },
  { label: 'Sync', desc: 'Bi-directional ITSM & Jira synchronization', color: 'var(--sap-blue)' },
];

const INITIAL_MSGS = [
  {
    role: 'agent',
    text: "I'm your **Enterprise CPI AI Operations Copilot** connected to live telemetry.\n\nYou can ask me:\n- **Technical troubleshooting**: Postman authentication, HTTP 401/403/500 errors, OAuth, Groovy scripts\n- **Incident operations**: Active P1-P4 incidents, iFlow failure diagnosis, pending remediations\n- **Architecture & general questions**: Integration best practices or general queries",
  },
];

// ── Enhanced Markdown & Branch Renderer ─────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code block: ```lang ... ```
    if (/^```/.test(line.trim())) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={key++} style={{
          background: 'var(--bg-shell, #f4f6f8)',
          border: '1px solid var(--border-soft, #e2e8f0)',
          borderRadius: 6,
          padding: '10px 12px',
          fontSize: 12,
          fontFamily: 'var(--font-mono, monospace)',
          overflowX: 'auto',
          margin: '8px 0',
          color: 'var(--text-primary)'
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Horizontal rule: ---
    if (/^---+\s*$/.test(line.trim())) {
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border-soft, #e2e8f0)', margin: '10px 0' }} />);
      i++; continue;
    }

    // Blockquote: > text
    if (/^>\s+/.test(line)) {
      elements.push(
        <div key={key++} style={{
          borderLeft: '3px solid var(--sap-blue)',
          background: 'var(--sap-blue-light, rgba(0,90,175,0.04))',
          padding: '6px 12px',
          margin: '6px 0',
          borderRadius: '0 4px 4px 0',
          color: 'var(--text-secondary)',
          fontSize: 12.5
        }}>
          {inlineMarkdown(line.replace(/^>\s+/, ''))}
        </div>
      );
      i++; continue;
    }

    // Headings
    if (/^###\s+/.test(line)) {
      elements.push(
        <div key={key++} style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <GitBranch size={13} color="var(--sap-blue)" />
          <span>{inlineMarkdown(line.replace(/^###\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }
    if (/^##\s+/.test(line)) {
      elements.push(
        <div key={key++} style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 14, marginBottom: 5 }}>
          {inlineMarkdown(line.replace(/^##\s+/, ''))}
        </div>
      );
      i++; continue;
    }
    if (/^#\s+/.test(line)) {
      elements.push(
        <div key={key++} style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 14, marginBottom: 6 }}>
          {inlineMarkdown(line.replace(/^#\s+/, ''))}
        </div>
      );
      i++; continue;
    }

    // Numbered list: "1. text"
    if (/^\d+\.\s+/.test(line)) {
      const num = line.match(/^(\d+)\.\s+/)[1];
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ minWidth: 20, fontWeight: 700, color: 'var(--sap-blue)', fontSize: 12.5 }}>{num}.</span>
          <span style={{ fontSize: 13, lineHeight: 1.6 }}>{inlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }

    // Bullet list: "- text" or "* text"
    if (/^[-*]\s+/.test(line)) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 8, marginBottom: 3, paddingLeft: 2 }}>
          <span style={{ color: 'var(--sap-blue)', fontSize: 13, marginTop: 1, lineHeight: 1 }}>•</span>
          <span style={{ fontSize: 13, lineHeight: 1.6 }}>{inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }

    // Blank line → spacing
    if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: 6 }} />);
      i++; continue;
    }

    // Normal paragraph line
    elements.push(
      <div key={key++} style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 2 }}>
        {inlineMarkdown(line)}
      </div>
    );
    i++;
  }

  return <>{elements}</>;
}

// Inline formatting: **bold**, *italic*, `code` (with auto-closing of dangling markdown)
function inlineMarkdown(text) {
  if (!text) return text;

  // Auto-close dangling ** so cutoffs like "**CPI-1" render properly as bold instead of raw **
  let sanitized = text;
  const boldCount = (sanitized.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    sanitized += '**';
  }
  const singleStarCount = (sanitized.replace(/\*\*/g, '').match(/\*/g) || []).length;
  if (singleStarCount % 2 !== 0) {
    sanitized += '*';
  }

  const parts = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match;
  let k = 0;

  while ((match = regex.exec(sanitized)) !== null) {
    if (match.index > last) {
      parts.push(<span key={k++}>{sanitized.slice(last, match.index)}</span>);
    }
    const raw = match[0];
    if (raw.startsWith('**')) {
      parts.push(<strong key={k++} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith('*')) {
      parts.push(<em key={k++} style={{ fontStyle: 'italic' }}>{raw.slice(1, -1)}</em>);
    } else if (raw.startsWith('`')) {
      parts.push(
        <code key={k++} style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: 12, background: 'rgba(0,90,175,0.08)',
          border: '1px solid rgba(0,90,175,0.15)', borderRadius: 3, padding: '1px 5px', color: 'var(--sap-blue)'
        }}>
          {raw.slice(1, -1)}
        </code>
      );
    }
    last = match.index + raw.length;
  }
  if (last < sanitized.length) parts.push(<span key={k++}>{sanitized.slice(last)}</span>);
  return parts.length ? parts : sanitized;
}

export default function AgentPage() {
  const [messages, setMessages] = useState(INITIAL_MSGS);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('openai/gpt-oss-20b');
  const [toastMsg, setToastMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [providerStatus, setProviderStatus] = useState({});
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    agentAPI.getAiConfig()
      .then(res => {
        const statusMap = {};
        (res.providers || []).forEach(p => { statusMap[p.provider] = p.configured; });
        setProviderStatus(statusMap);
        if (res.active?.provider) {
          setProvider(res.active.provider);
          // Verify model is still valid for this provider
          const pObj = PROVIDERS.find(p => p.id === res.active.provider);
          if (pObj && pObj.models.includes(res.active.model)) {
            setModel(res.active.model);
          } else if (pObj) {
            setModel(pObj.models[0]);
          }
        }
      })
      .catch(() => { /* backend may not be reachable yet */ });
  }, []);

  const providerObj = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

  async function send() {
    if (!input.trim() || sending) return;
    const q = input.trim();
    const history = [...messages, { role: 'user', text: q }];
    setMessages(history);
    setInput('');
    setSending(true);
    try {
      const apiMessages = history
        .filter(m => m.text)
        .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text }));
      const res = await agentAPI.chat(apiMessages, { provider, model });
      setMessages(m => [...m, { role: 'agent', text: res.response }]);
    } catch (err) {
      const msg = err.message || 'Could not reach the AI agent. Check the API key in Settings > AI Configuration.';
      setMessages(m => [...m, { role: 'agent', text: msg }]);
      setToastMsg(msg);
    } finally {
      setSending(false);
    }
  }

  const QUICK = [
    'Show me all P1 incidents',
    'How to fix a authentication error at Postman?',
    'Why is Customer_Master_Sync failing?',
    'What remediations are pending approval?',
    'What is earth?',
  ];

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>AI Operations Agent</h1>
        <p>Enterprise AI copilot — diagnosing integration failures, resolving tickets, and providing technical guidance.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
        {/* Chat Main Area */}
        <Card style={{ display: 'flex', flexDirection: 'column', height: 650 }}>
          {/* Provider & Model Header */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-shell, transparent)' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--sap-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,90,175,0.2)' }}>
              <Bot size={15} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>CPI Operations AI Copilot</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Active: <strong style={{ color: 'var(--sap-blue)' }}>{providerObj?.label}</strong> ({model})
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <select
                className="select"
                style={{ height: 32, padding: '0 8px', fontSize: 12, width: 'auto', borderRadius: 6 }}
                value={provider}
                onChange={e => {
                  const newP = e.target.value;
                  setProvider(newP);
                  const pObj = PROVIDERS.find(p => p.id === newP);
                  if (pObj) setModel(pObj.models[0]);
                }}
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label}{providerStatus[p.id] === false ? ' (no key)' : ''}
                  </option>
                ))}
              </select>
              <select
                className="select"
                style={{ height: 32, padding: '0 8px', fontSize: 12, width: 'auto', borderRadius: 6 }}
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                {(providerObj?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Messages Stream */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                {m.role === 'agent' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--sap-info-soft)', border: '1.5px solid var(--sap-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Bot size={13} color="var(--sap-blue)" />
                  </div>
                )}
                <div style={{ maxWidth: '85%' }}>
                  {m.role === 'agent' && (
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--sap-blue)', letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Sparkles size={10} /> AI Agent · {providerObj?.label} / {model}
                    </div>
                  )}
                  {m.text ? (
                    <div className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-agent'}
                      style={m.role === 'agent' ? { lineHeight: 1.6, fontSize: 13, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } : {}}>
                      {m.role === 'agent' ? renderMarkdown(m.text) : m.text}
                    </div>
                  ) : m.structured ? (
                    <StructuredResponse s={m.structured} onToast={setToastMsg} />
                  ) : null}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--sap-info-soft)', border: '1.5px solid var(--sap-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={13} color="var(--sap-blue)" />
                </div>
                <div className="chat-bubble-agent" style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Synthesizing response</span>
                  <span style={{ display: 'inline-flex', gap: 3 }}>
                    {[0, 150, 300].map(d => (
                      <span key={d} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--sap-blue)', opacity: 0.7, animation: `pulse 1.2s ${d}ms infinite` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick Suggestions */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--bg-shell, transparent)' }}>
            {QUICK.map((q, i) => (
              <button key={i} onClick={() => setInput(q)}
                style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-card, #fff)', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.target.style.background = 'var(--sap-blue-light)'; e.target.style.color = 'var(--sap-blue)'; e.target.style.borderColor = 'var(--sap-blue)'; }}
                onMouseLeave={e => { e.target.style.background = 'var(--bg-card, #fff)'; e.target.style.color = 'var(--text-secondary)'; e.target.style.borderColor = 'var(--border)'; }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div style={{ display: 'flex', gap: 8, padding: '12px 14px', borderTop: '1px solid var(--border-soft)' }}>
            <input
              className="input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about incidents, Postman auth, iFlow failures, or remediations..."
              style={{ flex: 1, fontSize: 13 }}
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending}
              style={{ width: 40, height: 40, borderRadius: 8, background: sending ? 'var(--border)' : 'var(--sap-blue)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sending ? 'default' : 'pointer', flexShrink: 0, transition: 'background 0.2s' }}
            >
              <Send size={15} color="#fff" />
            </button>
          </div>
        </Card>

        {/* Right Side Panel: Structured Branch Alignment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Self-Healing Workflow Branch */}
          <Card>
            <div className="card-header" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitBranch size={14} color="var(--sap-blue)" />
              <span className="card-title" style={{ fontSize: 12.5, fontWeight: 700 }}>Resolution Pipeline</span>
            </div>
            <div style={{ padding: '14px 14px 8px' }}>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.4 }}>
                7-stage autonomous incident detection and self-healing lifecycle.
              </p>
              {SELF_HEALING.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                  {/* Branch Node & Vertical Line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 22 }}>
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: s.color + '15',
                      border: `2px solid ${s.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      zIndex: 2
                    }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: s.color }}>{i + 1}</span>
                    </div>
                    {i < SELF_HEALING.length - 1 && (
                      <div style={{
                        width: 2,
                        height: 28,
                        background: 'var(--border-soft, #e2e8f0)',
                        margin: '2px 0'
                      }} />
                    )}
                  </div>
                  {/* Step Description */}
                  <div style={{ paddingBottom: i < SELF_HEALING.length - 1 ? 12 : 6, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</span>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-shell, #f8fafc)', border: '1px solid var(--border-soft, #e2e8f0)', color: 'var(--text-muted)' }}>
                        Phase {i + 1}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                      {s.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Safety & Token Policy Guardrail */}
          <Card style={{ borderLeft: '3px solid var(--sap-blue)' }}>
            <div style={{ padding: '12px 14px', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: 'var(--sap-blue)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={14} /> Token-Optimized Telemetry
              </div>
              Telemetry uses Token-Oriented Object Notation (TOON) to minimize overhead and maximize output quality.
            </div>
          </Card>
        </div>
      </div>
      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}

function StructuredResponse({ s, onToast }) {
  return (
    <div className="chat-bubble-agent" style={{ minWidth: 340 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <FactCell label="Finding" value={s.finding} />
        <FactCell label="Artifact" value={s.artifact} mono />
        <FactCell label="Category" value={<CategoryChip category={s.category} />} />
        <FactCell label="Severity" value={<SeverityBadge sev={s.severity} size="sm" />} />
      </div>
      <FactRow label="Root Cause" value={s.rootCause} />
      <FactRow label="Evidence" value={s.evidence} mono />
      <FactRow label="Recommended Action" value={s.action} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!s.resolved && (
          <Btn variant="primary" size="sm" onClick={() => onToast('Safe remediation started.')}>
            <Wrench size={12} /> Run Safe Remediation
          </Btn>
        )}
        <Btn variant="secondary" size="sm" onClick={() => onToast('Ticket creation initiated.')}>
          <Ticket size={12} /> Create Ticket
        </Btn>
        <Btn variant="ghost" size="sm" onClick={() => onToast('Requesting further explanation...')}>
          Explain Further
        </Btn>
        {s.resolved && (
          <span style={{ fontSize: 11.5, color: 'var(--sap-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Resolved automatically
          </span>
        )}
      </div>
    </div>
  );
}

function FactCell({ label, value, mono }) {
  return (
    <div style={{ background: 'var(--bg-shell)', borderRadius: 5, padding: '7px 9px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontFamily: mono ? 'var(--font-mono)' : undefined }}>{value}</div>
    </div>
  );
}

function FactRow({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5, fontFamily: mono ? 'var(--font-mono)' : undefined }}>{value}</div>
    </div>
  );
}