import React, { useState } from 'react';
import { TICKETS } from '../data/mockData';
import { SeverityBadge, StatusPill, CategoryChip, FilterSelect } from '../components/common';

const STATUS_COLOR = { Open: 'var(--sap-high)', 'In Progress': 'var(--sap-info)', Resolved: 'var(--sap-success)', Closed: 'var(--text-muted)' };
const ITSM_SYSTEMS = ['All', 'Jira', 'ServiceNow', 'IRIS'];

export default function TicketsPage({ onOpen }) {
  const [sys, setSys] = useState('All');
  const [status, setStatus] = useState('All');
  const statuses = ['All', 'Open', 'In Progress', 'Closed'];
  const list = TICKETS.filter(t =>
    (sys === 'All' || t.system === sys) &&
    (status === 'All' || t.status === status)
  );

  const ITSM_STYLE = {
    Jira: { bg: '#E8F0FF', color: '#1868DB' },
    ServiceNow: { bg: '#E8F6FF', color: '#0070C0' },
    IRIS: { bg: '#E8F5EC', color: '#107869' },
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Tickets</h1>
        <p>ITSM tickets created via Proceed or automation policy. Status kept synchronized automatically.</p>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {ITSM_SYSTEMS.map(s => (
          <button
            key={s}
            className={`pill-btn${sys === s ? ' active' : ''}`}
            onClick={() => setSys(s)}
          >
            {s}
            <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 700 }}>
              {s === 'All' ? TICKETS.length : TICKETS.filter(t => t.system === s).length}
            </span>
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <FilterSelect label="Status" value={status} options={statuses} onChange={setStatus} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th><th>ITSM</th><th>Incident ID</th><th>Severity</th>
              <th>Artifact</th><th>Category</th><th>Created</th><th>Status</th>
              <th>Assigned To</th><th>SLA</th><th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {list.map(t => {
              const is = ITSM_STYLE[t.system] || { bg: 'var(--border-soft)', color: 'var(--text-muted)' };
              return (
                <tr
                  key={t.id}
                  className="clickable"
                  onClick={() => onOpen(t.id)}
                >
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, color: 'var(--sap-blue)' }}>
                      {t.id}
                    </span>
                  </td>
                  <td>
                    <span style={{ background: is.bg, color: is.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3 }}>
                      {t.system}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--sap-blue)', fontWeight: 600 }}>{t.incident}</td>
                  <td><SeverityBadge sev={t.severity} size="sm" /></td>
                  <td style={{ fontWeight: 600, fontSize: 13, maxWidth: 160 }}>{t.artifact}</td>
                  <td><CategoryChip category={t.category} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.created}</td>
                  <td>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: STATUS_COLOR[t.status] || 'var(--text-muted)' }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{t.assignedTo}</td>
                  <td>
                    <span style={{
                      fontSize: 12, color: t.sla === 'Breach risk' ? 'var(--sap-critical)' : t.sla === 'Met' ? 'var(--sap-success)' : 'var(--text-secondary)',
                      fontWeight: t.sla === 'Breach risk' ? 700 : 400,
                    }}>{t.sla}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.lastUpdate}</td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No tickets match the selected filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
