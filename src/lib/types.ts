/**
 * Domain types.
 *
 * Note the split between public and admin shapes: `captain_phone` and
 * `roll_no` are collected on the registration form but are not public, and
 * the anon Postgres role has had SELECT revoked on those columns
 * (supabase/migrations/0002_rls.sql). Keeping them off `Team` / `Player`
 * means a public page cannot accidentally render them.
 */

export type PlayerPosition = 'GK' | 'DEF' | 'MID' | 'FWD';
export type MatchStage = 'group' | 'quarter' | 'semi' | 'third_place' | 'final';
export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'walkover';
export type CardType = 'yellow' | 'red';
export type GroupName = 'A' | 'B';

export const PLAYER_POSITIONS: PlayerPosition[] = ['GK', 'DEF', 'MID', 'FWD'];
export const MATCH_STAGES: MatchStage[] = ['group', 'quarter', 'semi', 'third_place', 'final'];
export const MATCH_STATUSES: MatchStatus[] = ['scheduled', 'live', 'completed', 'walkover'];

/** Squad size limits from the tournament rules. */
export const MIN_SQUAD = 7;
export const MAX_SQUAD = 11;

/** Half length in minutes, by stage. Group games are shorter. */
export const HALF_LENGTH_MINUTES: Record<MatchStage, number> = {
  group: 10,
  quarter: 15,
  semi: 15,
  third_place: 15,
  final: 15,
};

export type Team = {
  id: string;
  name: string;
  short_name: string;
  captain_name: string | null;
  group_name: GroupName | null;
  logo_url: string | null;
  tiebreak_override: number | null;
  created_at: string;
};

export type AdminTeam = Team & { captain_phone: string | null };

export type Player = {
  id: string;
  team_id: string;
  name: string;
  position: PlayerPosition;
  jersey_number: number | null;
  is_captain: boolean;
  created_at: string;
};

export type AdminPlayer = Player & { roll_no: string | null };

export type Match = {
  id: string;
  stage: MatchStage;
  group_name: GroupName | null;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  pitch: string | null;
  status: MatchStatus;
  home_score: number;
  away_score: number;
  home_pens: number | null;
  away_pens: number | null;
  notes: string | null;
  created_at: string;
};

export type Goal = {
  id: string;
  match_id: string;
  /** Null for a goal nobody could attribute. */
  player_id: string | null;
  /** The team the goal COUNTS FOR -- for an own goal, the scorer's opponent. */
  team_id: string;
  minute: number | null;
  is_own_goal: boolean;
  created_at: string;
};

export type Card = {
  id: string;
  match_id: string;
  player_id: string;
  type: CardType;
  minute: number | null;
  created_at: string;
};

export type TournamentSettings = {
  id: string;
  name: string;
  tagline: string | null;
  prize_note: string | null;
  is_knockout_unlocked: boolean;
};

/**
 * Everything the site needs, in one object.
 *
 * The whole dataset is tiny (at most ~20 teams, ~180 players, ~60 matches),
 * so every page loads the full snapshot once and derives what it needs with
 * the pure functions in standings.ts / stats.ts. That is what makes a
 * corrected scoreline show up correctly *everywhere* at once.
 */
export type TournamentSnapshot = {
  settings: TournamentSettings;
  teams: Team[];
  players: Player[];
  matches: Match[];
  goals: Goal[];
  cards: Card[];
  /** ISO timestamp of when this snapshot was read -- drives "last updated". */
  fetchedAt: string;
};

/** A match that counts: played to a result. */
export function isCounted(match: Match): boolean {
  return match.status === 'completed' || match.status === 'walkover';
}

export function isKnockout(stage: MatchStage): boolean {
  return stage !== 'group';
}

export const STAGE_LABEL: Record<MatchStage, string> = {
  group: 'Group',
  quarter: 'Quarter-final',
  semi: 'Semi-final',
  third_place: 'Third place',
  final: 'Final',
};

export const STAGE_LABEL_SHORT: Record<MatchStage, string> = {
  group: 'GRP',
  quarter: 'QF',
  semi: 'SF',
  third_place: '3RD',
  final: 'FINAL',
};
