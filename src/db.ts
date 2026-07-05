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
