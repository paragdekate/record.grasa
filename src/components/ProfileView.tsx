import React, { useState } from 'react';
import { RefreshCw, LogIn, LogOut, CloudLightning, User, Check } from 'lucide-react';
import { getSupabaseClient } from '../supabase';
import type { GoogleProfile } from '../supabase';
import { AlertsManager } from './AlertsManager';
import type { InAppAlert } from '../db';

interface ProfileViewProps {
  user: GoogleProfile | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  readingsCount: number;
  onSyncTrigger: () => Promise<{ success: boolean; count: number; message: string }>;
  alerts: InAppAlert[];
  onAddAlert: (alert: Omit<InAppAlert, 'id'>) => void;
  onUpdateAlert: (alert: InAppAlert) => void;
  onDeleteAlert: (id: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onLoginClick,
  onLogoutClick,
  readingsCount,
  onSyncTrigger,
  alerts,
  onAddAlert,
  onUpdateAlert,
  onDeleteAlert
}) => {
  // Sync status states
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Check if client is initialized from env
  const isConnected = !!getSupabaseClient();

  const handleSyncClick = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await onSyncTrigger();
      setSyncResult({ success: res.success, message: res.message });
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    } catch (e) {
      setSyncResult({ success: false, message: 'Sync failed due to an unexpected error.' });
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="schema-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Account Section */}
      <div style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} className="text-accent" />
            <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              GOOGLE AUTH PROFILE
            </span>
          </div>
          <span 
            className="text-xs" 
            style={{ 
              fontWeight: 'bold', 
              color: isConnected ? 'var(--cyan)' : 'var(--text-muted)' 
            }}
          >
            {isConnected ? 'SUPABASE ACTIVE' : 'OFFLINE MODE'}
          </span>
        </div>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src={user.avatarUrl} 
                alt={user.name} 
                style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              />
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold' }}>{user.name}</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{user.email}</p>
              </div>
            </div>
            <button 
              type="button" 
              className="btn btn-secondary btn-xs" 
              onClick={onLogoutClick}
              style={{ gap: '4px', padding: '6px 10px', height: 'fit-content' }}
            >
              <LogOut size={12} />
              <span>Log Out</span>
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p className="text-sm text-secondary mb-2">You are currently using the app offline.</p>
            <button 
              type="button" 
              className="btn btn-primary btn-sm" 
              onClick={onLoginClick}
              style={{ gap: '6px', margin: '0 auto' }}
              disabled={!isConnected}
            >
              <LogIn size={14} />
              <span>Sign in with Google</span>
            </button>
            {!isConnected && (
              <p className="text-xs text-red mt-2">
                Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your env file to enable authentication.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. In-App Alerts Manager Card */}
      <div style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '16px'
      }}>
        <AlertsManager 
          alerts={alerts}
          onAddAlert={onAddAlert}
          onUpdateAlert={onUpdateAlert}
          onDeleteAlert={onDeleteAlert}
        />
      </div>

      {/* 3. Database Sync Card (Only active when logged in) */}
      {user && (
        <div style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CloudLightning size={16} className="text-emerald" />
            <h4 style={{ fontSize: '13px', fontWeight: 'bold' }}>Sync Readings to Cloud</h4>
          </div>
          
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '140%' }}>
            Save your device logs safely. Currently tracking <strong>{readingsCount} logs</strong> locally. Syncing will upload all readings.
          </p>

          <button
            type="button"
            className={`btn btn-sm ${syncLoading ? 'btn-secondary' : 'btn-primary'}`}
            disabled={syncLoading}
            onClick={handleSyncClick}
            style={{ gap: '6px', width: 'fit-content' }}
          >
            <RefreshCw size={12} className={syncLoading ? 'spin' : ''} />
            <span>{syncLoading ? 'Uploading...' : 'Sync Now'}</span>
          </button>

          {syncResult && (
            <div 
              style={{
                fontSize: '11px',
                padding: '8px',
                borderRadius: '6px',
                backgroundColor: syncResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${syncResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                color: syncResult.success ? 'var(--emerald)' : 'var(--red)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Check size={12} />
              <span>{syncResult.message}</span>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
