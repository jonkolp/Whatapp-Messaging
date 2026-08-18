import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Smartphone, 
  Plus, 
  ArrowUpRight,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import api from '../api';
import { Header } from '../components/Header';

export const DashboardOverview: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [campRes, accRes] = await Promise.all([
          api.get('/campaigns'),
          api.get('/whatsapp/accounts')
        ]);
        if (campRes.data.success) setCampaigns(campRes.data.campaigns);
        if (accRes.data.success) setAccounts(accRes.data.accounts);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Aggregated Metrics
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + (c.delivered_count || 0), 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + (c.failed_count || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'RUNNING' || c.status === 'QUEUED').length;

  const stats = [
    { title: 'Connected Numbers', value: accounts.length, icon: Smartphone, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    { title: 'Messages Sent', value: totalSent, icon: Send, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    { title: 'Delivered', value: totalDelivered, icon: CheckCircle2, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    { title: 'Active Campaigns', value: activeCampaigns, icon: Clock, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  ];

  return (
    <div style={{ padding: '32px' }}>
      <Header
        title="Campaign Control Center"
        subtitle="Monitor your automated WhatsApp outreach and delivery pipelines in real-time."
        actionText="New Campaign"
      />

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '18px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: stat.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: stat.color
              }}>
                <Icon size={26} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>{stat.title}</span>
                <h3 style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '2px' }}>
                  {loading ? '...' : stat.value}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Recent Campaigns & Anti-Ban Protection Widget */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Recent Campaigns Card */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Recent Outreach Campaigns</h3>
            <button
              className="btn-secondary"
              onClick={() => navigate('/campaigns')}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              View All
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', padding: '20px 0' }}>Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <Send size={38} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>No campaigns launched yet.</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                Upload an Excel file to launch your first automated messaging job.
              </p>
              <button
                className="btn-primary"
                onClick={() => navigate('/campaigns/new')}
                style={{ marginTop: '18px' }}
              >
                <Plus size={16} />
                <span>Create Campaign</span>
              </button>
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Sender</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 5).map((camp) => (
                  <tr key={camp.id}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{camp.name}</td>
                    <td>{camp.sender_phone || camp.account_name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                          <div style={{
                            height: '100%',
                            width: `${camp.total_contacts ? Math.round(((camp.sent_count + camp.failed_count) / camp.total_contacts) * 100) : 0}%`,
                            background: 'var(--accent-emerald)',
                            borderRadius: '3px'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {camp.sent_count}/{camp.total_contacts}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${camp.status.toLowerCase()}`}>
                        {camp.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        onClick={() => navigate(`/campaigns/${camp.id}`)}
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Anti-Ban & Health Status Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <ShieldCheck size={22} color="var(--accent-emerald)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Anti-Ban Protection</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Your campaigns strictly abide by the Meta Safety Playbook:
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                <span>3–8s Randomized anti-ban jitter delays</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                <span>Automatic opt-out keyword detection (STOP / إلغاء)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                <span>Quiet Hours protection (11:00 PM – 8:00 AM)</span>
              </li>
            </ul>
          </div>

          {/* Quick Connect Card */}
          <div className="glass-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.05))' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '6px' }}>Meta Free Tier Tracker</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Meta provides 1,000 free user-initiated service conversation windows every calendar month.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>Monthly Service Quota</span>
              <span>1,000 / month</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '12%', background: 'var(--accent-emerald)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
