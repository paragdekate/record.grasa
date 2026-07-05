import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize Supabase Client directly using environment variables
let supabaseInstance: SupabaseClient<any, any, any> | null = null;

export function getSupabaseClient(): SupabaseClient<any, any, any> | null {
  if (supabaseInstance) return supabaseInstance;

  if (url && anonKey) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        db: { schema: 'record' },
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
