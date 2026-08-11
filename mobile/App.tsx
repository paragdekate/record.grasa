import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, Platform, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

import { 
  loadReadings, 
  addReading, 
  updateReading, 
  deleteReading, 
  loadAlerts, 
  addAlert, 
  updateAlert, 
  deleteAlert, 
  saveAlerts 
} from './src/db';
import type { SugarReading, ReadingUnit, InAppAlert } from './src/db';
import { getSupabaseClient } from './src/supabase';
import type { GoogleProfile } from './src/supabase';
import { requestNotificationPermissions, syncAllScheduledNotifications } from './src/notifications';

import { StatsDashboard } from './src/components/StatsDashboard';
import { BloodSugarChart } from './src/components/BloodSugarChart';
import { LogReadingForm } from './src/components/LogReadingForm';
import { HistoryList } from './src/components/HistoryList';
import { ProfileView } from './src/components/ProfileView';

export default function App() {
  const [readings, setReadings] = useState<SugarReading[]>([]);
  const [alerts, setAlerts] = useState<InAppAlert[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'log' | 'history' | 'profile'>('dashboard');
  const [preferredUnit, setPreferredUnit] = useState<ReadingUnit>('mg/dL');
  const [user, setUser] = useState<GoogleProfile | null>(null);

  // Sync function matching the PWA bidirectional sync logic
  const syncAllData = useCallback(async (sbUser: GoogleProfile | null) => {
    const activeUser = sbUser;
    if (!activeUser) return { success: false, count: 0, message: 'Not signed in.' };

    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, count: 0, message: 'Supabase client not active.' };

    let syncCount = 0;

    // 1. Sync Alerts
    try {
      const { data: cloudAlerts, error: alertsError } = await supabase
        .from('blood_sugar_alerts')
        .select('*');

      if (!alertsError && cloudAlerts) {
        if (cloudAlerts.length > 0) {
          const mappedAlerts: InAppAlert[] = cloudAlerts.map(row => ({
            id: row.id,
            type: row.type,
            time: row.time,
            label: row.label,
            isActive: row.is_active,
            mealType: row.meal_type || undefined,
            lastTriggeredDate: row.last_triggered_date || undefined,
            frequency: row.frequency || 'daily',
            startDate: row.start_date
          }));
          await saveAlerts(mappedAlerts);
          setAlerts(mappedAlerts);
          await syncAllScheduledNotifications(mappedAlerts);
        } else {
          // Push local alerts up
          const local = await loadAlerts();
          if (local.length > 0) {
            const rows = local.map(al => ({
              id: al.id,
              user_id: activeUser.id,
              type: al.type,
              time: al.time,
              label: al.label,
              is_active: al.isActive,
              meal_type: al.mealType,
              last_triggered_date: al.lastTriggeredDate,
              frequency: al.frequency || 'daily',
              start_date: al.startDate || new Date().toISOString().slice(0, 10)
            }));
            await supabase.from('blood_sugar_alerts').upsert(rows);
          }
        }
      }
    } catch (err) {
      console.error('Cloud alerts sync failed:', err);
    }

    // 2. Sync Readings
    try {
      const { data: cloudReadings, error: readingsError } = await supabase
        .from('blood_sugar_readings')
        .select('*')
        .order('measured_at', { ascending: false });

      if (!readingsError && cloudReadings) {
        const localReadings = await loadReadings();
        const sbReadings: SugarReading[] = cloudReadings.map(row => ({
          id: row.id,
          value: row.value,
          unit: row.unit,
          context: row.context,
          notes: row.notes || '',
          measuredAt: row.measured_at
        }));

        // Filter diffs
        const localOnly = localReadings.filter(l => 
          !sbReadings.some(c => c.id === l.id || (c.measuredAt === l.measuredAt && Math.abs(c.value - l.value) < 0.1))
        );

        const cloudOnly = sbReadings.filter(c => 
          !localReadings.some(l => l.id === c.id || (l.measuredAt === c.measuredAt && Math.abs(l.value - c.value) < 0.1))
        );

        // Upload local only
        if (localOnly.length > 0) {
          const rowsToUpload = localOnly.map(r => ({
            id: r.id,
            user_id: activeUser.id,
            value: r.value,
            unit: r.unit,
            context: r.context,
            notes: r.notes || '',
            measured_at: r.measuredAt
          }));
          await supabase.from('blood_sugar_readings').upsert(rowsToUpload);
          syncCount += localOnly.length;
        }

        // Merge and set
        const merged = [...localReadings];
        cloudOnly.forEach(c => {
          merged.push(c);
        });
        merged.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
        
        // Save locally
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('blood_sugar_readings', JSON.stringify(merged));
        setReadings(merged);
        syncCount += cloudOnly.length;
      }
    } catch (err) {
      console.error('Cloud readings sync failed:', err);
      return { success: false, count: 0, message: 'Sync failed: network error.' };
    }

    return {
      success: true,
      count: syncCount,
      message: `Sync completed successfully! Updated ${syncCount} items.`
    };
  }, []);

  // Initial setup and load
  useEffect(() => {
    const initApp = async () => {
      // 1. Request notification permissions
      await requestNotificationPermissions();

      // 2. Load Local Database items
      const loadedReadings = await loadReadings();
      setReadings(loadedReadings);

      const loadedAlerts = await loadAlerts();
      setAlerts(loadedAlerts);
      
      // Reschedule active local notifications on startup
      await syncAllScheduledNotifications(loadedAlerts);

      // 3. Connect Supabase Session if active
      const supabase = getSupabaseClient();
      if (supabase) {
        // Subscribe to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            const profile: GoogleProfile = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata.full_name || session.user.user_metadata.name || 'User',
              avatarUrl: session.user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${session.user.id}`
            };
            setUser(profile);
            await syncAllData(profile);
          } else {
            setUser(null);
            setReadings([]);
            setAlerts([]);
          }
        });

        // Check active session on startup
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile: GoogleProfile = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata.full_name || session.user.user_metadata.name || 'User',
            avatarUrl: session.user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${session.user.id}`
          };
          setUser(profile);
          await syncAllData(profile);
        }

        return () => {
          subscription.unsubscribe();
        };
      }
    };

    initApp();
  }, [syncAllData]);

  // Auth logins using Google OAuth with expo-web-browser and expo-auth-session
  const handleLogin = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      Alert.alert('Configuration Missing', 'Supabase credentials are not configured.');
      return;
    }

    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'glucosync',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned from Supabase.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success' && result.url) {
        // Extract session details from redirect URL hash/query params
        const parsedUrl = new URL(result.url);
        const paramsStr = parsedUrl.hash ? parsedUrl.hash.substring(1) : parsedUrl.search.substring(1);
        const params = new URLSearchParams(paramsStr);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }
      }
    } catch (e: any) {
      console.error('Google Sign-In Error:', e);
      Alert.alert('Google Sign-In Failed', e.message || 'An error occurred during authentication.');
    }
  };

  const handleEmailLogin = async (emailInput: string, passwordInput: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      Alert.alert('Configuration Missing', 'Supabase credentials are not configured.');
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });
      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Sign In Failed', e.message || 'Invalid credentials.');
    }
  };

  const handleEmailSignUp = async (emailInput: string, passwordInput: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      Alert.alert('Configuration Missing', 'Supabase credentials are not configured.');
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
      });
      if (error) throw error;
      Alert.alert('Sign Up Successful', 'Please check your email to confirm registration before signing in.');
    } catch (e: any) {
      Alert.alert('Sign Up Failed', e.message || 'An error occurred during registration.');
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setReadings([]);
    setAlerts([]);
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem('blood_sugar_readings');
    await AsyncStorage.removeItem('blood_sugar_alerts');
    await syncAllScheduledNotifications([]);
  };

  // State handlers to ensure changes trigger native notifications scheduling updates
  const handleAddReading = async (newR: Omit<SugarReading, 'id'>) => {
    const added = await addReading(newR);
    setReadings(prev => [added, ...prev]);

    // Upload to supabase if signed in
    const supabase = getSupabaseClient();
    if (supabase && user) {
      await supabase.from('blood_sugar_readings').upsert({
        id: added.id,
        user_id: user.id,
        value: added.value,
        unit: added.unit,
        context: added.context,
        notes: added.notes,
        measured_at: added.measuredAt
      });
    }
  };

  const handleUpdateReading = async (updated: SugarReading) => {
    await updateReading(updated);
    setReadings(prev => prev.map(r => r.id === updated.id ? updated : r));

    // Upload to supabase if signed in
    const supabase = getSupabaseClient();
    if (supabase && user) {
      await supabase.from('blood_sugar_readings').upsert({
        id: updated.id,
        user_id: user.id,
        value: updated.value,
        unit: updated.unit,
        context: updated.context,
        notes: updated.notes,
        measured_at: updated.measuredAt
      });
    }
  };

  const handleDeleteReading = async (id: string) => {
    await deleteReading(id);
    setReadings(prev => prev.filter(r => r.id !== id));

    // Delete from supabase if signed in
    const supabase = getSupabaseClient();
    if (supabase && user) {
      await supabase.from('blood_sugar_readings').delete().eq('id', id);
    }
  };

  const handleAddAlert = async (newA: Omit<InAppAlert, 'id'>) => {
    const added = await addAlert(newA);
    const updatedAlerts = [...alerts, added];
    setAlerts(updatedAlerts);
    await syncAllScheduledNotifications(updatedAlerts);

    const supabase = getSupabaseClient();
    if (supabase && user) {
      await supabase.from('blood_sugar_alerts').upsert({
        id: added.id,
        user_id: user.id,
        type: added.type,
        time: added.time,
        label: added.label,
        is_active: added.isActive,
        meal_type: added.mealType,
        frequency: added.frequency,
        start_date: added.startDate
      });
    }
  };

  const handleUpdateAlert = async (updated: InAppAlert) => {
    await updateAlert(updated);
    const updatedAlerts = alerts.map(a => a.id === updated.id ? updated : a);
    setAlerts(updatedAlerts);
    await syncAllScheduledNotifications(updatedAlerts);

    const supabase = getSupabaseClient();
    if (supabase && user) {
      await supabase.from('blood_sugar_alerts').upsert({
        id: updated.id,
        user_id: user.id,
        type: updated.type,
        time: updated.time,
        label: updated.label,
        is_active: updated.isActive,
        meal_type: updated.mealType,
        frequency: updated.frequency,
        start_date: updated.startDate,
        last_triggered_date: updated.lastTriggeredDate
      });
    }
  };

  const handleDeleteAlert = async (id: string) => {
    await deleteAlert(id);
    const updatedAlerts = alerts.filter(a => a.id !== id);
    setAlerts(updatedAlerts);
    await syncAllScheduledNotifications(updatedAlerts);

    const supabase = getSupabaseClient();
    if (supabase && user) {
      await supabase.from('blood_sugar_alerts').delete().eq('id', id);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoSymbol}>🩸</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>Grasa Record</Text>
            <Text style={styles.brandTag}>MOBILE PORTAL</Text>
          </View>
        </View>
        
        {/* Short info badge */}
        <View style={styles.syncBadge}>
          <Text style={styles.syncBadgeText}>
            {user ? 'Cloud Synced' : 'Local Only'}
          </Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {activeTab === 'dashboard' && (
          <View style={styles.tabContent}>
            <BloodSugarChart readings={readings} unit={preferredUnit} />
            <StatsDashboard readings={readings} unit={preferredUnit} />
          </View>
        )}
        
        {activeTab === 'log' && (
          <LogReadingForm
            onAddReading={handleAddReading}
            preferredUnit={preferredUnit}
          />
        )}
        
        {activeTab === 'history' && (
          <HistoryList
            readings={readings}
            unit={preferredUnit}
            onUpdateReading={handleUpdateReading}
            onDeleteReading={handleDeleteReading}
          />
        )}
        
        {activeTab === 'profile' && (
          <ProfileView
            user={user}
            onLoginClick={handleLogin}
            onLogoutClick={handleLogout}
            onEmailLogin={handleEmailLogin}
            onEmailSignUp={handleEmailSignUp}
            readingsCount={readings.length}
            onSyncTrigger={() => syncAllData(user)}
            alerts={alerts}
            onAddAlert={handleAddAlert}
            onUpdateAlert={handleUpdateAlert}
            onDeleteAlert={handleDeleteAlert}
            preferredUnit={preferredUnit}
            onUnitToggle={setPreferredUnit}
          />
        )}
      </View>

      {/* Navigation Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'log', label: 'Log Sugar', icon: '➕' },
          { id: 'history', label: 'History', icon: '📜' },
          { id: 'profile', label: 'Settings', icon: '⚙️' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id as any)}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  logoSymbol: {
    fontSize: 18,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  brandTag: {
    color: '#8b5cf6',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  syncBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  syncBadgeText: {
    color: '#06b6d4',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0c0d14',
    paddingVertical: 6,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabItemActive: {
    opacity: 1,
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#8b5cf6',
    fontWeight: 'bold',
  },
});
