import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConnected } from './env';
import type {
  Card,
  Goal,
  Match,
  Player,
  Team,
  TournamentSettings,
  TournamentSnapshot,
} from './types';

/**
 * Column lists are explicit on purpose. The anon Postgres role has SELECT
 * revoked on teams.captain_phone and players.roll_no, so `select *` would be
 * rejected -- and more to the point, those columns must not reach the public
 * site at all.
 */
const TEAM_COLUMNS =
  'id, name, short_name, captain_name, group_name, logo_url, tiebreak_override, created_at';
const PLAYER_COLUMNS = 'id, team_id, name, position, jersey_number, is_captain, created_at';
const MATCH_COLUMNS =
  'id, stage, group_name, home_team_id, away_team_id, kickoff_at, pitch, status, home_score, away_score, home_pens, away_pens, notes, created_at';
const GOAL_COLUMNS = 'id, match_id, player_id, team_id, minute, is_own_goal, created_at';
const CARD_COLUMNS = 'id, match_id, player_id, type, minute, created_at';

/** Used before the settings row exists, so the site still has a name. */
const DEFAULT_SETTINGS: TournamentSettings = {
  id: 'default',
  name: 'Woxsen Champions League',
  tagline: 'Season 1',
  prize_note: null,
  is_knockout_unlocked: false,
};

/** Read-only client for public data. No cookies, so it is safely shared. */
function publicClient() {
  if (!isConnected) return null;
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * What the site shows before a database is connected, or before any data has
 * been entered: nothing. No sample teams, no placeholder fixtures. Every page
 * has a real empty state, so an empty tournament looks deliberate rather than
 * broken.
 */
export function emptySnapshot(): TournamentSnapshot {
  return {
    settings: DEFAULT_SETTINGS,
    teams: [],
    players: [],
    matches: [],
    goals: [],
    cards: [],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * The tag every cached read carries, so one `revalidateTag` after a save
 * refreshes the whole site at once.
 */
export const TOURNAMENT_TAG = 'tournament';

/** How long a cached snapshot may be served before it is read again. */
export const SNAPSHOT_TTL_SECONDS = 30;

/**
 * Everything the site needs, in one read.
 *
 * The whole dataset is small enough that fetching it wholesale is cheaper
 * than the per-page joins it replaces, and it means every page on the site is
 * derived from exactly the same numbers.
 */
async function readSnapshot(): Promise<TournamentSnapshot> {
  const supabase = publicClient();
  if (!supabase) return emptySnapshot();

  const [settings, teams, players, matches, goals, cards] = await Promise.all([
    supabase.from('tournament_settings').select('id, name, tagline, prize_note, is_knockout_unlocked').limit(1).maybeSingle(),
    supabase.from('teams').select(TEAM_COLUMNS).order('name'),
    supabase.from('players').select(PLAYER_COLUMNS).order('jersey_number', { nullsFirst: false }),
    supabase.from('matches').select(MATCH_COLUMNS).order('kickoff_at'),
    supabase.from('goals').select(GOAL_COLUMNS),
    supabase.from('cards').select(CARD_COLUMNS),
  ]);

  const firstError =
    settings.error ?? teams.error ?? players.error ?? matches.error ?? goals.error ?? cards.error;
  if (firstError) {
    throw new Error(`Could not load tournament data: ${firstError.message}`);
  }

  return {
    settings: (settings.data as TournamentSettings | null) ?? DEFAULT_SETTINGS,
    teams: (teams.data ?? []) as Team[],
    players: (players.data ?? []) as Player[],
    matches: (matches.data ?? []) as Match[],
    goals: (goals.data ?? []) as Goal[],
    cards: (cards.data ?? []) as Card[],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * The read every cached snapshot goes through.
 *
 * `unstable_cache` holds one copy of the whole tournament for
 * SNAPSHOT_TTL_SECONDS and hands it to every page and every viewer, so the
 * number of queries Supabase sees depends on the clock rather than on how
 * many people are refreshing during a match. Two hundred readers cost the
 * same as one.
 *
 * It is safe to cache because nothing in `readSnapshot` touches cookies or
 * headers -- it is the anon client with no session, reading rows that are
 * public anyway.
 */
const readCachedSnapshot = unstable_cache(readSnapshot, ['tournament-snapshot'], {
  tags: [TOURNAMENT_TAG],
  revalidate: SNAPSHOT_TTL_SECONDS,
});

/**
 * For the public site.
 *
 * react's `cache()` on top dedupes within a single render, so a page's
 * metadata and its body share one snapshot rather than two cache reads.
 * A save calls `revalidateTag(TOURNAMENT_TAG)`, which drops this entry
 * immediately -- so a corrected scoreline is live on the next load rather
 * than up to thirty seconds later.
 */
export const getSnapshot = cache(async function getSnapshot(): Promise<TournamentSnapshot> {
  return readCachedSnapshot();
});

/**
 * For the admin area, which must never show a stale number.
 *
 * The control room is one or two people, so the handful of extra queries is
 * irrelevant next to the confusion of typing a result and not seeing it. This
 * deliberately skips the shared cache and reads the database directly.
 */
export const getLiveSnapshot = cache(async function getLiveSnapshot(): Promise<TournamentSnapshot> {
  return readSnapshot();
});

/** Convenience lookups shared by the pages. */
export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}
