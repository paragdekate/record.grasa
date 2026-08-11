import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Switch, ScrollView, Platform, Alert } from 'react-native';
import type { InAppAlert } from '../db';

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
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('08:00');
  const [type, setType] = useState<'meal' | 'record'>('meal');
  const [mealType, setMealType] = useState<Required<InAppAlert>['mealType']>('breakfast');
  const [frequency, setFrequency] = useState<'daily' | 'alternate'>('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const handleToggleActive = (alertItem: InAppAlert) => {
    onUpdateAlert({ ...alertItem, isActive: !alertItem.isActive });
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteAlert(id) }
      ]
    );
  };

  const handleSubmit = () => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      Alert.alert('Invalid Time', 'Please enter time in HH:MM format (e.g. 08:00).');
      return;
    }

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

    setLabel('');
    setTime('08:00');
    setShowAddForm(false);
  };

  const sortedAlerts = [...alerts].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>System Notification Reminders</Text>
        {!showAddForm && (
          <TouchableOpacity onPress={() => setShowAddForm(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add Alert</Text>
          </TouchableOpacity>
        )}
      </View>

      {showAddForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>New Alert</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Time (HH:MM 24h format)</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="e.g. 08:30"
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Label</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Morning Check"
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Alert Type</Text>
            <View style={styles.row}>
              {(['meal', 'record'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
                    {t === 'meal' ? 'Meal Check' : 'Log Reminder'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {type === 'meal' ? (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Meal Reference</Text>
              <View style={styles.row}>
                {(['breakfast', 'lunch', 'dinner', 'bedtime'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.smallBtn, mealType === m && styles.smallBtnActive]}
                    onPress={() => setMealType(m)}
                  >
                    <Text style={[styles.smallBtnText, mealType === m && styles.smallBtnTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Frequency</Text>
              <View style={styles.row}>
                {(['daily', 'alternate'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.typeBtn, frequency === f && styles.typeBtnActive]}
                    onPress={() => setFrequency(f)}
                  >
                    <Text style={[styles.typeBtnText, frequency === f && styles.typeBtnTextActive]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.formActions}>
            <TouchableOpacity onPress={() => setShowAddForm(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Add Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.alertsList}>
        {sortedAlerts.length === 0 ? (
          <Text style={styles.emptyText}>No reminders scheduled yet.</Text>
        ) : (
          sortedAlerts.map(alertItem => (
            <View key={alertItem.id} style={styles.alertRow}>
              <View style={styles.alertInfo}>
                <View style={styles.timeHeader}>
                  <Text style={styles.alertTime}>{alertItem.time}</Text>
                  <Text style={styles.alertBadge}>
                    {alertItem.type === 'meal' ? `Meal: ${alertItem.mealType}` : `Freq: ${alertItem.frequency}`}
                  </Text>
                </View>
                <Text style={styles.alertLabel}>{alertItem.label}</Text>
              </View>

              <View style={styles.alertActions}>
                <Switch
                  value={alertItem.isActive}
                  onValueChange={() => handleToggleActive(alertItem)}
                  trackColor={{ false: '#3e3e3e', true: '#8b5cf6' }}
                  thumbColor={alertItem.isActive ? '#ffffff' : '#f4f3f4'}
                />
                <TouchableOpacity onPress={() => handleDelete(alertItem.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#f3f4f6',
    fontSize: 13,
    fontWeight: 'bold',
  },
  addBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  addBtnText: {
    color: '#8b5cf6',
    fontSize: 11,
    fontWeight: 'bold',
  },
  formCard: {
    backgroundColor: '#1a1d2a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  formTitle: {
    color: '#f3f4f6',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#141620',
    color: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: '#141620',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  typeBtnActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  typeBtnText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: 'bold',
  },
  typeBtnTextActive: {
    color: '#ffffff',
  },
  smallBtn: {
    flex: 1,
    backgroundColor: '#141620',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  smallBtnActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  smallBtnText: {
    color: '#9ca3af',
    fontSize: 10,
    textTransform: 'capitalize',
  },
  smallBtnTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  saveBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  alertsList: {
    maxHeight: 300,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141620',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  alertInfo: {
    flex: 1,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  alertTime: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertBadge: {
    color: '#8b5cf6',
    fontSize: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    textTransform: 'capitalize',
  },
  alertLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  alertActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    fontSize: 16,
  },
});
