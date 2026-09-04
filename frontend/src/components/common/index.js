// ============================================================
//  Shared SAP-themed UI Components
// ============================================================
import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, X, ChevronRight, AlertTriangle } from 'lucide-react';

/* ---------- Severity Badge ---------- */
export function SeverityBadge({ sev, size = 'md' }) {
  const map = {
    P1: { label: 'P1 — Critical', cls: 'badge-p1' },
    P2: { label: 'P2 — High',     cls: 'badge-p2' },
    P3: { label: 'P3 — Medium',   cls: 'badge-p3' },
    P4: { label: 'P4 — Low',      cls: 'badge-p4' },
  };
  const m = map[sev] || { label: sev, cls: 'badge-neutral' };
  return (
    <span className={`badge ${m.cls}`} style={{ fontSize: size === 'sm' ? 11 : 12, padding: size === 'sm' ? '2px 7px' : '2px 9px' }}>
      {size === 'sm' ? sev : m.label}
    </span>
  );
}

/* ---------- Status Pill ---------- */
const STATUS_COLORS = {
  'New': '#B87200', 'Investigating': '#0070F2', 'Remediation Running': '#0070F2',
  'Resolved': '#107869', 'Auto-Remediated': '#107869', 'Escalated': '#BB0000',
  'Closed': '#8C94A2', 'Open': '#D14900', 'Monitoring': '#5A6473', 'In Progress': '#0070F2',
};
export function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || '#8C94A2';
  return (
    <span className="status-pill">
      <span className="status-dot" style={{ background: color }} />
      {status}
    </span>
  );
}

/* ---------- Category Chip ---------- */
const CATEGORY_COLORS = {
  'Authentication': { bg: '#FFF0E8', color: '#D14900' },
  'Authorization':  { bg: '#FFF0E8', color: '#D14900' },
  'Connectivity':   { bg: '#E8F2FF', color: '#0070F2' },
  'Timeout':        { bg: '#FFF8E6', color: '#B87200' },
  'Message Mapping':{ bg: '#F0F0FF', color: '#6B3FA0' },
  'Certificate':    { bg: '#FFEEEE', color: '#BB0000' },
  'Adapter Error':  { bg: '#EEF3F3', color: '#506C6C' },
  'Transformation': { bg: '#F0F0FF', color: '#6B3FA0' },
  'Routing':        { bg: '#E8F2FF', color: '#0070F2' },
  'Validation':     { bg: '#FFF8E6', color: '#B87200' },
  'Runtime Exception': { bg: '#FFEEEE', color: '#BB0000' },
  'Endpoint Failure':  { bg: '#FFEEEE', color: '#BB0000' },
};
export function CategoryChip({ category }) {
  const s = CATEGORY_COLORS[category] || { bg: '#EEF0F3', color: '#5A6473' };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 9px', borderRadius: 4,
      fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {category}
    </span>
  );
}

/* ---------- Card ---------- */
export function Card({ children, style, className = '', onClick }) {
  return (
    <div className={`card ${className}`} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

/* ---------- Buttons ---------- */
export function Btn({ children, variant = 'secondary', size = '', onClick, disabled, style, type }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${size ? `btn-${size}` : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

/* ---------- Toast ---------- */
export function Toast({ message, type = 'default', onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className={`toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : type === 'error' ? <XCircle size={16} /> : null}
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}><X size={14} /></button>
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Drawer ---------- */
export function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </>
  );
}

/* ---------- Info Row ---------- */
export function InfoRow({ label, value, last }) {
  return (
    <div className="info-row" style={last ? { borderBottom: 'none' } : {}}>
      <span className="info-key">{label}</span>
      <span className="info-val">{value}</span>
    </div>
  );
}

/* ---------- Field ---------- */
export function Field({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : undefined }}>
        {value || '—'}
      </div>
    </div>
  );
}

/* ---------- Section heading ---------- */
export function SectionHead({ title, subtitle, actions }) {
  return (
    <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

/* ---------- Timeline item ---------- */
const TL_ICONS = { done: CheckCircle2, failed: XCircle, pending: Clock };
const TL_COLORS = { done: 'var(--sap-success)', failed: 'var(--sap-critical)', pending: 'var(--text-muted)' };
export function TimelineItem({ status, title, detail, time, isLast }) {
  const Icon = TL_ICONS[status] || Clock;
  return (
    <div className="timeline-item">
      <div className="timeline-rail">
        <Icon size={16} color={TL_COLORS[status] || 'var(--text-muted)'} />
        {!isLast && <div className="timeline-connector" />}
      </div>
      <div className="timeline-content">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="timeline-title">{title}</span>
          {time && <span className="timeline-time">{time}</span>}
        </div>
        {detail && <div className="timeline-detail">{detail}</div>}
      </div>
    </div>
  );
}

/* ---------- Progress Bar ---------- */
export function ProgressBar({ value, max, color, height = 8 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="progress-bar-track" style={{ height }}>
      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? 4 : 0 }} />
    </div>
  );
}

/* ---------- Filter Select ---------- */
export function FilterSelect({ label, value, options, onChange }) {
  return (
    <select
      className="select"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: 'auto', minWidth: 140, height: 34, padding: '0 10px', fontSize: 12.5 }}
    >
      {options.map(o => (
        <option key={o.value || o} value={o.value || o}>
          {o.label || (label ? `${label}: ${o}` : o)}
        </option>
      ))}
    </select>
  );
}

/* ---------- Breadcrumb ---------- */
export function Breadcrumb({ items }) {
  return (
    <div className="breadcrumb">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={12} className="breadcrumb-sep" />}
          {item.onClick
            ? <button onClick={item.onClick}>{item.label}</button>
            : <span style={{ color: i === items.length - 1 ? 'var(--text-primary)' : undefined }}>{item.label}</span>
          }
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- Alert Box ---------- */
export function AlertBox({ type = 'info', icon, children }) {
  return (
    <div className={`alert-box alert-box-${type}`}>
      {icon || <AlertTriangle size={15} />}
      <div>{children}</div>
    </div>
  );
}

/* ---------- KPI Card ---------- */
export function KpiCard({ label, value, sub, icon, color, onClick }) {
  return (
    <div className={`kpi-card${onClick ? ' clickable' : ''}`} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value" style={color ? { color } : {}}>{value}</div>
          {sub && <div className="kpi-sub">{sub}</div>}
        </div>
        {icon && (
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: color ? `${color}18` : 'var(--border-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: color || 'var(--text-muted)',
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({ on, onChange }) {
  return (
    <button
      className="toggle"
      style={{ background: on ? 'var(--sap-blue)' : 'var(--border-strong)' }}
      onClick={() => onChange(!on)}
    >
      <span className="toggle-thumb" style={{ left: on ? 19 : 3 }} />
    </button>
  );
}

/* ---------- Empty State ---------- */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/* ---------- Loading Skeleton ---------- */
export function SkeletonBlock({ height = 40, width = '100%', style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}
