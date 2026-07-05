import { useState, useEffect } from 'react';
import { 
  loadReadings, 
  addReading, 
  updateReading, 
  deleteReading, 
  getStatus,
  getStatusColor,
  convertValue
} from './db';
import type { SugarReading, ReadingUnit } from './db';
import { getSupabaseClient } from './supabase';
import type { GoogleProfile } from './supabase';

import { StatsDashboard } from './components/StatsDashboard';
import { BloodSugarChart } from './components/BloodSugarChart';
import { LogReadingForm } from './components/LogReadingForm';
import { HistoryList } from './components/HistoryList';
import { SupabaseSchema } from './components/SupabaseSchema';

import { LayoutDashboard, PlusCircle, History, Database, Droplet } from 'lucide-react';

function App() {
  const [readings, setReadings] = useState<SugarReading[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'log' | 'history' | 'supabase'>('dashboard');
  const [preferredUnit, setPreferredUnit] = useState<ReadingUnit>('mg/dL');
  
  // Auth state management
  const [user, setUser] = useState<GoogleProfile | null>(null);

  // 1. Initial Data and Session Setup
  useEffect(() => {
    // Load local storage readings
    const stored = loadReadings();
    setReadings(stored);

    // Load preferred unit
    const savedUnit = localStorage.getItem('glucose_preferred_unit') as ReadingUnit;
    if (savedUnit === 'mg/dL' || savedUnit === 'mmol/L') {
      setPreferredUnit(savedUnit);
    }

    // Initialize Auth Session
    const supabase = getSupabaseClient();
    if (supabase) {
      // Get current session user
      supabase.auth.getUser().then(({ data: { user: sbUser } }) => {
        if (sbUser) {
          setUser({
            id: sbUser.id,
            email: sbUser.email || '',
            name: sbUser.user_metadata.full_name || sbUser.user_metadata.name || sbUser.email?.split('@')[0] || 'User',
            avatarUrl: sbUser.user_metadata.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${sbUser.id}`
          });
        } else {
          setUser(null);
        }
      });

      // Listen for auth state changes (sign ins/outs)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata.full_name || session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
            avatarUrl: session.user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${session.user.id}`
          });
        } else {
          setUser(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setUser(null);
    }
  }, [activeTab]); // Re-run checks when visiting settings tabs

  // 2. Change Unit Handler
  const handleUnitToggle = (unit: ReadingUnit) => {
    setPreferredUnit(unit);
    localStorage.setItem('glucose_preferred_unit', unit);
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  };

  // 3. Login / Logout Handlers
  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    if ('vibrate' in navigator) {
      navigator.vibrate(40);
    }
  };

  const handleTriggerRealOAuth = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin
          }
        });
        if (error) alert(`OAuth Error: ${error.message}`);
      } catch (e: any) {
        alert(e.message || 'An error occurred during Google OAuth redirect.');
      }
    } else {
      alert('Supabase credentials not configured. Please input your Project URL and Anon Key in the Supabase settings tab first.');
    }
  };

  // 4. Database Cloud Synchronization
  const handleSyncReadings = async (): Promise<{ success: boolean; count: number; message: string }> => {
    const supabase = getSupabaseClient();
    if (!user) {
      return { success: false, count: 0, message: 'You must be signed in to sync.' };
    }

    if (supabase) {
      try {
        const rows = readings.map(r => ({
          user_id: user.id,
          value: r.value,
          unit: r.unit,
          context: r.context,
          notes: r.notes || '',
          measured_at: r.measuredAt
        }));

        // Push all records to the Supabase table (insert rows)
        const { error } = await supabase
          .from('blood_sugar_readings')
          .insert(rows);

        if (error) {
          console.error('Supabase insert error:', error);
          
          if (error.code === '42P01') {
            return { 
              success: false, 
              count: 0, 
              message: 'Table blood_sugar_readings does not exist. Did you run the SQL script in your Supabase SQL editor?' 
            };
          }
          
          return { success: false, count: 0, message: `Database error: ${error.message}` };
        }

        return { 
          success: true, 
          count: rows.length, 
          message: `Successfully synchronized ${rows.length} readings to your live Supabase DB!` 
        };
      } catch (e: any) {
        return { success: false, count: 0, message: e.message || 'Network sync error.' };
      }
    } else {
      return { 
        success: false, 
        count: 0, 
        message: 'Database connection config is missing. Please save credentials in the Supabase tab.' 
      };
    }
  };

  // 5. CRUD Bindings
  const handleAddReading = (newReading: Omit<SugarReading, 'id'>) => {
    const added = addReading(newReading);
    setReadings(prev => [added, ...prev]);
    
    // Redirect to dashboard tab to immediately visualize changes
    setTimeout(() => {
      setActiveTab('dashboard');
    }, 1000);
  };

  const handleUpdateReading = (updated: SugarReading) => {
    updateReading(updated);
    setReadings(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const handleDeleteReading = (id: string) => {
    deleteReading(id);
    setReadings(prev => prev.filter(r => r.id !== id));
  };

  // 6. Header display helpers
  const latestReading = readings.length > 0 ? readings[0] : null;
  const latestStatus = latestReading ? getStatus(latestReading.value) : null;
  const latestStatusColor = latestStatus ? getStatusColor(latestStatus) : 'transparent';
  const displayLatestValue = latestReading
    ? (preferredUnit === 'mg/dL' ? latestReading.value : convertValue(latestReading.value, 'mg/dL', 'mmol/L'))
    : null;

  return (
    <>
      {/* Sleek App Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo-container">
            <Droplet size={18} className="brand-logo-svg" fill="white" />
          </div>
          <div>
            <h1 className="brand-name">GlucoSync</h1>
            <p className="brand-tagline">SMART LOG & TRACKER</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Latest reading quick indicator */}
          {latestReading && (
            <div 
              className="latest-reading-badge inline-flex"
              style={{
                background: 'var(--bg-card)',
                border: `1.5px solid ${latestStatusColor}33`,
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '11px',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Latest Blood Sugar Reading"
            >
              <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: latestStatusColor }}></span>
              <span className="text-secondary">Last:</span>
              <strong style={{ color: latestStatusColor }}>
                {displayLatestValue} {preferredUnit}
              </strong>
            </div>
          )}

          {/* Unit Toggle Button */}
          <div className="header-unit-selector">
            <button
              className={preferredUnit === 'mg/dL' ? 'active' : ''}
              onClick={() => handleUnitToggle('mg/dL')}
            >
              mg/dL
            </button>
            <button
              className={preferredUnit === 'mmol/L' ? 'active' : ''}
              onClick={() => handleUnitToggle('mmol/L')}
            >
              mmol/L
            </button>
          </div>

          {/* User profile avatar or login trigger */}
          {user ? (
            <img 
              src={user.avatarUrl} 
              alt={user.name} 
              style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '50%', 
                border: '1.5px solid var(--accent)', 
                cursor: 'pointer',
                backgroundColor: 'var(--bg-card)'
              }}
              onClick={() => {
                setActiveTab('supabase');
                if ('vibrate' in navigator) {
                  navigator.vibrate(20);
                }
              }}
              title={`Signed in as ${user.name}. Click to view database settings.`}
            />
          ) : (
            <button
              className="btn btn-secondary btn-xs"
              onClick={handleTriggerRealOAuth}
              style={{ padding: '6px 10px', borderRadius: '14px', fontSize: '10px', fontWeight: 'bold' }}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main App Content Viewport */}
      <main className="app-content">
        {activeTab === 'dashboard' && (
          <>
            {/* Custom SVG Line Chart */}
            <BloodSugarChart 
              readings={readings} 
              unit={preferredUnit} 
            />
            {/* Numeric Indicators & Target Range Gauge */}
            <StatsDashboard 
              readings={readings} 
              unit={preferredUnit} 
            />
          </>
        )}

        {activeTab === 'log' && (
          <LogReadingForm 
            onAddReading={handleAddReading} 
            preferredUnit={preferredUnit} 
          />
        )}

        {activeTab === 'history' && (
          <HistoryList 
            readings={readings} 
            unit={preferredUnit} 
            onUpdateReading={handleUpdateReading} 
            onDeleteReading={handleDeleteReading} 
          />
        )}

        {activeTab === 'supabase' && (
          <SupabaseSchema 
            user={user}
            onLoginClick={handleTriggerRealOAuth}
            onLogoutClick={handleLogout}
            readingsCount={readings.length}
            onSyncTrigger={handleSyncReadings}
          />
        )}
      </main>

      {/* Bottom Sticky Tab Navigation */}
      <nav className="app-nav">
        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          aria-label="View Dashboard"
        >
          <div className="nav-item-icon-wrapper">
            <LayoutDashboard size={20} />
          </div>
          <span>Dashboard</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'log' ? 'active' : ''}`}
          onClick={() => setActiveTab('log')}
          aria-label="Add Blood Sugar Reading"
        >
          <div className="nav-item-icon-wrapper">
            <PlusCircle size={20} />
          </div>
          <span>Log Glucose</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          aria-label="View Reading History"
        >
          <div className="nav-item-icon-wrapper">
            <History size={20} />
          </div>
          <span>Logs</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'supabase' ? 'active' : ''}`}
          onClick={() => setActiveTab('supabase')}
          aria-label="View Database Integration details"
        >
          <div className="nav-item-icon-wrapper">
            <Database size={20} />
          </div>
          <span>Supabase</span>
        </button>
      </nav>
    </>
  );
}

export default App;
