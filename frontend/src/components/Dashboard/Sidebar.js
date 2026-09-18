import React, { useState } from 'react';
import {
  LayoutGrid, AlertTriangle, Waypoints, Wrench, Ticket, Bot,
  BarChart3, ScrollText, Settings, Sparkles, LogOut, Link2,
  Radio, ChevronRight, Activity,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { key: 'overview',      label: 'Overview',       icon: LayoutGrid },
      { key: 'incidents',     label: 'Incidents',      icon: AlertTriangle },
      { key: 'integrations',  label: 'Integrations',   icon: Waypoints },
    ],
  },
  {
    label: 'Automation',
    items: [
      { key: 'remediation',   label: 'Remediation',    icon: Wrench },
      { key: 'agent',         label: 'AI Agent',       icon: Bot },
      { key: 'alerts',        label: 'Alerts',         icon: Radio },
    ],
  },
  {
    label: 'ITSM',
    items: [
      { key: 'tickets',       label: 'Tickets',        icon: Ticket },
    ],
  },
  {
    label: 'Insights',
    items: [
      { key: 'analytics',     label: 'Analytics',      icon: BarChart3 },
      { key: 'audit',         label: 'Audit Logs',     icon: ScrollText },
    ],
  },
  {
    label: 'Administration',
    items: [
      { key: 'settings',      label: 'Settings',       icon: Settings },
      { key: 'tenant',        label: 'Tenant Connection', icon: Link2 },
      { key: 'itsm-connect',  label: 'ITSM Connection',   icon: Activity },
    ],
  },
];

export default function Sidebar({ activePage, onNavigate, user, onLogout }) {
  const initials = user
    ? `${(user.firstName || user.name || 'U')[0]}${(user.lastName || '')[0] || ''}`.toUpperCase()
    : 'U';
  const displayName = user
    ? `${user.firstName || user.name || 'User'} ${user.lastName || ''}`.trim()
    : 'User';
  const role = user?.role || 'Integration Ops';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Sparkles size={15} color="#fff" />
        </div>
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-name">CPI Intelligent Ops</div>
          <div className="sidebar-logo-sub">SAP Cloud Integration</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <div className="sidebar-section-label">{group.label}</div>
            {group.items.map(item => {
              const Icon = item.icon;
              const active = activePage === item.key || activePage.startsWith(item.key + '-');
              return (
                <button
                  key={item.key}
                  className={`nav-item${active ? ' active' : ''}`}
                  onClick={() => onNavigate(item.key)}
                >
                  <Icon size={15} strokeWidth={2} />
                  {item.label}
                  {active && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Production badge */}
        <div className="sidebar-env-badge">
          <span className="conn-dot-green" />
          <span>PRODUCTION</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#5A7A96', fontWeight: 400 }}>CPI Ops v1.0</span>
        </div>

        {/* User */}
        <div className="sidebar-user" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="sidebar-avatar">{initials}</div>
            <div>
              <div className="sidebar-user-name">{displayName}</div>
              <div className="sidebar-user-role">{role}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            style={{ color: '#5A7A96', padding: 6, borderRadius: 4, transition: 'color 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#BB0000'}
            onMouseLeave={e => e.currentTarget.style.color = '#5A7A96'}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}