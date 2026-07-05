import React, { useState } from 'react';
import { convertValue, getStatus, getStatusColor, getContextLabel } from '../db';
import type { SugarReading, ReadingUnit, ReadingContext } from '../db';
import { Trash2, Edit2, Search, Filter, X, MessageSquare, Clock } from 'lucide-react';

interface HistoryListProps {
  readings: SugarReading[];
  unit: ReadingUnit;
  onUpdateReading: (reading: SugarReading) => void;
  onDeleteReading: (id: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  readings,
  unit,
  onUpdateReading,
  onDeleteReading
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContext, setSelectedContext] = useState<string>('all');
  const [editingReading, setEditingReading] = useState<SugarReading | null>(null);
  
  // States for Edit Modal
  const [editValue, setEditValue] = useState<string>('');
  const [editContext, setEditContext] = useState<ReadingContext>('fasting');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editUnit, setEditUnit] = useState<ReadingUnit>('mg/dL');

  // 1. Filtering logic
  const filteredReadings = readings.filter(r => {
    const matchesSearch = r.notes.toLowerCase().includes(searchTerm.toLowerCase()) || 
      getContextLabel(r.context).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesContext = selectedContext === 'all' || r.context === selectedContext;
    return matchesSearch && matchesContext;
  });

  // 2. Grouping logic by day
  const groupReadingsByDay = (items: SugarReading[]) => {
    const groups: { [key: string]: SugarReading[] } = {};
    items.forEach(item => {
      const dateStr = new Date(item.measuredAt).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(item);
    });
    return groups;
  };

  const groupedReadings = groupReadingsByDay(filteredReadings);

  const startEdit = (reading: SugarReading) => {
    setEditingReading(reading);
    setEditUnit(unit);
    // Display value based on preferred unit
    const displayVal = unit === 'mg/dL' ? reading.value : convertValue(reading.value, 'mg/dL', 'mmol/L');
    setEditValue(displayVal.toString());
    setEditContext(reading.context);
    setEditNotes(reading.notes);
    
    // Format ISO date to local datetime-local value
    const d = new Date(reading.measuredAt);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setEditDate(localTime);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReading) return;

    const val = parseFloat(editValue);
    if (!val || val <= 0) return;

    // Convert value back to mg/dL if needed for DB storage
    const valInMgDl = editUnit === 'mg/dL' ? val : Math.round(val * 18.0182);

    onUpdateReading({
      ...editingReading,
      value: valInMgDl,
      context: editContext,
      notes: editNotes,
      measuredAt: new Date(editDate).toISOString()
    });

    setEditingReading(null);
    if ('vibrate' in navigator) {
      navigator.vibrate(40);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this reading?')) {
      onDeleteReading(id);
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const contextOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'All Readings' },
    { value: 'fasting', label: 'Fasting' },
    { value: 'before_breakfast', label: 'Before Breakfast' },
    { value: 'after_breakfast', label: 'After Breakfast' },
    { value: 'before_lunch', label: 'Before Lunch' },
    { value: 'after_lunch', label: 'After Lunch' },
    { value: 'before_dinner', label: 'Before Dinner' },
    { value: 'after_dinner', label: 'After Dinner' },
    { value: 'bedtime', label: 'Bedtime' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="history-section">
      {/* Filters Card */}
      <div className="filters-card">
        <div className="filter-input-group">
          <Search size={16} className="filter-icon" />
          <input
            type="text"
            placeholder="Search notes or meals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="filter-search"
          />
          {searchTerm && (
            <button className="clear-btn" onClick={() => setSearchTerm('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-select-group">
          <Filter size={16} className="filter-icon" />
          <select
            value={selectedContext}
            onChange={(e) => setSelectedContext(e.target.value)}
            className="filter-select"
          >
            {contextOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List content */}
      {Object.keys(groupedReadings).length === 0 ? (
        <div className="empty-state py-8">
          <Search size={36} className="text-muted mb-2" />
          <p className="title">No logs matched filters</p>
          <p className="desc">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <div className="grouped-list">
          {Object.keys(groupedReadings).map(dayStr => (
            <div key={dayStr} className="day-group">
              <h3 className="day-title">{dayStr}</h3>
              <div className="day-items">
                {groupedReadings[dayStr].map(r => {
                  const status = getStatus(r.value);
                  const statusColor = getStatusColor(status);
                  const displayValue = unit === 'mg/dL' ? r.value : convertValue(r.value, 'mg/dL', 'mmol/L');

                  return (
                    <div key={r.id} className="history-item" style={{ borderLeft: `4px solid ${statusColor}` }}>
                      <div className="item-left">
                        <div className="item-time">
                          <Clock size={12} className="mr-1 opacity-60" />
                          <span>{formatTime(r.measuredAt)}</span>
                        </div>
                        <div className="item-context-pill" style={{ backgroundColor: `${statusColor}15`, color: statusColor }}>
                          {getContextLabel(r.context)}
                        </div>
                        {r.notes && (
                          <div className="item-notes">
                            <MessageSquare size={10} className="mr-1 opacity-70" />
                            <span>{r.notes}</span>
                          </div>
                        )}
                      </div>

                      <div className="item-right">
                        <div className="item-numeric">
                          <span className="val" style={{ color: statusColor }}>{displayValue}</span>
                          <span className="unit">{unit}</span>
                        </div>
                        
                        <div className="item-actions">
                          <button
                            className="action-btn edit"
                            onClick={() => startEdit(r)}
                            aria-label="Edit reading"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="action-btn delete"
                            onClick={() => handleDelete(r.id)}
                            aria-label="Delete reading"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Overlay Modal */}
      {editingReading && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Edit Reading</h3>
              <button className="modal-close" onClick={() => setEditingReading(null)} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="form-row-units">
                <div className="form-group flex-1">
                  <label className="input-label">VALUE</label>
                  <input
                    type="number"
                    step={editUnit === 'mmol/L' ? '0.1' : '1'}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="text-input font-bold text-center"
                    style={{ fontSize: '24px' }}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="input-label">UNIT</label>
                  <div className="unit-toggle-pill inline-flex">
                    <button
                      type="button"
                      className={editUnit === 'mg/dL' ? 'active' : ''}
                      onClick={() => {
                        if (editUnit === 'mmol/L') {
                          setEditUnit('mg/dL');
                          const converted = convertValue(parseFloat(editValue) || 0, 'mmol/L', 'mg/dL');
                          setEditValue(converted.toString());
                        }
                      }}
                    >
                      mg/dL
                    </button>
                    <button
                      type="button"
                      className={editUnit === 'mmol/L' ? 'active' : ''}
                      onClick={() => {
                        if (editUnit === 'mg/dL') {
                          setEditUnit('mmol/L');
                          const converted = convertValue(parseFloat(editValue) || 0, 'mg/dL', 'mmol/L');
                          setEditValue(converted.toString());
                        }
                      }}
                    >
                      mmol/L
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">CONTEXT</label>
                <select
                  value={editContext}
                  onChange={(e) => setEditContext(e.target.value as ReadingContext)}
                  className="text-input select-input"
                >
                  {contextOptions.filter(o => o.value !== 'all').map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="input-label">DATE & TIME</label>
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="text-input font-mono"
                  required
                />
              </div>

              <div className="form-group">
                <label className="input-label">NOTES</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="text-input"
                />
              </div>

              <div className="modal-footer-btns">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingReading(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
