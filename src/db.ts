export type ReadingUnit = 'mg/dL' | 'mmol/L';

export type ReadingContext = 
  | 'fasting' 
  | 'before_breakfast' 
  | 'after_breakfast' 
  | 'before_lunch' 
  | 'after_lunch' 
  | 'before_dinner' 
  | 'after_dinner' 
  | 'bedtime' 
  | 'other';

export interface SugarReading {
  id: string;
  value: number; // Stored in mg/dL for consistency internally, converted on display if needed
  unit: ReadingUnit;
  context: ReadingContext;
  notes: string;
  measuredAt: string; // ISO string
}

export interface SugarStats {
  average: number; // in mg/dL
  highest: number; // in mg/dL
  lowest: number; // in mg/dL
  totalCount: number;
  inRangePercentage: number; // percentage in 70-140 mg/dL (or custom target)
  lowCount: number;
  normalCount: number;
  highCount: number;
  veryHighCount: number;
}

const STORAGE_KEY = 'blood_sugar_readings';

// Conversion constant: 1 mmol/L = 18.0182 mg/dL
export const MMOL_TO_MGDL = 18.0182;

export function convertValue(value: number, from: ReadingUnit, to: ReadingUnit): number {
  if (from === to) return value;
  if (to === 'mmol/L') {
    return Math.round((value / MMOL_TO_MGDL) * 10) / 10;
  } else {
    return Math.round(value * MMOL_TO_MGDL);
  }
}

export function getStatus(valueMgDl: number): 'low' | 'normal' | 'high' | 'very_high' {
  if (valueMgDl < 70) return 'low';
  if (valueMgDl <= 140) return 'normal';
  if (valueMgDl <= 200) return 'high';
  return 'very_high';
}

export function getStatusColor(status: 'low' | 'normal' | 'high' | 'very_high'): string {
  switch (status) {
    case 'low': return '#06b6d4'; // Cyan
    case 'normal': return '#10b981'; // Emerald
    case 'high': return '#f59e0b'; // Amber
    case 'very_high': return '#ef4444'; // Red
  }
}

export function getContextLabel(context: ReadingContext): string {
  switch (context) {
    case 'fasting': return 'Fasting';
    case 'before_breakfast': return 'Before Breakfast';
    case 'after_breakfast': return 'After Breakfast';
    case 'before_lunch': return 'Before Lunch';
    case 'after_lunch': return 'After Lunch';
    case 'before_dinner': return 'Before Dinner';
    case 'after_dinner': return 'After Dinner';
    case 'bedtime': return 'Bedtime';
    case 'other': return 'Other';
  }
}

export function loadReadings(): SugarReading[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return [];
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse readings', e);
    return [];
  }
}

export function saveReadings(readings: SugarReading[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
}

export function addReading(reading: Omit<SugarReading, 'id'>): SugarReading {
  const newReading: SugarReading = {
    ...reading,
    id: crypto.randomUUID()
  };
  const readings = loadReadings();
  readings.unshift(newReading); // Add at the start (newest first)
  saveReadings(readings);
  return newReading;
}

export function updateReading(updated: SugarReading): void {
  const readings = loadReadings();
  const index = readings.findIndex(r => r.id === updated.id);
  if (index !== -1) {
    readings[index] = updated;
    saveReadings(readings);
  }
}

export function deleteReading(id: string): void {
  const readings = loadReadings();
  const filtered = readings.filter(r => r.id !== id);
  saveReadings(filtered);
}

export function calculateStats(readings: SugarReading[]): SugarStats {
  if (readings.length === 0) {
    return {
      average: 0,
      highest: 0,
      lowest: 0,
      totalCount: 0,
      inRangePercentage: 0,
      lowCount: 0,
      normalCount: 0,
      highCount: 0,
      veryHighCount: 0
    };
  }

  let sum = 0;
  let highest = -Infinity;
  let lowest = Infinity;
  let lowCount = 0;
  let normalCount = 0;
  let highCount = 0;
  let veryHighCount = 0;

  readings.forEach(r => {
    // Value is stored in mg/dL internally
    const val = r.value;
    sum += val;
    if (val > highest) highest = val;
    if (val < lowest) lowest = val;

    const status = getStatus(val);
    if (status === 'low') lowCount++;
    else if (status === 'normal') normalCount++;
    else if (status === 'high') highCount++;
    else if (status === 'very_high') veryHighCount++;
  });

  const totalCount = readings.length;
  const average = Math.round(sum / totalCount);
  const inRangePercentage = Math.round((normalCount / totalCount) * 100);

  return {
    average,
    highest,
    lowest: lowest === Infinity ? 0 : lowest,
    totalCount,
    inRangePercentage,
    lowCount,
    normalCount,
    highCount,
    veryHighCount
  };
}

// --- IN-APP ALERTS CONFIGURATION ---

export interface InAppAlert {
  id: string;
  type: 'meal' | 'record';
  time: string; // "HH:MM" 24h format
  label: string;
  isActive: boolean;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'bedtime' | 'other';
  lastTriggeredDate?: string; // Format: "YYYY-MM-DD" to avoid repeating same alert within same day
}

const ALERTS_KEY = 'blood_sugar_alerts';

// Synthesize a beep sound using Web Audio API (no external file dependencies)
export function playBeepSound(isUrgent: boolean = false): void {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playOscillator = (freq: number, duration: number, delay: number) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + delay + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);
      
      oscillator.start(audioCtx.currentTime + delay);
      oscillator.stop(audioCtx.currentTime + delay + duration);
    };

    if (isUrgent) {
      // Alarm double high beep (like a medical monitor)
      playOscillator(987.77, 0.15, 0); // B5 note
      playOscillator(987.77, 0.15, 0.2); // B5 note
    } else {
      // Gentle reminder notification chime
      playOscillator(523.25, 0.25, 0); // C5 note
      playOscillator(659.25, 0.35, 0.15); // E5 note
    }
  } catch (e) {
    console.warn('Web Audio API not supported or blocked by user gesture', e);
  }
}

export function loadAlerts(): InAppAlert[] {
  const stored = localStorage.getItem(ALERTS_KEY);
  if (!stored) {
    // Generate default alerts on first launch
    const defaults: InAppAlert[] = [
      {
        id: 'a-1',
        type: 'meal',
        time: '08:00',
        label: 'Breakfast Glucose Check',
        isActive: true,
        mealType: 'breakfast'
      },
      {
        id: 'a-2',
        type: 'record',
        time: '09:00',
        label: 'Morning Logging Reminder',
        isActive: false
      }
    ];
    saveAlerts(defaults);
    return defaults;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

export function saveAlerts(alerts: InAppAlert[]): void {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function addAlert(alert: Omit<InAppAlert, 'id'>): InAppAlert {
  const newAlert: InAppAlert = {
    ...alert,
    id: crypto.randomUUID()
  };
  const alerts = loadAlerts();
  alerts.push(newAlert);
  saveAlerts(alerts);
  return newAlert;
}

export function updateAlert(updated: InAppAlert): void {
  const alerts = loadAlerts();
  const index = alerts.findIndex(a => a.id === updated.id);
  if (index !== -1) {
    alerts[index] = updated;
    saveAlerts(alerts);
  }
}

export function deleteAlert(id: string): void {
  const alerts = loadAlerts();
  const filtered = alerts.filter(a => a.id !== id);
  saveAlerts(filtered);
}

