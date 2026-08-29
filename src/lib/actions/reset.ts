'use server';

import { requireAdminDb } from '../auth';
import { CLEARED_RESULT, RESET_PHRASE, matchesOnDay, staleKnockoutWarning } from '../reset';
import { isCounted, isKnockout, type Match } from '../types';
import { type ActionResult, describeDbError, fail, guard, ok, refreshSite } from './shared';

/**
 * Resetting is the organiser's alone.
 *
 * A match host can correct any single scoreline they typed -- that is the job.
 * Throwing away a whole evening of results is a different kind of decision,
 * and `requireAdminDb()` defaults to the organiser, so both actions below are
 * closed to a host on the server as well as hidden from them in the UI.
 */

const counted = (matches: Match[]) => matches.filter(isCounted).length;

/**
 * Put one night back to unplayed.
 *
 * Scorelines, penalties, notes, goals and cards for that day all go; the
 * fixtures stay exactly where they are, so the schedule a reader sees is
 * unchanged and every match is simply ready to be entered again.
 */
export async function resetDay(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const key = String(formData.get('day') ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return fail('Pick a day to reset.');

    const { db } = await requireAdminDb();
    const all = await db.from('matches').select('*');
    if (all.error) return fail(describeDbError(all.error.message));

    const matches = (all.data ?? []) as Match[];
    const onDay = matchesOnDay(matches, key);
    if (onDay.length === 0) return fail('There are no fixtures on that day.');

    const ids = onDay.map((m) => m.id);
    const had = counted(onDay);

    // Goals and cards first: a result with its scorers still attached would be
    // a half-reset, and the stats pages read from those tables directly.
    const goals = await db.from('goals').delete().in('match_id', ids);
    if (goals.error) return fail(describeDbError(goals.error.message));
    const cards = await db.from('cards').delete().in('match_id', ids);
    if (cards.error) return fail(describeDbError(cards.error.message));

    const cleared = await db.from('matches').update(CLEARED_RESULT).in('id', ids);
    if (cleared.error) return fail(describeDbError(cleared.error.message));

    refreshSite();
    return ok(
      had > 0
        ? `Reset ${had} ${had === 1 ? 'result' : 'results'}. All ${onDay.length} ${onDay.length === 1 ? 'match is' : 'matches are'} ready to be entered again.`
        : `Nothing had been entered for that day. All ${onDay.length} ${onDay.length === 1 ? 'match is' : 'matches are'} still scheduled.`,
      staleKnockoutWarning(matches, key) ?? undefined,
    );
  });
}

/**
 * Put the whole tournament back to the morning of the first match.
 *
 * Every result, goal and card goes. The semi-finals and the final go with them
 * -- not out of tidiness, but because those ties only exist as a consequence of
 * the group tables: leaving them behind would mean a draw derived from results
 * that no longer exist, and would block the group stage from being closed
 * again. The thirty group fixtures, the teams and the squads are untouched.
 */
export async function resetTournament(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const typed = String(formData.get('confirm') ?? '').trim().toUpperCase();
    if (typed !== RESET_PHRASE) {
      return fail(`Type ${RESET_PHRASE} to confirm. Nothing has been changed.`);
    }

    const { db } = await requireAdminDb();
    const all = await db.from('matches').select('*');
    if (all.error) return fail(describeDbError(all.error.message));

    const matches = (all.data ?? []) as Match[];
    if (matches.length === 0) return fail('There are no fixtures to reset.');

    const had = counted(matches);
    const knockouts = matches.filter((m) => isKnockout(m.stage));

    // Deleting the knockout ties takes their goals and cards with them by
    // cascade; everything else has to be cleared explicitly.
    const goals = await db.from('goals').delete().neq('id', ZERO_UUID);
    if (goals.error) return fail(describeDbError(goals.error.message));
    const cards = await db.from('cards').delete().neq('id', ZERO_UUID);
    if (cards.error) return fail(describeDbError(cards.error.message));

    if (knockouts.length > 0) {
      const dropped = await db
        .from('matches')
        .delete()
        .in('id', knockouts.map((m) => m.id));
      if (dropped.error) return fail(describeDbError(dropped.error.message));
    }

    const cleared = await db
      .from('matches')
      .update(CLEARED_RESULT)
      .in('id', matches.filter((m) => !isKnockout(m.stage)).map((m) => m.id));
    if (cleared.error) return fail(describeDbError(cleared.error.message));

    // The bracket goes back behind its lock, since there is nothing in it.
    const settings = await db.from('tournament_settings').select('id').limit(1).maybeSingle();
    if (settings.data) {
      await db
        .from('tournament_settings')
        .update({ is_knockout_unlocked: false })
        .eq('id', settings.data.id);
    }

    refreshSite();
    const parts = [`Reset ${had} ${had === 1 ? 'result' : 'results'}.`];
    if (knockouts.length > 0) {
      parts.push(
        `${knockouts.length} knockout ${knockouts.length === 1 ? 'match was' : 'matches were'} removed -- close the group stage again to redraw them.`,
      );
    }
    parts.push('Teams, squads and the group fixtures are untouched.');
    return ok(parts.join(' '));
  });
}

/**
 * PostgREST refuses an unfiltered delete, which is a good default. This is the
 * filter that means "every row": no id can equal the nil UUID.
 */
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
