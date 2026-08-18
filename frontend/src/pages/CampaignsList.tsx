import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
   Send, 
   Plus, 
   Search, 
   Filter, 
   Eye, 
   Trash2, 
   Play, 
   Pause, 
   RefreshCw,
   CheckCircle2,
   AlertCircle,
   Clock
 } from 'lucide-react';
import api from '../api';
import { Header } from '../components/Header';
import { ConfirmModal } from '../components/ConfirmModal';

export const CampaignsList: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Deletion state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCampaigns = async () => {
    try {
      setRefreshing(true);
      const res = await api.get('/campaigns');
      if (res.data.success) {
        setCampaigns(res.data.campaigns);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/campaigns/${campaignToDelete.id}`);
      if (res.data.success) {
        setCampaigns(prev => prev.filter(c => c.id !== campaignToDelete.id));
        setDeleteModalOpen(false);
        setCampaignToDelete(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete campaign.');
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickStart = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.post(`/campaigns/${id}/start`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to start campaign');
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.sender_phone && c.sender_phone.includes(searchTerm));
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const countByStatus = (status: string) => {
    if (status === 'ALL') return campaigns.length;
    return campaigns.filter(c => c.status === status).length;
  };

  return (
    <div style={{ padding: '32px' }}>
      <Header
        title="WhatsApp Campaigns"
        subtitle="Manage, launch, inspect, and delete your automated outreach campaigns."
        backTo="/"
        backLabel="Dashboard"
        actionText="New Campaign"
        onAction={() => navigate('/campaigns/new')}
      />

      {/* Filter & Action Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '42px' }}
            placeholder="Search by campaign name or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'RUNNING', label: 'Running', color: '#10b981' },
            { id: 'COMPLETED', label: 'Completed', color: '#8b5cf6' },
            { id: 'DRAFT', label: 'Draft', color: '#94a3b8' },
            { id: 'PAUSED', label: 'Paused', color: '#f59e0b' },
            { id: 'FAILED', label: 'Failed', color: '#f43f5e' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: statusFilter === tab.id ? '1px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                background: statusFilter === tab.id ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                color: statusFilter === tab.id ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                fontSize: '0.825rem',
                fontWeight: statusFilter === tab.id ? '700' : '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.color && (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tab.color }} />
              )}
              <span>{tab.label}</span>
              <span style={{
                background: statusFilter === tab.id ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-input)',
                padding: '1px 6px',
                borderRadius: '999px',
                fontSize: '0.75rem'
              }}>
                {countByStatus(tab.id)}
              </span>
            </button>
          ))}

          <button
            onClick={fetchCampaigns}
            className="btn-secondary"
            title="Refresh Campaigns"
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px auto' }} />
          <p>Loading campaigns...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Send size={44} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>No Campaigns Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px', maxWidth: '420px', margin: '6px auto 20px auto' }}>
            {searchTerm || statusFilter !== 'ALL' ? 'No campaigns matched your filters.' : 'Get started by creating your first WhatsApp outreach campaign.'}
          </p>
          <button className="btn-primary" onClick={() => navigate('/campaigns/new')}>
            <Plus size={16} />
            <span>Create Campaign</span>
          </button>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '8px', overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Sender Phone</th>
                <th>Audience</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((camp) => {
                const total = camp.total_contacts || 0;
                const processed = (camp.sent_count || 0) + (camp.failed_count || 0);
                const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

                return (
                  <tr key={camp.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/campaigns/${camp.id}`)}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{camp.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{camp.sender_phone || camp.account_name}</td>
                    <td>
                      <strong>{camp.total_contacts}</strong> contacts
                    </td>
                    <td style={{ minWidth: '160px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${percent}%`,
                            background: camp.status === 'FAILED' ? '#f43f5e' : 'var(--accent-emerald)',
                            borderRadius: '3px'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '40px' }}>
                          {camp.sent_count}/{camp.total_contacts}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${camp.status.toLowerCase()}`}>
                        {camp.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {new Date(camp.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }} onClick={e => e.stopPropagation()}>
                        {camp.status === 'DRAFT' && (
                          <button
                            className="btn-primary"
                            onClick={(e) => handleQuickStart(e, camp.id)}
                            style={{ padding: '6px 10px', fontSize: '0.775rem' }}
                            title="Start Campaign"
                          >
                            <Play size={13} />
                            <span>Start</span>
                          </button>
                        )}

                        <button
                          className="btn-secondary"
                          onClick={() => navigate(`/campaigns/${camp.id}`)}
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          title="Inspect Details"
                        >
                          <Eye size={14} />
                          <span>Details</span>
                        </button>

                        <button
                          className="btn-danger"
                          onClick={() => {
                            setCampaignToDelete(camp);
                            setDeleteModalOpen(true);
                          }}
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          title="Delete Campaign"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Campaign"
        message={`Are you sure you want to delete "${campaignToDelete?.name}"? All associated contacts and message logs for this campaign will be permanently removed.`}
        confirmText="Delete Campaign"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteModalOpen(false);
          setCampaignToDelete(null);
        }}
      />
    </div>
  );
};
