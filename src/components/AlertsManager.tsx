import React, { useState } from 'react';
import type { InAppAlert } from '../db';
import { Bell, BellOff, Clock, Plus, Trash2, X, Utensils, AlertTriangle } from 'lucide-react';

interface AlertsManagerProps {
  alerts: InAppAlert[];
  onAddAlert: (alert: Omit<InAppAlert, 'id'>) => void;
  onUpdateAlert: (alert: InAppAlert) => void;
  onDeleteAlert: (id: string) => void;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  alerts,
  onAddAlert,
  onUpdateAlert,
  onDeleteAlert
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New alert form states
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('08:00');
  const [type, setType] = useState<'meal' | 'record'>('meal');
  const [mealType, setMealType] = useState<Required<InAppAlert>['mealType']>('breakfast');
  const [frequency, setFrequency] = useState<'daily' | 'alternate'>('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const handleToggleActive = (alert: InAppAlert) => {
    onUpdateAlert({ ...alert, isActive: !alert.isActive });
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this alert?')) {
      onDeleteAlert(id);
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return;

    const newLabel = label.trim() || (type === 'meal' 
      ? `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Glucose Check` 
      : 'Glucose Logging Reminder');

    onAddAlert({
      type,
      time,
      label: newLabel,
      isActive: true,
      mealType: type === 'meal' ? mealType : undefined,
      frequency: type === 'record' ? frequency : 'daily',
      startDate: type === 'record' ? startDate : new Date().toISOString().slice(0, 10)
    });

    // Reset form
    setLabel('');
    setTime('08:00');
    setShowAddForm(false);

    if ('vibrate' in navigator) {
      navigator.vibrate([40, 40]);
    }
  };

  // Sort alerts chronologically (ascending HH:MM)
  const sortedAlerts = [...alerts].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Header section with add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} className="text-accent" />
          <h4 style={{ fontSize: '13px', fontWeight: 'bold' }}>In-App Reminders</h4>
        </div>
        
        {!showAddForm && (
          <button 
            type="button" 
            className="btn btn-secondary btn-xs"
            onClick={() => setShowAddForm(true)}
            style={{ gap: '4px', borderRadius: '10px' }}
          >
            <Plus size={12} />
            <span>Add Alert</span>
          </button>
        )}
      </div>

      {/* Add Alert Form Container */}
      {showAddForm && (
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--accent-border)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--accent)', letterSpacing: '0.5px' }}>
              CREATE NEW ALERT
            </span>
            <button 
              type="button" 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              onClick={() => setShowAddForm(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Toggle Type */}
          <div className="form-group">
            <label className="input-label">ALERT PURPOSE</label>
            <div className="unit-toggle-pill inline-flex" style={{ width: '100%' }}>
              <button
                type="button"
                className={type === 'meal' ? 'active' : ''}
                onClick={() => setType('meal')}
                style={{ flex: 1 }}
              >
                Meal Check
              </button>
              <button
                type="button"
                className={type === 'record' ? 'active' : ''}
                onClick={() => setType('record')}
                style={{ flex: 1 }}
              >
                Record Overdue (Beeps)
              </button>
            </div>
          </div>

          {/* Time Picker */}
          <div className="form-group">
            <label className="input-label">TRIGGER TIME</label>
            <div className="input-wrapper">
              <Clock className="input-icon" size={14} />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="text-input font-mono"
                required
              />
            </div>
          </div>

          {/* Meal selector (If type === meal) */}
          {type === 'meal' && (
            <div className="form-group">
              <label className="input-label">MEAL EVENT TYPE</label>
              <div className="context-pills-grid">
                {(['breakfast', 'lunch', 'dinner', 'bedtime', 'other'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`context-pill ${mealType === m ? 'active' : ''}`}
                    onClick={() => setMealType(m)}
                    style={{ fontSize: '10px', padding: '6px 10px' }}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Frequency & Start Date Picker (Only if type === 'record') */}
          {type === 'record' && (
            <>
              <div className="form-group">
                <label className="input-label">REMINDER FREQUENCY</label>
                <div className="unit-toggle-pill inline-flex" style={{ width: '100%' }}>
                  <button
                    type="button"
                    className={frequency === 'daily' ? 'active' : ''}
                    onClick={() => setFrequency('daily')}
                    style={{ flex: 1 }}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    className={frequency === 'alternate' ? 'active' : ''}
                    onClick={() => setFrequency('alternate')}
                    style={{ flex: 1 }}
                  >
                    Alternate Days
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">START DATE</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-input"
                  required
                />
              </div>
            </>
          )}

          {/* Custom Label */}
          <div className="form-group">
            <label className="input-label">CUSTOM LABEL (OPTIONAL)</label>
            <input
              type="text"
              placeholder={type === 'meal' ? 'e.g. Post-Lunch Check' : 'e.g. Shaky? Remember to log'}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="text-input"
            />
          </div>

          {type === 'record' && (
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '135%' }}>
              ℹ️ <strong>Record reminders</strong> will double-beep and blink every 15 minutes starting from the trigger time until you log a glucose reading.
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button type="submit" className="btn btn-primary btn-sm flex-1">
              Create Alert
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List of Alerts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sortedAlerts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '16px',
            background: 'var(--bg-input)',
            borderRadius: '12px',
            border: '1px dashed var(--border-color)',
            fontSize: '11px',
            color: 'var(--text-secondary)'
          }}>
            No alerts set. Tap "Add Alert" to schedule one.
          </div>
        ) : (
          sortedAlerts.map((al) => (
            <div 
              key={al.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '12px 14px',
                opacity: al.isActive ? 1 : 0.6,
                transition: 'opacity 0.25s ease'
              }}
            >
              {/* Alert Meta details */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div 
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: al.isActive 
                      ? (al.type === 'meal' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)') 
                      : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: al.isActive 
                      ? (al.type === 'meal' ? 'var(--accent)' : 'var(--red)') 
                      : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {al.type === 'meal' ? <Utensils size={14} /> : <AlertTriangle size={14} />}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{al.time}</span>
                    <span 
                      style={{ 
                        fontSize: '8px', 
                        fontWeight: '800', 
                        padding: '1px 4px', 
                        borderRadius: '4px',
                        backgroundColor: al.type === 'meal' ? 'var(--accent-glow)' : 'rgba(239,68,68,0.1)',
                        color: al.type === 'meal' ? 'var(--accent)' : 'var(--red)'
                      }}
                    >
                      {al.type === 'meal' ? 'MEAL' : 'LOG REMINDER'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500 }}>{al.label}</span>
                    {al.type === 'record' && (
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                        🔁 {al.frequency === 'alternate' ? 'Alternate Days' : 'Daily'} starting {al.startDate || 'today'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Toggle switch and Delete */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleToggleActive(al)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: al.isActive ? 'var(--emerald)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                  title={al.isActive ? 'Turn Off Alert' : 'Turn On Alert'}
                >
                  {al.isActive ? <Bell size={18} /> : <BellOff size={18} />}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(al.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                  title="Delete Alert"
                >
                  <Trash2 size={14} />
                </button>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
};
