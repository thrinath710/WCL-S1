/**
 * Undoing an evening.
 *
 * Results are the one thing on this site that get typed in a hurry, in a noisy
 * hall, on a phone. Correcting a single scoreline is already easy; what was
 * missing was a way to say "that whole night went in wrong, start it again".
 *
 * A reset only ever removes *results*: scorelines, penalties, goals and cards.
 * The fixtures themselves survive, so the schedule a reader is looking at does
 * not vanish -- every match simply goes back to being scheduled, ready to be
 * entered again. Pure functions; the writing happens in actions/reset.ts.
 */

import { dayKey, formatLongDay } from './format';
import { type Card, type Goal, type Match, isCounted, isKnockout } from './types';
import { byKickoff } from './standings';

/** The fields a reset puts back, exactly as a never-played match looks. */
export const CLEARED_RESULT = {
  status: 'scheduled' as const,
  home_score: 0,
  away_score: 0,
  home_pens: null,
  away_pens: null,
  notes: null,
};

export type ResetDay = {
  /** YYYY-MM-DD in tournament time -- what the reset form submits. */
  key: string;
  /** "Monday 31 August". */
  label: string;
  matchIds: string[];
  total: number;
  played: number;
  goals: number;
  cards: number;
  /** True when the day holds semi-finals or the final. */
  knockout: boolean;
};

/**
 * Every day of the tournament that has fixtures, earliest first, with a count
 * of what a reset would actually clear. Days with nothing entered are still
 * listed -- the count says "0 results", which is a clearer answer than an
 * absent row.
 */
export function resetDays(matches: Match[], goals: Goal[], cards: Card[]): ResetDay[] {
  const days = new Map<string, Match[]>();
  for (const match of [...matches].sort(byKickoff)) {
    const key = dayKey(match.kickoff_at);
    (days.get(key) ?? days.set(key, []).get(key)!).push(match);
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayMatches]) => {
      const ids = new Set(dayMatches.map((m) => m.id));
      return {
        key,
        label: formatLongDay(dayMatches[0].kickoff_at),
        matchIds: [...ids],
        total: dayMatches.length,
        played: dayMatches.filter(isCounted).length,
        goals: goals.filter((g) => ids.has(g.match_id)).length,
        cards: cards.filter((c) => ids.has(c.match_id)).length,
        knockout: dayMatches.some((m) => isKnockout(m.stage)),
      };
    });
}

/** The matches belonging to one tournament day, by its key. */
export function matchesOnDay(matches: Match[], key: string): Match[] {
  return matches.filter((match) => dayKey(match.kickoff_at) === key);
}

/**
 * Why resetting this day is more than it looks.
 *
 * The semi-final draw and the final are derived from group results. Wiping a
 * group night while they exist leaves them standing on results that are no
 * longer there, so the organiser is told rather than left to find out.
 */
export function staleKnockoutWarning(matches: Match[], resetKey: string): string | null {
  const cleared = matchesOnDay(matches, resetKey);
  if (cleared.every((m) => isKnockout(m.stage))) return null;

  const knockouts = matches.filter((m) => isKnockout(m.stage) && !cleared.includes(m));
  if (knockouts.length === 0) return null;

  return `The semi-finals and final were drawn from results that this reset clears. Check them on the knockout screen, or reset the whole tournament to draw them again.`;
}

/** The word the full reset asks to be typed, so it cannot be a stray tap. */
export const RESET_PHRASE = 'RESET';
