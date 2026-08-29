/**
 * Standings, derived at read time. Pure functions only -- no I/O, no dates
 * beyond what is handed in. Nothing here is ever written to the database, so
 * a mis-typed scoreline is fixed everywhere the moment it is corrected.
 *
 * Rules encoded here:
 *   - win 3, draw 1, loss 0
 *   - only group-stage matches count toward a group table
 *   - a penalty shootout decides a knockout tie but never moves GF/GA/GD
 *   - tiebreakers, in strict order:
 *       points -> goal difference -> goals scored -> head-to-head -> admin override
 */

import {
  type GroupName,
  type Match,
  type Team,
  isCounted,
} from './types';

export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;
export const LOSS_POINTS = 0;

export type FormResult = 'W' | 'D' | 'L';

/** Which criterion separated a row from the row directly above it. */
export type Tiebreak =
  | 'points'
  | 'goal_difference'
  | 'goals_for'
  | 'head_to_head'
  | 'admin_override'
  | 'alphabetical';

export const TIEBREAK_LABEL: Record<Tiebreak, string> = {
  points: 'points',
  goal_difference: 'goal difference',
  goals_for: 'goals scored',
  head_to_head: 'head-to-head',
  admin_override: "admin's ruling",
  alphabetical: 'alphabetical order',
};

export type StandingsRow = {
  team: Team;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Oldest to newest, at most `limit` entries. */
  form: FormResult[];
  /** True when this position qualifies for the knockout stage. */
  qualified: boolean;
  /**
   * How this row was separated from the one above it. `null` for the top row.
   * Only ever 'head_to_head' / 'admin_override' / 'alphabetical' when the
   * ordinary criteria were all level, which is exactly when it is worth
   * showing the reader a marker.
   */
  separatedBy: Tiebreak | null;
};

export type GroupStandings = {
  /** `null` when the tournament is being run as a single flat table. */
  groupName: GroupName | null;
  rows: StandingsRow[];
  qualifyCount: number;
};

/** Result of a match from one team's point of view, penalties included. */
export function resultFor(match: Match, teamId: string): FormResult | null {
  if (!isCounted(match)) return null;
  const isHome = match.home_team_id === teamId;
  const isAway = match.away_team_id === teamId;
  if (!isHome && !isAway) return null;

  const [own, opp] = isHome
    ? [match.home_score, match.away_score]
    : [match.away_score, match.home_score];

  if (own > opp) return 'W';
  if (own < opp) return 'L';

  // Level on normal time. A shootout, if there was one, decides it.
  if (match.home_pens != null && match.away_pens != null) {
    const [ownPens, oppPens] = isHome
      ? [match.home_pens, match.away_pens]
      : [match.away_pens, match.home_pens];
    if (ownPens > oppPens) return 'W';
    if (ownPens < oppPens) return 'L';
  }
  return 'D';
}

/** The winning team id, or null for a genuine draw / unplayed match. */
export function matchWinner(match: Match): string | null {
  const home = resultFor(match, match.home_team_id);
  if (home === 'W') return match.home_team_id;
  if (home === 'L') return match.away_team_id;
  return null;
}

/** The losing team id, or null for a genuine draw / unplayed match. */
export function matchLoser(match: Match): string | null {
  const winner = matchWinner(match);
  if (!winner) return null;
  return winner === match.home_team_id ? match.away_team_id : match.home_team_id;
}

/** Chronological order, with a stable id tiebreak so sorts never flicker. */
export function byKickoff(a: Match, b: Match): number {
  const diff = Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at);
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

export function matchesForTeam(matches: Match[], teamId: string): Match[] {
  return matches
    .filter((m) => m.home_team_id === teamId || m.away_team_id === teamId)
    .sort(byKickoff);
}

/** Last `limit` results for a team, oldest to newest. */
export function teamForm(matches: Match[], teamId: string, limit = 5): FormResult[] {
  const results: FormResult[] = [];
  for (const match of matchesForTeam(matches, teamId).filter(isCounted)) {
    const result = resultFor(match, teamId);
    if (result) results.push(result);
  }
  return results.slice(-limit);
}

type Tally = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

function emptyTally(): Tally {
  return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
}

/**
 * Accumulate one match into the tallies of both teams.
 * Penalty scores are deliberately not touched: they decide a knockout tie,
 * they are not goals.
 */
function applyMatch(tallies: Map<string, Tally>, match: Match): void {
  const home = tallies.get(match.home_team_id);
  const away = tallies.get(match.away_team_id);
  if (!home || !away) return; // a team outside the scope being tallied

  home.played += 1;
  away.played += 1;
  home.goalsFor += match.home_score;
  home.goalsAgainst += match.away_score;
  away.goalsFor += match.away_score;
  away.goalsAgainst += match.home_score;

  if (match.home_score > match.away_score) {
    home.won += 1;
    away.lost += 1;
  } else if (match.home_score < match.away_score) {
    away.won += 1;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
  }
}

function pointsOf(t: Tally): number {
  return t.won * WIN_POINTS + t.drawn * DRAW_POINTS + t.lost * LOSS_POINTS;
}

/**
 * Head-to-head as a mini-league over only the matches played *between* the
 * tied teams. This is correct for a two-way tie (it reduces to the single
 * meeting) and for an n-way tie, where comparing pairs alone is ambiguous.
 */
function headToHeadOrder(tied: Team[], groupMatches: Match[]): Map<string, [number, number, number]> {
  const ids = new Set(tied.map((t) => t.id));
  const tallies = new Map<string, Tally>(tied.map((t) => [t.id, emptyTally()]));

  for (const match of groupMatches) {
    if (ids.has(match.home_team_id) && ids.has(match.away_team_id)) {
      applyMatch(tallies, match);
    }
  }

  const keys = new Map<string, [number, number, number]>();
  for (const team of tied) {
    const t = tallies.get(team.id)!;
    keys.set(team.id, [pointsOf(t), t.goalsFor - t.goalsAgainst, t.goalsFor]);
  }
  return keys;
}

/** Descending numeric compare that treats nullish as "ranked last". */
function compareOverride(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b; // lower number ranks higher
}

/**
 * How many teams from each group go through.
 *
 * Derived from the knockout matches that actually exist so the table never
 * contradicts the bracket. Before any knockout match is created we fall back
 * to the shape this tournament is built around: two groups send two each,
 * a single group sends four -- either way, four teams into the semi-finals.
 */
export function qualifyPerGroup(matches: Match[], groupCount: number): number {
  const groups = Math.max(1, groupCount);
  const quarters = matches.filter((m) => m.stage === 'quarter').length;
  const semis = matches.filter((m) => m.stage === 'semi').length;

  if (quarters > 0) return Math.max(1, Math.round((quarters * 2) / groups));
  if (semis > 0) return Math.max(1, Math.round((semis * 2) / groups));
  return groups > 1 ? 2 : 4;
}

export type StandingsOptions = {
  /** Overrides the derived qualification count. */
  qualifyCount?: number;
  formLimit?: number;
};

/**
 * Build one group's table. `matches` may be the whole fixture list; only
 * group-stage matches between the given teams are counted.
 */
export function buildGroupTable(
  teams: Team[],
  matches: Match[],
  groupName: GroupName | null,
  options: StandingsOptions = {},
): GroupStandings {
  const formLimit = options.formLimit ?? 5;
  const memberIds = new Set(teams.map((t) => t.id));

  const groupMatches = matches
    .filter(
      (m) =>
        m.stage === 'group' &&
        isCounted(m) &&
        memberIds.has(m.home_team_id) &&
        memberIds.has(m.away_team_id),
    )
    .sort(byKickoff);

  const tallies = new Map<string, Tally>(teams.map((t) => [t.id, emptyTally()]));
  for (const match of groupMatches) applyMatch(tallies, match);

  type Seed = { team: Team; tally: Tally; points: number };
  const seeds: Seed[] = teams.map((team) => {
    const tally = tallies.get(team.id)!;
    return { team, tally, points: pointsOf(tally) };
  });

  // Phase 1 -- the three plain criteria, in order.
  seeds.sort(
    (a, b) =>
      b.points - a.points ||
      (b.tally.goalsFor - b.tally.goalsAgainst) - (a.tally.goalsFor - a.tally.goalsAgainst) ||
      b.tally.goalsFor - a.tally.goalsFor,
  );

  // Phase 2 -- resolve each cluster still level on all three.
  const separators = new Map<string, Tiebreak>();
  const ordered: Seed[] = [];
  let i = 0;
  while (i < seeds.length) {
    let j = i + 1;
    const level = (a: Seed, b: Seed) =>
      a.points === b.points &&
      a.tally.goalsFor - a.tally.goalsAgainst === b.tally.goalsFor - b.tally.goalsAgainst &&
      a.tally.goalsFor === b.tally.goalsFor;
    while (j < seeds.length && level(seeds[i], seeds[j])) j += 1;

    const cluster = seeds.slice(i, j);
    if (cluster.length === 1) {
      ordered.push(cluster[0]);
    } else {
      const h2h = headToHeadOrder(
        cluster.map((s) => s.team),
        groupMatches,
      );
      cluster.sort((a, b) => {
        const ka = h2h.get(a.team.id)!;
        const kb = h2h.get(b.team.id)!;
        const byH2h = kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2];
        if (byH2h !== 0) return byH2h;
        const byOverride = compareOverride(a.team.tiebreak_override, b.team.tiebreak_override);
        if (byOverride !== 0) return byOverride;
        return a.team.name.localeCompare(b.team.name);
      });

      // Record why each member sits below the previous one.
      for (let k = 1; k < cluster.length; k += 1) {
        const prev = cluster[k - 1];
        const cur = cluster[k];
        const kp = h2h.get(prev.team.id)!;
        const kc = h2h.get(cur.team.id)!;
        if (kp[0] !== kc[0] || kp[1] !== kc[1] || kp[2] !== kc[2]) {
          separators.set(cur.team.id, 'head_to_head');
        } else if (
          compareOverride(prev.team.tiebreak_override, cur.team.tiebreak_override) !== 0
        ) {
          separators.set(cur.team.id, 'admin_override');
        } else {
          separators.set(cur.team.id, 'alphabetical');
        }
      }
      ordered.push(...cluster);
    }
    i = j;
  }

  // buildStandings always passes an explicit count; a direct call to this
  // function is scoped to a single table, so fall back to a one-group shape.
  const qualifyCount = options.qualifyCount ?? qualifyPerGroup(matches, 1);

  const rows: StandingsRow[] = ordered.map((seed, index) => {
    const { tally } = seed;
    let separatedBy: Tiebreak | null = null;
    if (index > 0) {
      const above = ordered[index - 1];
      if (above.points !== seed.points) separatedBy = 'points';
      else if (
        above.tally.goalsFor - above.tally.goalsAgainst !==
        tally.goalsFor - tally.goalsAgainst
      )
        separatedBy = 'goal_difference';
      else if (above.tally.goalsFor !== tally.goalsFor) separatedBy = 'goals_for';
      else separatedBy = separators.get(seed.team.id) ?? 'alphabetical';
    }

    return {
      team: seed.team,
      position: index + 1,
      played: tally.played,
      won: tally.won,
      drawn: tally.drawn,
      lost: tally.lost,
      goalsFor: tally.goalsFor,
      goalsAgainst: tally.goalsAgainst,
      goalDifference: tally.goalsFor - tally.goalsAgainst,
      points: seed.points,
      form: teamForm(groupMatches, seed.team.id, formLimit),
      qualified: index < qualifyCount,
      separatedBy,
    };
  });

  return { groupName, rows, qualifyCount };
}

/** Distinct groups in play, in display order. Empty when nobody is grouped. */
export function groupNames(teams: Team[]): GroupName[] {
  const names = new Set<GroupName>();
  for (const team of teams) if (team.group_name) names.add(team.group_name);
  return [...names].sort();
}

/**
 * Every table the tournament needs. Teams without a group are collected into
 * one ungrouped table, so the site still renders sensibly before groups are
 * assigned.
 */
export function buildStandings(
  teams: Team[],
  matches: Match[],
  options: StandingsOptions = {},
): GroupStandings[] {
  const names = groupNames(teams);

  if (names.length === 0) {
    const qualifyCount = options.qualifyCount ?? qualifyPerGroup(matches, 1);
    return [buildGroupTable(teams, matches, null, { ...options, qualifyCount })];
  }

  const qualifyCount = options.qualifyCount ?? qualifyPerGroup(matches, names.length);
  const tables = names.map((name) =>
    buildGroupTable(
      teams.filter((t) => t.group_name === name),
      matches,
      name,
      { ...options, qualifyCount },
    ),
  );

  const ungrouped = teams.filter((t) => !t.group_name);
  if (ungrouped.length > 0) {
    tables.push(
      buildGroupTable(ungrouped, matches, null, { ...options, qualifyCount: 0 }),
    );
  }
  return tables;
}

/** True once every group-stage match has a result. */
export function isGroupStageComplete(matches: Match[]): boolean {
  const groupMatches = matches.filter((m) => m.stage === 'group');
  return groupMatches.length > 0 && groupMatches.every(isCounted);
}
