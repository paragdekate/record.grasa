import AsyncStorage from '@react-native-async-storage/async-storage';

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
  value: number; // Stored in mg/dL internally
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
  inRangePercentage: number; // percentage in 70-140 mg/dL
  lowCount: number;
  normalCount: number;
  highCount: number;
  veryHighCount: number;
}

export interface InAppAlert {
  id: string;
  type: 'meal' | 'record';
  time: string; // "HH:MM" 24h format
  label: string;
  isActive: boolean;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'bedtime' | 'other';
  lastTriggeredDate?: string; // Format: "YYYY-MM-DD"
  frequency?: 'daily' | 'alternate';
  startDate?: string; // "YYYY-MM-DD"
}

const READINGS_KEY = 'blood_sugar_readings';
const ALERTS_KEY = 'blood_sugar_alerts';

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

// Readings CRUD operations using AsyncStorage
export async function loadReadings(): Promise<SugarReading[]> {
  try {
    const stored = await AsyncStorage.getItem(READINGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load readings:', e);
    return [];
  }
}

export async function saveReadings(readings: SugarReading[]): Promise<void> {
  try {
    await AsyncStorage.setItem(READINGS_KEY, JSON.stringify(readings));
  } catch (e) {
    console.error('Failed to save readings:', e);
  }
}

export async function addReading(reading: Omit<SugarReading, 'id'>): Promise<SugarReading> {
  const newReading: SugarReading = {
    ...reading,
    id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) // simple uuid alternative
  };
  const readings = await loadReadings();
  readings.unshift(newReading);
  await saveReadings(readings);
  return newReading;
}

export async function updateReading(updated: SugarReading): Promise<void> {
  const readings = await loadReadings();
  const index = readings.findIndex(r => r.id === updated.id);
  if (index !== -1) {
    readings[index] = updated;
    await saveReadings(readings);
  }
}

export async function deleteReading(id: string): Promise<void> {
  const readings = await loadReadings();
  const filtered = readings.filter(r => r.id !== id);
  await saveReadings(filtered);
}

// Alerts CRUD operations using AsyncStorage
export async function loadAlerts(): Promise<InAppAlert[]> {
  try {
    const stored = await AsyncStorage.getItem(ALERTS_KEY);
    if (!stored) {
      // Default alerts matching the main app if none set
      const defaultAlerts: InAppAlert[] = [
        { id: '1', type: 'record', time: '08:00', label: 'Morning fasting check', isActive: true, frequency: 'daily' },
        { id: '2', type: 'meal', time: '10:00', label: 'After breakfast check', isActive: false, mealType: 'breakfast', frequency: 'daily' },
        { id: '3', type: 'record', time: '21:00', label: 'Bedtime sugar check', isActive: true, frequency: 'daily' }
      ];
      await saveAlerts(defaultAlerts);
      return defaultAlerts;
    }
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load alerts:', e);
    return [];
  }
}

export async function saveAlerts(alerts: InAppAlert[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  } catch (e) {
    console.error('Failed to save alerts:', e);
  }
}

export async function addAlert(alert: Omit<InAppAlert, 'id'>): Promise<InAppAlert> {
  const newAlert: InAppAlert = {
    ...alert,
    id: Math.random().toString(36).substring(2, 15)
  };
  const alerts = await loadAlerts();
  alerts.push(newAlert);
  await saveAlerts(alerts);
  return newAlert;
}

export async function updateAlert(updated: InAppAlert): Promise<void> {
  const alerts = await loadAlerts();
  const index = alerts.findIndex(a => a.id === updated.id);
  if (index !== -1) {
    alerts[index] = updated;
    await saveAlerts(alerts);
  }
}

export async function deleteAlert(id: string): Promise<void> {
  const alerts = await loadAlerts();
  const filtered = alerts.filter(a => a.id !== id);
  await saveAlerts(filtered);
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
