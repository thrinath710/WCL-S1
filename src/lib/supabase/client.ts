'use client';
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../env';

/** Browser client. Only the admin login form uses this. */
export function createSupabaseBrowserClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
