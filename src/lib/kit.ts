/**
 * Which shirt each side wears.
 *
 * The fixture sheet prints one team of every tie in a black box and the other
 * in a white box. The rule behind it is simply home and away: **the home team
 * wears dark, the away team wears light**. That is true of all thirty group
 * matches, and the knockout note ("the higher-seeded team wears dark") is the
 * same rule with the higher seed placed at home.
 *
 * So a team has no colour of its own -- Titans are dark on Monday and dark
 * again on Wednesday only because they are at home both nights, and Cooked FC
 * go from dark on Tuesday to light on Wednesday. Nothing here is stored: swap
 * the two sides of a fixture in the admin area and both kits swap with it.
 */

import type { Match } from './types';

export type Kit = 'dark' | 'light';

export const KIT_LABEL: Record<Kit, string> = {
  dark: 'Dark',
  light: 'Light',
};

/** The kit a team wears in one match, or null if it is not playing in it. */
export function kitFor(match: Match, teamId: string): Kit | null {
  if (match.home_team_id === teamId) return 'dark';
  if (match.away_team_id === teamId) return 'light';
  return null;
}

/** The home side wears dark, so this is just "who is at home". */
export const darkTeamId = (match: Match): string => match.home_team_id;
export const lightTeamId = (match: Match): string => match.away_team_id;

/**
 * The teams in dark on a given night, for the "IN DARK TONIGHT" line under
 * each day on the fixture sheet.
 *
 * A team plays every one of its matches on a night on the same side, so this
 * is a set rather than a list: it never contains the same team twice, and a
 * team never appears both here and in light on the same day.
 */
export function darkTeamsOn(matches: Match[]): Set<string> {
  return new Set(matches.map(darkTeamId));
}

/**
 * True when no team is asked to wear both kits on the same night -- i.e. when
 * every team is on the same side of every match it plays that day.
 *
 * Editing a fixture can break this (put a team at home in one game and away in
 * another on the same evening) and nobody would notice until two sides turned
 * up in the same shirt, so the admin area checks it and says so.
 */
export function kitClashes(dayMatches: Match[]): string[] {
  const home = new Set(dayMatches.map((m) => m.home_team_id));
  const away = new Set(dayMatches.map((m) => m.away_team_id));
  return [...home].filter((id) => away.has(id));
}
