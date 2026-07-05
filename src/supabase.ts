import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  const url = localStorage.getItem('supabase_project_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = localStorage.getItem('supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (url && anonKey) {
    return { url, anonKey };
  }
  return null;
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem('supabase_project_url', url);
  localStorage.setItem('supabase_anon_key', anonKey);
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem('supabase_project_url');
  localStorage.removeItem('supabase_anon_key');
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
