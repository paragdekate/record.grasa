import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform, Modal } from 'react-native';
import { convertValue, MMOL_TO_MGDL, getStatus, getStatusColor, getContextLabel } from '../db';
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
      unit: 'mg/dL', // Always store in mg/dL internally
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

  const contextOptions: ReadingContext[] = [
    'fasting',
    'before_breakfast',
    'after_breakfast',
    'before_lunch',
    'after_lunch',
    'before_dinner',
    'after_dinner',
    'bedtime',
    'other',
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Modal
        visible={showScanner}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.scannerModalContent}>
            <CameraScanner
              onScanSuccess={handleScanSuccess}
              onClose={() => setShowScanner(false)}
            />
          </View>
        </View>
      </Modal>

      <View style={styles.logForm}>
        {/* Unit & Scanner Header Row */}
        <View style={styles.formHeaderRow}>
          <View style={styles.unitTogglePill}>
            <TouchableOpacity
              onPress={() => handleUnitToggle('mg/dL')}
              style={[styles.unitToggleBtn, unit === 'mg/dL' && styles.unitToggleBtnActive]}
            >
              <Text style={[styles.unitToggleBtnText, unit === 'mg/dL' && styles.unitToggleBtnTextActive]}>
                mg/dL
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleUnitToggle('mmol/L')}
              style={[styles.unitToggleBtn, unit === 'mmol/L' && styles.unitToggleBtnActive]}
            >
              <Text style={[styles.unitToggleBtnText, unit === 'mmol/L' && styles.unitToggleBtnTextActive]}>
                mmol/L
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setShowScanner(true)} style={styles.btnScan}>
            <Text style={styles.btnScanText}>📸 Scan Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Core Value Entry Wheel */}
        <View style={[styles.valueEntryWheel, { borderColor: `${statusColor}22` }]}>
          <View style={[styles.adjusterButtons, styles.colLeft]}>
            <TouchableOpacity onPress={() => adjustValue(-10)} style={styles.btnAdj}>
              <Text style={styles.btnAdjText}>-10</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => adjustValue(-1)} style={[styles.btnAdj, styles.sub]}>
              <Text style={styles.btnAdjText}>-1</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.displayNumericContainer}>
            <TextInput
              keyboardType="numeric"
              value={displayValue}
              onChangeText={handleInputChange}
              style={[styles.sugarNumericInput, { color: statusColor }]}
            />
            <Text style={styles.displayUnit}>{unit}</Text>
            <View style={[styles.displayStatusBadge, { backgroundColor: `${statusColor}15` }]}>
              <Text style={[styles.displayStatusText, { color: statusColor }]}>
                {status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={[styles.adjusterButtons, styles.colRight]}>
            <TouchableOpacity onPress={() => adjustValue(10)} style={styles.btnAdj}>
              <Text style={styles.btnAdjText}>+10</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => adjustValue(1)} style={[styles.btnAdj, styles.sub]}>
              <Text style={styles.btnAdjText}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Context Grid Pills */}
        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>WHEN WAS THIS TAKEN?</Text>
          <View style={styles.contextPillsGrid}>
            {contextOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => setContext(opt)}
                style={[styles.contextPill, context === opt && styles.contextPillActive]}
              >
                <Text style={[styles.contextPillText, context === opt && styles.contextPillTextActive]}>
                  {getContextLabel(opt)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes Textarea */}
        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>NOTES</Text>
          <TextInput
            placeholder="Add comments (e.g. insulin, food, exercise)"
            placeholderTextColor="#6b7280"
            value={notes}
            onChangeText={setNotes}
            style={styles.notesInput}
            multiline
          />
        </View>

        {/* Submit button */}
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
  },
  logForm: {
    gap: 20,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitTogglePill: {
    flexDirection: 'row',
    backgroundColor: '#141620',
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  unitToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  unitToggleBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  unitToggleBtnText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: 'bold',
  },
  unitToggleBtnTextActive: {
    color: '#ffffff',
  },
  btnScan: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  btnScanText: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: 'bold',
  },
  valueEntryWheel: {
    backgroundColor: '#141620',
    borderRadius: 160,
    aspectRatio: 1,
    width: '100%',
    maxHeight: 280,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  adjusterButtons: {
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
  },
  colLeft: {
    alignItems: 'flex-start',
  },
  colRight: {
    alignItems: 'flex-end',
  },
  btnAdj: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1d2a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sub: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#161924',
  },
  btnAdjText: {
    color: '#f3f4f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  displayNumericContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sugarNumericInput: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    padding: 0,
    margin: 0,
    height: 60,
    width: '100%',
  },
  displayUnit: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: -2,
    marginBottom: 6,
  },
  displayStatusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  displayStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  formGroup: {
    gap: 8,
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  contextPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextPill: {
    backgroundColor: '#141620',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  contextPillActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: '#8b5cf6',
  },
  contextPillText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  contextPillTextActive: {
    color: '#8b5cf6',
    fontWeight: 'bold',
  },
  notesInput: {
    backgroundColor: '#141620',
    color: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  submitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 8,
  },
  successSubmitBtn: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scannerModalContent: {
    width: '100%',
    maxWidth: 340,
    height: 480,
    backgroundColor: '#000000',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});
