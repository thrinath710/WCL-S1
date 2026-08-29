'use server';

import { requireHostDb } from '../auth';
import { syncFinal } from '../sync-final';
import { cardSchema, goalSchema, idSchema, resultSchema } from '../validation';
import type { Goal, Match, Player } from '../types';
import { isKnockout } from '../types';
import {
  type ActionResult,
  describeDbError,
  fail,
  guard,
  ok,
  parseForm,
  refreshMatch,
  refreshSite,
} from './shared';

/** Reads a match plus everything needed to check the guard rails against it. */
async function loadMatch(db: Awaited<ReturnType<typeof requireHostDb>>['db'], matchId: string) {
  const [match, goals, players] = await Promise.all([
    db.from('matches').select('*').eq('id', matchId).maybeSingle(),
    db.from('goals').select('*').eq('match_id', matchId),
    db.from('players').select('id, team_id, name'),
  ]);
  if (match.error) throw new Error(describeDbError(match.error.message));
  if (!match.data) throw new Error('That match no longer exists.');

  return {
    match: match.data as Match,
    goals: (goals.data ?? []) as Goal[],
    players: (players.data ?? []) as Pick<Player, 'id' | 'team_id' | 'name'>[],
  };
}

/** Do the recorded scorers add up to the scoreline that was entered? */
function reconcile(match: Match, goals: Goal[]): string | undefined {
  const home = goals.filter((g) => g.team_id === match.home_team_id).length;
  const away = goals.filter((g) => g.team_id === match.away_team_id).length;
  if (home === match.home_score && away === match.away_score) return undefined;

  return `Scorers entered so far (${home}–${away}) do not add up to the score (${match.home_score}–${match.away_score}). The table uses the score; add the missing scorers when you know them.`;
}

/**
 * Save the scoreline, status and penalties.
 *
 * Guard rails, in order of severity:
 *   - a knockout match cannot be completed level without a shootout (blocked)
 *   - a shootout cannot itself end level (blocked)
 *   - scorers that do not add up to the score (warned, never blocked, because
 *     the score is what the referee gave and it must be recordable at once)
 */
export async function saveResult(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(resultSchema, formData);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const { db } = await requireHostDb();
    const { match, goals } = await loadMatch(db, input.match_id);

    const finished = input.status === 'completed' || input.status === 'walkover';
    const level = input.home_score === input.away_score;
    const hasPens = input.home_pens != null && input.away_pens != null;

    if (finished && isKnockout(match.stage) && level && !hasPens) {
      return fail(
        'A knockout match cannot end level. Enter the penalty shootout score before completing it.',
      );
    }
    if (hasPens && input.home_pens === input.away_pens) {
      return fail('A penalty shootout cannot end level. One side has to have more.');
    }
    if (hasPens && !level) {
      return fail(
        'Penalties only apply when the match finished level. Clear them, or correct the score.',
      );
    }

    const { error } = await db
      .from('matches')
      .update({
        status: input.status,
        home_score: input.home_score,
        away_score: input.away_score,
        home_pens: input.home_pens,
        away_pens: input.away_pens,
        notes: input.notes,
      })
      .eq('id', input.match_id);

    if (error) return fail(describeDbError(error.message));

    // A semi-final result decides half of the final, so put the winners in as
    // soon as both are known rather than making anyone type them again. It is
    // a no-op until the second semi-final is finished, and it re-runs happily
    // if a scoreline is later corrected.
    let followOn: string | undefined;
    if (match.stage === 'semi') {
      const filled = await syncFinal(db);
      if (filled?.ok) followOn = filled.message;
      else if (filled && !filled.ok) followOn = `The final could not be filled in: ${filled.error}`;
    }

    refreshMatch(match);
    const updated: Match = {
      ...match,
      home_score: input.home_score,
      away_score: input.away_score,
    };
    const mismatch = finished ? reconcile(updated, goals) : undefined;
    return ok(
      followOn ? `Result saved. ${followOn}` : 'Result saved.',
      mismatch,
    );
  });
}

/**
 * Record a goal.
 *
 * The team the goal counts for is derived, never trusted from the form: for
 * an own goal it is the scorer's opponent, otherwise it is the scorer's own
 * team. That is the single rule that keeps own goals out of player tallies
 * while still counting them on the scoreboard.
 */
export async function addGoal(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(goalSchema, formData);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const { db } = await requireHostDb();
    const { match, players } = await loadMatch(db, input.match_id);
    const sides = [match.home_team_id, match.away_team_id];

    let playerId: string | null = null;
    let creditedTo: string;

    if (input.player_id === 'unknown') {
      if (!sides.includes(input.team_id)) {
        return fail('Pick which of the two teams the goal counts for.');
      }
      creditedTo = input.team_id;
    } else {
      const scorer = players.find((p) => p.id === input.player_id);
      if (!scorer) return fail('That player is no longer in the squad list.');
      if (!sides.includes(scorer.team_id)) {
        return fail('That player does not play for either team in this match.');
      }
      playerId = scorer.id;
      creditedTo = input.is_own_goal
        ? sides.find((id) => id !== scorer.team_id)!
        : scorer.team_id;
    }

    const { error } = await db.from('goals').insert({
      match_id: input.match_id,
      player_id: playerId,
      team_id: creditedTo,
      minute: input.minute,
      is_own_goal: input.is_own_goal,
    });
    if (error) return fail(describeDbError(error.message));

    const { goals } = await loadMatch(db, input.match_id);
    refreshMatch(match);
    return ok('Goal added.', reconcile(match, goals));
  });
}

export async function deleteGoal(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(idSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireHostDb();
    // Read which match it belonged to first: after the delete there is no way
    // back to it, and the refresh needs both teams.
    const row = await db.from('goals').select('match_id').eq('id', parsed.data.id).maybeSingle();
    const { error } = await db.from('goals').delete().eq('id', parsed.data.id);
    if (error) return fail(describeDbError(error.message));

    if (row.data?.match_id) refreshMatch((await loadMatch(db, row.data.match_id)).match);
    else refreshSite();
    return ok('Goal removed.');
  });
}

export async function addCard(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(cardSchema, formData);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const { db } = await requireHostDb();
    const { match, players } = await loadMatch(db, input.match_id);

    const player = players.find((p) => p.id === input.player_id);
    if (!player) return fail('That player is no longer in the squad list.');
    if (![match.home_team_id, match.away_team_id].includes(player.team_id)) {
      return fail('That player does not play for either team in this match.');
    }

    const { error } = await db.from('cards').insert({
      match_id: input.match_id,
      player_id: input.player_id,
      type: input.type,
      minute: input.minute,
    });
    if (error) return fail(describeDbError(error.message));

    refreshMatch(match);
    return ok(
      input.type === 'red'
        ? `Red card recorded. ${player.name} is suspended for the next match.`
        : 'Yellow card recorded.',
    );
  });
}

export async function deleteCard(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(idSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireHostDb();
    const row = await db.from('cards').select('match_id').eq('id', parsed.data.id).maybeSingle();
    const { error } = await db.from('cards').delete().eq('id', parsed.data.id);
    if (error) return fail(describeDbError(error.message));

    if (row.data?.match_id) refreshMatch((await loadMatch(db, row.data.match_id)).match);
    else refreshSite();
    return ok('Card removed.');
  });
}
