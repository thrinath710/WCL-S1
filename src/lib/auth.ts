import 'server-only';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from './supabase/server';
import { createSupabaseAdminClient } from './supabase/admin';
import { ADMIN_EMAILS, HOST_EMAILS, isConnected, roleForEmail } from './env';

/**
 * Who may sign in, and how much they may do.
 *
 * `admin` is the organiser: everything. `host` runs the matches -- results,
 * kickoff times and the knockout draw -- and cannot touch squads, team names
 * or the tournament settings.
 */
export type Role = 'admin' | 'host';

export type AdminSession = { email: string; userId: string; role: Role };

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Organiser',
  host: 'Match host',
};

/**
 * Who is signed in, if anyone the site recognises.
 *
 * Two gates have to pass: Supabase Auth must have a valid session, and the
 * email on it must be on one of the allowlists. Somebody who manages to create
 * an account some other way still gets nothing.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  const role = roleForEmail(data.user.email);
  if (!role) return null;

  return { email: data.user.email, userId: data.user.id, role };
}

/** True when the signed-in user is the organiser rather than a match host. */
export const isAdmin = (session: AdminSession | null): boolean => session?.role === 'admin';

/** Why the admin area cannot be used, or null if it can. */
export function adminSetupProblem(): string | null {
  if (!isConnected) {
    return 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';
  }
  if (ADMIN_EMAILS.length === 0 && HOST_EMAILS.length === 0) {
    return 'No admin email is allowed yet. Set ADMIN_EMAILS to your email address.';
  }
  if (!createSupabaseAdminClient()) {
    return 'Writes are disabled. Set SUPABASE_SERVICE_ROLE_KEY so the admin area can save changes.';
  }
  return null;
}

/** For pages: bounce to the login screen when not signed in. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  return session;
}

/**
 * For pages only the organiser may open. A host who follows a link to one is
 * sent back to their own home rather than shown a wall, because from their
 * side the page simply is not part of the job.
 */
export async function requireOrganiserPage(): Promise<AdminSession> {
  const session = await requireAdminPage();
  if (session.role !== 'admin') redirect('/admin');
  return session;
}

export class NotAuthorisedError extends Error {
  constructor(message = 'You are not signed in as the organiser.') {
    super(message);
    this.name = 'NotAuthorisedError';
  }
}

/**
 * For Server Actions: the only place the service-role client is handed out.
 * It bypasses RLS, so it is deliberately unreachable without a verified
 * allowlisted session.
 *
 * `role` is the minimum the caller must hold. It defaults to `admin`, so a new
 * action is organiser-only until somebody deliberately opens it up -- the safe
 * direction for a mistake to fall.
 */
export async function requireAdminDb(role: Role = 'admin'): Promise<{
  session: AdminSession;
  db: SupabaseClient;
}> {
  const session = await getAdminSession();
  if (!session) throw new NotAuthorisedError();

  if (role === 'admin' && session.role !== 'admin') {
    throw new NotAuthorisedError(
      'Only the organiser can change that. A match host can enter results, kickoff times and the knockout draw.',
    );
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    throw new NotAuthorisedError(
      'Writes are disabled: SUPABASE_SERVICE_ROLE_KEY is not set on the server.',
    );
  }
  return { session, db };
}

/** For actions a match host is allowed to run as well as the organiser. */
export const requireHostDb = () => requireAdminDb('host');
