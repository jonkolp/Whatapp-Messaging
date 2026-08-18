import React, { useEffect, useState } from 'react';
import { 
  ListFilter, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Terminal, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import api from '../api';
import { Header } from '../components/Header';
import { ConfirmModal } from '../components/ConfirmModal';

export const MessageLogs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'MESSAGES' | 'BACKEND_ERRORS'>('MESSAGES');

  // WhatsApp Message Logs State
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('ALL');
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [searchPhone, setSearchPhone] = useState('');

  // Backend System/Error Logs State
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logLevelFilter, setLogLevelFilter] = useState('ALL');
  const [searchLogText, setSearchLogText] = useState('');
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchCampaignMessages = async () => {
    setLoadingMessages(true);
    try {
      const campRes = await api.get('/campaigns');
      if (campRes.data.success) {
        setCampaigns(campRes.data.campaigns);
        if (selectedCampaignId === 'ALL' && campRes.data.campaigns.length > 0) {
          const firstId = campRes.data.campaigns[0].id;
          const msgRes = await api.get(`/campaigns/${firstId}/messages`);
          if (msgRes.data.success) setMessages(msgRes.data.messages);
        } else if (selectedCampaignId !== 'ALL') {
          const msgRes = await api.get(`/campaigns/${selectedCampaignId}/messages`);
          if (msgRes.data.success) setMessages(msgRes.data.messages);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchSystemLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get(`/system/logs?level=${logLevelFilter}`);
      if (res.data.success) {
        setSystemLogs(res.data.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogsConfirm = async () => {
    setClearing(true);
    try {
      await api.delete('/system/logs');
      fetchSystemLogs();
      setClearModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'MESSAGES') {
      fetchCampaignMessages();
    } else {
      fetchSystemLogs();
    }
  }, [activeTab, selectedCampaignId, logLevelFilter]);

  const filteredMessages = messages.filter(m => 
    !searchPhone || (m.recipient_phone && m.recipient_phone.includes(searchPhone))
  );

  const filteredSystemLogs = systemLogs.filter(l => 
    !searchLogText || 
    (l.message && l.message.toLowerCase().includes(searchLogText.toLowerCase())) ||
    (l.context && l.context.toLowerCase().includes(searchLogText.toLowerCase()))
  );

  return (
    <div style={{ padding: '32px' }}>
      <Header
        title="Logs & System Diagnostics"
        subtitle="Inspect real-time WhatsApp delivery receipts and backend error logs."
        backTo="/"
        backLabel="Dashboard"
      />

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('MESSAGES')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: activeTab === 'MESSAGES' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            border: activeTab === 'MESSAGES' ? '1px solid var(--accent-emerald)' : '1px solid transparent',
            color: activeTab === 'MESSAGES' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem'
          }}
        >
          <FileText size={16} />
          <span>WhatsApp Message Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('BACKEND_ERRORS')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: activeTab === 'BACKEND_ERRORS' ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
            border: activeTab === 'BACKEND_ERRORS' ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid transparent',
            color: activeTab === 'BACKEND_ERRORS' ? '#f87171' : 'var(--text-secondary)',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem'
          }}
        >
          <Terminal size={16} />
          <span>Backend Error & Server Logs</span>
        </button>
      </div>

      {/* Tab 1: WhatsApp Message Logs */}
      {activeTab === 'MESSAGES' && (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="Search by recipient phone number..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ width: '260px' }}
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button className="btn-secondary" onClick={fetchCampaignMessages} style={{ padding: '10px 14px' }}>
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="glass-card" style={{ padding: '8px' }}>
            {loadingMessages ? (
              <p style={{ color: 'var(--text-muted)', padding: '24px' }}>Loading logs...</p>
            ) : filteredMessages.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '32px', textAlign: 'center' }}>No log entries found for this campaign.</p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Provider Msg ID</th>
                    <th>Status</th>
                    <th>Message Snippet</th>
                    <th>Timestamp</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMessages.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{m.recipient_phone}</td>
                      <td>
                        <code style={{ color: 'var(--accent-emerald)', fontSize: '0.75rem' }}>
                          {m.provider_message_id ? m.provider_message_id.slice(0, 18) + '...' : '—'}
                        </code>
                      </td>
                      <td>
                        <span className={`badge badge-${m.status.toLowerCase()}`}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.message_content}
                      </td>
                      <td>{new Date(m.created_at).toLocaleString()}</td>
                      <td style={{ color: '#f87171', fontSize: '0.8rem' }}>{m.error_code || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Tab 2: Backend Error & Server Logs */}
      {activeTab === 'BACKEND_ERRORS' && (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="Search server errors, context, or stack trace..."
                value={searchLogText}
                onChange={(e) => setSearchLogText(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ width: '180px' }}
              value={logLevelFilter}
              onChange={(e) => setLogLevelFilter(e.target.value)}
            >
              <option value="ALL">All Levels</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
            </select>

            <button className="btn-secondary" onClick={fetchSystemLogs} style={{ padding: '10px 14px' }}>
              <RefreshCw size={16} />
            </button>

            <button className="btn-danger" onClick={() => setClearModalOpen(true)} style={{ padding: '10px 14px' }}>
              <Trash2 size={16} />
              <span>Clear Logs</span>
            </button>
          </div>

          <div className="glass-card" style={{ padding: '16px', background: '#090d16' }}>
            {loadingLogs ? (
              <p style={{ color: 'var(--text-muted)', padding: '24px' }}>Fetching system error logs...</p>
            ) : filteredSystemLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <CheckCircle2 size={40} color="var(--accent-emerald)" style={{ marginBottom: '10px' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#34d399' }}>Clean System State</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  No backend errors or warnings logged in the server buffer.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredSystemLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: log.level === 'ERROR' ? 'rgba(244, 63, 94, 0.08)' : log.level === 'WARN' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${log.level === 'ERROR' ? 'rgba(244, 63, 94, 0.25)' : log.level === 'WARN' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: '8px',
                      padding: '14px 16px',
                      fontFamily: 'monospace',
                      fontSize: '0.825rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge badge-${log.level === 'ERROR' ? 'failed' : log.level === 'WARN' ? 'paused' : 'running'}`}>
                          {log.level}
                        </span>
                        {log.context && (
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: '600' }}>
                            [{log.context}]
                          </span>
                        )}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ color: log.level === 'ERROR' ? '#fca5a5' : 'var(--text-primary)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                      {log.message}
                    </div>

                    {log.details && (
                      <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '6px', marginTop: '8px', color: '#93c5fd', fontSize: '0.75rem' }}>
                        <strong>Payload:</strong> {JSON.stringify(log.details)}
                      </div>
                    )}

                    {log.stack && (
                      <div style={{ background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '6px', marginTop: '8px', color: '#fda4af', fontSize: '0.72rem', overflowX: 'auto' }}>
                        {log.stack}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Clear Logs Confirm Modal */}
      <ConfirmModal
        isOpen={clearModalOpen}
        title="Clear Backend Diagnostics"
        message="Are you sure you want to flush all system error logs and buffer history from SQLite?"
        confirmText="Clear All Logs"
        variant="danger"
        loading={clearing}
        onConfirm={handleClearLogsConfirm}
        onCancel={() => setClearModalOpen(false)}
      />
    </div>
  );
};
