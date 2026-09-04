import React, { useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { AUDIT_LOG } from '../data/mockData';
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
};

export default function AuditLogPage({ extraLogs = [] }) {
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');

  const allLogs = [...extraLogs, ...AUDIT_LOG];
  const actors = ['All', 'AI Agent', 'System', 'User'];
  const actions = ['All', ...Array.from(new Set(allLogs.map(a => a.action)))];

  const filtered = allLogs.filter(l => {
    if (actorFilter !== 'All' && l.actor !== actorFilter) return false;
    if (actionFilter !== 'All' && l.action !== actionFilter) return false;
    if (search && !`${l.entity} ${l.action} ${l.actor} ${l.source}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No audit events match the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
