import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Wrench, Ticket, ChevronDown, Sparkles, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Btn, Card, SeverityBadge, CategoryChip, Toast } from '../components/common';

const PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'] },
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { id: 'groq', label: 'Groq', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'llama3-70b'] },
  { id: 'custom', label: 'Custom Provider', models: ['custom-model'] },
];

const SELF_HEALING = [
  { label: 'Detect', desc: 'CPI artifact failure detected', color: 'var(--sap-critical)' },
  { label: 'Analyze', desc: 'AI identifies root cause', color: 'var(--sap-info)' },
  { label: 'Validate', desc: 'Safety check for remediation', color: 'var(--sap-medium)' },
  { label: 'Remediate', desc: 'Execute approved action', color: 'var(--sap-success)' },
  { label: 'Verify', desc: 'Check CPI monitoring', color: 'var(--sap-info)' },
  { label: 'Resolve', desc: 'Mark incident resolved', color: 'var(--sap-success)' },
  { label: 'Sync', desc: 'Update ITSM if ticket exists', color: 'var(--sap-blue)' },
];

const INITIAL_MSGS = [
  { role: 'user', text: 'Why is Payment_Order_Integration failing?' },
  {
    role: 'agent',
    text: null,
    structured: {
      finding: 'OAuth 2.0 authentication failure — 18 messages rejected over 4 minutes.',
      artifact: 'Payment_Order_Integration',
      iface: 'Payment Gateway API',
      category: 'Authentication',
      severity: 'P3',
      rootCause: 'OAuth access token expired. Token lifecycle of 3600s elapsed without refresh. The CPI iFlow failed to refresh before expiry.',
      evidence: 'Error code 401 · Correlation ID: COR-20260901-10422 · All 18 messages returned HTTP 401 Unauthorized',
      action: 'Token refresh triggered automatically. 18 failed messages retried successfully. Incident resolved.',
      resolved: true,
    },
  },
  { role: 'user', text: 'Why was no Jira ticket created for that incident?' },
  {
    role: 'agent',
    text: 'The incident (INC-20260901-00422) was classified P3. The AI remediated it successfully within 4 minutes — well below the 10-occurrence / 15-minute escalation threshold. Per automation policy Rule-003, a ticket is created only if remediation fails or the threshold is exceeded. In this case, neither condition was met, so no ticket was created.',
  },
];

function buildReply(q) {
  const lower = q.toLowerCase();
  if (lower.includes('customer_master') || lower.includes('customer master')) {
    return {
      text: null,
      structured: {
        finding: 'Repeated connection timeouts to the downstream customer master endpoint.',
        artifact: 'Customer_Master_Sync',
        iface: 'Customer Master API',
        category: 'Connectivity',
        severity: 'P3',
        rootCause: 'Downstream endpoint responding after the configured 30s timeout. 27 messages have failed over the last 48 minutes.',
        evidence: 'Error: java.net.SocketTimeoutException · iFlow: Customer_Master_Sync · All retries timed out',
        action: 'Reconnect endpoint attempted — failed. JIRA-4821 has been created. Escalate to infrastructure team.',
        resolved: false,
      },
    };
  }
  if (lower.includes('vendor_invoice') || lower.includes('certificate')) {
    return { text: 'Vendor_Invoice_Sync is blocked due to an expired client certificate. The certificate for the Vendor Portal API expired 01 Sep 2026 00:01 UTC. 143 invoices are pending. Manual remediation required — certificate renewal has been requested. JIRA-4815 is tracking this.' };
  }
  if (lower.includes('p1') || lower.includes('critical')) {
    return { text: 'There are 2 active P1 incidents right now: INC-20260901-00425 (Sales_Order_Processing — ERP endpoint unreachable, SNOW-10291) and INC-20260901-00419 (Material_Stock_Movement — DLQ overflow data loss risk, IRIS-78421). Both have on-call engineers engaged.' };
  }
  if (lower.includes('ticket') && lower.includes('why')) {
    return { text: 'Tickets are created based on severity and policy. P1 tickets immediately. P2 tickets when failure rate > 25% for 10+ minutes. P3 only if remediation fails or threshold (10 failures / 15 min) exceeded. P4 rarely — typically never. Currently there are 6 active tickets across Jira, ServiceNow, and IRIS.' };
  }
  if (lower.includes('remediation') || lower.includes('remediat')) {
    return { text: 'Today: 42 automatic remediations executed, 89% success rate. Notable: OAuth token refresh for Payment_Order_Integration (successful, 52s). Endpoint reconnect for Customer_Master_Sync (failed). 2 actions pending approval: ERP failover (High risk) and consumer scaling (Medium risk).' };
  }
  return { text: `I've analyzed the current operational state. Active incidents: 8 across P1-P4. 2 P1 incidents require immediate attention. 4 P3 incidents are within monitoring thresholds. AI is monitoring ${42} active remediations. Ask me about a specific artifact, incident, or ticket for detailed analysis.` };
}

export default function AgentPage() {
  const [messages, setMessages] = useState(INITIAL_MSGS);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-2.5-pro');
  const [toastMsg, setToastMsg] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const providerObj = PROVIDERS.find(p => p.id === provider);

  function send() {
    if (!input.trim()) return;
    const q = input.trim();
    const reply = buildReply(q);
    setMessages(m => [...m, { role: 'user', text: q }, { role: 'agent', ...reply }]);
    setInput('');
  }

  const QUICK = [
    'Why is Customer_Master_Sync failing?',
    'Show me all P1 incidents',
    'Why was no ticket created for Payment_Order_Integration?',
    'What remediations are pending approval?',
  ];

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>AI Agent</h1>
        <p>Enterprise operations copilot — analyze incidents, explain decisions, recommend remediation.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        {/* Chat */}
        <Card style={{ display: 'flex', flexDirection: 'column', height: 600 }}>
          {/* Provider bar */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={16} color="var(--sap-blue)" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>CPI Operations AI Agent</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <select
                className="select"
                style={{ height: 30, padding: '0 8px', fontSize: 12, width: 'auto' }}
                value={provider}
                onChange={e => { setProvider(e.target.value); setModel(PROVIDERS.find(p => p.id === e.target.value)?.models[0]); }}
              >
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <select
                className="select"
                style={{ height: 30, padding: '0 8px', fontSize: 12, width: 'auto' }}
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                {(providerObj?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'agent' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--sap-info-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 4 }}>
                    <Bot size={14} color="var(--sap-blue)" />
                  </div>
                )}
                <div>
                  {m.role === 'agent' && (
                    <div className="chat-agent-label"><Sparkles size={11} /> AI Agent · {providerObj?.label} / {model}</div>
                  )}
                  {m.text ? (
                    <div className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-agent'}>{m.text}</div>
                  ) : m.structured ? (
                    <StructuredResponse s={m.structured} onToast={setToastMsg} />
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Quick suggestions */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK.map((q, i) => (
              <button key={i} onClick={() => { setInput(q); }}
                style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-shell)', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, padding: '12px 14px', borderTop: '1px solid var(--border-soft)' }}>
            <input
              className="input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about incidents, tickets, remediations, or artifacts..."
              style={{ flex: 1 }}
            />
            <button
              onClick={send}
              style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--sap-blue)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <Send size={15} color="#fff" />
            </button>
          </div>
        </Card>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Self-healing workflow */}
          <Card>
            <div className="card-header" style={{ padding: '12px 14px' }}>
              <span className="card-title" style={{ fontSize: 12.5 }}><Sparkles size={13} />Self-Healing Workflow</span>
            </div>
            <div style={{ padding: '10px 14px' }}>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                Safe actions only. Risky actions require approval. High-risk changes are manual.
              </p>
              {SELF_HEALING.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.color + '20', border: `2px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: s.color }}>{i + 1}</span>
                    </div>
                    {i < SELF_HEALING.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border-soft)', marginTop: 2, minHeight: 12 }} />}
                  </div>
                  <div style={{ paddingBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Safety reminder */}
          <Card style={{ borderLeft: '3px solid var(--sap-medium)' }}>
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--sap-medium)' }}>Production Safety:</strong> AI proposes actions. Safe actions run automatically. Risky actions require approval. High-risk changes remain manual. Every action is audited.
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
