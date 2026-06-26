import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCw, ExternalLink, X, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ticketsAPI } from '../services/api';

const PRIORITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];

function getPriorityClass(p) {
  const m = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };
  return m[p] || 'badge-low';
}
function getStatusClass(s) {
  const m = { OPEN: 'badge-open', IN_PROGRESS: 'badge-in-progress', RESOLVED: 'badge-resolved' };
  return m[s] || 'badge-open';
}

export default function TicketsPage({ liveEvents }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => { loadTickets(); }, []);
  useEffect(() => { if (liveEvents.length > 0) loadTickets(); }, [liveEvents]);

  async function loadTickets() {
    try {
      const data = await ticketsAPI.getAll();
      setTickets(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function updateStatus(id, status) {
    setActionLoading(id + status);
    try {
      await ticketsAPI.update(id, { status });
      await loadTickets();
      if (selectedTicket?.id === id) setSelectedTicket(t => ({ ...t, status }));
    } catch (err) { alert(err.message); }
    finally { setActionLoading(null); }
  }

  const filtered = tickets.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.ticketNumber?.toLowerCase().includes(search.toLowerCase()) || t.interface?.toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === 'ALL' || t.priority === filterPriority;
    const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
    return matchSearch && matchPriority && matchStatus;
  });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Incident Tickets</h1>
          <p>Auto-created and AI-analyzed tickets from SAP CPI monitoring</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={loadTickets}><RefreshCw size={14} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> New Ticket</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding: '14px 16px' }}>
        <div className="flex gap-3 flex-wrap">
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
          <select className="select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p === 'ALL' ? 'All Priorities' : p}</option>)}
          </select>
          <select className="select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>{filtered.length} results</span>
        </div>
      </div>

      {/* Ticket list */}
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Interface</th>
                <th>Category</th>
                <th>Team</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No tickets found</td></tr>
              ) : filtered.map(ticket => (
                <tr key={ticket.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTicket(ticket)}>
                  <td><span className="mono" style={{ fontSize: 12, color: 'var(--accent-blue)' }}>{ticket.ticketNumber}</span></td>
                  <td style={{ maxWidth: 280 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.title}</div>
                    {ticket.aiAnalyzed && <span style={{ fontSize: 10, color: 'var(--accent-purple)' }}>✦ AI Analyzed</span>}
                  </td>
                  <td><span className={`badge ${getPriorityClass(ticket.priority)}`}>{ticket.priority}</span></td>
                  <td><span className={`badge ${getStatusClass(ticket.status)}`}>{ticket.status?.replace('_', ' ')}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ticket.interface}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ticket.category?.replace(/_/g, ' ')}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ticket.assignedTeam}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {ticket.status === 'OPEN' && (
                        <button className="btn btn-secondary btn-xs" onClick={() => updateStatus(ticket.id, 'IN_PROGRESS')} disabled={actionLoading === ticket.id + 'IN_PROGRESS'}>
                          <Clock size={10} /> Start
                        </button>
                      )}
                      {ticket.status !== 'RESOLVED' && (
                        <button className="btn btn-success btn-xs" onClick={() => updateStatus(ticket.id, 'RESOLVED')} disabled={actionLoading === ticket.id + 'RESOLVED'}>
                          <CheckCircle size={10} /> Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket detail modal */}
      {selectedTicket && <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onUpdate={loadTickets} />}
      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={loadTickets} />}
    </div>
  );
}

function TicketModal({ ticket, onClose, onUpdate }) {
  const [syncLoading, setSyncLoading] = useState(null);

  async function sync(platform) {
    setSyncLoading(platform);
    try {
      const fn = platform === 'servicenow' ? ticketsAPI.syncServiceNow : ticketsAPI.syncJira;
      const result = await fn(ticket.id);
      alert(`Synced to ${platform}: ${result.externalNumber || result.externalId}`);
      onUpdate();
    } catch (err) { alert(err.message); }
    finally { setSyncLoading(null); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 560, height: '100vh', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', overflowY: 'auto', animation: 'slide-in 0.2s ease' }}>
        <div style={{ padding: 24 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--accent-blue)' }}>{ticket.ticketNumber}</span>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{ticket.title}</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}><X size={18} /></button>
          </div>

          <div className="flex gap-2 mb-4">
            <span className={`badge ${getPriorityClass(ticket.priority)}`}>{ticket.priority}</span>
            <span className={`badge ${getStatusClass(ticket.status)}`}>{ticket.status?.replace('_', ' ')}</span>
            {ticket.aiAnalyzed && <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(139,92,246,0.2)' }}>✦ AI Analyzed</span>}
          </div>

          <DetailSection label="Root Cause" value={ticket.rootCause} highlight />
          <DetailSection label="Recommendation" value={ticket.recommendation} />
          {ticket.evidence && <DetailSection label="Evidence" value={ticket.evidence} />}
          {ticket.impact && <DetailSection label="Business Impact" value={ticket.impact} />}

          <div className="grid-2 mt-4" style={{ gap: 12 }}>
            <DetailRow label="Interface" value={ticket.interface} />
            <DetailRow label="iFlow" value={ticket.iflow} />
            <DetailRow label="Assigned Team" value={ticket.assignedTeam} />
            <DetailRow label="Category" value={ticket.category?.replace(/_/g, ' ')} />
            <DetailRow label="Error Code" value={ticket.errorCode} mono />
            <DetailRow label="Source" value={ticket.systemSource} />
          </div>

          {ticket.payload && ticket.payload !== '{}' && (
            <div className="mt-4">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Payload Snippet</div>
              <pre className="mono" style={{ fontSize: 11, color: 'var(--accent-cyan)', background: 'var(--bg-input)', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 140 }}>
                {ticket.payload}
              </pre>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => sync('servicenow')} disabled={!!syncLoading}>
              {syncLoading === 'servicenow' ? '...' : <><ExternalLink size={12} /> ServiceNow</>}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => sync('jira')} disabled={!!syncLoading}>
              {syncLoading === 'jira' ? '...' : <><ExternalLink size={12} /> Jira</>}
            </button>
          </div>

          <div className="mt-4" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Created: {new Date(ticket.createdAt).toLocaleString()} · Updated: {new Date(ticket.updatedAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ label, value, highlight }) {
  if (!value) return null;
  return (
    <div className="mt-3">
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 13, color: highlight ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: highlight ? 'rgba(59,130,246,0.06)' : 'transparent',
        padding: highlight ? '10px 12px' : 0,
        borderRadius: highlight ? 8 : 0,
        borderLeft: highlight ? '2px solid var(--accent-blue)' : 'none',
        lineHeight: 1.6
      }}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{value}</div>
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', category: 'GENERAL', interface: '', iflow: '', errorCode: '' });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.title || !form.priority) return alert('Title and priority required');
    setLoading(true);
    try {
      await ticketsAPI.create(form);
      onCreated();
      onClose();
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 480, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Create Ticket</h2>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
        </div>
        <div className="flex-col gap-3">
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Title *</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ticket title" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue" style={{ resize: 'vertical' }} />
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Priority *</label>
              <select className="select" style={{ width: '100%' }} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Interface</label>
              <input className="input" value={form.interface} onChange={e => setForm(f => ({ ...f, interface: e.target.value }))} placeholder="e.g. Salesforce" />
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>iFlow</label>
              <input className="input" value={form.iflow} onChange={e => setForm(f => ({ ...f, iflow: e.target.value }))} placeholder="iFlow name" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Error Code</label>
              <input className="input" value={form.errorCode} onChange={e => setForm(f => ({ ...f, errorCode: e.target.value }))} placeholder="HTTP_401" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Ticket'}</button>
        </div>
      </div>
    </div>
  );
}
