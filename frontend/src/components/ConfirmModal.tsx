import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        maxWidth: '440px',
        width: '100%',
        padding: '28px',
        border: isDanger ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid var(--border-color)',
        boxShadow: isDanger ? '0 20px 40px rgba(244, 63, 94, 0.15)' : 'var(--shadow-elevation)',
        animation: 'fadeIn 0.2s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: isDanger ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDanger ? '#f87171' : '#fbbf24'
            }}>
              {isDanger ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{title}</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          lineHeight: '1.5',
          marginBottom: '24px'
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '0.875rem' }}
          >
            {cancelText}
          </button>

          <button
            className={isDanger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
            style={{ padding: '8px 20px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isDanger && <Trash2 size={16} />}
            <span>{loading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
