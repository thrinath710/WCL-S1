/**
 * Schedule queries: what is on now, what is next, what just finished.
 * Pure functions -- the clock is always passed in, never read.
 */

import { type Match, isCounted } from './types';
import { byKickoff } from './standings';

/** Matches currently marked live, earliest kickoff first. */
export function liveMatches(matches: Match[]): Match[] {
  return matches.filter((m) => m.status === 'live').sort(byKickoff);
}

/** Upcoming fixtures, soonest first. */
export function upcomingMatches(matches: Match[], limit?: number): Match[] {
  const upcoming = matches.filter((m) => m.status === 'scheduled').sort(byKickoff);
  return limit == null ? upcoming : upcoming.slice(0, limit);
}

/** Finished matches, most recent first. */
export function recentResults(matches: Match[], limit?: number): Match[] {
  const played = matches.filter(isCounted).sort((a, b) => byKickoff(b, a));
  return limit == null ? played : played.slice(0, limit);
}

/**
 * The one match a visitor most wants to see on opening the site: whatever is
 * being played right now, otherwise the next kickoff, otherwise the last result.
 */
export function headlineMatch(matches: Match[]): {
  match: Match;
  kind: 'live' | 'next' | 'last';
} | null {
  const live = liveMatches(matches)[0];
  if (live) return { match: live, kind: 'live' };

  const next = upcomingMatches(matches, 1)[0];
  if (next) return { match: next, kind: 'next' };

  const last = recentResults(matches, 1)[0];
  if (last) return { match: last, kind: 'last' };

  return null;
}

/**
 * Fixtures grouped by calendar day, using the supplied day-key function.
 *
 * Days run forwards and so do the kickoffs inside them, so the list reads the
 * way the printed fixture sheet does: the next match to be played is nearest
 * the top, and scrolling down moves later into the tournament.
 */
export function groupByDay(
  matches: Match[],
  keyOf: (iso: string) => string,
): { key: string; matches: Match[] }[] {
  const days = new Map<string, Match[]>();
  for (const match of [...matches].sort(byKickoff)) {
    const key = keyOf(match.kickoff_at);
    const bucket = days.get(key);
    if (bucket) bucket.push(match);
    else days.set(key, [match]);
  }
  return [...days.entries()]
    .map(([key, dayMatches]) => ({ key, matches: dayMatches }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
