import React, { useState, useCallback } from 'react';
import './App.css';

// Shell
import Sidebar from './components/Dashboard/Sidebar';
import TopBar from './components/Shell/TopBar';

// Auth
import { AuthProvider, useAuth } from './context/AuthContext';
import { useWebSocket } from './hooks/useWebSocket';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Pages
import OverviewPage from './pages/OverviewPage';
import IncidentsPage from './pages/IncidentsPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import IntegrationsPage from './pages/IntegrationsPage';
import AlertsPage from './pages/AlertsPage';
import RemediationPage from './pages/RemediationPage';
import AgentPage from './pages/AgentPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';
import TenantConnectPage from './pages/TenantConnectPage';
import ITSMConnectionPage from './pages/ITSMConnectionPage';

function AuthenticatedApp() {
  const [activePage, setActivePage] = useState('overview');
  const [openIncidentId, setOpenIncidentId] = useState(null);
  const [openTicketId, setOpenTicketId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [itsmSystem, setItsmSystem] = useState('Jira');
  const [auditLog, setAuditLog] = useState([]);
  const { user, logout } = useAuth();

  const handleWsMessage = useCallback((msg) => {
    const { type, data } = msg;
    if (['ticket_created', 'new_alert', 'agent_activity'].includes(type)) {
      const notif = {
        id: Date.now(), kind: type === 'ticket_created' ? 'info' : 'warning',
        title: data?.message || msg.message || 'System event',
        sub: data?.detail || '',
        t: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      };
      setNotifications(prev => [notif, ...prev].slice(0, 20));
    }
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  function navigate(page) {
    setActivePage(page);
    setOpenIncidentId(null);
    setOpenTicketId(null);
  }

  function openIncident(id) {
    setOpenIncidentId(id);
    setActivePage('incident-detail');
  }

  function openTicket(id) {
    setOpenTicketId(id);
    setActivePage('ticket-detail');
  }

  function renderPage() {
    // Sub-pages that need detail routing
    if (activePage === 'incident-detail' && openIncidentId) {
      return (
        <IncidentDetailPage
          incidentId={openIncidentId}
          onBack={() => navigate('incidents')}
          itsmSystem={itsmSystem}
        />
      );
    }
    if (activePage === 'ticket-detail' && openTicketId) {
      return (
        <TicketDetailPage
          ticketId={openTicketId}
          onBack={() => navigate('tickets')}
        />
      );
    }

    switch (activePage) {
      case 'overview':
        return (
          <OverviewPage
            onNavigate={navigate}
            onOpenIncident={openIncident}
          />
        );
      case 'incidents':
        return (
          <IncidentsPage
            onOpenIncident={openIncident}
            itsmSystem={itsmSystem}
            auditLog={auditLog}
            setAuditLog={setAuditLog}
          />
        );
      case 'integrations':
        return <IntegrationsPage />;
      case 'remediation':
        return <RemediationPage />;
      case 'agent':
        return <AgentPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'tickets':
        return <TicketsPage onOpen={openTicket} />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'audit':
        return <AuditLogPage extraLogs={auditLog} />;
      case 'settings':
        return <SettingsPage user={user} />;
      case 'tenant':
        return <TenantConnectPage />;
      case 'itsm-connect':
        return <ITSMConnectionPage onITSMChange={setItsmSystem} />;
      default:
        return (
          <OverviewPage
            onNavigate={navigate}
            onOpenIncident={openIncident}
          />
        );
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        user={user}
        onLogout={logout}
      />
      <main className="app-main">
        <TopBar
          user={user}
          notifications={notifications}
          notifOpen={notifOpen}
          setNotifOpen={setNotifOpen}
        />
        <div className="page-scroll">
          <div className="page-content">
            {renderPage()}
          </div>
        </div>
      </main>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState('login');

  if (loading) {
    return (
      <div className="app-loading">
        <div style={{ textAlign: 'center' }}>
          <div className="spin" style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--sap-blue)', borderRadius: '50%', margin: '0 auto 12px' }} />
          Loading CPI Intelligent Operations...
        </div>
      </div>
    );
  }

  if (!user) {
    return authView === 'login'
      ? <LoginPage onSwitchToSignup={() => setAuthView('signup')} />
      : <SignupPage onSwitchToLogin={() => setAuthView('login')} />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}