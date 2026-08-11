import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Alert, Platform } from 'react-native';
import { convertValue, getStatus, getStatusColor, getContextLabel } from '../db';
import type { SugarReading, ReadingUnit, ReadingContext } from '../db';

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

  // Edit fields
  const [editValue, setEditValue] = useState('');
  const [editContext, setEditContext] = useState<ReadingContext>('fasting');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');

  const filteredReadings = readings.filter(r => {
    const matchesSearch = r.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getContextLabel(r.context).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesContext = selectedContext === 'all' || r.context === selectedContext;
    return matchesSearch && matchesContext;
  });

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
    const displayVal = unit === 'mg/dL' ? reading.value : convertValue(reading.value, 'mg/dL', 'mmol/L');
    setEditValue(displayVal.toString());
    setEditContext(reading.context);
    setEditNotes(reading.notes);
    setEditDate(new Date(reading.measuredAt).toISOString());
  };

  const handleEditSubmit = () => {
    if (!editingReading) return;

    const val = parseFloat(editValue);
    if (!val || val <= 0) {
      Alert.alert('Invalid value', 'Please enter a valid blood sugar reading.');
      return;
    }

    const valInMgDl = unit === 'mg/dL' ? val : Math.round(val * 18.0182);

    onUpdateReading({
      ...editingReading,
      value: valInMgDl,
      context: editContext,
      notes: editNotes,
      measuredAt: editDate
    });

    setEditingReading(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Reading',
      'Are you sure you want to delete this glucose reading?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteReading(id) }
      ]
    );
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDisplayValue = (valInMgDl: number) => {
    if (unit === 'mg/dL') return Math.round(valInMgDl);
    return convertValue(valInMgDl, 'mg/dL', 'mmol/L');
  };

  const contexts: { label: string; value: string }[] = [
    { label: 'All', value: 'all' },
    { label: 'Fasting', value: 'fasting' },
    { label: 'Before Meal', value: 'before_lunch' },
    { label: 'After Meal', value: 'after_lunch' },
    { label: 'Bedtime', value: 'bedtime' }
  ];

  return (
    <View style={styles.container}>
      {/* Search and filter header */}
      <View style={styles.filterSection}>
        <TextInput
          placeholder="Search notes or context..."
          placeholderTextColor="#6b7280"
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contextTabs}>
          {contexts.map(c => (
            <TouchableOpacity
              key={c.value}
              onPress={() => setSelectedContext(c.value)}
              style={[
                styles.tabBtn,
                selectedContext === c.value && styles.tabBtnActive
              ]}
            >
              <Text style={[styles.tabText, selectedContext === c.value && styles.tabTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* History scroll list */}
      <ScrollView style={styles.listScroll}>
        {Object.keys(groupedReadings).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No matching logs found.</Text>
          </View>
        ) : (
          Object.keys(groupedReadings).map(day => (
            <View key={day} style={styles.dayGroup}>
              <Text style={styles.dayTitle}>{day}</Text>
              <View style={styles.dayContainer}>
                {groupedReadings[day].map(reading => {
                  const status = getStatus(reading.value);
                  const statusColor = getStatusColor(status);

                  return (
                    <View key={reading.id} style={styles.readingRow}>
                      <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
                      
                      <View style={styles.readingInfo}>
                        <View style={styles.timeRow}>
                          <Text style={styles.timeText}>{formatTime(reading.measuredAt)}</Text>
                          <Text style={styles.contextText}>{getContextLabel(reading.context)}</Text>
                        </View>
                        {reading.notes ? (
                          <Text style={styles.noteText}>{reading.notes}</Text>
                        ) : null}
                      </View>

                      <View style={styles.valueContainer}>
                        <Text style={styles.valueText}>{formatDisplayValue(reading.value)}</Text>
                        <Text style={styles.unitText}>{unit}</Text>
                      </View>

                      <View style={styles.actionButtons}>
                        <TouchableOpacity onPress={() => startEdit(reading)} style={styles.actionBtn}>
                          <Text style={styles.editBtnText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(reading.id)} style={styles.actionBtn}>
                          <Text style={styles.deleteBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit Modal */}
      {editingReading && (
        <Modal transparent animationType="slide" visible={!!editingReading}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Glucose Reading</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Value ({unit})</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.textInput}
                  value={editValue}
                  onChangeText={setEditValue}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  placeholder="Optional notes"
                  placeholderTextColor="#6b7280"
                  style={styles.textInput}
                  value={editNotes}
                  onChangeText={setEditNotes}
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setEditingReading(null)} style={[styles.modalBtn, styles.cancelBtn]}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEditSubmit} style={[styles.modalBtn, styles.saveBtn]}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10',
  },
  filterSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    backgroundColor: '#141620',
    color: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  contextTabs: {
    flexDirection: 'row',
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginRight: 8,
  },
  tabBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  listScroll: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  dayGroup: {
    paddingTop: 16,
  },
  dayTitle: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  dayContainer: {
    backgroundColor: '#141620',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  statusIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  readingInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: '#f3f4f6',
    fontSize: 13,
    fontWeight: 'bold',
  },
  contextText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  noteText: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 2,
  },
  valueContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: 16,
  },
  valueText: {
    color: '#f3f4f6',
    fontSize: 18,
    fontWeight: '800',
  },
  unitText: {
    color: '#6b7280',
    fontSize: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 6,
  },
  editBtnText: {
    fontSize: 14,
  },
  deleteBtnText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#141620',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#f3f4f6',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#1a1d2a',
    color: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#1a1d2a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtnText: {
    color: '#f3f4f6',
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#8b5cf6',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
