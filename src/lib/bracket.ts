/**
 * Knockout bracket, derived from whatever knockout matches exist.
 *
 * Rounds that have not been drawn yet are still shown, as empty slots, so the
 * shape of the run-in is visible before the group stage finishes. Pure
 * functions only.
 */

import { type Match, type MatchStage, STAGE_LABEL, isCounted } from './types';
import { byKickoff, matchWinner } from './standings';

export type BracketRound = {
  stage: MatchStage;
  label: string;
  /** Matches that exist, padded with nulls up to the size of the round. */
  slots: (Match | null)[];
};

export type Bracket = {
  rounds: BracketRound[];
  thirdPlace: Match | null;
  /** The winner of a completed final. */
  champion: string | null;
  runnerUp: string | null;
};

const ROUND_SIZE: Partial<Record<MatchStage, number>> = {
  quarter: 4,
  semi: 2,
  final: 1,
};

export function buildBracket(matches: Match[]): Bracket {
  const knockouts = matches.filter((m) => m.stage !== 'group');
  const of = (stage: MatchStage) => knockouts.filter((m) => m.stage === stage).sort(byKickoff);

  const quarters = of('quarter');
  // Quarter-finals only appear when the tournament is big enough to need them.
  const stages: MatchStage[] = quarters.length > 0 ? ['quarter', 'semi', 'final'] : ['semi', 'final'];

  const rounds: BracketRound[] = stages.map((stage) => {
    const played = of(stage);
    const size = Math.max(ROUND_SIZE[stage] ?? played.length, played.length);
    const slots: (Match | null)[] = Array.from({ length: size }, (_, i) => played[i] ?? null);
    return { stage, label: STAGE_LABEL[stage], slots };
  });

  const finalMatch = of('final')[0] ?? null;
  const decided = finalMatch && isCounted(finalMatch) ? matchWinner(finalMatch) : null;

  return {
    rounds,
    thirdPlace: of('third_place')[0] ?? null,
    champion: decided,
    runnerUp:
      decided && finalMatch
        ? decided === finalMatch.home_team_id
          ? finalMatch.away_team_id
          : finalMatch.home_team_id
        : null,
  };
}

/** True once there is anything worth showing on the bracket page. */
export function hasKnockoutMatches(matches: Match[]): boolean {
  return matches.some((m) => m.stage !== 'group');
}
