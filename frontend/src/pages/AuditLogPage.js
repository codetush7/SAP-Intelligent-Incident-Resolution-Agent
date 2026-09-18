import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { agentAPI } from '../services/api';
import { FilterSelect } from '../components/common';

const ACTION_COLOR = {
  'Incident Created': 'var(--sap-info)',
  'ITSM Ticket Created': 'var(--sap-critical)',
  'Remediation Started': 'var(--sap-medium)',
  'Remediation Completed': 'var(--sap-success)',
  'Remediation Failed': 'var(--sap-critical)',
  'Ticket Creation Skipped': 'var(--sap-low)',
  'Incident Resolved': 'var(--sap-success)',
  'Severity Classified': 'var(--sap-info)',
  'On-call Notified': 'var(--sap-high)',
  'Root Cause Identified': 'var(--sap-info)',
  'Incident Updated': 'var(--sap-medium)',
  'AI Analysis Generated': 'var(--sap-info)',
};

function normalizeAuditLog(l) {
  const ts = l.timestamp
    ? new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : (l.ts || 'Just now');

  let action = l.action || 'Action Executed';
  if (action === 'CHAT_INTERACTION') action = 'AI Analysis Generated';
  else if (action === 'INCIDENT_PROCESSED') action = 'Incident Created';
  else if (action === 'REMEDIATION_EXECUTED') action = 'Remediation Completed';
  else if (action === 'TICKET_CREATED') action = 'ITSM Ticket Created';

  return {
    id: l.id || Math.random().toString(36).substring(2),
    ts: ts,
    actor: l.actor || 'AI Agent',
    action: action,
    entity: l.entity || l.ticketNumber || (l.ticketId ? String(l.ticketId).slice(0, 8) : 'CPI Agent'),
    prev: l.prev || '—',
    next: l.next || l.message || l.details || 'Processed',
    source: l.source || 'Automatic Detection',
  };
}

export default function AuditLogPage({ extraLogs = [] }) {
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [dbLogs, setDbLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadLogs() {
      try {
        const data = await agentAPI.getLogs();
        if (active) {
          setDbLogs(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadLogs();
    return () => { active = false; };
  }, []);

  const allLogs = useMemo(() => {
    const mappedDb = dbLogs.map(normalizeAuditLog);
    const mappedExtra = (extraLogs || []).map(normalizeAuditLog);
    return [...mappedExtra, ...mappedDb];
  }, [dbLogs, extraLogs]);

  const actors = ['All', 'AI Agent', 'System', 'User'];
  const actions = useMemo(() => {
    return ['All', ...Array.from(new Set(allLogs.map(a => a.action).filter(Boolean)))];
  }, [allLogs]);

  const filtered = useMemo(() => {
    return allLogs.filter(l => {
      if (actorFilter !== 'All' && l.actor !== actorFilter) return false;
      if (actionFilter !== 'All' && l.action !== actionFilter) return false;
      if (search && !`${l.entity} ${l.action} ${l.actor} ${l.source}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allLogs, actorFilter, actionFilter, search]);

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Audit Logs</h1>
        <p>Complete, immutable record of every AI decision, remediation, and human action. Used for accountability and compliance.</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 30, height: 34 }}
            placeholder="Search entity, action, source..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <FilterSelect label="Actor" value={actorFilter} options={actors} onChange={setActorFilter} />
        <FilterSelect label="Action" value={actionFilter} options={actions} onChange={setActionFilter} />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {filtered.length} of {allLogs.length} events
        </span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Previous</th>
              <th>New Value</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l.ts}</td>
                <td>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                    background: l.actor === 'AI Agent' ? 'var(--sap-info-soft)' : l.actor === 'System' ? 'var(--border-soft)' : 'var(--sap-medium-soft)',
                    color: l.actor === 'AI Agent' ? 'var(--sap-blue)' : l.actor === 'System' ? 'var(--text-secondary)' : 'var(--sap-medium)',
                  }}>
                    {l.actor}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: ACTION_COLOR[l.action] || 'var(--text-primary)' }}>
                    {l.action}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--sap-blue)' }}>{l.entity}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.prev || '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.next}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.source}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No audit events match the filters.</td></tr>
            )}
            {loading && allLogs.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading audit logs...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
