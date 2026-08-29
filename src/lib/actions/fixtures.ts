'use server';

import { requireAdminDb, requireHostDb } from '../auth';
import { generateFixturesSchema, idSchema, matchSchema, settingsSchema } from '../validation';
import { planGroupFixtures } from '../fixtures';
import type { Match, Team } from '../types';
import {
  type ActionResult,
  describeDbError,
  fail,
  guard,
  ok,
  parseForm,
  refreshSite,
} from './shared';

/**
 * A datetime-local field has no timezone. It means the campus clock, which is
 * the tournament timezone, so it is resolved there rather than on the server's
 * own clock -- otherwise a kickoff typed on Vercel (UTC) would land hours off.
 */
function fromLocalInput(value: string): string {
  const zone = process.env.NEXT_PUBLIC_TIMEZONE?.trim() || 'Asia/Kolkata';
  const naive = new Date(`${value}${value.length === 16 ? ':00' : ''}Z`);
  if (Number.isNaN(naive.getTime())) throw new Error('That kickoff time is not valid.');

  // Work out the zone's offset at that moment, then shift by it.
  const asZoned = new Date(naive.toLocaleString('en-US', { timeZone: zone }));
  const asUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = asZoned.getTime() - asUtc.getTime();
  return new Date(naive.getTime() - offsetMs).toISOString();
}

export async function createMatch(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(matchSchema, formData);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const { db } = await requireAdminDb();
    const { error } = await db.from('matches').insert({
      stage: input.stage,
      group_name: input.stage === 'group' ? input.group_name : null,
      home_team_id: input.home_team_id,
      away_team_id: input.away_team_id,
      kickoff_at: fromLocalInput(input.kickoff_at),
      pitch: input.pitch,
    });
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok('Match created.');
  });
}

/**
 * Change an existing fixture: its teams, its kickoff, its court.
 *
 * Open to a match host, because rearranging a tie is part of running the
 * evening -- and because swapping the two sides is how the knockout kit is
 * corrected. Creating and deleting fixtures are not: the published schedule
 * is the organiser's.
 */
export async function updateMatch(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const idCheck = idSchema.safeParse({ id: formData.get('id') });
    if (!idCheck.success) return fail('Missing match id.');

    const parsed = parseForm(matchSchema, formData);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const { db } = await requireHostDb();
    const { error } = await db
      .from('matches')
      .update({
        stage: input.stage,
        group_name: input.stage === 'group' ? input.group_name : null,
        home_team_id: input.home_team_id,
        away_team_id: input.away_team_id,
        kickoff_at: fromLocalInput(input.kickoff_at),
        pitch: input.pitch,
      })
      .eq('id', idCheck.data.id);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok('Match saved.');
  });
}

/** Just the kickoff time, for setting times after generating a round robin. */
export async function updateKickoff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const idCheck = idSchema.safeParse({ id: formData.get('id') });
    if (!idCheck.success) return fail('Missing match id.');

    const kickoff = String(formData.get('kickoff_at') ?? '');
    if (!kickoff) return fail('Pick a kickoff time.');
    const pitch = String(formData.get('pitch') ?? '').trim() || null;

    const { db } = await requireHostDb();
    const { error } = await db
      .from('matches')
      .update({ kickoff_at: fromLocalInput(kickoff), pitch })
      .eq('id', idCheck.data.id);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok('Kickoff updated.');
  });
}

export async function deleteMatch(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(idSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireAdminDb();
    const { error } = await db.from('matches').delete().eq('id', parsed.data.id);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok('Match deleted, along with its goals and cards.');
  });
}

/**
 * Round-robin every team in a group against every other, starting at a chosen
 * kickoff and spacing them evenly. Ties that already exist are skipped, so
 * pressing this twice is harmless.
 */
export async function generateGroupFixtures(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(generateFixturesSchema, formData);
    if (parsed.error) return parsed.error;
    const input = parsed.data;

    const { db } = await requireAdminDb();
    const [teams, matches] = await Promise.all([
      db.from('teams').select('*'),
      db.from('matches').select('*'),
    ]);
    if (teams.error) return fail(describeDbError(teams.error.message));

    const members = ((teams.data ?? []) as Team[]).filter((t) => t.group_name === input.group_name);
    if (members.length < 2) {
      return fail(`Group ${input.group_name} needs at least two teams before fixtures can be generated.`);
    }

    const planned = planGroupFixtures({
      teams: (teams.data ?? []) as Team[],
      group: input.group_name,
      firstKickoff: new Date(fromLocalInput(input.first_kickoff)),
      minutesBetween: input.minutes_between,
      pitch: input.pitch,
      existing: (matches.data ?? []) as Match[],
    });

    if (planned.length === 0) {
      return ok(`Every fixture in group ${input.group_name} already exists.`);
    }

    const { error } = await db.from('matches').insert(planned);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok(
      `${planned.length} ${planned.length === 1 ? 'fixture' : 'fixtures'} created for group ${input.group_name}. Set the kickoff times below.`,
    );
  });
}

export async function saveSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(settingsSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireAdminDb();
    const existing = await db.from('tournament_settings').select('id').limit(1).maybeSingle();

    const { error } = existing.data
      ? await db.from('tournament_settings').update(parsed.data).eq('id', existing.data.id)
      : await db.from('tournament_settings').insert(parsed.data);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok('Settings saved.');
  });
}
