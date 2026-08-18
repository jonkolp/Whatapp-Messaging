import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileSpreadsheet, 
  Check, 
  Upload, 
  Smartphone, 
  Send, 
  Sliders, 
  ArrowRight, 
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import api from '../api';
import { Header } from '../components/Header';

export const CampaignWizard: React.FC = () => {
  const navigate = useNavigate();

  // Wizard Step (1: Account & File, 2: Column Mapping & Validation, 3: Message Template, 4: Safety & Launch)
  const [step, setStep] = useState(1);

  // Accounts
  const [accounts, setAccounts] = useState<any[]>([]);

  // Step 1 State
  const [campaignName, setCampaignName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFileData, setUploadedFileData] = useState<any>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Step 2 State (Column Mapping)
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  const [adColumn, setAdColumn] = useState('');
  const [mappingPreview, setMappingPreview] = useState<any>(null);
  const [validatingMapping, setValidatingMapping] = useState(false);

  // Step 3 State (Message / Template)
  const [messageBody, setMessageBody] = useState(
    'السلام عليكم ورحمة الله، شفت إعلانك "{{ad}}" في حراج، ياليت نتواصل بخصوص السعر والتفاصيل. وفقك الله.'
  );

  // Step 4 State (Safety Settings)
  const [sendDelaySeconds, setSendDelaySeconds] = useState(10);
  const [respectQuietHours, setRespectQuietHours] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await api.get('/whatsapp/accounts');
        if (res.data.success) {
          setAccounts(res.data.accounts);
          if (res.data.accounts.length > 0) {
            setSelectedAccountId(res.data.accounts[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadAccounts();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUploadingFile(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setUploadedFileData(res.data.file);
        setDetectedColumns(res.data.file.detectedColumns);

        // Auto-guess phone and ad column names
        const cols: string[] = res.data.file.detectedColumns;
        const phoneMatch = cols.find(c => /phone|mobile|جوال|رقم|number/i.test(c)) || cols[0];
        const nameMatch = cols.find(c => /name|اسم|صاحب/i.test(c)) || '';
        const adMatch = cols.find(c => /ad|title|اعلان|سلعة|item/i.test(c)) || '';

        setPhoneColumn(phoneMatch);
        setNameColumn(nameMatch);
        setAdColumn(adMatch);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'File upload failed.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleValidateMapping = async () => {
    if (!uploadedFileData || !phoneColumn) return;
    setValidatingMapping(true);
    setError('');

    try {
      const columnMapping: any = { phoneColumn };
      if (nameColumn) columnMapping.name = nameColumn;
      if (adColumn) columnMapping.ad = adColumn;

      const res = await api.post(`/files/${uploadedFileData.id}/validate-mapping`, {
        columnMapping
      });

      if (res.data.success) {
        setMappingPreview(res.data);
        setStep(3);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Validation failed.');
    } finally {
      setValidatingMapping(false);
    }
  };

  const handleCreateAndLaunch = async () => {
    setError('');
    setSubmitting(true);

    try {
      const columnMapping: any = { phoneColumn };
      if (nameColumn) columnMapping.name = nameColumn;
      if (adColumn) columnMapping.ad = adColumn;

      // 1. Create Campaign Record & Mapped Contacts in Database
      const createRes = await api.post('/campaigns', {
        name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
        whatsappAccountId: selectedAccountId,
        uploadedFileId: uploadedFileData.id,
        messageType: 'TEXT',
        messageBody,
        columnMapping,
        sendDelaySeconds,
        respectQuietHours
      });

      if (createRes.data.success) {
        const campaignId = createRes.data.campaignId;

        // 2. Start & Dispatch to n8n Automation Engine
        const startRes = await api.post(`/campaigns/${campaignId}/start`);
        if (startRes.data.success) {
          navigate(`/campaigns/${campaignId}`);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to launch campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <Header
        title="New WhatsApp Campaign"
        subtitle="Configure your Excel contact list, map placeholders, and launch automated outreach."
        backTo="/campaigns"
        backLabel="Campaigns"
      />

      {/* Stepper Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', position: 'relative' }}>
        {[
          { num: 1, label: 'Account & File' },
          { num: 2, label: 'Map Columns' },
          { num: 3, label: 'Message Template' },
          { num: 4, label: 'Safety & Launch' }
        ].map((s) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1 }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: step >= s.num ? 'var(--accent-emerald)' : 'var(--bg-input)',
              color: step >= s.num ? '#ffffff' : 'var(--text-muted)',
              border: step >= s.num ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.9rem'
            }}>
              {step > s.num ? <Check size={18} /> : s.num}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: step === s.num ? '600' : '400', color: step === s.num ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(244, 63, 94, 0.15)',
          color: '#f87171',
          fontSize: '0.875rem',
          marginBottom: '24px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Account & File Upload */}
      {step === 1 && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px' }}>Step 1: Campaign Details & Excel File</h3>

          <div className="form-group">
            <label className="form-label">Campaign Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Haraj Riyadh Car Inquiries"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Sender WhatsApp Number</label>
            <select
              className="form-select"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name} ({acc.phone_number}) — {acc.provider_type}
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <span style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '4px', display: 'block' }}>
                No WhatsApp numbers connected yet. Please connect a number first.
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Upload Excel Contacts (.xlsx, .csv)</label>
            <div style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.01)',
              cursor: 'pointer',
              position: 'relative'
            }}>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
              <FileSpreadsheet size={42} color="var(--accent-emerald)" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                {uploadingFile ? 'Inspecting Excel columns...' : file ? file.name : 'Click or Drag Excel file here'}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Supports `.xlsx`, `.csv` with phone and custom column fields
              </p>
            </div>
          </div>

          {uploadedFileData && (
            <div style={{ background: 'var(--bg-input)', padding: '14px 18px', borderRadius: '8px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: 'var(--accent-emerald)' }}>{uploadedFileData.rowCount}</strong> rows detected across{' '}
                <strong>{detectedColumns.length}</strong> columns.
              </div>
              <span className="badge badge-connected">File Inspected</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={!uploadedFileData || !selectedAccountId}
              onClick={() => setStep(2)}
            >
              <span>Next: Map Columns</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping & Validation */}
      {step === 2 && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '6px' }}>Step 2: Map Excel Columns to Variables</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '24px' }}>
            Specify which column in your Excel sheet contains recipient phone numbers and custom placeholders.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Phone Number Column (Required)</label>
              <select
                className="form-select"
                value={phoneColumn}
                onChange={(e) => setPhoneColumn(e.target.value)}
              >
                {detectedColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ad / Listing Title Column ({"{{ad}}"})</label>
              <select
                className="form-select"
                value={adColumn}
                onChange={(e) => setAdColumn(e.target.value)}
              >
                <option value="">-- None --</option>
                {detectedColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Contact Name Column ({"{{name}}"})</label>
              <select
                className="form-select"
                value={nameColumn}
                onChange={(e) => setNameColumn(e.target.value)}
              >
                <option value="">-- None --</option>
                {detectedColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
            <button className="btn-secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              className="btn-primary"
              disabled={validatingMapping || !phoneColumn}
              onClick={handleValidateMapping}
            >
              <span>{validatingMapping ? 'Validating Numbers...' : 'Validate & Next'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Message Template */}
      {step === 3 && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '6px' }}>Step 3: Message & Dynamic Placeholders</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
            Write your message. Use variables like <code>{"{{ad}}"}</code> or <code>{"{{name}}"}</code> to personalize each outgoing text.
          </p>

          <div className="form-group">
            <label className="form-label">Message Body</label>
            <textarea
              className="form-textarea"
              rows={5}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              style={{ fontSize: '1rem', lineHeight: '1.6' }}
            />
          </div>

          {/* Live Preview Card */}
          <div style={{ background: 'var(--bg-input)', padding: '18px', borderRadius: '12px', marginTop: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: '700', textTransform: 'uppercase' }}>Sample WhatsApp Preview</span>
            <div style={{
              background: '#075e54',
              color: '#ffffff',
              padding: '12px 16px',
              borderRadius: '10px',
              marginTop: '8px',
              fontSize: '0.9rem',
              maxWidth: '85%'
            }}>
              {messageBody.replace(/\{\{ad\}\}/g, 'آيفون 15 برو مستعمل').replace(/\{\{name\}\}/g, 'أبو ناصر')}
              <div style={{ textAlign: 'right', fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                12:45 PM ✓✓
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
            <button className="btn-secondary" onClick={() => setStep(2)}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button className="btn-primary" onClick={() => setStep(4)}>
              <span>Next: Safety & Dispatch</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Safety & Launch */}
      {step === 4 && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '6px' }}>Step 4: Safety Guardrails & Dispatch</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '24px' }}>
            Verify rate pacing and anti-ban settings before launching the n8n automation worker.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Anti-Ban Randomized Jitter (3–8s)</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Adds random intervals between consecutive message dispatches in n8n.
                </p>
              </div>
              <span className="badge badge-connected">Enforced</span>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Quiet Hours Protection (11:00 PM – 8:00 AM)</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Prevents midnight message deliveries in the recipient's timezone.
                </p>
              </div>
              <input
                type="checkbox"
                checked={respectQuietHours}
                onChange={(e) => setRespectQuietHours(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn-secondary" onClick={() => setStep(3)}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              className="btn-primary"
              style={{ padding: '12px 28px', fontSize: '1rem' }}
              disabled={submitting}
              onClick={handleCreateAndLaunch}
            >
              <Sparkles size={18} />
              <span>{submitting ? 'Launching n8n Workflow...' : 'Launch Campaign'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
