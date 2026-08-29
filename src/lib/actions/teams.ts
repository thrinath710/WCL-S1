'use server';

import { requireAdminDb } from '../auth';
import { idSchema, playerSchema, teamSchema } from '../validation';
import {
  type ActionResult,
  describeDbError,
  fail,
  guard,
  ok,
  parseForm,
  refreshSite,
} from './shared';

export async function createTeam(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(teamSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireAdminDb();
    const { error } = await db.from('teams').insert(parsed.data);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok(`${parsed.data.name} added.`);
  });
}

export async function updateTeam(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const id = formData.get('id');
    const idCheck = idSchema.safeParse({ id });
    if (!idCheck.success) return fail('Missing team id.');

    const parsed = parseForm(teamSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireAdminDb();
    const { error } = await db.from('teams').update(parsed.data).eq('id', idCheck.data.id);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok('Team saved.');
  });
}

/**
 * Deleting a team takes its squad and its matches with it -- the foreign keys
 * cascade. The confirmation in the UI says exactly how much goes, because
 * this is the one destructive action that reaches beyond what is on screen.
 */
export async function deleteTeam(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(idSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireAdminDb();
    const { error } = await db.from('teams').delete().eq('id', parsed.data.id);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok('Team deleted, along with its squad and fixtures.');
  });
}

export async function createPlayer(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(playerSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireAdminDb();
    const { error } = await db.from('players').insert(parsed.data);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok(`${parsed.data.name} added to the squad.`);
  });
}

export async function updatePlayer(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const idCheck = idSchema.safeParse({ id: formData.get('id') });
    if (!idCheck.success) return fail('Missing player id.');

    const parsed = parseForm(playerSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireAdminDb();
    const { error } = await db.from('players').update(parsed.data).eq('id', idCheck.data.id);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok('Player saved.');
  });
}

export async function deletePlayer(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseForm(idSchema, formData);
    if (parsed.error) return parsed.error;

    const { db } = await requireAdminDb();
    const { error } = await db.from('players').delete().eq('id', parsed.data.id);
    if (error) return fail(describeDbError(error.message));

    refreshSite();
    return ok('Player removed.');
  });
}
