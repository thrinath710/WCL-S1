'use server';

import { requireHostDb } from '../auth';
import { buildStandings, isGroupStageComplete } from '../standings';
import {
  KNOCKOUT_PITCH,
  SEMI_ONE_TIME,
  SEMI_TWO_TIME,
  onKnockoutDay,
  planSemiFinals,
} from '../knockout';
import { loadTournament, syncFinal } from '../sync-final';
import { type ActionResult, fail, guard, ok, refreshSite } from './shared';

/**
 * The last group match has been played: draw the semi-finals.
 *
 * The draw is crossed -- each group winner meets the other group's runner-up --
 * so the two teams that topped their groups can only meet in the final. The
 * group winner is placed at home, which is what puts them in dark.
 *
 * Nothing is guessed: if a group table is not yet decided, or the semi-finals
 * already exist, this refuses rather than quietly writing something wrong.
 * Once they exist the host can still swap either side by editing the match,
 * and the final follows along.
 */
export async function closeGroupStage(): Promise<ActionResult> {
  return guard(async () => {
    const { db } = await requireHostDb();
    const { teams, matches } = await loadTournament(db);

    if (!isGroupStageComplete(matches)) {
      const left = matches.filter((m) => m.stage === 'group' && m.status === 'scheduled').length;
      return fail(
        left > 0
          ? `${left} group ${left === 1 ? 'match still has' : 'matches still have'} no result. Enter them all before closing the group stage.`
          : 'There are no group matches to close.',
      );
    }

    if (matches.some((m) => m.stage === 'semi')) {
      return fail('The semi-finals have already been drawn. Edit them below if they need changing.');
    }

    const standings = buildStandings(teams, matches);
    const plans = planSemiFinals(standings);
    if (plans.some((p) => !p.home || !p.away)) {
      return fail('Both groups need a winner and a runner-up before the semi-finals can be drawn.');
    }

    // The knockout evening is the day after the last group match.
    const lastGroup = matches
      .filter((m) => m.stage === 'group')
      .map((m) => new Date(m.kickoff_at).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const knockoutDay = new Date(lastGroup + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await db.from('matches').insert(
      plans.map((plan, index) => ({
        stage: 'semi' as const,
        group_name: null,
        home_team_id: plan.home!.id,
        away_team_id: plan.away!.id,
        kickoff_at: onKnockoutDay(knockoutDay, index === 0 ? SEMI_ONE_TIME : SEMI_TWO_TIME),
        pitch: KNOCKOUT_PITCH,
      })),
    );
    if (error) return fail(error.message);

    refreshSite();
    return ok(
      `Semi-finals drawn: ${plans[0].home!.name} v ${plans[0].away!.name}, and ${plans[1].home!.name} v ${plans[1].away!.name}.`,
    );
  });
}

/**
 * Put the two semi-final winners into the final.
 *
 * Called on its own from the knockout screen and again automatically after any
 * knockout result is saved, so the final tracks the semi-finals rather than
 * having to be typed in. The higher seed -- a group winner ahead of a runner-up
 * -- is placed at home and so wears dark, which is the rule printed on the
 * fixture sheet.
 *
 * Rerunning it is safe: an existing final is updated in place, keeping its id,
 * its kickoff and anything already recorded against it.
 */
export async function fillFinal(): Promise<ActionResult> {
  return guard(async () => {
    const { db } = await requireHostDb();
    const result = await syncFinal(db);
    if (result) refreshSite();
    return result ?? fail('Both semi-finals need a winner before the final can be filled in.');
  });
}
