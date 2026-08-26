import React, { useState } from 'react';
import {
  LayoutDashboard, Ticket, Activity, Bot, Search,
  Wifi, WifiOff, Bell, Zap, Link2, LogOut
} from 'lucide-react';

const navGroups = [
  {
    label: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }]
  },
  {
    label: 'Operations',
    items: [
      { id: 'tickets', label: 'Tickets', icon: Ticket },
      { id: 'monitoring', label: 'Monitoring', icon: Activity },
      { id: 'agent', label: 'AI Agent', icon: Bot },
      { id: 'analysis', label: 'Analysis', icon: Search }
    ]
  },
  {
    label: 'Setup',
    items: [{ id: 'tenants', label: 'Tenant Connect', icon: Link2 }]
  }
];

function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export default function Sidebar({ activePage, onNavigate, wsConnected, notifications, user, onLogout }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = (notifications || []).filter(n => !n.read).length;

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb, #0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
          }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>SAP CPI</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>AI Ticketing Agent</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
        {navGroups.map(group => (
          <div key={group.label} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '2px 10px 6px' }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 11px', borderRadius: 8, marginBottom: 2,
                    background: active ? 'var(--accent-blue-light)' : 'transparent',
                    color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    border: active ? '1px solid rgba(37,99,235,0.18)' : '1px solid transparent',
                    fontSize: 13, fontWeight: active ? 600 : 500,
                    transition: 'background 0.15s', cursor: 'pointer'
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={16} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-blue)' }} />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div style={{ padding: '10px', borderTop: '1px solid var(--border)' }}>
        {/* Notifications */}
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 11px', borderRadius: 8, background: 'transparent',
              color: 'var(--text-secondary)', border: '1px solid transparent',
              fontSize: 13, fontWeight: 500, cursor: 'pointer'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Bell size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Notifications</span>
            {unread > 0 && (
              <span style={{
                background: 'var(--critical)', color: 'white',
                borderRadius: '10px', padding: '1px 6px', fontSize: 10, fontWeight: 700
              }}>{unread}</span>
            )}
          </button>

          {showNotifs && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 8, marginBottom: 6, boxShadow: 'var(--shadow-lg)',
              maxHeight: 220, overflowY: 'auto', zIndex: 100
            }}>
              {(notifications || []).length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 6px' }}>No notifications</p>
              ) : notifications.slice(0, 10).map(n => (
                <div key={n.id} style={{ padding: '7px 6px', borderBottom: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  {n.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WS Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px',
          borderRadius: 8, background: wsConnected ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)',
          border: `1px solid ${wsConnected ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)'}`,
          marginBottom: user ? 10 : 0
        }}>
          {wsConnected
            ? <><Wifi size={14} color="var(--accent-green)" /><span style={{ fontSize: 11.5, color: 'var(--accent-green)', fontWeight: 500 }}>Live Connected</span></>
            : <><WifiOff size={14} color="var(--critical)" /><span style={{ fontSize: 11.5, color: 'var(--critical)', fontWeight: 500 }}>Disconnected</span></>
          }
          {wsConnected && <div className="live-dot" style={{ marginLeft: 'auto' }} />}
        </div>

        {/* User profile + logout */}
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 8px 8px 6px', borderRadius: 10, background: 'var(--bg-card-hover)'
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'var(--accent-blue-light)', color: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700
            }}>
              {initials(user.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Log out"
                style={{
                  background: 'transparent', color: 'var(--text-muted)',
                  padding: 6, borderRadius: 6, display: 'flex', flexShrink: 0
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--critical)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}