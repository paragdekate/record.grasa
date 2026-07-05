import React, { useState, useEffect } from 'react';
import { convertValue, MMOL_TO_MGDL, getStatus, getStatusColor, getContextLabel } from '../db';
import type { ReadingUnit, ReadingContext } from '../db';
import { Camera, Calendar, Check, Plus, Minus } from 'lucide-react';
import { CameraScanner } from './CameraScanner';

interface LogReadingFormProps {
  onAddReading: (reading: {
    value: number;
    unit: ReadingUnit;
    context: ReadingContext;
    notes: string;
    measuredAt: string;
  }) => void;
  preferredUnit: ReadingUnit;
}

export const LogReadingForm: React.FC<LogReadingFormProps> = ({ onAddReading, preferredUnit }) => {
  const [unit, setUnit] = useState<ReadingUnit>(preferredUnit);
  const [rawValue, setRawValue] = useState<number>(100); // Internally tracking in mg/dL
  const [displayValue, setDisplayValue] = useState<string>('100'); // What user sees and edits
  const [context, setContext] = useState<ReadingContext>('fasting');
  const [notes, setNotes] = useState<string>('');
  const [measuredAt, setMeasuredAt] = useState<string>('');
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Sync state with default preferred unit
  useEffect(() => {
    setUnit(preferredUnit);
    const converted = convertValue(100, 'mg/dL', preferredUnit);
    setDisplayValue(converted.toString());
    setRawValue(100);
  }, [preferredUnit]);

  // Set default datetime to now (local timezone formatted for datetime-local input)
  useEffect(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setMeasuredAt(localISOTime);
  }, []);

  // Update internal value whenever unit switches
  const handleUnitToggle = (newUnit: ReadingUnit) => {
    if (newUnit === unit) return;
    
    const parsedVal = parseFloat(displayValue) || 0;
    const convertedVal = convertValue(parsedVal, unit, newUnit);
    
    setUnit(newUnit);
    setDisplayValue(convertedVal.toString());

    // Update raw value in mg/dL
    if (newUnit === 'mg/dL') {
      setRawValue(Math.round(convertedVal));
    } else {
      setRawValue(Math.round(parsedVal * MMOL_TO_MGDL));
    }
  };

  // Safe input changer
  const handleInputChange = (valStr: string) => {
    setDisplayValue(valStr);
    const parsedVal = parseFloat(valStr) || 0;
    
    if (unit === 'mg/dL') {
      setRawValue(Math.round(parsedVal));
    } else {
      setRawValue(Math.round(parsedVal * MMOL_TO_MGDL));
    }
  };

  // Quick adjust buttons (+1, +10, -1, -10)
  const adjustValue = (amount: number) => {
    const currentVal = parseFloat(displayValue) || 0;
    const step = unit === 'mmol/L' ? amount / 10 : amount;
    const newVal = Math.max(0, currentVal + step);
    const rounded = unit === 'mmol/L' ? Math.round(newVal * 10) / 10 : Math.round(newVal);
    
    setDisplayValue(rounded.toString());
    
    if (unit === 'mg/dL') {
      setRawValue(rounded);
    } else {
      setRawValue(Math.round(rounded * MMOL_TO_MGDL));
    }

    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleScanSuccess = (valueInMgDl: number) => {
    // Fill values based on scan
    setRawValue(valueInMgDl);
    const converted = convertValue(valueInMgDl, 'mg/dL', unit);
    setDisplayValue(converted.toString());
    
    // Animate scan input glow
    const inputEl = document.getElementById('sugar-input');
    if (inputEl) {
      inputEl.classList.add('scan-success-glow');
      setTimeout(() => inputEl.classList.remove('scan-success-glow'), 1500);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalValue = parseFloat(displayValue);
    if (!finalValue || finalValue <= 0) return;

    // Convert display value back to mg/dL for consistent db storage
    const valInMgDl = unit === 'mg/dL' ? finalValue : Math.round(finalValue * MMOL_TO_MGDL);

    onAddReading({
      value: valInMgDl,
      unit: 'mg/dL', // Always store in mg/dL internally
      context,
      notes,
      measuredAt: new Date(measuredAt).toISOString()
    });

    // Reset Form with UX feedback
    setIsSuccess(true);
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    setTimeout(() => {
      setIsSuccess(false);
      setNotes('');
      // Reset datetime to now
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      setMeasuredAt(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16));
    }, 1200);
  };

  // Determine current category and color for background rings
  const readingStatus = getStatus(rawValue);
  const statusColor = getStatusColor(readingStatus);

  const contextOptions: ReadingContext[] = [
    'fasting',
    'before_breakfast',
    'after_breakfast',
    'before_lunch',
    'after_lunch',
    'before_dinner',
    'after_dinner',
    'bedtime',
    'other'
  ];

  return (
    <div className="log-form-container">
      {showScanner && (
        <CameraScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="log-form">
        {/* Unit & Scanner Header Row */}
        <div className="form-header-row">
          <div className="unit-toggle-pill">
            <button
              type="button"
              className={unit === 'mg/dL' ? 'active' : ''}
              onClick={() => handleUnitToggle('mg/dL')}
            >
              mg/dL
            </button>
            <button
              type="button"
              className={unit === 'mmol/L' ? 'active' : ''}
              onClick={() => handleUnitToggle('mmol/L')}
            >
              mmol/L
            </button>
          </div>

          <button
            type="button"
            className="btn-scan"
            onClick={() => setShowScanner(true)}
            aria-label="Scan reading with camera"
          >
            <Camera size={16} />
            <span>Scan Camera</span>
          </button>
        </div>

        {/* Core Value Slider / Radial input container */}
        <div className="value-entry-wheel" style={{ borderColor: `${statusColor}22` }}>
          <div className="value-ring-glow" style={{ boxShadow: `0 0 40px ${statusColor}15` }}></div>
          
          <div className="adjuster-buttons col-left">
            <button type="button" className="btn-adj" onClick={() => adjustValue(-10)} aria-label="Decrease by 10">
              -10
            </button>
            <button type="button" className="btn-adj sub" onClick={() => adjustValue(-1)} aria-label="Decrease by 1">
              <Minus size={14} />
            </button>
          </div>

          <div className="display-numeric-container">
            <input
              id="sugar-input"
              type="number"
              step={unit === 'mmol/L' ? '0.1' : '1'}
              value={displayValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="sugar-numeric-input"
              style={{ color: statusColor }}
            />
            <span className="display-unit">{unit}</span>
            <span className="display-status-badge" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
              {readingStatus.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="adjuster-buttons col-right">
            <button type="button" className="btn-adj" onClick={() => adjustValue(10)} aria-label="Increase by 10">
              +10
            </button>
            <button type="button" className="btn-adj sub" onClick={() => adjustValue(1)} aria-label="Increase by 1">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Context Grid Pills */}
        <div className="form-group">
          <label className="input-label">WHEN WAS THIS TAKEN?</label>
          <div className="context-pills-grid">
            {contextOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`context-pill ${context === opt ? 'active' : ''}`}
                onClick={() => setContext(opt)}
              >
                {getContextLabel(opt)}
              </button>
            ))}
          </div>
        </div>

        {/* Date and Time Selector */}
        <div className="form-row">
          <div className="form-group flex-1">
            <label className="input-label" htmlFor="measured-date">DATE & TIME</label>
            <div className="input-wrapper">
              <Calendar className="input-icon" size={16} />
              <input
                id="measured-date"
                type="datetime-local"
                value={measuredAt}
                onChange={(e) => setMeasuredAt(e.target.value)}
                className="text-input font-mono"
                required
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="input-label" htmlFor="reading-notes">NOTES / MEALS / SYMPTOMS</label>
          <input
            id="reading-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Fasting breakfast, felt slightly weak..."
            className="text-input"
          />
        </div>

        {/* Submit Log Button */}
        <button
          type="submit"
          className={`btn btn-primary btn-block btn-lg ${isSuccess ? 'btn-success' : ''}`}
          disabled={isSuccess}
        >
          {isSuccess ? (
            <>
              <Check size={20} className="mr-2 animate-bounce" />
              <span>SAVED SUCCESSFULLY!</span>
            </>
          ) : (
            <span>LOG READING</span>
          )}
        </button>
      </form>
    </div>
  );
};
