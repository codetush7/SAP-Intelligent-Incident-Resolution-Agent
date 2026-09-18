import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Edit2, ArrowRight, CheckCircle2, X, Info, Trash2,
} from 'lucide-react';
import { ticketsAPI } from '../services/api';
import {
  SeverityBadge, StatusPill, CategoryChip, Btn,
  InfoRow, FilterSelect, AlertBox, Toast,
} from '../components/common';

const STATUS_OPTIONS = ['All', 'New', 'Investigating', 'Open', 'Remediation Running', 'Resolved', 'Escalated', 'Monitoring', 'Closed'];
const CATEGORY_OPTIONS = ['All', 'Authentication', 'Authorization', 'Connectivity', 'Timeout', 'Message Mapping', 'Certificate', 'Adapter Error', 'Transformation', 'Routing', 'Validation', 'Runtime Exception', 'Endpoint Failure'];

function toStr(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if (val.type === 'Buffer' && Array.isArray(val.data)) {
      try {
        return new TextDecoder().decode(new Uint8Array(val.data));
      } catch (e) {
        return fallback;
      }
    }
    try {
      return JSON.stringify(val);
    } catch (e) {
      return fallback;
    }
  }
  return String(val);
}

export default function IncidentsPage({ onOpenIncident, itsmSystem = 'Jira', auditLog, setAuditLog }) {
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [proceedOpen, setProceedOpen] = useState(false);
  const [proceedSuccess, setProceedSuccess] = useState(null);  // { ticketNum, jiraUrl }
  const [submitting, setSubmitting] = useState(false);
  const [proceedError, setProceedError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const showToast = (msg, type = 'success') => { setToastMsg(msg); setToastType(type); };
  // Local edits
  const [edits, setEdits] = useState({});
  const [rawTickets, setRawTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      const data = await ticketsAPI.getAll();
      setRawTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load tickets for incidents:', err);
      setRawTickets([]);
    } finally {
      setLoading(false);
    }
  }

  // Merge edits into incidents
  const incidents = useMemo(() => {
    return rawTickets.map(t => {
      const prio = (t.priority || '').toUpperCase();
      const sev = t.severity || (prio === 'CRITICAL' ? 'P1' : prio === 'HIGH' ? 'P2' : prio === 'MEDIUM' ? 'P3' : 'P4');
      const rawStatus = (t.status || 'OPEN').toUpperCase();
      const statusDisplay =
        rawStatus === 'OPEN' ? 'Open' :
        rawStatus === 'IN_PROGRESS' ? 'Investigating' :
        rawStatus === 'RESOLVED' ? 'Resolved' :
        rawStatus === 'CLOSED' ? 'Closed' : t.status || 'New';
      const incId = t.ticketNumber || t.id;

      const base = {
        id: incId,
        rawId: t.id,
        severity: sev,
        artifact: toStr(t.iflow || t.interface || t.artifact || t.title, 'Integration Flow'),
        category: t.category ? toStr(t.category).replace(/_/g, ' ') : 'Connectivity',
        status: statusDisplay,
        owner: toStr(t.owner || t.assignedTeam || t.assignedTo, 'AI Agent'),
        duration: toStr(t.duration, 'Live'),
        failureCount: t.failureCount || 1,
        aiConfidence: t.aiConfidence || 95,
        rootCause: toStr(t.rootCause || t.description, 'CPI error detected during message execution'),
        impact: toStr(t.impact || t.title, 'Message processing interrupted'),
        recommendedAction: toStr(t.recommendation || t.recommendedAction, 'Inspect message payload and retry'),
        ticket: t.jiraKey || (t.systemSource === 'MANUAL' ? t.ticketNumber : null),
        ticketSystem: t.jiraKey ? 'Jira' : (t.system || null),
        decision: t.decision || (t.jiraKey ? 'ticket' : 'auto'),
        decisionReason: toStr(t.decisionReason, 'Analyzed by CPI AI operations policy'),
        remediationStatus: t.remediationStatus || (rawStatus === 'RESOLVED' ? 'Successful' : 'Pending'),
        iface: toStr(t.interface || t.iface || t.iflow, 'CPI Endpoint'),
        pkg: toStr(t.packageName || t.packageId || t.pkg, 'CPI Package'),
        detected: t.createdAt ? new Date(t.createdAt).toLocaleString() : 'Recent',
        businessImpact: toStr(t.businessImpact, prio === 'CRITICAL' ? 'Critical' : prio === 'HIGH' ? 'High' : 'Moderate'),
      };
      return { ...base, ...(edits[incId] || {}) };
    });
  }, [rawTickets, edits]);

  const filtered = useMemo(() => incidents.filter(i => {
    if (sevFilter !== 'All' && i.severity !== sevFilter) return false;
    if (statusFilter !== 'All' && i.status !== statusFilter) return false;
    if (catFilter !== 'All' && i.category !== catFilter) return false;
    if (search && !`${i.id} ${i.artifact} ${i.category}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [incidents, sevFilter, statusFilter, catFilter, search]);

  const selectedInc = incidents.find(i => i.id === selected) || null;
  const [deleting, setDeleting] = useState(false);

  function handleEdit(inc) { setSelected(inc.id); setEditOpen(true); }
  function handleProceed(inc) {
    if (!inc.ticket) { setSelected(inc.id); setProceedSuccess(null); setProceedOpen(true); }
  }

  async function handleDelete(inc) {
    if (!inc) return;
    const confirmMsg = `Are you sure you want to delete incident ${inc.id}?`;
    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      await ticketsAPI.delete(inc.rawId || inc.id);
      showToast(`Incident ${inc.id} deleted successfully`, 'success');
      setSelected(null);
      await loadTickets();
      if (setAuditLog) {
        setAuditLog(l => [{
          id: `AUD-${Date.now()}`,
          ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          actor: 'User', action: 'Incident Deleted', entity: inc.id,
          prev: inc.status, next: 'Deleted', source: 'Manual Delete',
        }, ...l]);
      }
    } catch (err) {
      console.error('Failed to delete incident:', err);
      showToast(`Failed to delete: ${err.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  }

  function saveEdit(form) {
    const prev = incidents.find(i => i.id === selected);
    setEdits(e => ({ ...e, [selected]: { ...e[selected], ...form } }));
    // Audit entry
    if (setAuditLog && auditLog) {
      const changes = Object.entries(form)
        .filter(([k, v]) => prev[k] !== v)
        .map(([k, v]) => `${k}: ${prev[k]} → ${v}`);
      if (changes.length) {
        setAuditLog(l => [{
          id: `AUD-${Date.now()}`, ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          actor: 'User', action: 'Incident Updated', entity: selected,
          prev: changes.join(', '), next: 'Manual Edit', source: 'Manual Incident Update',
        }, ...l]);
      }
    }
    setEditOpen(false);
    showToast('Incident updated successfully.');
  }

  async function confirmProceed() {
    const inc = incidents.find(i => i.id === selected);
    if (!inc) return;
    setSubmitting(true);
    setProceedError('');
    try {
      // Build the ticket payload for the backend
      const payload = {
        title:       `[${inc.severity}] ${inc.artifact} — ${inc.category}`,
        description: inc.rootCause || inc.category,
        priority:    inc.severity === 'P1' ? 'CRITICAL' : inc.severity === 'P2' ? 'HIGH' : inc.severity === 'P3' ? 'MEDIUM' : 'LOW',
        category:    inc.category?.toUpperCase().replace(/\s+/g, '_'),
        interface:   inc.iface,
        iflow:       inc.artifact,
        errorCode:   inc.errorCode || '',
        rootCause:   inc.rootCause,
        impact:      inc.impact,
        recommendation: inc.recommendedAction,
        incidentId:  inc.id,
      };
      const ticket = await ticketsAPI.create(payload);
      const jiraSynced = !!ticket.jiraKey;  // true only if Jira actually created an issue
      const ticketNum  = ticket.jiraKey || ticket.ticketNumber || ticket.id;
      const jiraUrl    = ticket.jiraUrl || null;

      if (!jiraSynced) {
        // Internal ticket created but Jira sync failed silently — warn the user
        setProceedError(`Internal ticket ${ticketNum} created, but Jira sync failed. Check that the Jira project key is correct in ITSM Connection settings.`);
        setSubmitting(false);
        return;
      }

      // Update local incident state with the new ticket reference
      setEdits(e => ({ ...e, [selected]: { ...e[selected], ticket: ticketNum, ticketSystem: itsmSystem, status: 'Investigating' } }));
      setProceedSuccess({ ticketNum, jiraUrl });
      await loadTickets();
      // Write audit entry
      if (setAuditLog) {
        setAuditLog(l => [{
          id: `AUD-${Date.now()}`,
          ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          actor: 'User', action: 'ITSM Ticket Created', entity: inc.id,
          prev: 'No ticket', next: ticketNum, source: 'Manual Proceed → Jira',
        }, ...l]);
      }
    } catch (err) {
      const msg = err.message || 'Ticket creation failed.';
      setProceedError(msg);
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Incidents</h1>
          <p>Every incident the AI has evaluated — and what it decided to do about it.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn
            variant="secondary"
            onClick={() => selectedInc && handleEdit(selectedInc)}
            disabled={!selected || deleting}
          >
            <Edit2 size={13} /> Edit
          </Btn>
          <Btn
            variant="primary"
            onClick={() => selectedInc && handleProceed(selectedInc)}
            disabled={!selected || !!selectedInc?.ticket || deleting}
          >
            <ArrowRight size={13} /> Proceed
          </Btn>
          <Btn
            variant="danger"
            onClick={() => selectedInc && handleDelete(selectedInc)}
            disabled={!selected || deleting}
          >
            <Trash2 size={13} /> Delete
          </Btn>
        </div>
      </div>

      {!itsmSystem && (
        <AlertBox type="warning" style={{ marginBottom: 16 }}>
          <strong>No ITSM destination configured.</strong> Configure an ITSM connection before using Proceed.
        </AlertBox>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ position: 'relative', width: 260 }}>
          <Search size={13} className="search-icon" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 30, height: 34 }}
            placeholder="Search ID, artifact, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <FilterSelect label="Severity" value={sevFilter} options={['All', 'P1', 'P2', 'P3', 'P4']} onChange={setSevFilter} />
        <FilterSelect label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
        <FilterSelect label="Category" value={catFilter} options={CATEGORY_OPTIONS} onChange={setCatFilter} />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {filtered.length} of {incidents.length} incidents
          {selected && <span style={{ marginLeft: 8, color: 'var(--sap-blue)', fontWeight: 600 }}>· 1 selected</span>}
        </span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Incident ID</th>
              <th>Severity</th>
              <th>Artifact Name</th>
              <th>Detected</th>
              <th>Category</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Duration</th>
              <th>Ticket</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inc => (
              <tr
                key={inc.id}
                className="clickable"
                style={{ background: selected === inc.id ? 'var(--sap-blue-light)' : undefined }}
                onClick={() => setSelected(selected === inc.id ? null : inc.id)}
                onDoubleClick={() => onOpenIncident(inc.id)}
              >
                <td style={{ width: 16, paddingRight: 0 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 3,
                    border: `2px solid ${selected === inc.id ? 'var(--sap-blue)' : 'var(--border-strong)'}`,
                    background: selected === inc.id ? 'var(--sap-blue)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected === inc.id && <CheckCircle2 size={9} color="#fff" />}
                  </div>
                </td>
                <td>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--sap-blue)', whiteSpace: 'nowrap' }}>
                    {inc.id}
                  </div>
                </td>
                <td><SeverityBadge sev={inc.severity} size="sm" /></td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{inc.artifact}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inc.pkg}</div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{inc.detected}</td>
                <td><CategoryChip category={inc.category} /></td>
                <td><StatusPill status={inc.status} /></td>
                <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{inc.owner}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{inc.duration}</td>
                <td>
                  {inc.ticket
                    ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--sap-blue)' }}>{inc.ticket}</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                  }
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={10} style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading incidents from database...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No incidents match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        <Info size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        Click a row to select · Double-click to open detail · Select then use Edit or Proceed buttons above
      </div>

      {/* Edit Drawer */}
      {editOpen && selectedInc && (
        <EditIncidentDrawer
          incident={selectedInc}
          onClose={() => setEditOpen(false)}
          onSave={saveEdit}
        />
      )}

      {/* Proceed Modal */}
      {proceedOpen && selectedInc && (
        <ProceedModal
          incident={incidents.find(i => i.id === selected)}
          itsmSystem={itsmSystem}
          success={proceedSuccess}
          error={proceedError}
          submitting={submitting}
          onConfirm={confirmProceed}
          onClose={() => { setProceedOpen(false); setProceedSuccess(null); setProceedError(''); }}
        />
      )}

      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    </div>
  );
}

/* ---- Edit Incident Drawer ---- */
function EditIncidentDrawer({ incident: inc, onClose, onSave }) {
  const [form, setForm] = useState({
    severity: inc.severity,
    status: inc.status,
    category: inc.category,
    owner: inc.owner,
    notes: '',
  });
  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }
  const changed = Object.entries(form).some(([k, v]) => inc[k] !== undefined && inc[k] !== v && k !== 'notes');

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Incident</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{inc.id}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="drawer-body">
          <div style={{ background: 'var(--sap-medium-soft)', border: '1px solid rgba(184,114,0,0.2)', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, color: 'var(--sap-medium)', marginBottom: 20 }}>
            <strong>Manual Update</strong> — Changes will be recorded in the audit log.
          </div>

          <div className="input-group">
            <label className="input-label">Severity / Priority</label>
            <select className="select" value={form.severity} onChange={set('severity')}>
              {['P1', 'P2', 'P3', 'P4'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {form.severity !== inc.severity && (
              <div style={{ fontSize: 11.5, color: 'var(--sap-medium)', marginTop: 4 }}>
                {inc.severity} → {form.severity} (manual change)
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Status</label>
            <select className="select" value={form.status} onChange={set('status')}>
              {['New', 'Investigating', 'Open', 'Remediation Running', 'Escalated', 'Resolved', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {form.status !== inc.status && (
              <div style={{ fontSize: 11.5, color: 'var(--sap-medium)', marginTop: 4 }}>
                {inc.status} → {form.status} (manual change)
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Category</label>
            <select className="select" value={form.category} onChange={set('category')}>
              {['Authentication', 'Authorization', 'Connectivity', 'Timeout', 'Message Mapping', 'Certificate', 'Adapter Error', 'Transformation', 'Routing', 'Validation', 'Runtime Exception', 'Endpoint Failure'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Assigned To / Owner</label>
            <input className="input" value={form.owner} onChange={set('owner')} placeholder="Owner name or team" />
            {form.owner !== inc.owner && (
              <div style={{ fontSize: 11.5, color: 'var(--sap-medium)', marginTop: 4 }}>
                {inc.owner} → {form.owner}
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Notes</label>
            <textarea
              className="input"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Add notes about this manual update..."
              rows={3}
            />
          </div>

          {changed && (
            <div className="alert-box alert-box-info" style={{ marginBottom: 0 }}>
              <Info size={14} />
              <span>Changes will be reflected in any ITSM ticket created via Proceed.</span>
            </div>
          )}
        </div>
        <div className="drawer-footer">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => onSave(form)}>Save Changes</Btn>
        </div>
      </div>
    </>
  );
}

/* ---- Proceed Modal ---- */
function ProceedModal({ incident: inc, itsmSystem, success, error, submitting, onConfirm, onClose }) {
  if (!inc) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">
            {success ? '✓ Ticket Created Successfully' : 'Proceed with ITSM Ticket Creation?'}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {!success ? (
          <>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-shell)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <InfoRow label="Incident ID" value={<span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{inc.id}</span>} />
                <InfoRow label="Severity" value={<SeverityBadge sev={inc.severity} size="sm" />} />
                <InfoRow label="Artifact" value={inc.artifact} />
                <InfoRow label="Category" value={<CategoryChip category={inc.category} />} />
                <InfoRow label="Root Cause" value={inc.rootCause || '—'} />
                <InfoRow label="Target ITSM" value={<strong style={{ color: 'var(--sap-blue)' }}>{itsmSystem}</strong>} last />
              </div>
              {error && (
                <div style={{ background: 'var(--sap-critical-soft)', border: '1px solid var(--sap-critical)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--sap-critical)', marginBottom: 12 }}>
                  {error}
                </div>
              )}
              <div className="alert-box alert-box-info">
                <Info size={14} />
                <span>A ticket will be created in <strong>{itsmSystem}</strong> with AI-generated summary and root cause analysis. The incident status will update to <strong>Investigating</strong>.</span>
              </div>
            </div>
            <div className="modal-footer">
              <Btn variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Btn>
              <Btn variant="primary" onClick={onConfirm} disabled={submitting}>
                {submitting
                  ? <><span className="spin" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', marginRight: 6 }} />Creating…</>
                  : <><ArrowRight size={13} /> Create {itsmSystem} Ticket</>}
              </Btn>
            </div>
          </>
        ) : (
          <>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px 22px' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--sap-success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={26} color="var(--sap-success)" />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--sap-blue)', marginBottom: 6 }}>
                {success.ticketNum}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Ticket created in <strong>{itsmSystem}</strong>
              </div>
              {success.jiraUrl && (
                <a href={success.jiraUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: 13, color: 'var(--sap-blue)', textDecoration: 'underline', display: 'block', marginTop: 8 }}>
                  Open in {itsmSystem} ↗
                </a>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Incident status updated to Investigating</div>
            </div>
            <div className="modal-footer">
              <Btn variant="primary" onClick={onClose}>Done</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
