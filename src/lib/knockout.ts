/**
 * The run-in: who meets whom in the semi-finals, and who fills the final.
 *
 * Pure functions. Nothing here writes; `src/lib/actions/knockout.ts` takes
 * what these return and puts it in the database, which is what keeps the
 * "confirm the semi-finals" screen able to show the draw before committing to
 * it, and what lets the final re-derive itself when a semi-final is corrected.
 */

import { byKickoff, matchWinner, type GroupStandings } from './standings';
import { type Match, isCounted } from './types';

/**
 * Kickoff times for the knockout evening. Revised from the printed sheet:
 * semi-finals at 6:30 and 7:15, final at 8:30.
 */
export const SEMI_ONE_TIME = '18:30';
export const SEMI_TWO_TIME = '19:15';
export const FINAL_TIME = '20:30';
export const KNOCKOUT_PITCH = 'Court 2';

export type PlannedTie = {
  stage: 'semi' | 'final';
  /** The side that wears dark: the higher seed. */
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  pitch: string;
};

/** A semi-final slot, named the way the fixture sheet names it. */
export type SemiPlan = {
  label: string;
  homeLabel: string;
  awayLabel: string;
  /** Null until that group has a team in the position. */
  home: { id: string; name: string } | null;
  away: { id: string; name: string } | null;
};

const nth = (table: GroupStandings | undefined, position: number) => {
  const row = table?.rows[position - 1];
  return row ? { id: row.team.id, name: row.team.name } : null;
};

/**
 * The draw: winner of one group against the runner-up of the other, crossed
 * so the two group winners can only meet in the final.
 */
export function planSemiFinals(standings: GroupStandings[]): SemiPlan[] {
  const a = standings.find((t) => t.groupName === 'A');
  const b = standings.find((t) => t.groupName === 'B');

  return [
    {
      label: 'Semi-final 1',
      homeLabel: 'Winner Group A',
      awayLabel: 'Runner-up Group B',
      home: nth(a, 1),
      away: nth(b, 2),
    },
    {
      label: 'Semi-final 2',
      homeLabel: 'Winner Group B',
      awayLabel: 'Runner-up Group A',
      home: nth(b, 1),
      away: nth(a, 2),
    },
  ];
}

/** True once both semi-finals exist and both have been played to a result. */
export function semisDecided(matches: Match[]): boolean {
  const semis = matches.filter((m) => m.stage === 'semi');
  return semis.length === 2 && semis.every(isCounted);
}

/**
 * Where a team finished, as a single number that can be compared across
 * groups: 1 for either group winner, 2 for either runner-up, and so on.
 * Lower is better, which is what "higher seed" means.
 */
export function seedOf(teamId: string, standings: GroupStandings[]): number | null {
  for (const table of standings) {
    const row = table.rows.find((r) => r.team.id === teamId);
    if (row) return row.position;
  }
  return null;
}

/**
 * The final, once both semi-finals have been won.
 *
 * The fixture sheet lists it as "Higher seed v Lower seed", and the higher
 * seed wears dark -- so the group winner goes home against a runner-up. Two
 * finalists who finished level (both won their group) are separated by the
 * record that got them there: points, then goal difference, then goals
 * scored, exactly as the group table orders them.
 */
export function planFinal(
  matches: Match[],
  standings: GroupStandings[],
): PlannedTie | null {
  const semis = matches.filter((m) => m.stage === 'semi').sort(byKickoff);
  if (semis.length !== 2 || !semis.every(isCounted)) return null;

  const winners = semis.map(matchWinner);
  // A drawn knockout tie with no shootout has no winner yet.
  if (winners.some((id) => id == null)) return null;
  const [first, second] = winners as [string, string];
  if (first === second) return null;

  const [home, away] = [first, second].sort(compareSeeds(standings));

  return {
    stage: 'final',
    home_team_id: home,
    away_team_id: away,
    kickoff_at: onKnockoutDay(semis[0].kickoff_at, FINAL_TIME),
    pitch: KNOCKOUT_PITCH,
  };
}

/** Orders two teams best-first by where they finished the group stage. */
function compareSeeds(standings: GroupStandings[]) {
  const rowOf = (id: string) => {
    for (const table of standings) {
      const row = table.rows.find((r) => r.team.id === id);
      if (row) return row;
    }
    return null;
  };

  return (a: string, b: string): number => {
    const rowA = rowOf(a);
    const rowB = rowOf(b);
    if (!rowA || !rowB) return 0;
    if (rowA.position !== rowB.position) return rowA.position - rowB.position;
    if (rowA.points !== rowB.points) return rowB.points - rowA.points;
    if (rowA.goalDifference !== rowB.goalDifference) {
      return rowB.goalDifference - rowA.goalDifference;
    }
    if (rowA.goalsFor !== rowB.goalsFor) return rowB.goalsFor - rowA.goalsFor;
    return rowA.team.name.localeCompare(rowB.team.name);
  };
}

/**
 * A knockout kickoff: the same calendar day as the semi-finals, at the given
 * campus-clock time. Written as an offset-bearing string so the database
 * stores the instant the organiser means rather than a server-local guess.
 */
export function onKnockoutDay(referenceIso: string, time: string): string {
  const zone = process.env.NEXT_PUBLIC_TIMEZONE?.trim() || 'Asia/Kolkata';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(referenceIso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;

  // Resolve that wall-clock time in the tournament zone.
  const naive = new Date(`${day}T${time}:00Z`);
  const asZoned = new Date(naive.toLocaleString('en-US', { timeZone: zone }));
  const asUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(naive.getTime() - (asZoned.getTime() - asUtc.getTime())).toISOString();
}
