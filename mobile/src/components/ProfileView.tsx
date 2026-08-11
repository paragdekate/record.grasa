import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView, Platform, TextInput } from 'react-native';
import { getSupabaseClient } from '../supabase';
import type { GoogleProfile } from '../supabase';
import { AlertsManager } from './AlertsManager';
import type { InAppAlert, ReadingUnit } from '../db';

interface ProfileViewProps {
  user: GoogleProfile | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (email: string, password: string) => Promise<void>;
  readingsCount: number;
  onSyncTrigger: () => Promise<{ success: boolean; count: number; message: string }>;
  alerts: InAppAlert[];
  onAddAlert: (alert: Omit<InAppAlert, 'id'>) => void;
  onUpdateAlert: (alert: InAppAlert) => void;
  onDeleteAlert: (id: string) => void;
  preferredUnit: ReadingUnit;
  onUnitToggle: (unit: ReadingUnit) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onLoginClick,
  onLogoutClick,
  onEmailLogin,
  onEmailSignUp,
  readingsCount,
  onSyncTrigger,
  alerts,
  onAddAlert,
  onUpdateAlert,
  onDeleteAlert,
  preferredUnit,
  onUnitToggle,
}) => {
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Email login states
  const [authMode, setAuthMode] = useState<'google' | 'email'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const isConnected = !!getSupabaseClient();

  const handleSyncClick = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await onSyncTrigger();
      setSyncResult({ success: res.success, message: res.message });
    } catch (e) {
      setSyncResult({ success: false, message: 'Sync failed due to an unexpected error.' });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleEmailAuthSubmit = async () => {
    if (!email || !password) return;
    setAuthLoading(true);
    try {
      if (isSigningUp) {
        await onEmailSignUp(email, password);
      } else {
        await onEmailLogin(email, password);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 1. Account Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>ACCOUNT PORTAL</Text>
          <Text style={[styles.statusText, isConnected ? styles.textCyan : styles.textMuted]}>
            {isConnected ? 'SUPABASE ACTIVE' : 'OFFLINE MODE'}
          </Text>
        </View>

        {user ? (
          <View style={styles.profileRow}>
            <View style={styles.profileInfo}>
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              <View>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onLogoutClick} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loginContainer}>
            {/* Toggle auth mode */}
            <View style={styles.authModeToggle}>
              <TouchableOpacity
                onPress={() => setAuthMode('email')}
                style={[styles.toggleModeBtn, authMode === 'email' && styles.toggleModeBtnActive]}
              >
                <Text style={[styles.toggleModeText, authMode === 'email' && styles.toggleModeTextActive]}>
                  Email Log In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAuthMode('google')}
                style={[styles.toggleModeBtn, authMode === 'google' && styles.toggleModeBtnActive]}
              >
                <Text style={[styles.toggleModeText, authMode === 'google' && styles.toggleModeTextActive]}>
                  Google OAuth
                </Text>
              </TouchableOpacity>
            </View>

            {authMode === 'google' ? (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={styles.loginDesc}>
                  Sign in with Google to synchronize your readings and alerts automatically across devices and the cloud.
                </Text>
                <TouchableOpacity onPress={onLoginClick} style={styles.loginBtn}>
                  <Text style={styles.loginBtnText}>Sign In with Google</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: '100%' }}>
                <Text style={styles.loginDesc}>
                  Access your GlucoSync account using your email and password.
                </Text>
                
                <TextInput
                  placeholder="Email Address"
                  placeholderTextColor="#6b7280"
                  style={styles.authInput}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#6b7280"
                  style={styles.authInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  onPress={handleEmailAuthSubmit}
                  disabled={authLoading}
                  style={[styles.loginBtn, authLoading && styles.disabledBtn]}
                >
                  <Text style={styles.loginBtnText}>
                    {authLoading ? 'Authenticating...' : isSigningUp ? 'Sign Up' : 'Sign In with Email'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsSigningUp(!isSigningUp)}
                  style={{ marginTop: 12, alignItems: 'center' }}
                >
                  <Text style={styles.switchAuthText}>
                    {isSigningUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 2. Device Settings & Unit Preferences */}
      <View style={styles.card}>
        <Text style={styles.cardTitleSection}>DISPLAY PREFERENCES</Text>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Measurement Unit</Text>
            <Text style={styles.settingDesc}>Choose how blood sugar concentrations are displayed.</Text>
          </View>
          <View style={styles.unitSelector}>
            {(['mg/dL', 'mmol/L'] as const).map(u => (
              <TouchableOpacity
                key={u}
                style={[styles.unitBtn, preferredUnit === u && styles.unitBtnActive]}
                onPress={() => onUnitToggle(u)}
              >
                <Text style={[styles.unitBtnText, preferredUnit === u && styles.unitBtnTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.settingRow, styles.borderTop]}>
          <View>
            <Text style={styles.settingLabel}>Stored Readings</Text>
            <Text style={styles.settingDesc}>Total readings cached locally on this device.</Text>
          </View>
          <Text style={styles.readingsCount}>{readingsCount} logs</Text>
        </View>
      </View>

      {/* 3. Sync Cloud Integration */}
      {user && (
        <View style={styles.card}>
          <Text style={styles.cardTitleSection}>CLOUD DATABASE SYNCHRONIZATION</Text>
          <Text style={styles.syncDesc}>
            Bidirectional sync will merge your local blood sugar logs and reminders with your secure database.
          </Text>

          <TouchableOpacity
            onPress={handleSyncClick}
            disabled={syncLoading}
            style={[styles.syncBtn, syncLoading && styles.disabledBtn]}
          >
            <Text style={styles.syncBtnText}>
              {syncLoading ? 'Syncing...' : 'Synchronize Now'}
            </Text>
          </TouchableOpacity>

          {syncResult && (
            <View style={[styles.resultBanner, syncResult.success ? styles.successBanner : styles.errorBanner]}>
              <Text style={[styles.resultText, syncResult.success ? styles.successText : styles.errorText]}>
                {syncResult.message}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 4. Alerts and Reminders manager */}
      <View style={styles.card}>
        <AlertsManager
          alerts={alerts}
          onAddAlert={onAddAlert}
          onUpdateAlert={onUpdateAlert}
          onDeleteAlert={onDeleteAlert}
        />
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
    marginBottom: 16,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  textCyan: {
    color: '#06b6d4',
  },
  textMuted: {
    color: '#6b7280',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileName: {
    color: '#f3f4f6',
    fontSize: 15,
    fontWeight: 'bold',
  },
  profileEmail: {
    color: '#6b7280',
    fontSize: 12,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loginContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loginDesc: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 16,
    paddingTop: 16,
  },
  settingLabel: {
    color: '#f3f4f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingDesc: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 2,
    maxWidth: 180,
  },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: '#1a1d2a',
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  unitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  unitBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  unitBtnText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: 'bold',
  },
  unitBtnTextActive: {
    color: '#ffffff',
  },
  readingsCount: {
    color: '#f3f4f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  syncDesc: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  syncBtn: {
    backgroundColor: '#06b6d4',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  syncBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  resultText: {
    fontSize: 12,
    textAlign: 'center',
  },
  successText: {
    color: '#10b981',
  },
  errorText: {
    color: '#ef4444',
  },
  authModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1d2a',
    borderRadius: 8,
    padding: 2,
    marginBottom: 16,
    width: '100%',
  },
  toggleModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleModeBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  toggleModeText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 'bold',
  },
  toggleModeTextActive: {
    color: '#ffffff',
  },
  authInput: {
    backgroundColor: '#1a1d2a',
    color: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
    width: '100%',
  },
  switchAuthText: {
    color: '#8b5cf6',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
