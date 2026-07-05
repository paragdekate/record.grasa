import React, { useState } from 'react';
import { Database, Copy, Check, RefreshCw, LogIn, LogOut, CloudLightning } from 'lucide-react';
import { getSupabaseClient } from '../supabase';
import type { GoogleProfile } from '../supabase';

interface SupabaseSchemaProps {
  user: GoogleProfile | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  readingsCount: number;
  onSyncTrigger: () => Promise<{ success: boolean; count: number; message: string }>;
}

export const SupabaseSchema: React.FC<SupabaseSchemaProps> = ({
  user,
  onLoginClick,
  onLogoutClick,
  readingsCount,
  onSyncTrigger
}) => {
  const [copied, setCopied] = useState(false);
  
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

  const sqlCode = `-- 1. Table to store blood sugar readings
create table public.blood_sugar_readings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  value numeric not null, -- Stores numerical blood glucose reading
  unit varchar(10) not null default 'mg/dL', -- 'mg/dL' or 'mmol/L'
  context varchar(30) not null, -- 'fasting', 'before_breakfast', etc.
  notes text, -- Optional logs or food items eaten
  measured_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
alter table public.blood_sugar_readings enable row level security;

-- 3. Row Level Security (RLS) Policies
create policy "Users can insert their own readings"
  on public.blood_sugar_readings for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own readings"
  on public.blood_sugar_readings for select
  using (auth.uid() = user_id);

create policy "Users can update their own readings"
  on public.blood_sugar_readings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own readings"
  on public.blood_sugar_readings for delete
  using (auth.uid() = user_id);

-- 4. Create index for fast query retrieval sorted by time
create index blood_sugar_readings_user_id_measured_at_idx 
  on public.blood_sugar_readings (user_id, measured_at desc);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    setTimeout(() => setCopied(false), 2000);
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
          <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
            GOOGLE AUTH STATUS
          </span>
          <span 
            className="text-xs" 
            style={{ 
              fontWeight: 'bold', 
              color: isConnected ? 'var(--cyan)' : 'var(--text-muted)' 
            }}
          >
            {isConnected ? 'SUPABASE ACTIVE' : 'OFFLINE MODE (ENV MISSING)'}
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
                Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to enable authentication.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. Database Sync Card (Only active when logged in) */}
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

      {/* 3. SQL Schema Card */}
      <div className="schema-intro" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
        <div className="intro-title">
          <Database size={20} className="text-accent" />
          <h3 style={{ fontSize: '14px', fontWeight: 'bold' }}>Supabase SQL Table Script</h3>
        </div>
        <p className="intro-text" style={{ fontSize: '11px' }}>
          Execute this SQL in your Supabase Project dashboard to spin up your database table. RLS policies safeguard read/write access.
        </p>

        <div className="code-header" style={{ marginTop: '8px' }}>
          <span>SQL Script</span>
          <button className="btn-copy" onClick={copyToClipboard}>
            {copied ? (
              <>
                <Check size={12} className="text-emerald mr-1" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={12} className="mr-1" />
                <span>Copy SQL</span>
              </>
            )}
          </button>
        </div>
        <pre className="code-block" style={{ maxHeight: '180px', overflowY: 'auto' }}>
          <code>{sqlCode}</code>
        </pre>
      </div>

    </div>
  );
};
