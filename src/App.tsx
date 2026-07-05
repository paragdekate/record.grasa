import { useState, useEffect } from 'react';
import { 
  loadReadings, 
  addReading, 
  updateReading, 
  deleteReading, 
  getStatus,
  getStatusColor,
  convertValue,
  loadAlerts,
  updateAlert,
  addAlert,
  deleteAlert,
  saveAlerts
} from './db';
import type { SugarReading, ReadingUnit, InAppAlert } from './db';
import { getSupabaseClient } from './supabase';
import type { GoogleProfile } from './supabase';

import { StatsDashboard } from './components/StatsDashboard';
import { BloodSugarChart } from './components/BloodSugarChart';
import { LogReadingForm } from './components/LogReadingForm';
import { HistoryList } from './components/HistoryList';
import { ProfileView } from './components/ProfileView';
import { AlertBanner } from './components/AlertBanner';

import { LayoutDashboard, PlusCircle, History, User } from 'lucide-react';

function App() {
  const [readings, setReadings] = useState<SugarReading[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'log' | 'history' | 'profile'>('dashboard');
  const [preferredUnit, setPreferredUnit] = useState<ReadingUnit>('mg/dL');
  
  // Auth state management
  const [user, setUser] = useState<GoogleProfile | null>(null);

  // Alerts and reminders state
  const [alerts, setAlerts] = useState<InAppAlert[]>([]);
  const [activeTriggeredAlert, setActiveTriggeredAlert] = useState<InAppAlert | null>(null);
  const [snoozedAlerts, setSnoozedAlerts] = useState<{ [alertId: string]: number }>({});
  const [skippedAlertToast, setSkippedAlertToast] = useState<string | null>(null);

  // 1. Initial Data and Session Setup
  useEffect(() => {
    // Load local storage readings
    const stored = loadReadings();
    setReadings(stored);

    // Load alerts state
    setAlerts(loadAlerts());

    // Load preferred unit
    const savedUnit = localStorage.getItem('glucose_preferred_unit') as ReadingUnit;
    if (savedUnit === 'mg/dL' || savedUnit === 'mmol/L') {
      setPreferredUnit(savedUnit);
    }

    // Initialize Auth Session
    const supabase = getSupabaseClient();
    if (supabase) {
      const syncAlerts = async (sbUser: any) => {
        try {
          const { data, error } = await supabase
            .from('blood_sugar_alerts')
            .select('*');

          if (error) {
            console.error('Error fetching cloud alerts:', error);
            return;
          }

          if (data && data.length > 0) {
            const sbAlerts: InAppAlert[] = data.map(row => ({
              id: row.id,
              type: row.type,
              time: row.time,
              label: row.label,
              isActive: row.is_active,
              mealType: row.meal_type || undefined,
              lastTriggeredDate: row.last_triggered_date || undefined,
              frequency: row.frequency || 'daily',
              startDate: row.start_date || new Date().toISOString().slice(0, 10)
            }));
            saveAlerts(sbAlerts);
            setAlerts(sbAlerts);
          } else {
            // Push local alerts up
            const local = loadAlerts();
            if (local.length > 0) {
              const rows = local.map(al => ({
                id: al.id,
                user_id: sbUser.id,
                type: al.type,
                time: al.time,
                label: al.label,
                is_active: al.isActive,
                meal_type: al.mealType,
                last_triggered_date: al.lastTriggeredDate,
                frequency: al.frequency || 'daily',
                start_date: al.startDate || new Date().toISOString().slice(0, 10)
              }));
              await supabase.from('blood_sugar_alerts').insert(rows);
            }
          }
        } catch (err) {
          console.error('Cloud alerts sync failed:', err);
        }
      };

      const syncReadings = async (sbUser: any) => {
        try {
          const { data, error } = await supabase
            .from('blood_sugar_readings')
            .select('*')
            .order('measured_at', { ascending: false });

          if (error) {
            console.error('Error fetching cloud readings:', error);
            return;
          }

          const localReadings = loadReadings();

          if (data && data.length > 0) {
            const sbReadings: SugarReading[] = data.map(row => ({
              id: row.id,
              value: row.value,
              unit: row.unit,
              context: row.context,
              notes: row.notes || '',
              measuredAt: row.measured_at
            }));

            // Merge local and cloud readings
            const merged = [...localReadings];
            sbReadings.forEach(c => {
              const exists = merged.some(l => 
                l.id === c.id || 
                (l.measuredAt === c.measuredAt && Math.abs(l.value - c.value) < 0.01)
              );
              if (!exists) {
                merged.push(c);
              }
            });

            // Sort newest first
            merged.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());

            localStorage.setItem('blood_sugar_readings', JSON.stringify(merged));
            setReadings(merged);
          } else {
            // Push local readings up
            if (localReadings.length > 0) {
              const rows = localReadings.map(r => ({
                id: r.id,
                user_id: sbUser.id,
                value: r.value,
                unit: r.unit,
                context: r.context,
                notes: r.notes || '',
                measured_at: r.measuredAt
              }));
              await supabase.from('blood_sugar_readings').upsert(rows);
            }
          }
        } catch (err) {
          console.error('Cloud readings sync failed:', err);
        }
      };

      // Get current session user
      supabase.auth.getUser().then(({ data: { user: sbUser } }) => {
        if (sbUser) {
          setUser({
            id: sbUser.id,
            email: sbUser.email || '',
            name: sbUser.user_metadata.full_name || sbUser.user_metadata.name || sbUser.email?.split('@')[0] || 'User',
            avatarUrl: sbUser.user_metadata.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${sbUser.id}`
          });
          syncAlerts(sbUser);
          syncReadings(sbUser);
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
          syncAlerts(session.user);
          syncReadings(session.user);
        } else {
          setUser(null);
          setReadings([]);
          setAlerts([]);
          localStorage.removeItem('blood_sugar_readings');
          localStorage.removeItem('blood_sugar_alerts');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setUser(null);
    }
  }, [activeTab]); // Re-run checks when visiting settings tabs

  // Background daemon checking for reminders every 10 seconds
  useEffect(() => {
    const isTriggerDay = (startDateStr?: string, freq?: 'daily' | 'alternate'): boolean => {
      if (!startDateStr || freq === 'daily') return true;
      try {
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays % 2 === 0;
      } catch (e) {
        return true;
      }
    };

    const checkAlarms = () => {
      if (activeTriggeredAlert) return; // Only process one alert at a time

      const now = new Date();
      const currentHHMM = now.toTimeString().slice(0, 5); // "HH:MM"
      const todayStr = now.toISOString().slice(0, 10);
      const todayDateString = now.toLocaleDateString();

      const activeAlerts = loadAlerts();

      // Check if user logged a reading today (current calendar day local time)
      const hasLoggedToday = readings.some(r => {
        const logDate = new Date(r.measuredAt).toLocaleDateString();
        return logDate === todayDateString;
      });

      for (const al of activeAlerts) {
        if (!al.isActive) continue;

        // Skip if currently in an active snooze window
        const snoozeEnd = snoozedAlerts[al.id] || 0;
        if (Date.now() < snoozeEnd) continue;

        if (al.time === currentHHMM && al.lastTriggeredDate !== todayStr) {
          // Check if it is a valid trigger day based on start date and frequency
          const isTodayTriggerDay = isTriggerDay(al.startDate, al.frequency);
          if (!isTodayTriggerDay) continue;

          if (al.type === 'meal') {
            setActiveTriggeredAlert(al);
            al.lastTriggeredDate = todayStr;
            updateAlert(al);
            setAlerts(loadAlerts());
            break;
          } else if (al.type === 'record') {
            if (hasLoggedToday) {
              // SMART SKIP LOGIC: Mark as triggered for today and skip alarm
              al.lastTriggeredDate = todayStr;
              updateAlert(al);
              setAlerts(loadAlerts());
              
              // Display gentle notification toast
              setSkippedAlertToast(`"${al.label}" skipped because you already logged your reading today!`);
              setTimeout(() => setSkippedAlertToast(null), 5000);

              // Sync skip state update to Supabase in real-time
              const supabase = getSupabaseClient();
              if (supabase && user) {
                supabase.from('blood_sugar_alerts').upsert({
                  id: al.id,
                  user_id: user.id,
                  type: al.type,
                  time: al.time,
                  label: al.label,
                  is_active: al.isActive,
                  meal_type: al.mealType,
                  frequency: al.frequency || 'daily',
                  start_date: al.startDate || todayStr,
                  last_triggered_date: todayStr
                }).then(() => {});
              }
            } else {
              // Trigger urgent alarm
              setActiveTriggeredAlert(al);
            }
            break;
          }
        }
      }
    };

    const interval = setInterval(checkAlarms, 10000);
    checkAlarms(); // Immediate check on load

    return () => clearInterval(interval);
  }, [alerts, readings, snoozedAlerts, activeTriggeredAlert, user]);

  // Alert Actions
  const handleSnoozeAlert = (alertId: string) => {
    // Snooze for 15 minutes
    const snoozeUntil = Date.now() + 15 * 60 * 1000;
    setSnoozedAlerts(prev => ({
      ...prev,
      [alertId]: snoozeUntil
    }));
    setActiveTriggeredAlert(null);
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  };

  const handleLogNow = () => {
    setActiveTab('log');
    setActiveTriggeredAlert(null);
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  };

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
    setReadings([]);
    setAlerts([]);
    localStorage.removeItem('blood_sugar_readings');
    localStorage.removeItem('blood_sugar_alerts');
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
          id: r.id,
          user_id: user.id,
          value: r.value,
          unit: r.unit,
          context: r.context,
          notes: r.notes || '',
          measured_at: r.measuredAt
        }));

        // Push all records to the Supabase table (upsert rows)
        const { error } = await supabase
          .from('blood_sugar_readings')
          .upsert(rows);

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

        // Sync all local alerts up to Supabase alerts table
        const alertRows = alerts.map(al => ({
          id: al.id,
          user_id: user.id,
          type: al.type,
          time: al.time,
          label: al.label,
          is_active: al.isActive,
          meal_type: al.mealType,
          last_triggered_date: al.lastTriggeredDate,
          frequency: al.frequency || 'daily',
          start_date: al.startDate || new Date().toISOString().slice(0, 10)
        }));

        await supabase
          .from('blood_sugar_alerts')
          .upsert(alertRows);

        return { 
          success: true, 
          count: rows.length, 
          message: `Successfully synchronized ${rows.length} readings and ${alertRows.length} alerts to your live Supabase DB!` 
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
  const handleAddReading = async (newReading: Omit<SugarReading, 'id'>) => {
    const added = addReading(newReading);
    setReadings(prev => [added, ...prev]);

    // Real-time Cloud Sync
    const supabase = getSupabaseClient();
    if (supabase && user) {
      try {
        await supabase.from('blood_sugar_readings').upsert({
          id: added.id,
          user_id: user.id,
          value: added.value,
          unit: added.unit,
          context: added.context,
          notes: added.notes || '',
          measured_at: added.measuredAt
        });
      } catch (e) {
        console.error('Failed to sync new reading to cloud:', e);
      }
    }

    // If an alert was active, clear it and mark as triggered for today
    if (activeTriggeredAlert && activeTriggeredAlert.type === 'record') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const updated = { ...activeTriggeredAlert, lastTriggeredDate: todayStr };
      updateAlert(updated);
      setActiveTriggeredAlert(null);
      setAlerts(loadAlerts());
    }
    
    // Redirect to dashboard tab to immediately visualize changes
    setTimeout(() => {
      setActiveTab('dashboard');
    }, 1000);
  };

  const handleUpdateReading = async (updated: SugarReading) => {
    updateReading(updated);
    setReadings(prev => prev.map(r => r.id === updated.id ? updated : r));

    // Real-time Cloud Sync
    const supabase = getSupabaseClient();
    if (supabase && user) {
      try {
        await supabase.from('blood_sugar_readings').upsert({
          id: updated.id,
          user_id: user.id,
          value: updated.value,
          unit: updated.unit,
          context: updated.context,
          notes: updated.notes || '',
          measured_at: updated.measuredAt
        });
      } catch (e) {
        console.error('Failed to sync updated reading to cloud:', e);
      }
    }
  };

  const handleDeleteReading = async (id: string) => {
    deleteReading(id);
    setReadings(prev => prev.filter(r => r.id !== id));

    // Real-time Cloud Sync
    const supabase = getSupabaseClient();
    if (supabase && user) {
      try {
        await supabase.from('blood_sugar_readings').delete().eq('id', id);
      } catch (e) {
        console.error('Failed to sync reading deletion to cloud:', e);
      }
    }
  };

  // --- Alerts CRUD Bindings (with Supabase Sync) ---
  const handleAddAlert = async (alert: Omit<InAppAlert, 'id'>) => {
    const added = addAlert(alert);
    setAlerts(prev => [...prev, added]);

    const supabase = getSupabaseClient();
    if (supabase && user) {
      try {
        await supabase.from('blood_sugar_alerts').insert({
          id: added.id,
          user_id: user.id,
          type: added.type,
          time: added.time,
          label: added.label,
          is_active: added.isActive,
          meal_type: added.mealType,
          frequency: added.frequency || 'daily',
          start_date: added.startDate || new Date().toISOString().slice(0, 10),
          last_triggered_date: added.lastTriggeredDate
        });
      } catch (e) {
        console.error('Failed to sync new alert to cloud:', e);
      }
    }
  };

  const handleUpdateAlert = async (updated: InAppAlert) => {
    updateAlert(updated);
    setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));

    const supabase = getSupabaseClient();
    if (supabase && user) {
      try {
        await supabase.from('blood_sugar_alerts').upsert({
          id: updated.id,
          user_id: user.id,
          type: updated.type,
          time: updated.time,
          label: updated.label,
          is_active: updated.isActive,
          meal_type: updated.mealType,
          frequency: updated.frequency || 'daily',
          start_date: updated.startDate || new Date().toISOString().slice(0, 10),
          last_triggered_date: updated.lastTriggeredDate
        });
      } catch (e) {
        console.error('Failed to sync alert update to cloud:', e);
      }
    }
  };

  const handleDeleteAlert = async (id: string) => {
    deleteAlert(id);
    setAlerts(prev => prev.filter(a => a.id !== id));

    const supabase = getSupabaseClient();
    if (supabase && user) {
      try {
        await supabase.from('blood_sugar_alerts').delete().eq('id', id);
      } catch (e) {
        console.error('Failed to sync alert deletion to cloud:', e);
      }
    }
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
      {skippedAlertToast && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3000,
            background: 'var(--bg-card)',
            border: '1.5px solid var(--emerald)',
            borderRadius: '12px',
            padding: '12px 18px',
            fontSize: '11px',
            color: 'var(--emerald)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'slideDown 0.3s ease-out',
            width: 'calc(100% - 40px)',
            maxWidth: '400px'
          }}
        >
          <span>✨</span>
          <span style={{ fontWeight: 'bold' }}>{skippedAlertToast}</span>
        </div>
      )}

      {activeTriggeredAlert && (
        <AlertBanner
          alert={activeTriggeredAlert}
          onSnooze={handleSnoozeAlert}
          onLogNow={handleLogNow}
        />
      )}

      {/* Sleek App Header */}
      <header className="app-header">
        <div className="brand-section">
          <img 
            src="/logo.png" 
            alt="GlucoSync Logo" 
            style={{ 
              width: '46px', 
              height: '46px', 
              borderRadius: '10px', 
              objectFit: 'cover',
              boxShadow: '-5px -5px 15px rgba(139, 92, 246, 0.45), 5px 5px 15px rgba(6, 182, 212, 0.2)'
            }} 
          />
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
                setActiveTab('profile');
                if ('vibrate' in navigator) {
                  navigator.vibrate(20);
                }
              }}
              title={`Signed in as ${user.name}. Click to view profile settings.`}
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

        {activeTab === 'profile' && (
          <ProfileView 
            user={user}
            onLoginClick={handleTriggerRealOAuth}
            onLogoutClick={handleLogout}
            readingsCount={readings.length}
            onSyncTrigger={handleSyncReadings}
            alerts={alerts}
            onAddAlert={handleAddAlert}
            onUpdateAlert={handleUpdateAlert}
            onDeleteAlert={handleDeleteAlert}
            preferredUnit={preferredUnit}
            onUnitToggle={handleUnitToggle}
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
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
          aria-label="View Profile and Cloud Sync"
        >
          <div className="nav-item-icon-wrapper">
            <User size={20} />
          </div>
          <span>Profile</span>
        </button>
      </nav>
    </>
  );
}

export default App;
