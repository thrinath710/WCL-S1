import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildStandings } from './standings';
import { planFinal } from './knockout';
import type { Match, Team } from './types';
import { type ActionResult, describeDbError, fail, ok } from './actions/shared';

/**
 * The half of the knockout wiring that needs a database handle.
 *
 * It lives outside `actions/knockout.ts` because a 'use server' module may
 * only export async functions whose arguments cross the wire, and a Supabase
 * client does not. Keeping it here lets both the knockout screen and the
 * result form reuse one implementation.
 */

export async function loadTournament(db: SupabaseClient) {
  const [teams, matches] = await Promise.all([
    db.from('teams').select('*'),
    db.from('matches').select('*'),
  ]);
  if (teams.error) throw new Error(describeDbError(teams.error.message));
  if (matches.error) throw new Error(describeDbError(matches.error.message));
  return {
    teams: (teams.data ?? []) as Team[],
    matches: (matches.data ?? []) as Match[],
  };
}

/**
 * The shared half of `fillFinal`, so saving a semi-final result can bring the
 * final along with it without a second round trip. Returns null when the
 * semi-finals are not both decided yet -- which is not an error, just "not yet".
 */
export async function syncFinal(db: SupabaseClient): Promise<ActionResult | null> {
  const { teams, matches } = await loadTournament(db);
  const standings = buildStandings(teams, matches);
  const plan = planFinal(matches, standings);
  if (!plan) return null;

  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? 'the winner';
  const existing = matches.find((m) => m.stage === 'final');

  if (existing) {
    const unchanged =
      existing.home_team_id === plan.home_team_id && existing.away_team_id === plan.away_team_id;
    if (unchanged) return ok(`The final is already set: ${nameOf(plan.home_team_id)} v ${nameOf(plan.away_team_id)}.`);

    const { error } = await db
      .from('matches')
      .update({ home_team_id: plan.home_team_id, away_team_id: plan.away_team_id })
      .eq('id', existing.id);
    if (error) return fail(describeDbError(error.message));

    return ok(`Final updated: ${nameOf(plan.home_team_id)} v ${nameOf(plan.away_team_id)}.`);
  }

  const { error } = await db.from('matches').insert({
    stage: 'final',
    group_name: null,
    home_team_id: plan.home_team_id,
    away_team_id: plan.away_team_id,
    kickoff_at: plan.kickoff_at,
    pitch: plan.pitch,
  });
  if (error) return fail(describeDbError(error.message));

  return ok(
    `Final set: ${nameOf(plan.home_team_id)} v ${nameOf(plan.away_team_id)}. ${nameOf(plan.home_team_id)} are the higher seed and wear dark.`,
  );
}
