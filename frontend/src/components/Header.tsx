import React from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  backTo?: string;
  onBack?: () => void;
  backLabel?: string;
  badge?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  backTo,
  onBack,
  backLabel = 'Back',
  badge
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingBottom: '24px',
      marginBottom: '28px',
      borderBottom: '1px solid var(--border-color)',
      flexWrap: 'wrap',
      gap: '16px'
    }}>
      <div>
        {(backTo || onBack) && (
          <button
            onClick={handleBack}
            className="btn-secondary"
            style={{
              marginBottom: '12px',
              padding: '6px 12px',
              fontSize: '0.825rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={15} />
            <span>{backLabel}</span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>{title}</h1>
          {badge}
        </div>
        {subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {secondaryActionText && (
          <button
            className="btn-secondary"
            onClick={onSecondaryAction}
            style={{ padding: '8px 16px', fontSize: '0.875rem' }}
          >
            {secondaryActionText}
          </button>
        )}

        {actionText && (
          <button
            className="btn-primary"
            onClick={onAction || (() => navigate('/campaigns/new'))}
            style={{ padding: '8px 18px', fontSize: '0.875rem' }}
          >
            <Sparkles size={16} />
            <span>{actionText}</span>
          </button>
        )}
      </div>
    </header>
  );
};

