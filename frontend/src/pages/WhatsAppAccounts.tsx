import React, { useEffect, useState } from 'react';
import { 
  Smartphone, 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  QrCode,
  RefreshCw,
  HelpCircle,
  Sparkles,
  Wifi,
  WifiOff,
  Server,
  Layers,
  RotateCcw,
  Check
} from 'lucide-react';
import api from '../api';
import { Header } from '../components/Header';
import { ConfirmModal } from '../components/ConfirmModal';

export const WhatsAppAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // open-wa Live Service Status
  const [openWaHealth, setOpenWaHealth] = useState<any>(null);
  const [openWaSessions, setOpenWaSessions] = useState<any[]>([]);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Meta Cloud API Form State
  const [accountName, setAccountName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // open-wa QR Code State
  const [qrGatewayUrl, setQrGatewayUrl] = useState((import.meta as any).env?.VITE_OPENWA_GATEWAY_URL || 'http://localhost:2785');
  const [qrAccountName, setQrAccountName] = useState('WhatsApp Number');
  const [qrPhoneNumber, setQrPhoneNumber] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrConfirmed, setQrConfirmed] = useState(false);
  const [activeSessionInfo, setActiveSessionInfo] = useState<any>(null);
  const [isSessionAuthenticated, setIsSessionAuthenticated] = useState(false);

  // Test Message State
  const [testRecipient, setTestRecipient] = useState('');
  const [testMsg, setTestMsg] = useState('Hello! This is a test message from your WhatsApp Automation Dashboard.');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/whatsapp/accounts');
      if (res.data.success) {
        setAccounts(res.data.accounts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkOpenWaHealth = async () => {
    setCheckingHealth(true);
    try {
      const [healthRes, sessionsRes] = await Promise.all([
        api.get(`/whatsapp/openwa/health?gatewayUrl=${encodeURIComponent(qrGatewayUrl)}`),
        api.get(`/whatsapp/openwa/sessions?gatewayUrl=${encodeURIComponent(qrGatewayUrl)}`).catch(() => ({ data: { sessions: [] } }))
      ]);

      if (healthRes.data.success) {
        setOpenWaHealth(healthRes.data.health);
      }
      if (sessionsRes.data?.sessions) {
        setOpenWaSessions(sessionsRes.data.sessions);
      }
    } catch (err) {
      setOpenWaHealth({ isOnline: false, status: 'OFFLINE', error: 'Failed to query open-wa service' });
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    checkOpenWaHealth();
  }, []);

  // 1. Meta Cloud API Add
  const handleAddMetaAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const payload = {
        accountName,
        phoneNumber,
        providerType: 'META_CLOUD_API',
        phoneNumberId,
        wabaId,
        accessToken
      };

      const res = await api.post('/whatsapp/accounts', payload);
      if (res.data.success) {
        setShowModal(false);
        setAccountName('');
        setPhoneNumber('');
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        fetchAccounts();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to connect Meta WhatsApp account.');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Fetch live dynamic QR from open-wa service
  const handleFetchLiveQr = async (forceNewSession = false, customSessionName?: string) => {
    setQrLoading(true);
    setFormError('');
    setIsSessionAuthenticated(false);
    setActiveSessionInfo(null);

    const nameToUse = customSessionName || qrAccountName || `Number-${accounts.length + 1}`;

    try {
      const res = await api.post('/whatsapp/openwa/start-session', {
        gatewayUrl: qrGatewayUrl,
        accountName: nameToUse,
        forceNew: forceNewSession
      });

      if (res.data.success) {
        setActiveSessionInfo(res.data);
        if (res.data.isAuthenticated) {
          setIsSessionAuthenticated(true);
          if (res.data.phoneNumber) {
            setQrPhoneNumber(res.data.phoneNumber.startsWith('+') ? res.data.phoneNumber : `+${res.data.phoneNumber}`);
          }
          setShowQrModal(true);
        } else {
          setQrDataUrl(res.data.qrDataUrl || '');
          setShowQrModal(true);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'open-wa service is offline or unreachable on port 2785.';
      setFormError(msg);
      setShowQrModal(true);
    } finally {
      setQrLoading(false);
      checkOpenWaHealth();
    }
  };

  // 3. Confirm open-wa QR Pairing
  const handleConfirmQrSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrPhoneNumber) return;
    setSubmitting(true);
    setFormError('');

    try {
      const res = await api.post('/whatsapp/openwa/confirm-session', {
        accountName: qrAccountName,
        phoneNumber: qrPhoneNumber,
        gatewayUrl: qrGatewayUrl,
        sessionId: activeSessionInfo?.sessionId
      });
      if (res.data.success) {
        setQrConfirmed(true);
        setTimeout(() => {
          setShowQrModal(false);
          setQrConfirmed(false);
          setQrPhoneNumber('');
          setActiveSessionInfo(null);
          setIsSessionAuthenticated(false);
          fetchAccounts();
          checkOpenWaHealth();
        }, 1200);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to register session.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Disconnect & Reset session in OpenWA
  const handleResetOpenWaSession = async (sessionId?: string) => {
    const targetId = sessionId || activeSessionInfo?.sessionId;
    if (!targetId) return;

    setQrLoading(true);
    try {
      await api.delete(`/whatsapp/openwa/sessions/${targetId}?gatewayUrl=${encodeURIComponent(qrGatewayUrl)}`);
      // Re-fetch a brand new QR session
      await handleFetchLiveQr(true);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to reset OpenWA session.');
    } finally {
      setQrLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/whatsapp/accounts/${accountToDelete.id}`);
      fetchAccounts();
      checkOpenWaHealth();
      setDeleteModalOpen(false);
      setAccountToDelete(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setTestResult(null);
    setSendingTest(true);

    try {
      const res = await api.post(`/whatsapp/accounts/${selectedAccount.id}/test`, {
        recipientPhone: testRecipient,
        message: testMsg
      });
      setTestResult({ success: true, message: res.data.message || 'Test message sent successfully!' });
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.message || 'Test message failed to deliver.' });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div style={{ padding: '32px' }}>
      <Header
        title="Connected WhatsApp Numbers"
        subtitle="Manage multiple WhatsApp numbers, Meta Cloud API accounts, and open-wa multi-sessions."
        backTo="/"
        backLabel="Dashboard"
      />

      {/* Service Health & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={() => setShowModal(true)}
          >
            <Sparkles size={16} />
            <span>Connect Meta Cloud API</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => handleFetchLiveQr(false)}
            disabled={qrLoading}
            style={{ border: '1px solid rgba(16, 185, 129, 0.4)' }}
          >
            <QrCode size={16} color="var(--accent-emerald)" />
            <span>{qrLoading ? 'Connecting...' : 'Pair Number via Live QR'}</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => handleFetchLiveQr(true, `Number-${accounts.length + 1}`)}
            disabled={qrLoading}
            title="Create and pair an additional WhatsApp number"
          >
            <Plus size={16} />
            <span>Add Additional Session</span>
          </button>
        </div>

        {/* open-wa Health Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 16px',
          borderRadius: '9999px',
          background: openWaHealth?.isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          border: `1px solid ${openWaHealth?.isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          fontSize: '0.85rem'
        }}>
          <Server size={16} color={openWaHealth?.isOnline ? 'var(--accent-emerald)' : '#f59e0b'} />
          <span style={{ fontWeight: '600', color: openWaHealth?.isOnline ? 'var(--accent-emerald)' : '#fbbf24' }}>
            open-wa ({qrGatewayUrl}): {openWaHealth?.isOnline ? `${openWaSessions.length} Engine Session(s)` : 'OFFLINE'}
          </span>
          <button
            onClick={checkOpenWaHealth}
            title="Recheck open-wa health"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={14} className={checkingHealth ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px auto' }} />
          <p>Loading connected accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Smartphone size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>No WhatsApp Numbers Connected</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '8px auto 24px auto', fontSize: '0.9rem' }}>
            Pair one or more WhatsApp numbers by scanning live QR codes or connecting official Meta Cloud API credentials.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} />
              <span>Connect Meta Cloud API</span>
            </button>
            <button className="btn-secondary" onClick={() => handleFetchLiveQr(false)}>
              <QrCode size={16} color="var(--accent-emerald)" />
              <span>Pair WhatsApp via Live QR</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {accounts.map((acc) => (
            <div key={acc.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: acc.provider_type === 'OPEN_WA' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: acc.provider_type === 'OPEN_WA' ? '#60a5fa' : 'var(--accent-emerald)'
                    }}>
                      {acc.provider_type === 'OPEN_WA' ? <QrCode size={24} /> : <Smartphone size={24} />}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{acc.account_name}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', fontWeight: '600' }}>
                        {acc.phone_number}
                      </p>
                    </div>
                  </div>
                  <span className={`badge badge-${acc.status.toLowerCase()}`}>
                    {acc.status}
                  </span>
                </div>

                <div style={{ background: 'var(--bg-input)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Provider Engine:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {acc.provider_type === 'META_CLOUD_API' ? 'Official Meta Cloud API' : 'open-wa (Baileys Engine)'}
                    </strong>
                  </div>
                  {acc.provider_type === 'META_CLOUD_API' && acc.phone_number_id && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Phone Number ID:</span>
                      <code style={{ color: 'var(--accent-emerald)' }}>{acc.phone_number_id}</code>
                    </div>
                  )}
                  {acc.provider_type === 'OPEN_WA' && acc.session_id && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Session ID:</span>
                      <code style={{ color: '#60a5fa' }}>{acc.session_id.substring(0, 16)}...</code>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Rating:</span>
                    <strong style={{ color: acc.quality_rating === 'GREEN' ? '#34d399' : 'var(--text-secondary)' }}>
                      {acc.quality_rating || 'CONNECTED'}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.825rem' }}
                  onClick={() => {
                    setSelectedAccount(acc);
                    setShowTestModal(true);
                  }}
                >
                  <Send size={14} />
                  <span>Send Test</span>
                </button>

                <button
                  className="btn-danger"
                  style={{ padding: '8px 10px' }}
                  title="Disconnect & Remove"
                  onClick={() => {
                    setAccountToDelete(acc);
                    setDeleteModalOpen(true);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Meta Cloud API Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '30px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '6px' }}>Connect Meta Cloud API</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Enter your official Meta WhatsApp Cloud API credentials.
            </p>

            {formError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#f87171',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddMetaAccount}>
              <div className="form-group">
                <label className="form-label">Account Label</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sales Support Line"
                  value={accountName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccountName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number (E.164)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="+966500000000"
                  value={phoneNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={phoneNumberId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumberId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">WhatsApp Business Account ID (WABA)</label>
                <input
                  type="text"
                  className="form-input"
                  value={wabaId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWabaId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">System User Permanent Access Token</label>
                <input
                  type="password"
                  className="form-input"
                  value={accessToken}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccessToken(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Connecting...' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* open-wa Dynamic QR Code Modal (Multi-Session Aware) */}
      {showQrModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '32px', textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-emerald)',
              marginBottom: '14px'
            }}>
              <QrCode size={28} />
            </div>

            <h3 style={{ fontSize: '1.35rem', fontWeight: '800' }}>WhatsApp Web Live QR Pairing</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px', marginBottom: '20px' }}>
              Pair any phone number directly via OpenWA Baileys Protocol engine.
            </p>

            {formError && (
              <div style={{
                padding: '14px',
                borderRadius: '8px',
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#f87171',
                fontSize: '0.85rem',
                marginBottom: '18px',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', marginBottom: '4px' }}>
                  <AlertCircle size={16} />
                  <span>Connection Notice</span>
                </div>
                <div>{formError}</div>
              </div>
            )}

            {qrConfirmed ? (
              <div style={{ padding: '30px 0' }}>
                <CheckCircle2 size={54} color="var(--accent-emerald)" style={{ marginBottom: '12px' }} />
                <h4 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#34d399' }}>Pairing Saved!</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  WhatsApp session registered and ready for outreach campaigns.
                </p>
              </div>
            ) : isSessionAuthenticated ? (
              /* Already Authenticated Session Handler */
              <div style={{ textAlign: 'left', background: 'var(--bg-input)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <CheckCircle2 size={22} color="var(--accent-emerald)" />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#34d399' }}>Active Connected Session Found</h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Session <strong>{activeSessionInfo?.accountName || 'baileys-active'}</strong> is currently active and authenticated on your engine.
                  {activeSessionInfo?.phoneNumber && (
                    <span> Linked Phone: <strong style={{ color: 'var(--accent-emerald)' }}>+{activeSessionInfo.phoneNumber.replace(/^\+/, '')}</strong></span>
                  )}
                </p>

                <form onSubmit={handleConfirmQrSession}>
                  <div className="form-group">
                    <label className="form-label">Account Label</label>
                    <input
                      type="text"
                      className="form-input"
                      value={qrAccountName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQrAccountName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirmed Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+966500000001"
                      value={qrPhoneNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQrPhoneNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={submitting || !qrPhoneNumber}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Check size={16} />
                      <span>{submitting ? 'Registering...' : 'Register / Sync This Connected Number'}</span>
                    </button>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleFetchLiveQr(true, `Number-${accounts.length + 1}`)}
                        disabled={qrLoading}
                        style={{ flex: 1, fontSize: '0.8rem' }}
                      >
                        <Plus size={14} />
                        <span>Pair Additional New Number</span>
                      </button>

                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleResetOpenWaSession()}
                        disabled={qrLoading}
                        style={{ flex: 1, fontSize: '0.8rem' }}
                      >
                        <RotateCcw size={14} />
                        <span>Disconnect & Rescan</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <>
                {/* QR Code Container */}
                {qrDataUrl ? (
                  <div style={{
                    display: 'inline-block',
                    padding: '16px',
                    background: '#ffffff',
                    borderRadius: '16px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    marginBottom: '16px'
                  }}>
                    <img
                      src={qrDataUrl}
                      alt="WhatsApp Web Live QR Code"
                      style={{ width: '220px', height: '220px', display: 'block' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    padding: '28px',
                    background: 'var(--bg-input)',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem'
                  }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
                    <span>Generating live Baileys QR code from engine...</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleFetchLiveQr(false)}
                    disabled={qrLoading}
                    style={{ fontSize: '0.825rem', padding: '6px 14px' }}
                  >
                    <RefreshCw size={14} className={qrLoading ? 'spin' : ''} />
                    <span>Refresh QR</span>
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleFetchLiveQr(true, `Number-${accounts.length + 1}`)}
                    disabled={qrLoading}
                    style={{ fontSize: '0.825rem', padding: '6px 14px' }}
                  >
                    <Plus size={14} />
                    <span>New Session</span>
                  </button>
                </div>

                <form onSubmit={handleConfirmQrSession} style={{ textAlign: 'left' }}>
                  <div className="form-group">
                    <label className="form-label">Account Label</label>
                    <input
                      type="text"
                      className="form-input"
                      value={qrAccountName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQrAccountName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Scanned Phone Number (with Country Code)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+966500000001"
                      value={qrPhoneNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQrPhoneNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowQrModal(false)}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={submitting || !qrPhoneNumber}
                    >
                      <CheckCircle2 size={16} />
                      <span>{submitting ? 'Confirming...' : 'Save & Register Session'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Test Message Modal */}
      {showTestModal && selectedAccount && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '30px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '6px' }}>Send Test WhatsApp Message</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '18px' }}>
              Sending from <strong>{selectedAccount.account_name}</strong> ({selectedAccount.phone_number})
            </p>

            {testResult && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                color: testResult.success ? '#34d399' : '#f87171',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{testResult.message}</span>
              </div>
            )}

            <form onSubmit={handleSendTest}>
              <div className="form-group">
                <label className="form-label">Recipient Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="+966500000001"
                  value={testRecipient}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestRecipient(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Message Content</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={testMsg}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTestMsg(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowTestModal(false);
                    setTestResult(null);
                  }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={sendingTest}
                >
                  <Send size={16} />
                  <span>{sendingTest ? 'Sending...' : 'Send Test'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Disconnect & Delete WhatsApp Number"
        message={`Are you sure you want to disconnect and delete ${accountToDelete?.account_name} (${accountToDelete?.phone_number})? The session will also be disconnected in the WhatsApp engine.`}
        confirmText="Disconnect & Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteModalOpen(false);
          setAccountToDelete(null);
        }}
      />
    </div>
  );
};
