import React, { useState } from 'react';
import { Database, Copy, Check, Shield, Key } from 'lucide-react';

export const SupabaseSchema: React.FC = () => {
  const [copied, setCopied] = useState(false);

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
    
    // Trigger haptic response
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="schema-card">
      <div className="schema-intro">
        <div className="intro-title">
          <Database size={24} className="text-accent" />
          <h2>Supabase & Future Auth Integration</h2>
        </div>
        <p className="intro-text">
          Ready to scale your app? This schema is pre-configured with <strong>Row Level Security (RLS)</strong>, meaning users can only access their own readings. It connects directly to Supabase Authentication for instant multi-user capabilities.
        </p>
      </div>

      <div className="schema-tabs">
        <div className="schema-tab-content">
          <div className="code-header">
            <span>SQL Schema Script</span>
            <button className="btn-copy" onClick={copyToClipboard}>
              {copied ? (
                <>
                  <Check size={14} className="text-emerald mr-1" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} className="mr-1" />
                  <span>Copy SQL</span>
                </>
              )}
            </button>
          </div>
          <pre className="code-block">
            <code>{sqlCode}</code>
          </pre>
        </div>
      </div>

      <div className="steps-container">
        <h3>Google Login & Supabase Setup</h3>
        
        <div className="step-card">
          <div className="step-number"><Key size={16} /></div>
          <div className="step-content">
            <h4>1. Google OAuth Client ID</h4>
            <p>
              Create a project in the Google Cloud Console, configure your OAuth Consent Screen, and create a client ID of type "Web Application".
            </p>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number"><Database size={16} /></div>
          <div className="step-content">
            <h4>2. Enable Google Provider in Supabase</h4>
            <p>
              Go to your Supabase Dashboard &gt; Authentication &gt; Providers &gt; Google. Toggle it on and enter your Google Client ID and Client Secret. Copy the Redirect URL from Supabase back to Google Cloud Console.
            </p>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number"><Shield size={16} /></div>
          <div className="step-content">
            <h4>3. Client-Side Authentication Code</h4>
            <p>
              Initialize Supabase Client in your frontend and trigger Google login using:
            </p>
            <pre className="small-code">
{`const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
};`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
