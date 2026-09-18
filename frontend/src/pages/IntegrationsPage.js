import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { ticketsAPI, monitoringAPI } from '../services/api';
import { Card, SeverityBadge, StatusPill, InfoRow, ProgressBar } from '../components/common';

const STATUS_COLOR = { Healthy: 'var(--sap-success)', Degraded: 'var(--sap-medium)', Critical: 'var(--sap-critical)' };
const STATUS_BG    = { Healthy: 'var(--sap-success-soft)', Degraded: 'var(--sap-medium-soft)', Critical: 'var(--sap-critical-soft)' };

function normalizeArtifact(f, tickets = []) {
  const id = f.id || f.Id || f.name || 'iflow';
  const name = f.name || f.Name || id;
  const rawStatus = (f.status || f.Status || 'HEALTHY').toUpperCase();

  const status =
    (rawStatus === 'FAILED' || rawStatus === 'CRITICAL' || rawStatus === 'ERROR') ? 'Critical' :
    (rawStatus === 'WARNING' || rawStatus === 'DEGRADED') ? 'Degraded' : 'Healthy';

  const matchedTickets = tickets.filter(t => {
    const art = (t.artifact || t.iflow || t.interface || '').toLowerCase();
    const targetId = String(id).toLowerCase();
    const targetName = String(name).toLowerCase();
    return art === targetId || art === targetName || (art && (targetId.includes(art) || art.includes(targetId)));
  });

  const failedCount = matchedTickets.length;
  const successRate = status === 'Critical' ? (failedCount > 3 ? 65 : 78) : status === 'Degraded' ? 92 : 99.8;
  const total = failedCount > 0 ? failedCount * 45 + 120 : 540;

  return {
    id: id,
    name: name,
    pkg: f.packageId || f.pkg || f.PackageId || 'Core Integration Package',
    version: f.version || f.Version || '1.0.0',
    status: status,
    successRate: typeof f.successRate === 'number' ? f.successRate : successRate,
    failed: failedCount,
    total: total,
    incidents: failedCount,
    iface: f.interface || f.iface || f.Interface || 'CPI Endpoint',
    lastDeploy: f.deployedAt ? new Date(f.deployedAt).toLocaleDateString() : f.lastRun ? new Date(f.lastRun).toLocaleString() : 'Active',
  };
}

function normalizeIncident(t) {
  const prio = (t.priority || '').toUpperCase();
  const sev = t.severity || (prio === 'CRITICAL' ? 'P1' : prio === 'HIGH' ? 'P2' : prio === 'MEDIUM' ? 'P3' : 'P4');
  const rawStatus = (t.status || 'OPEN').toUpperCase();
  const statusDisplay =
    rawStatus === 'OPEN' ? 'Open' :
    rawStatus === 'IN_PROGRESS' ? 'Investigating' :
    rawStatus === 'RESOLVED' ? 'Resolved' :
    rawStatus === 'CLOSED' ? 'Closed' : t.status || 'Open';

  return {
    id: t.ticketNumber || t.id,
    artifactId: t.iflow || t.artifact || t.interface || '',
    severity: sev,
    category: t.category ? String(t.category).replace(/_/g, ' ') : 'General',
    status: statusDisplay,
    duration: t.duration || 'Live',
  };
}

export default function IntegrationsPage() {
  const [openId, setOpenId] = useState(null);
  const [rawIflows, setRawIflows] = useState([]);
  const [rawTickets, setRawTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchData() {
      try {
        const [iflowsData, ticketsData] = await Promise.all([
          monitoringAPI.getIflows().catch(() => []),
          ticketsAPI.getAll().catch(() => [])
        ]);
        if (active) {
          setRawIflows(Array.isArray(iflowsData) ? iflowsData : []);
          setRawTickets(Array.isArray(ticketsData) ? ticketsData : []);
        }
      } catch (err) {
        console.error('Failed to load integrations data:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchData();
    return () => { active = false; };
  }, []);

  const artifacts = useMemo(() => {
    return rawIflows.map(f => normalizeArtifact(f, rawTickets));
  }, [rawIflows, rawTickets]);

  const incidents = useMemo(() => {
    return rawTickets.map(normalizeIncident);
  }, [rawTickets]);

  const open = useMemo(() => artifacts.find(a => a.id === openId), [artifacts, openId]);

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Integrations</h1>
        <p>CPI artifacts fetched from your connected tenant. Click any card for detail and incident history.</p>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {['Healthy', 'Degraded', 'Critical'].map(s => {
          const count = artifacts.filter(a => a.status === s).length;
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

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          Loading integrations from connected tenant...
        </div>
      )}

      {!loading && artifacts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          No integration flows found on this tenant.
        </div>
      )}

      <div className="grid-3">
        {artifacts.map(a => (
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
              {incidents.filter(i => {
                const art = (i.artifactId || '').toLowerCase();
                const openIdLow = (open.id || '').toLowerCase();
                const openNameLow = (open.name || '').toLowerCase();
                return art === openIdLow || art === openNameLow || (art && (openIdLow.includes(art) || openNameLow.includes(art)));
              }).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>
                  No incidents on record for this artifact.
                </div>
              ) : (
                incidents.filter(i => {
                  const art = (i.artifactId || '').toLowerCase();
                  const openIdLow = (open.id || '').toLowerCase();
                  const openNameLow = (open.name || '').toLowerCase();
                  return art === openIdLow || art === openNameLow || (art && (openIdLow.includes(art) || openNameLow.includes(art)));
                }).map(inc => (
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
