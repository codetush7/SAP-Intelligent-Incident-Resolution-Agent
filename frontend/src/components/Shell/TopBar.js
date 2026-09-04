import React, { useState } from 'react';
import { Search, Bell, RefreshCw, HelpCircle, X } from 'lucide-react';

export default function TopBar({ user, notifications = [], notifOpen, setNotifOpen }) {
  const initials = user
    ? `${(user.firstName || user.name || 'U')[0]}${(user.lastName || '')[0] || ''}`.toUpperCase()
    : 'U';
  const displayName = user ? `${user.firstName || user.name || 'User'} ${user.lastName || ''}`.trim() : 'User';
  const unread = notifications.filter(n => !n.read).length;

  return (
    <header className="topbar">
      {/* Search */}
      <div className="topbar-search">
        <Search size={14} className="topbar-search-icon" />
        <input
          className="input"
          placeholder="Search incidents, tickets, artifacts..."
          style={{ height: 34, fontSize: 13 }}
        />
      </div>

      <div className="topbar-actions">
        <span className="topbar-sync">Updated just now</span>

        {/* Refresh */}
        <button className="topbar-icon-btn" title="Refresh">
          <RefreshCw size={14} />
        </button>

        {/* Help */}
        <button className="topbar-icon-btn" title="Help">
          <HelpCircle size={14} />
        </button>

        {/* Notifications */}
        <button
          className="topbar-icon-btn"
          title="Notifications"
          onClick={() => setNotifOpen(o => !o)}
        >
          <Bell size={14} />
          {unread > 0 && <span className="topbar-notif-dot" />}
        </button>

        {/* User chip */}
        <div className="topbar-user-chip">
          <div className="topbar-avatar">{initials}</div>
          <span className="topbar-username">{displayName}</span>
        </div>
      </div>

      {/* Notification drawer */}
      {notifOpen && (
        <NotifDrawer notifications={notifications} onClose={() => setNotifOpen(false)} />
      )}
    </header>
  );
}

const NOTIF_COLOR = {
  critical: 'var(--sap-critical)',
  warning:  'var(--sap-medium)',
  info:     'var(--sap-info)',
  success:  'var(--sap-success)',
};

function NotifDrawer({ notifications, onClose }) {
  const items = notifications.length > 0 ? notifications : [
    { kind: 'critical', title: 'Sales_Order_Processing unavailable', sub: 'P1 incident — SNOW-10291', t: '09:58 AM' },
    { kind: 'warning',  title: 'Vendor_Invoice_Sync certificate expired', sub: 'P3 incident — JIRA-4815', t: '07:52 AM' },
    { kind: 'warning',  title: 'Customer_Master_Sync timeouts', sub: 'Remediation failed', t: '10:12 AM' },
    { kind: 'info',     title: 'Payment_Order_Integration resolved', sub: 'Auto-remediated — no ticket', t: '10:43 AM' },
    { kind: 'critical', title: 'Material_Stock_Movement data-loss risk', sub: 'P1 incident — IRIS-78421', t: '07:15 AM' },
  ];

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 140 }}
        onClick={onClose}
      />
      <div className="notif-drawer" style={{ zIndex: 150 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {items.map((n, i) => (
            <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                  color: NOTIF_COLOR[n.kind] || 'var(--text-muted)',
                }}>
                  {n.kind || n.type}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{n.t || n.timestamp}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title || n.message}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{n.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
