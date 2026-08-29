/**
 * Tournament statistics, derived at read time. Pure functions only.
 *
 * Rules encoded here:
 *   - an own goal counts toward the team's score but NEVER toward any
 *     player's goal tally
 *   - penalty shootout scores are not goals and appear in no total here
 *   - discipline: every second yellow across the tournament = one match ban,
 *     every straight red = one match ban; bans are served in the team's next
 *     match that has a result
 */

import {
  type Card,
  type Goal,
  type Match,
  type Player,
  type Team,
  isCounted,
} from './types';
import { byKickoff, matchesForTeam, matchWinner } from './standings';

export const YELLOWS_PER_BAN = 2;

// --------------------------------------------------------------- goals

/**
 * Goals credited to each player. Own goals are excluded outright -- they are
 * never anybody's goal -- and unattributed goals have no player to credit.
 */
export function goalsByPlayer(goals: Goal[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const goal of goals) {
    if (goal.is_own_goal || !goal.player_id) continue;
    counts.set(goal.player_id, (counts.get(goal.player_id) ?? 0) + 1);
  }
  return counts;
}

/** Goals recorded against a match, in the order they were scored. */
export function goalsForMatch(goals: Goal[], matchId: string): Goal[] {
  return goals
    .filter((g) => g.match_id === matchId)
    .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.created_at.localeCompare(b.created_at));
}

export function cardsForMatch(cards: Card[], matchId: string): Card[] {
  return cards
    .filter((c) => c.match_id === matchId)
    .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.created_at.localeCompare(b.created_at));
}

export type ScorerRow = {
  player: Player;
  team: Team | undefined;
  goals: number;
  /**
   * The team's completed matches. No lineups are stored, so this is the
   * honest denominator available for a goals-per-match figure.
   */
  teamMatches: number;
  goalsPerMatch: number;
};

export function topScorers(
  players: Player[],
  teams: Team[],
  matches: Match[],
  goals: Goal[],
  limit?: number,
): ScorerRow[] {
  const counts = goalsByPlayer(goals);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playedByTeam = new Map<string, number>();
  for (const team of teams) {
    playedByTeam.set(team.id, matchesForTeam(matches, team.id).filter(isCounted).length);
  }

  const rows: ScorerRow[] = players
    .filter((p) => (counts.get(p.id) ?? 0) > 0)
    .map((player) => {
      const scored = counts.get(player.id) ?? 0;
      const teamMatches = playedByTeam.get(player.team_id) ?? 0;
      return {
        player,
        team: teamById.get(player.team_id),
        goals: scored,
        teamMatches,
        goalsPerMatch: teamMatches > 0 ? scored / teamMatches : 0,
      };
    })
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        b.goalsPerMatch - a.goalsPerMatch ||
        a.player.name.localeCompare(b.player.name),
    );

  return limit == null ? rows : rows.slice(0, limit);
}

// -------------------------------------------------------------- discipline

export type BanReason = 'two_yellows' | 'red_card';

export type DisciplineRow = {
  player: Player;
  team: Team | undefined;
  yellows: number;
  reds: number;
  /** Total bans the player has accrued across the tournament. */
  bansEarned: number;
  bansServed: number;
  isSuspended: boolean;
  /** Why the outstanding ban was given. Null when not suspended. */
  reason: BanReason | null;
  /** The next match they are set to miss, if one is scheduled. */
  suspendedFor: Match | null;
};

/**
 * Walk every player's team fixtures in order, accruing and serving bans.
 *
 * A ban is served by the team's next match that has a result. A match still
 * scheduled or in progress has not been served yet, which is exactly why a
 * player sitting out a live match still shows as suspended.
 */
export function buildDiscipline(
  players: Player[],
  teams: Team[],
  matches: Match[],
  cards: Card[],
): DisciplineRow[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const cardsByMatch = new Map<string, Card[]>();
  for (const card of cards) {
    const list = cardsByMatch.get(card.match_id);
    if (list) list.push(card);
    else cardsByMatch.set(card.match_id, [card]);
  }

  const fixturesByTeam = new Map<string, Match[]>();
  for (const team of teams) fixturesByTeam.set(team.id, matchesForTeam(matches, team.id));

  return players.map((player) => {
    const fixtures = fixturesByTeam.get(player.team_id) ?? [];

    let yellows = 0;
    let reds = 0;
    let bansEarned = 0;
    let bansServed = 0;
    const pending: BanReason[] = [];

    for (const match of fixtures) {
      if (!isCounted(match)) continue;

      // A ban outstanding at kickoff is served by sitting this one out.
      if (pending.length > 0) {
        pending.shift();
        bansServed += 1;
      }

      for (const card of cardsByMatch.get(match.id) ?? []) {
        if (card.player_id !== player.id) continue;
        if (card.type === 'yellow') {
          yellows += 1;
          if (yellows % YELLOWS_PER_BAN === 0) {
            pending.push('two_yellows');
            bansEarned += 1;
          }
        } else {
          reds += 1;
          pending.push('red_card');
          bansEarned += 1;
        }
      }
    }

    const upcoming = fixtures.find((m) => !isCounted(m)) ?? null;

    return {
      player,
      team: teamById.get(player.team_id),
      yellows,
      reds,
      bansEarned,
      bansServed,
      isSuspended: pending.length > 0,
      reason: pending[0] ?? null,
      suspendedFor: pending.length > 0 ? upcoming : null,
    };
  });
}

export function suspendedPlayers(rows: DisciplineRow[]): DisciplineRow[] {
  return rows
    .filter((r) => r.isSuspended)
    .sort(
      (a, b) =>
        (a.team?.name ?? '').localeCompare(b.team?.name ?? '') ||
        a.player.name.localeCompare(b.player.name),
    );
}

/** Most-carded players. Ranked by reds first, then yellows. */
export function mostCarded(rows: DisciplineRow[], limit?: number): DisciplineRow[] {
  const carded = rows
    .filter((r) => r.yellows > 0 || r.reds > 0)
    .sort(
      (a, b) =>
        b.reds - a.reds ||
        b.yellows - a.yellows ||
        a.player.name.localeCompare(b.player.name),
    );
  return limit == null ? carded : carded.slice(0, limit);
}

// ------------------------------------------------------------- team stats

export type TeamStats = {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
  yellows: number;
  reds: number;
};

/** Across every match with a result, group stage and knockout alike. */
export function buildTeamStats(
  team: Team,
  matches: Match[],
  players: Player[],
  cards: Card[],
): TeamStats {
  const squad = new Set(players.filter((p) => p.team_id === team.id).map((p) => p.id));
  const played = matchesForTeam(matches, team.id).filter(isCounted);

  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;

  for (const match of played) {
    const isHome = match.home_team_id === team.id;
    const own = isHome ? match.home_score : match.away_score;
    const opp = isHome ? match.away_score : match.home_score;
    goalsFor += own;
    goalsAgainst += opp;
    if (opp === 0) cleanSheets += 1;

    const winner = matchWinner(match);
    if (winner === team.id) won += 1;
    else if (winner === null) drawn += 1;
    else lost += 1;
  }

  const playedIds = new Set(played.map((m) => m.id));
  let yellows = 0;
  let reds = 0;
  for (const card of cards) {
    if (!squad.has(card.player_id) || !playedIds.has(card.match_id)) continue;
    if (card.type === 'yellow') yellows += 1;
    else reds += 1;
  }

  return {
    team,
    played: played.length,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    cleanSheets,
    yellows,
    reds,
  };
}

export type KeeperRow = {
  player: Player;
  team: Team;
  cleanSheets: number;
  played: number;
  /** True when the squad lists more than one keeper, so the total is shared. */
  shared: boolean;
};

/**
 * Clean sheets are a team fact -- no lineups are stored, so there is no way
 * to know which keeper was between the sticks. Every registered goalkeeper is
 * credited with their team's total, and squads with more than one keeper are
 * flagged so the page can say so rather than implying a false precision.
 */
export function cleanSheetLeaders(
  players: Player[],
  teams: Team[],
  matches: Match[],
  limit?: number,
): KeeperRow[] {
  const rows: KeeperRow[] = [];
  for (const team of teams) {
    const keepers = players.filter((p) => p.team_id === team.id && p.position === 'GK');
    if (keepers.length === 0) continue;

    const played = matchesForTeam(matches, team.id).filter(isCounted);
    const cleanSheets = played.filter((m) =>
      m.home_team_id === team.id ? m.away_score === 0 : m.home_score === 0,
    ).length;

    for (const keeper of keepers) {
      rows.push({
        player: keeper,
        team,
        cleanSheets,
        played: played.length,
        shared: keepers.length > 1,
      });
    }
  }

  rows.sort(
    (a, b) =>
      b.cleanSheets - a.cleanSheets ||
      a.played - b.played ||
      a.player.name.localeCompare(b.player.name),
  );
  return limit == null ? rows : rows.slice(0, limit);
}

// ---------------------------------------------------------- tournament-wide

export type BiggestWin = {
  match: Match;
  winner: Team | undefined;
  loser: Team | undefined;
  margin: number;
  scoreline: string;
};

export function biggestWins(
  matches: Match[],
  teams: Team[],
  limit = 5,
): BiggestWin[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  return matches
    .filter(isCounted)
    .map((match) => {
      const margin = Math.abs(match.home_score - match.away_score);
      const homeWon = match.home_score > match.away_score;
      const winnerId = homeWon ? match.home_team_id : match.away_team_id;
      const loserId = homeWon ? match.away_team_id : match.home_team_id;
      const high = Math.max(match.home_score, match.away_score);
      const low = Math.min(match.home_score, match.away_score);
      return {
        match,
        winner: teamById.get(winnerId),
        loser: teamById.get(loserId),
        margin,
        scoreline: `${high}-${low}`,
      };
    })
    .filter((w) => w.margin > 0)
    .sort(
      (a, b) =>
        b.margin - a.margin ||
        b.match.home_score + b.match.away_score - (a.match.home_score + a.match.away_score) ||
        byKickoff(a.match, b.match),
    )
    .slice(0, limit);
}

export type TournamentTotals = {
  matchesPlayed: number;
  matchesScheduled: number;
  totalGoals: number;
  averageGoalsPerMatch: number;
  ownGoals: number;
  cleanSheets: number;
  yellows: number;
  reds: number;
};

/**
 * Totals come from the scorelines, not from the goal rows: the scoreline is
 * what the referee recorded, and individual scorers may not all be known.
 */
export function tournamentTotals(
  matches: Match[],
  goals: Goal[],
  cards: Card[],
): TournamentTotals {
  const played = matches.filter(isCounted);
  const playedIds = new Set(played.map((m) => m.id));
  const totalGoals = played.reduce((sum, m) => sum + m.home_score + m.away_score, 0);
  const cleanSheets = played.reduce(
    (sum, m) => sum + (m.home_score === 0 ? 1 : 0) + (m.away_score === 0 ? 1 : 0),
    0,
  );

  let yellows = 0;
  let reds = 0;
  for (const card of cards) {
    if (!playedIds.has(card.match_id)) continue;
    if (card.type === 'yellow') yellows += 1;
    else reds += 1;
  }

  return {
    matchesPlayed: played.length,
    matchesScheduled: matches.length - played.length,
    totalGoals,
    averageGoalsPerMatch: played.length > 0 ? totalGoals / played.length : 0,
    ownGoals: goals.filter((g) => g.is_own_goal && playedIds.has(g.match_id)).length,
    cleanSheets,
    yellows,
    reds,
  };
}

/**
 * Does the list of recorded scorers agree with the entered scoreline?
 * Used by the admin screen to warn before a result is published.
 */
export function reconcileGoals(
  match: Match,
  goals: Goal[],
): { home: number; away: number; matches: boolean } {
  const forMatch = goals.filter((g) => g.match_id === match.id);
  const home = forMatch.filter((g) => g.team_id === match.home_team_id).length;
  const away = forMatch.filter((g) => g.team_id === match.away_team_id).length;
  return {
    home,
    away,
    matches: home === match.home_score && away === match.away_score,
  };
}
