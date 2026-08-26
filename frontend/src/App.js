import React, { useState, useCallback } from 'react';
import './App.css';
import Sidebar from './components/Dashboard/Sidebar';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import MonitoringPage from './pages/MonitoringPage';
import AgentPage from './pages/AgentPage';
import AnalysisPage from './pages/AnalysisPage';
import TenantConnectPage from './pages/TenantConnectPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useWebSocket } from './hooks/useWebSocket';

function AuthenticatedApp() {
  const [activePage, setActivePage] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const { user, logout } = useAuth();

  const handleWsMessage = useCallback((msg) => {
    const { type, data } = msg;
    if (['ticket_created', 'new_alert', 'agent_activity'].includes(type)) {
      const notif = { id: Date.now(), type, message: data?.message || msg.message || 'System event', timestamp: new Date().toISOString() };
      setNotifications(prev => [notif, ...prev].slice(0, 20));
    }
    setLiveEvents(prev => [{ type, data, timestamp: msg.timestamp }, ...prev].slice(0, 50));
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  const pages = {
    dashboard: <DashboardPage liveEvents={liveEvents} wsConnected={connected} />,
    tickets: <TicketsPage liveEvents={liveEvents} />,
    monitoring: <MonitoringPage wsConnected={connected} />,
    agent: <AgentPage />,
    analysis: <AnalysisPage />,
    tenants: <TenantConnectPage />
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        wsConnected={connected}
        notifications={notifications}
        user={user}
        onLogout={logout}
      />
      <main className="app-main">
        <div className="page-content animate-in">
          {pages[activePage] || pages.dashboard}
        </div>
      </main>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState('login');

  if (loading) return <div className="app-loading">Loading...</div>;
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