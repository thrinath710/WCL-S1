/**
 * Environment configuration.
 *
 * Without Supabase credentials the site renders its empty states rather than
 * inventing data: no sample teams, no placeholder fixtures. Everything shown
 * on the public site has been entered by the organiser.
 */

const trim = (value: string | undefined) => {
  const cleaned = value?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : undefined;
};

export const SUPABASE_URL = trim(process.env.NEXT_PUBLIC_SUPABASE_URL);

export const SUPABASE_ANON_KEY =
  trim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
  trim(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const SUPABASE_SERVICE_ROLE_KEY = trim(process.env.SUPABASE_SERVICE_ROLE_KEY);

/** True when the site has a database to talk to. */
export const isConnected = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const emailList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

/**
 * The organiser's account, by email. Comma separated so a co-organiser can be
 * added without a code change. Anyone not on this list is signed straight
 * back out, whatever Supabase Auth thinks.
 */
export const ADMIN_EMAILS: string[] = emailList(process.env.ADMIN_EMAILS);

/**
 * The match host's account. A host runs the evening -- results, kickoff times
 * and the knockout draw -- and nothing else: squads, team names and the
 * tournament settings stay the organiser's alone.
 *
 * An address on both lists is an admin. The stronger role wins so that adding
 * yourself as a host by mistake cannot lock you out of your own tournament.
 */
export const HOST_EMAILS: string[] = emailList(process.env.HOST_EMAILS);

/**
 * Optional. When set, the sign-in form pre-fills this address so the
 * organiser only has to type a password.
 *
 * It is deliberately opt-in: filling it in publishes which address can sign
 * in. That is not a key -- the password still is -- but it is one fewer thing
 * an attacker has to guess, so the safe default is to leave it unset.
 */
export const ADMIN_EMAIL_HINT = trim(process.env.NEXT_PUBLIC_ADMIN_EMAIL);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isHostEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return HOST_EMAILS.includes(email.toLowerCase());
}

/** The role an address signs in as, or null if it may not sign in at all. */
export function roleForEmail(email: string | null | undefined): 'admin' | 'host' | null {
  if (isAdminEmail(email)) return 'admin';
  if (isHostEmail(email)) return 'host';
  return null;
}

/** Public origin, used for absolute URLs in Open Graph tags. */
export function siteUrl(): string {
  const explicit = trim(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = trim(process.env.VERCEL_PROJECT_PRODUCTION_URL) ?? trim(process.env.VERCEL_URL);
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
