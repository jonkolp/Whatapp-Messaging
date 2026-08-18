import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { DashboardOverview } from './pages/DashboardOverview';
import { WhatsAppAccounts } from './pages/WhatsAppAccounts';
import { CampaignWizard } from './pages/CampaignWizard';
import { CampaignsList } from './pages/CampaignsList';
import { CampaignDetails } from './pages/CampaignDetails';
import { MessageLogs } from './pages/MessageLogs';
import { Settings } from './pages/Settings';

const ProtectedLayout: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading application...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/whatsapp" element={<WhatsAppAccounts />} />
          <Route path="/campaigns" element={<CampaignsList />} />
          <Route path="/campaigns/new" element={<CampaignWizard />} />
          <Route path="/campaigns/:id" element={<CampaignDetails />} />
          <Route path="/logs" element={<MessageLogs />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
