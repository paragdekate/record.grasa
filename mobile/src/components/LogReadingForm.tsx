import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { convertValue, MMOL_TO_MGDL, getStatus, getStatusColor } from '../db';
import type { ReadingUnit, ReadingContext } from '../db';
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
  const [rawValue, setRawValue] = useState<number>(100);
  const [displayValue, setDisplayValue] = useState<string>('100');
  const [context, setContext] = useState<ReadingContext>('fasting');
  const [notes, setNotes] = useState<string>('');
  const [measuredAt, setMeasuredAt] = useState<string>('');
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    setUnit(preferredUnit);
    const converted = convertValue(100, 'mg/dL', preferredUnit);
    setDisplayValue(converted.toString());
    setRawValue(100);
  }, [preferredUnit]);

  useEffect(() => {
    setMeasuredAt(new Date().toISOString());
  }, []);

  const handleUnitToggle = (newUnit: ReadingUnit) => {
    if (newUnit === unit) return;
    
    const parsedVal = parseFloat(displayValue) || 0;
    const convertedVal = convertValue(parsedVal, unit, newUnit);
    
    setUnit(newUnit);
    setDisplayValue(convertedVal.toString());

    if (newUnit === 'mg/dL') {
      setRawValue(Math.round(convertedVal));
    } else {
      setRawValue(Math.round(parsedVal * MMOL_TO_MGDL));
    }
  };

  const handleInputChange = (valStr: string) => {
    setDisplayValue(valStr);
    const parsedVal = parseFloat(valStr) || 0;
    
    if (unit === 'mg/dL') {
      setRawValue(Math.round(parsedVal));
    } else {
      setRawValue(Math.round(parsedVal * MMOL_TO_MGDL));
    }
  };

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
  };

  const handleScanSuccess = (valueInMgDl: number) => {
    setRawValue(valueInMgDl);
    const converted = convertValue(valueInMgDl, 'mg/dL', unit);
    setDisplayValue(converted.toString());
    setShowScanner(false);
  };

  const handleSubmit = () => {
    const parsed = parseFloat(displayValue);
    if (!parsed || parsed <= 0) {
      Alert.alert('Invalid Reading', 'Please enter a valid blood sugar reading.');
      return;
    }

    onAddReading({
      value: rawValue,
      unit: unit,
      context: context,
      notes: notes.trim(),
      measuredAt: new Date().toISOString(),
    });

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setNotes('');
    }, 1500);
  };

  const status = getStatus(rawValue);
  const statusColor = getStatusColor(status);

  const contextOptions: { label: string; value: ReadingContext }[] = [
    { label: 'Fasting 🌅', value: 'fasting' },
    { label: 'Before Breakfast 🍳', value: 'before_breakfast' },
    { label: 'After Breakfast 🥞', value: 'after_breakfast' },
    { label: 'Before Lunch 🍱', value: 'before_lunch' },
    { label: 'After Lunch 🥗', value: 'after_lunch' },
    { label: 'Before Dinner 🥩', value: 'before_dinner' },
    { label: 'After Dinner 🍝', value: 'after_dinner' },
    { label: 'Bedtime 🌙', value: 'bedtime' },
    { label: 'Other ❓', value: 'other' },
  ];

  if (showScanner) {
    return (
      <CameraScanner
        onScanSuccess={handleScanSuccess}
        onClose={() => setShowScanner(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>NEW BLOOD GLUCOSE ENTRY</Text>
          <TouchableOpacity onPress={() => setShowScanner(true)} style={styles.scanBtn}>
            <Text style={styles.scanBtnText}>📸 OCR Scan Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Big value layout */}
        <View style={styles.valueDisplayCard}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {status.toUpperCase().replace('_', ' ')}
          </Text>

          <View style={styles.mainInputRow}>
            <TextInput
              keyboardType="numeric"
              style={styles.mainInput}
              value={displayValue}
              onChangeText={handleInputChange}
            />
            <Text style={styles.mainUnitLabel}>{unit}</Text>
          </View>

          {/* Unit Toggle buttons */}
          <View style={styles.unitToggleRow}>
            {(['mg/dL', 'mmol/L'] as const).map(u => (
              <TouchableOpacity
                key={u}
                onPress={() => handleUnitToggle(u)}
                style={[styles.unitToggleBtn, unit === u && styles.unitToggleBtnActive]}
              >
                <Text style={[styles.unitToggleText, unit === u && styles.unitToggleTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Adjustment buttons */}
          <View style={styles.adjustRow}>
            <TouchableOpacity onPress={() => adjustValue(-10)} style={styles.adjustBtn}>
              <Text style={styles.adjustBtnText}>-10</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => adjustValue(-1)} style={styles.adjustBtn}>
              <Text style={styles.adjustBtnText}>-1</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => adjustValue(1)} style={styles.adjustBtn}>
              <Text style={styles.adjustBtnText}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => adjustValue(10)} style={styles.adjustBtn}>
              <Text style={styles.adjustBtnText}>+10</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Context Selection */}
      <View style={styles.card}>
        <Text style={styles.cardTitleSection}>MEASUREMENT CONTEXT</Text>
        <View style={styles.contextGrid}>
          {contextOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              onPress={() => setContext(option.value)}
              style={[
                styles.contextBtn,
                context === option.value && styles.contextBtnActive,
              ]}
            >
              <Text style={[styles.contextBtnText, context === option.value && styles.contextBtnTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notes & Submission */}
      <View style={styles.card}>
        <Text style={styles.cardTitleSection}>NOTES</Text>
        <TextInput
          placeholder="Add optional comments (e.g. insulin doses, food eaten, etc.)"
          placeholderTextColor="#6b7280"
          value={notes}
          onChangeText={setNotes}
          style={styles.notesInput}
          multiline
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSuccess}
          style={[styles.submitBtn, isSuccess && styles.successSubmitBtn]}
        >
          <Text style={styles.submitBtnText}>
            {isSuccess ? 'Saved successfully! ✓' : 'Save Glucose Reading'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    backgroundColor: '#141620',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTitleSection: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  scanBtn: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  scanBtnText: {
    color: '#06b6d4',
    fontSize: 11,
    fontWeight: 'bold',
  },
  valueDisplayCard: {
    backgroundColor: '#1a1d2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  mainInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainInput: {
    color: '#f3f4f6',
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 120,
  },
  mainUnitLabel: {
    color: '#6b7280',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  unitToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  unitToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#141620',
  },
  unitToggleBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  unitToggleText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: 'bold',
  },
  unitToggleTextActive: {
    color: '#ffffff',
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  adjustBtn: {
    flex: 1,
    backgroundColor: '#141620',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  adjustBtnText: {
    color: '#f3f4f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextBtn: {
    backgroundColor: '#1a1d2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  contextBtnActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: '#8b5cf6',
  },
  contextBtnText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  contextBtnTextActive: {
    color: '#8b5cf6',
    fontWeight: 'bold',
  },
  notesInput: {
    backgroundColor: '#1a1d2a',
    color: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  successSubmitBtn: {
    backgroundColor: '#10b981',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
