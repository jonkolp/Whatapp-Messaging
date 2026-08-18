import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RotateCcw, 
  Pause, 
  Play, 
  XOctagon,
  RefreshCw,
  Trash2,
  Download,
  Filter,
  Search
} from 'lucide-react';
import api from '../api';
import { Header } from '../components/Header';
import { ConfirmModal } from '../components/ConfirmModal';

export const CampaignDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [contactStatusFilter, setContactStatusFilter] = useState('ALL');
  const [contactSearch, setContactSearch] = useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCampaignData = async () => {
    try {
      const [campRes, msgRes] = await Promise.all([
        api.get(`/campaigns/${id}`),
        api.get(`/campaigns/${id}/messages`)
      ]);

      if (campRes.data.success) {
        setCampaign(campRes.data.campaign);
        setContacts(campRes.data.contacts || []);
      }
      if (msgRes.data.success) {
        setMessages(msgRes.data.messages || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignData();
    const interval = setInterval(fetchCampaignData, 4000);
    return () => clearInterval(interval);
  }, [id]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await api.post(`/campaigns/${id}/start`);
      fetchCampaignData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to start campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await api.post(`/campaigns/${id}/pause`);
      fetchCampaignData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to pause campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this campaign? Pending contacts will not be sent.')) return;
    setActionLoading(true);
    try {
      await api.post(`/campaigns/${id}/cancel`);
      fetchCampaignData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    setActionLoading(true);
    try {
      await api.post(`/campaigns/${id}/retry-failed`);
      fetchCampaignData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to retry failed contacts');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/campaigns/${id}`);
      if (res.data.success) {
        navigate('/campaigns');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete campaign.');
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  const handleExportCsv = () => {
    if (!contacts.length) return;
    const headers = ['Phone Number', 'Status', 'Sent At', 'Error Details'];
    const rows = contacts.map(c => [
      `"${c.phone_e164}"`,
      `"${c.status}"`,
      `"${c.sent_at || ''}"`,
      `"${(c.error_message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${campaign.name.replace(/\s+/g, '_')}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !campaign) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <RefreshCw size={28} className="spin" style={{ margin: '40px auto 12px auto' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading campaign details...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ padding: '32px' }}>
        <button className="btn-secondary" onClick={() => navigate('/campaigns')} style={{ marginBottom: '20px' }}>
          <ArrowLeft size={16} />
          <span>Back to Campaigns</span>
        </button>
        <p style={{ color: '#f87171' }}>Campaign not found.</p>
      </div>
    );
  }

  const processedCount = (campaign.sent_count || 0) + (campaign.failed_count || 0);
  const percentComplete = campaign.total_contacts ? Math.round((processedCount / campaign.total_contacts) * 100) : 0;

  const filteredContacts = contacts.filter(c => {
    const matchesStatus = contactStatusFilter === 'ALL' || c.status === contactStatusFilter;
    const matchesSearch = !contactSearch || c.phone_e164.includes(contactSearch);
    return matchesStatus && matchesSearch;
  });

  return (
    <div style={{ padding: '32px' }}>
      <Header
        title={campaign.name}
        subtitle={`Sender Number: ${campaign.sender_phone || 'Default'} (${campaign.account_name || 'WhatsApp Account'})`}
        backTo="/campaigns"
        backLabel="Campaigns"
        badge={
          <span className={`badge badge-${campaign.status.toLowerCase()}`}>
            {campaign.status}
          </span>
        }
      />

      {/* Top Action Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Created: <strong>{new Date(campaign.created_at).toLocaleDateString()}</strong>
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {campaign.status === 'DRAFT' && (
            <button className="btn-primary" onClick={handleStart} disabled={actionLoading}>
              <Play size={16} />
              <span>Start Dispatch</span>
            </button>
          )}

          {campaign.status === 'RUNNING' && (
            <button className="btn-secondary" onClick={handlePause} disabled={actionLoading}>
              <Pause size={16} />
              <span>Pause</span>
            </button>
          )}

          {campaign.failed_count > 0 && (
            <button className="btn-secondary" onClick={handleRetryFailed} disabled={actionLoading}>
              <RotateCcw size={16} />
              <span>Retry {campaign.failed_count} Failed</span>
            </button>
          )}

          {['RUNNING', 'QUEUED', 'PAUSED'].includes(campaign.status) && (
            <button className="btn-danger" onClick={handleCancel} disabled={actionLoading}>
              <XOctagon size={16} />
              <span>Cancel</span>
            </button>
          )}

          <button className="btn-secondary" onClick={handleExportCsv} title="Download CSV Report">
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button
            className="btn-danger"
            onClick={() => setDeleteModalOpen(true)}
            title="Delete this campaign"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Progress Matrix */}
      <div className="glass-card" style={{ padding: '28px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '1rem', fontWeight: '700' }}>Campaign Execution Progress</span>
          <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-emerald)' }}>
            {percentComplete}%
          </span>
        </div>

        <div style={{ height: '10px', background: 'var(--bg-input)', borderRadius: '5px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{
            height: '100%',
            width: `${percentComplete}%`,
            background: campaign.status === 'FAILED' ? '#f43f5e' : 'linear-gradient(90deg, #10b981, #34d399)',
            transition: 'width 0.4s ease'
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Total Contacts</span>
            <h4 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '4px' }}>{campaign.total_contacts}</h4>
          </div>

          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: '600' }}>Sent</span>
            <h4 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '4px', color: '#34d399' }}>{campaign.sent_count}</h4>
          </div>

          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#818cf8', textTransform: 'uppercase', fontWeight: '600' }}>Delivered</span>
            <h4 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '4px', color: '#818cf8' }}>{campaign.delivered_count || 0}</h4>
          </div>

          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', fontWeight: '600' }}>Failed</span>
            <h4 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '4px', color: '#f87171' }}>{campaign.failed_count || 0}</h4>
          </div>
        </div>
      </div>

      {/* Message Stream Table */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Recipient Delivery Stream</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Real-time status of each enrolled contact</p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '0.825rem', width: '180px', padding: '6px 12px 6px 32px' }}
                placeholder="Search phone..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
              />
            </div>

            {/* Filter */}
            <select
              className="form-select"
              value={contactStatusFilter}
              onChange={e => setContactStatusFilter(e.target.value)}
              style={{ fontSize: '0.825rem', padding: '6px 12px', width: '140px' }}
            >
              <option value="ALL">All Contacts</option>
              <option value="SENT">Sent</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>

            <button className="btn-secondary" onClick={fetchCampaignData} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {filteredContacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
            <p>No contacts found matching the filters.</p>
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Recipient Phone</th>
                <th>Status</th>
                <th>Message Preview</th>
                <th>Sent Time</th>
                <th>Error Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{c.phone_e164}</td>
                  <td>
                    <span className={`badge badge-${c.status.toLowerCase()}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {campaign.message_body}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {c.sent_at ? new Date(c.sent_at).toLocaleTimeString() : '—'}
                  </td>
                  <td style={{ color: '#f87171', fontSize: '0.8rem' }}>
                    {c.error_message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Campaign"
        message={`Are you sure you want to delete "${campaign.name}"? This action cannot be undone.`}
        confirmText="Delete Campaign"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
};
