import { useState, useEffect } from 'react';
import { 
  loadReadings, 
  saveReadings, 
  addReading, 
  updateReading, 
  deleteReading, 
  generateMockReadings,
  getStatus,
  getStatusColor,
  convertValue
} from './db';
import type { SugarReading, ReadingUnit } from './db';
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

  // 1. Initial Data Load
  useEffect(() => {
    // Load readings (will auto-populate mock data if storage is empty)
    const stored = loadReadings();
    setReadings(stored);

    // Load preferred unit
    const savedUnit = localStorage.getItem('glucose_preferred_unit') as ReadingUnit;
    if (savedUnit === 'mg/dL' || savedUnit === 'mmol/L') {
      setPreferredUnit(savedUnit);
    }
  }, []);

  // 2. Change Unit Handler
  const handleUnitToggle = (unit: ReadingUnit) => {
    setPreferredUnit(unit);
    localStorage.setItem('glucose_preferred_unit', unit);
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  };

  // 3. CRUD Bindings
  const handleAddReading = (newReading: Omit<SugarReading, 'id'>) => {
    const added = addReading(newReading);
    setReadings(prev => [added, ...prev]);
    
    // Redirect to dashboard so they see the new data plotted immediately
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

  const handleResetMockData = () => {
    if (window.confirm('This will replace your current readings with standard mock data for the last 10 days. Continue?')) {
      const mock = generateMockReadings();
      saveReadings(mock);
      setReadings(mock);
    }
  };

  // 4. Extract latest reading details for header banner
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
              onResetMockData={handleResetMockData}
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
          <SupabaseSchema />
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
