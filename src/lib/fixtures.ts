/**
 * Fixture generation. Pure functions.
 */

import type { GroupName, Match, Team } from './types';

/**
 * Circle-method round robin: every team meets every other exactly once.
 * An odd number of teams gets a bye each round, which simply produces fewer
 * matches in that round rather than an invalid pairing.
 */
export function roundRobin<T>(items: T[]): [T, T][] {
  const list = [...items];
  if (list.length < 2) return [];

  const odd = list.length % 2 === 1;
  if (odd) list.push(null as unknown as T);

  const half = list.length / 2;
  const rotating = list.slice(1);
  const pairs: [T, T][] = [];

  for (let round = 0; round < list.length - 1; round += 1) {
    const line = [list[0], ...rotating];
    for (let i = 0; i < half; i += 1) {
      const home = line[i];
      const away = line[line.length - 1 - i];
      if (home == null || away == null) continue;
      // Alternate the nominal home side round by round so no team is always
      // listed first.
      pairs.push(round % 2 === 0 ? [home, away] : [away, home]);
    }
    rotating.unshift(rotating.pop() as T);
  }
  return pairs;
}

export type PlannedMatch = {
  stage: 'group';
  group_name: GroupName;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  pitch: string | null;
};

/**
 * Every group-stage fixture for one group, spaced evenly from a first kickoff.
 * Pairs already scheduled are skipped, so pressing the button twice does not
 * create duplicates.
 */
export function planGroupFixtures(options: {
  teams: Team[];
  group: GroupName;
  firstKickoff: Date;
  minutesBetween: number;
  pitch: string | null;
  existing: Match[];
}): PlannedMatch[] {
  const { teams, group, firstKickoff, minutesBetween, pitch, existing } = options;

  const members = teams.filter((t) => t.group_name === group);
  const alreadyPlayed = new Set(
    existing
      .filter((m) => m.stage === 'group')
      .map((m) => pairKey(m.home_team_id, m.away_team_id)),
  );

  const pairs = roundRobin(members).filter(
    ([home, away]) => !alreadyPlayed.has(pairKey(home.id, away.id)),
  );

  return pairs.map(([home, away], index) => ({
    stage: 'group' as const,
    group_name: group,
    home_team_id: home.id,
    away_team_id: away.id,
    kickoff_at: new Date(
      firstKickoff.getTime() + index * minutesBetween * 60_000,
    ).toISOString(),
    pitch,
  }));
}

/** Order-independent key for a pairing, so A v B and B v A are the same tie. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
