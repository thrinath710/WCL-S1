import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '../env';

/**
 * Service-role client. Bypasses RLS, so it must only ever be reached after
 * the caller's email has been checked against the ADMIN_EMAILS allowlist --
 * see requireAdmin() in src/lib/auth.ts, which is the only door to it.
 */
export function createSupabaseAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
