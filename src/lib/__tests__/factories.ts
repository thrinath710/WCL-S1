/** Terse builders so the tests read as tournament situations, not object literals. */

import type {
  Card,
  CardType,
  Goal,
  GroupName,
  Match,
  MatchStage,
  MatchStatus,
  Player,
  PlayerPosition,
  Team,
} from '../types';

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

export function resetIds() {
  counter = 0;
}

const BASE = Date.parse('2026-03-01T09:00:00.000Z');
/** Kickoff `n` hours after the tournament starts. */
export const at = (hours: number) => new Date(BASE + hours * 3600_000).toISOString();

export function team(name: string, overrides: Partial<Team> = {}): Team {
  return {
    id: overrides.id ?? nextId('team'),
    name,
    short_name: name.slice(0, 3).toUpperCase(),
    captain_name: null,
    group_name: 'A',
    logo_url: null,
    tiebreak_override: null,
    created_at: at(0),
    ...overrides,
  };
}

export function player(
  teamId: string,
  name: string,
  overrides: Partial<Player> = {},
): Player {
  return {
    id: overrides.id ?? nextId('player'),
    team_id: teamId,
    name,
    position: 'MID' as PlayerPosition,
    jersey_number: null,
    is_captain: false,
    created_at: at(0),
    ...overrides,
  };
}

type MatchInput = {
  home: Team | string;
  away: Team | string;
  score?: [number, number];
  pens?: [number, number];
  stage?: MatchStage;
  status?: MatchStatus;
  group?: GroupName | null;
  hour?: number;
};

export function match(input: MatchInput): Match {
  const homeId = typeof input.home === 'string' ? input.home : input.home.id;
  const awayId = typeof input.away === 'string' ? input.away : input.away.id;
  const stage = input.stage ?? 'group';
  const [home_score, away_score] = input.score ?? [0, 0];
  return {
    id: nextId('match'),
    stage,
    group_name: stage === 'group' ? (input.group ?? 'A') : null,
    home_team_id: homeId,
    away_team_id: awayId,
    kickoff_at: at(input.hour ?? 1),
    pitch: 'Pitch 1',
    status: input.status ?? (input.score ? 'completed' : 'scheduled'),
    home_score,
    away_score,
    home_pens: input.pens?.[0] ?? null,
    away_pens: input.pens?.[1] ?? null,
    notes: null,
    created_at: at(0),
  };
}

export function goal(
  matchId: string,
  teamId: string,
  playerId: string | null,
  overrides: Partial<Goal> = {},
): Goal {
  return {
    id: nextId('goal'),
    match_id: matchId,
    player_id: playerId,
    team_id: teamId,
    minute: null,
    is_own_goal: false,
    created_at: at(0),
    ...overrides,
  };
}

export function card(
  matchId: string,
  playerId: string,
  type: CardType,
  overrides: Partial<Card> = {},
): Card {
  return {
    id: nextId('card'),
    match_id: matchId,
    player_id: playerId,
    type,
    minute: null,
    created_at: at(0),
    ...overrides,
  };
}
