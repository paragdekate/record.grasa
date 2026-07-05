import React, { useState } from 'react';
import { Mail, ShieldAlert, LogIn, X, Globe } from 'lucide-react';
import type { GoogleProfile } from '../supabase';

interface GoogleLoginModalProps {
  onClose: () => void;
  onLoginSuccess: (user: GoogleProfile) => void;
  isRealSupabase: boolean;
  onTriggerRealOAuth: () => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  onClose,
  onLoginSuccess,
  isRealSupabase,
  onTriggerRealOAuth
}) => {
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  const mockAccounts = [
    {
      id: 'g-101',
      name: 'Alex Johnson',
      email: 'alex.johnson@gmail.com',
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex'
    },
    {
      id: 'g-102',
      name: 'Emily Rivera',
      email: 'emily.rivera@gmail.com',
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Emily'
    }
  ];

  const handleSelectMock = (acc: typeof mockAccounts[0]) => {
    onLoginSuccess(acc);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail) return;
    const name = customName || customEmail.split('@')[0];
    const seed = encodeURIComponent(name);
    
    onLoginSuccess({
      id: `g-custom-${Date.now()}`,
      email: customEmail,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '360px' }}>
        <div className="modal-header">
          <div className="inline-flex" style={{ alignItems: 'center', gap: '8px' }}>
            <Globe size={18} className="text-accent" />
            <h3 style={{ fontSize: '15px' }}>Sign in with Google</h3>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isRealSupabase ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <p className="text-sm text-secondary mb-2" style={{ lineHeight: '140%' }}>
                We detected your custom Supabase Keys! This will trigger the actual Google OAuth redirection.
              </p>
              
              <button 
                type="button" 
                className="btn btn-primary btn-block btn-lg"
                onClick={onTriggerRealOAuth}
                style={{ gap: '10px', marginTop: '10px' }}
              >
                <Globe size={18} />
                <span>Redirect to Google OAuth</span>
              </button>
            </div>
          ) : (
            <>
              <div 
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px dashed rgba(245, 158, 11, 0.3)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start'
                }}
              >
                <ShieldAlert size={18} className="text-amber" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '135%' }}>
                  <strong>Demo Mode Authentication:</strong> To use real Google Auth, configure your Supabase Keys in the Supabase tab. Select a mock Google Account below to log in instantly.
                </div>
              </div>

              {!showCustomForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {mockAccounts.map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleSelectMock(acc)}
                      style={{
                        justifyContent: 'flex-start',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        gap: '12px',
                        width: '100%'
                      }}
                    >
                      <img 
                        src={acc.avatarUrl} 
                        alt={acc.name} 
                        style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-input)' }} 
                      />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{acc.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{acc.email}</div>
                      </div>
                    </button>
                  ))}
                  
                  <button 
                    className="btn btn-link btn-xs"
                    onClick={() => setShowCustomForm(true)}
                    style={{ marginTop: '5px' }}
                  >
                    Or log in with custom email...
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="input-label">YOUR NAME</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="text-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="input-label">GOOGLE EMAIL</label>
                    <div className="input-wrapper">
                      <Mail className="input-icon" size={14} />
                      <input
                        type="email"
                        placeholder="yourname@gmail.com"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        className="text-input"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="modal-footer-btns">
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowCustomForm(false)}
                    >
                      Back
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
                      <LogIn size={14} />
                      <span>Mock Log In</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
