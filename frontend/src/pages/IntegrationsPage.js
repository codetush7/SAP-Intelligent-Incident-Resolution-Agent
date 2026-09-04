import React, { useState } from 'react';
import { Waypoints, X, AlertTriangle } from 'lucide-react';
import { ARTIFACTS, INCIDENTS } from '../data/mockData';
import { Card, SeverityBadge, StatusPill, InfoRow, ProgressBar } from '../components/common';

const STATUS_COLOR = { Healthy: 'var(--sap-success)', Degraded: 'var(--sap-medium)', Critical: 'var(--sap-critical)' };
const STATUS_BG    = { Healthy: 'var(--sap-success-soft)', Degraded: 'var(--sap-medium-soft)', Critical: 'var(--sap-critical-soft)' };

export default function IntegrationsPage() {
  const [openId, setOpenId] = useState(null);
  const open = ARTIFACTS.find(a => a.id === openId);

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Integrations</h1>
        <p>CPI artifacts fetched from your connected tenant. Click any card for detail and incident history.</p>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {['Healthy', 'Degraded', 'Critical'].map(s => {
          const count = ARTIFACTS.filter(a => a.status === s).length;
          return (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 6,
              background: STATUS_BG[s], border: `1px solid ${STATUS_COLOR[s]}40`,
              fontSize: 13, fontWeight: 600, color: STATUS_COLOR[s],
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s] }} />
              {count} {s}
            </div>
          );
        })}
      </div>

      <div className="grid-3">
        {ARTIFACTS.map(a => (
          <Card
            key={a.id}
            className="clickable"
            style={{ cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s', borderTop: `2px solid ${STATUS_COLOR[a.status]}` }}
            onClick={() => setOpenId(a.id)}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
          >
            <div style={{ padding: '16px 18px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{a.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.pkg} · v{a.version}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: STATUS_BG[a.status], color: STATUS_COLOR[a.status],
                  padding: '2px 9px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[a.status] }} />
                  {a.status}
                </span>
              </div>

              {/* Success rate bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Message success rate</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: STATUS_COLOR[a.status] }}>
                    {a.successRate}%
                  </span>
                </div>
                <ProgressBar value={a.successRate} max={100} color={STATUS_COLOR[a.status]} height={6} />
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
                <span><strong style={{ color: 'var(--sap-critical)' }}>{a.failed}</strong> failed</span>
                <span>{a.total.toLocaleString()} total</span>
                <span style={{ color: a.incidents > 0 ? 'var(--sap-critical)' : 'var(--sap-success)', fontWeight: 600 }}>
                  {a.incidents} active incidents
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Detail drawer */}
      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpenId(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{open.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{open.pkg} · v{open.version}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setOpenId(null)}><X size={16} /></button>
            </div>
            <div className="drawer-body">
              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  background: STATUS_BG[open.status], color: STATUS_COLOR[open.status],
                  padding: '4px 12px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[open.status] }} />
                  {open.status}
                </span>
              </div>

              {/* Info */}
              <Card style={{ marginBottom: 14 }}>
                <div style={{ padding: 0 }}>
                  <div style={{ padding: '0 14px' }}>
                    <InfoRow label="Interface" value={open.iface} />
                    <InfoRow label="Package" value={open.pkg} />
                    <InfoRow label="Version" value={`v${open.version}`} />
                    <InfoRow label="Last Deployment" value={open.lastDeploy} />
                    <InfoRow label="Message Success Rate" value={`${open.successRate}%`} />
                    <InfoRow label="Failed Messages" value={open.failed} />
                    <InfoRow label="Total Messages" value={open.total.toLocaleString()} last />
                  </div>
                </div>
              </Card>

              {/* Incidents */}
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Incident History</div>
              {INCIDENTS.filter(i => i.artifactId === open.id).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>
                  No incidents on record for this artifact.
                </div>
              ) : (
                INCIDENTS.filter(i => i.artifactId === open.id).map(inc => (
                  <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SeverityBadge sev={inc.severity} size="sm" />
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--sap-blue)' }}>{inc.id}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inc.category}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <StatusPill status={inc.status} />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{inc.duration}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
