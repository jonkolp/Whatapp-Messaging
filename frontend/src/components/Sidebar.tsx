import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Smartphone, 
  Send, 
  FileSpreadsheet, 
  ListFilter, 
  Settings as SettingsIcon, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/whatsapp', label: 'WhatsApp Numbers', icon: Smartphone },
    { to: '/campaigns', label: 'Campaigns', icon: Send },
    { to: '/campaigns/new', label: 'New Campaign', icon: Sparkles },
    { to: '/logs', label: 'Message Logs', icon: ListFilter },
    { to: '/settings', label: 'Settings & Webhooks', icon: SettingsIcon },
  ];

  return (
    <aside style={{
      width: '260px',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0
    }}>
      {/* Brand Header */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
        }}>
          <Smartphone size={22} color="#ffffff" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', letterSpacing: '-0.01em' }}>AutoWhats</h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: '600', textTransform: 'uppercase' }}>Control Panel</span>
        </div>
      </div>

      {/* Nav List */}
      <nav style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                textDecoration: 'none',
                fontWeight: isActive ? '600' : '500',
                fontSize: '0.9rem',
                transition: 'all 0.15s ease'
              })}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user?.fullName || 'User'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user?.email}
          </span>
        </div>
        <button
          onClick={logout}
          title="Logout"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};
