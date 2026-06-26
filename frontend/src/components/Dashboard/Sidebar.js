import React, { useState } from 'react';
import {
  LayoutDashboard, Ticket, Activity, Bot, Search,
  Wifi, WifiOff, Bell, ChevronRight, Zap, Settings
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'agent', label: 'AI Agent', icon: Bot },
  { id: 'analysis', label: 'Analysis', icon: Search }
];

export default function Sidebar({ activePage, onNavigate, wsConnected, notifications }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

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
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>SAP CPI</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>Ticketing Agent</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '4px 8px 8px' }}>
          Navigation
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 10px', borderRadius: 8, marginBottom: 2,
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: active ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                fontSize: 13, fontWeight: active ? 600 : 400,
                transition: 'all 0.15s', cursor: 'pointer'
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={16} />
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {active && <ChevronRight size={12} />}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
        {/* Notifications */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 10px', borderRadius: 8, background: 'transparent',
              color: 'var(--text-secondary)', border: '1px solid transparent',
              fontSize: 13, cursor: 'pointer'
            }}
          >
            <Bell size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Notifications</span>
            {unread > 0 && (
              <span style={{
                background: 'var(--accent-red)', color: 'white',
                borderRadius: '10px', padding: '1px 6px', fontSize: 10, fontWeight: 700
              }}>{unread}</span>
            )}
          </button>

          {showNotifs && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 8, marginBottom: 4,
              maxHeight: 200, overflowY: 'auto', zIndex: 100
            }}>
              {notifications.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 4px' }}>No notifications</p>
              ) : notifications.slice(0, 10).map(n => (
                <div key={n.id} style={{ padding: '6px 4px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {n.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WS Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          borderRadius: 8, background: wsConnected ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${wsConnected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`
        }}>
          {wsConnected
            ? <><Wifi size={14} color="var(--accent-green)" /><span style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 500 }}>Live Connected</span></>
            : <><WifiOff size={14} color="var(--critical)" /><span style={{ fontSize: 11, color: 'var(--critical)', fontWeight: 500 }}>Disconnected</span></>
          }
          {wsConnected && <div className="live-dot" style={{ marginLeft: 'auto' }} />}
        </div>
      </div>
    </aside>
  );
}
