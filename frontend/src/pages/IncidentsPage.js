import React, { useState, useMemo } from 'react';
import {
  Search, Filter, AlertTriangle, Ticket, Edit2, ArrowRight,
  CheckCircle2, X, ChevronRight, Info,
} from 'lucide-react';
import { INCIDENTS } from '../data/mockData';
import {
  SeverityBadge, StatusPill, CategoryChip, Card, Btn, Modal, Drawer,
  InfoRow, Field, FilterSelect, Breadcrumb, AlertBox, Toast,
} from '../components/common';

const STATUS_OPTIONS = ['All', 'New', 'Investigating', 'Open', 'Remediation Running', 'Resolved', 'Escalated', 'Monitoring', 'Closed'];
const CATEGORY_OPTIONS = ['All', 'Authentication', 'Authorization', 'Connectivity', 'Timeout', 'Message Mapping', 'Certificate', 'Adapter Error', 'Transformation', 'Routing', 'Validation', 'Runtime Exception', 'Endpoint Failure'];

export default function IncidentsPage({ onOpenIncident, itsmSystem = 'Jira', auditLog, setAuditLog }) {
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [proceedOpen, setProceedOpen] = useState(false);
  const [proceedSuccess, setProceedSuccess] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  // Local edits
  const [edits, setEdits] = useState({});

  const showToast = (msg, type = 'success') => { setToastMsg(msg); setToastType(type); };

  // Merge edits into incidents
  const incidents = useMemo(() => INCIDENTS.map(i => ({ ...i, ...(edits[i.id] || {}) })), [edits]);

  const filtered = useMemo(() => incidents.filter(i => {
    if (sevFilter !== 'All' && i.severity !== sevFilter) return false;
    if (statusFilter !== 'All' && i.status !== statusFilter) return false;
    if (catFilter !== 'All' && i.category !== catFilter) return false;
    if (search && !`${i.id} ${i.artifact} ${i.category}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [incidents, sevFilter, statusFilter, catFilter, search]);

  const selectedInc = incidents.find(i => i.id === selected) || null;

  function handleEdit(inc) { setSelected(inc.id); setEditOpen(true); }
  function handleProceed(inc) {
    if (!inc.ticket) { setSelected(inc.id); setProceedSuccess(null); setProceedOpen(true); }
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

  function confirmProceed() {
    const ticketNum = itsmSystem === 'Jira' ? `JIRA-${4820 + Math.floor(Math.random() * 10)}`
      : itsmSystem === 'ServiceNow' ? `SNOW-${10300 + Math.floor(Math.random() * 10)}`
      : `IRIS-${78430 + Math.floor(Math.random() * 10)}`;
    setEdits(e => ({ ...e, [selected]: { ...e[selected], ticket: ticketNum, ticketSystem: itsmSystem, status: 'Investigating' } }));
    setProceedSuccess(ticketNum);
    if (setAuditLog) {
      setAuditLog(l => [{
        id: `AUD-${Date.now()}`, ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        actor: 'User', action: 'ITSM Ticket Created', entity: selected,
        prev: 'No ticket', next: ticketNum, source: 'Manual Proceed',
      }, ...l]);
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
            disabled={!selected}
          >
            <Edit2 size={13} /> Edit
          </Btn>
          <Btn
            variant="primary"
            onClick={() => selectedInc && handleProceed(selectedInc)}
            disabled={!selected || !!selectedInc?.ticket}
          >
            <ArrowRight size={13} /> Proceed
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
            {filtered.length === 0 && (
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
          onConfirm={confirmProceed}
          onClose={() => { setProceedOpen(false); setProceedSuccess(null); }}
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
function ProceedModal({ incident: inc, itsmSystem, success, onConfirm, onClose }) {
  if (!inc) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">
            {success ? 'Ticket Created Successfully' : 'Proceed with ITSM Ticket Creation?'}
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
                <InfoRow label="Status" value={<StatusPill status={inc.status} />} />
                <InfoRow label="Target ITSM" value={<strong style={{ color: 'var(--sap-blue)' }}>{itsmSystem}</strong>} last />
              </div>
              {inc.edits && (
                <div className="alert-box alert-box-info">
                  <Info size={14} />
                  <span><strong>Source: Manual Incident Update</strong> — ticket will reflect latest values.</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
              <Btn variant="primary" onClick={onConfirm}>
                <ArrowRight size={13} /> Create {itsmSystem} Ticket
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
                {success}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Ticket created in <strong>{itsmSystem}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Incident status updated to Investigating</div>
            </div>
            <div className="modal-footer">
              <Btn variant="secondary" onClick={onClose}>Close</Btn>
              <Btn variant="primary" onClick={onClose}>View Incident</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
