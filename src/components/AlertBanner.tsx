import React, { useEffect } from 'react';
import { playBeepSound } from '../db';
import type { InAppAlert } from '../db';
import { AlertTriangle, Clock, PlusCircle } from 'lucide-react';

interface AlertBannerProps {
  alert: InAppAlert;
  onSnooze: (alertId: string) => void;
  onLogNow: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alert, onSnooze, onLogNow }) => {
  const isUrgent = alert.type === 'record';

  // Audio trigger loop: Beep on mount, and set a 15-minute interval for record alerts
  useEffect(() => {
    // Initial beep
    playBeepSound(isUrgent);

    if (isUrgent) {
      // Keep beeping every 15 minutes (15 * 60 * 1000 ms)
      const beepInterval = setInterval(() => {
        playBeepSound(true);
      }, 15 * 60 * 1000);

      return () => clearInterval(beepInterval);
    }
  }, [alert.id, isUrgent]);

  return (
    <div 
      className={`alert-banner-fixed ${isUrgent ? 'urgent' : 'standard'}`}
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 40px)',
        maxWidth: '480px',
        zIndex: 2000,
        borderRadius: '16px',
        border: `1.5px solid ${isUrgent ? 'var(--red)' : 'var(--accent)'}`,
        backgroundColor: 'rgba(15, 17, 26, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '16px',
        boxShadow: isUrgent 
          ? '0 0 25px rgba(239, 68, 68, 0.3), inset 0 0 15px rgba(239, 68, 68, 0.15)' 
          : '0 0 25px rgba(139, 92, 246, 0.25), inset 0 0 15px rgba(139, 92, 246, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Banner Header Info */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: isUrgent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isUrgent ? 'var(--red)' : 'var(--accent)',
            flexShrink: 0,
            animation: isUrgent ? 'pulse-glow 1s infinite alternate' : 'none'
          }}
        >
          {isUrgent ? <AlertTriangle size={18} /> : <Clock size={18} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          <span 
            style={{ 
              fontSize: '10px', 
              fontWeight: '800', 
              color: isUrgent ? 'var(--red)' : 'var(--accent)',
              letterSpacing: '0.8px',
              textTransform: 'uppercase'
            }}
          >
            {isUrgent ? '⚠️ GLUCOSE LOG OVERDUE' : '⏰ REMINDER CHECK'}
          </span>
          <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: '130%' }}>
            {alert.label}
          </h4>
          {isUrgent && (
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Alarms will beep every 15 minutes until a reading is logged.
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm flex-1"
          onClick={() => onSnooze(alert.id)}
          style={{ gap: '6px', borderRadius: '10px' }}
        >
          <Clock size={14} />
          <span>Snooze (15m)</span>
        </button>
        
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1"
          onClick={onLogNow}
          style={{ gap: '6px', borderRadius: '10px' }}
        >
          <PlusCircle size={14} />
          <span>Log Reading Now</span>
        </button>
      </div>

      {/* Inline animations styling */}
      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -40px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .alert-banner-fixed.urgent {
          border-color: var(--red) !important;
          box-shadow: 0 0 30px rgba(239, 68, 68, 0.4) !important;
        }
      `}</style>
    </div>
  );
};
