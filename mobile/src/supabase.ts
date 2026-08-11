import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

const url = 'https://jlegrmsylvnfscjwqtnn.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZWdybXN5bHZuZnNjandxdG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mjg3NzIsImV4cCI6MjA5NDAwNDc3Mn0.ulnCOBOiDbRd2a6S_6TstDpgijB1tLQdciwV65HpHmo';

let supabaseInstance: SupabaseClient<any, any, any> | null = null;

export function getSupabaseClient(): SupabaseClient<any, any, any> | null {
  if (supabaseInstance) return supabaseInstance;

  if (url && anonKey) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        db: { schema: 'record' },
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
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
