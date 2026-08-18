import React from 'react';
import { Settings as SettingsIcon, Shield, Webhook, Copy, Check } from 'lucide-react';
import { Header } from '../components/Header';

export const Settings: React.FC = () => {
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const webhookUrl = 'https://api.yourdomain.com/api/v1/webhooks/meta-whatsapp';
  const verifyToken = 'whatsapp_meta_verify_token_123';
  const n8nWebhookUrl = 'http://localhost:5678/webhook/whatsapp-campaign-dispatch';

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      <Header
        title="Settings & Webhook Endpoints"
        subtitle="Manage n8n automation integration and Meta Cloud API Webhook subscriptions."
        backTo="/"
        backLabel="Dashboard"
      />

      {/* Meta Webhook Card */}
      <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Webhook size={22} color="var(--accent-emerald)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Meta Inbound Webhook Configuration</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
          Configure these values inside <strong>Meta Developer Portal $\rightarrow$ WhatsApp $\rightarrow$ Configuration</strong> to receive delivery receipts and automatically process customer opt-out keywords.
        </p>

        <div className="form-group">
          <label className="form-label">Callback URL</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" className="form-input" value={webhookUrl} readOnly />
            <button className="btn-secondary" onClick={() => copyToClipboard(webhookUrl, 'url')}>
              {copied === 'url' ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Verify Token</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" className="form-input" value={verifyToken} readOnly />
            <button className="btn-secondary" onClick={() => copyToClipboard(verifyToken, 'token')}>
              {copied === 'token' ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* n8n Integration Card */}
      <div className="glass-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Shield size={22} color="var(--accent-emerald)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>n8n Workflow Engine Status</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
          The dashboard dispatches campaign contact batches directly to the imported n8n workflow located at <code>n8n/workflows/whatsapp_campaign_dispatcher.json</code>.
        </p>

        <div className="form-group">
          <label className="form-label">n8n Webhook Dispatch URL</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" className="form-input" value={n8nWebhookUrl} readOnly />
            <button className="btn-secondary" onClick={() => copyToClipboard(n8nWebhookUrl, 'n8n')}>
              {copied === 'n8n' ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
