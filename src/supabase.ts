import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration keys for local storage overrides
const URL_KEY = 'supabase_project_url';
const ANON_KEY = 'supabase_anon_key';
const USER_KEY = 'supabase_mock_user';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

// Get saved credentials from localStorage or environment variables
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = localStorage.getItem(URL_KEY) || import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = localStorage.getItem(ANON_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (url && anonKey) {
    return { url, anonKey };
  }
  return null;
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(URL_KEY, url);
  localStorage.setItem(ANON_KEY, anonKey);
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(ANON_KEY);
}

// Initialize Supabase Client dynamically
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const config = getSupabaseConfig();
  if (config) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      return supabaseInstance;
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

// Reset instance when keys are changed
export function resetSupabaseInstance(): void {
  supabaseInstance = null;
}

// Mock auth management
export function getMockUser(): GoogleProfile | null {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (e) {
    return null;
  }
}

export function setMockUser(user: GoogleProfile | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}
