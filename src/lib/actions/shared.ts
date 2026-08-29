import 'server-only';
import { revalidatePath, updateTag } from 'next/cache';
import { ZodError, type ZodType } from 'zod';
import { NotAuthorisedError } from '../auth';
import { TOURNAMENT_TAG } from '../queries';

/**
 * What every Server Action returns.
 *
 * `warning` is for things the organiser should see but that must not block
 * the save -- most importantly, a list of scorers that does not add up to the
 * scoreline that was entered.
 */
export type ActionResult =
  | { ok: true; message?: string; warning?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const ok = (message?: string, warning?: string): ActionResult => ({
  ok: true,
  message,
  warning,
});

export const fail = (error: string, fieldErrors?: Record<string, string[]>): ActionResult => ({
  ok: false,
  error,
  fieldErrors,
});

/** Parse a submitted form against a schema, collecting per-field messages. */
export function parseForm<T>(
  schema: ZodType<T>,
  formData: FormData,
): { data: T; error?: never } | { data?: never; error: ActionResult } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') raw[key] = value;
  }
  // An unchecked checkbox submits nothing at all.
  for (const key of ['is_captain', 'is_own_goal', 'is_knockout_unlocked']) {
    if (!(key in raw)) raw[key] = false;
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) return { data: parsed.data };

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = parsed.error.issues[0]?.message ?? 'Those details are not valid.';
  return { error: fail(first, fieldErrors) };
}

/**
 * Every public route that shows a scoreline, a table or a tally.
 *
 * Listed explicitly rather than swept with a layout-wide call so that a save
 * invalidates what actually changed. `/bracket` is included because a
 * knockout result moves teams through it.
 */
const SCORE_PATHS = ['/', '/table', '/fixtures', '/stats', '/bracket'] as const;

/**
 * After a save: drop the cached snapshot, then the pages built from it.
 *
 * The tag is the important half. Every public page reads one `unstable_cache`
 * entry (see queries.ts), so expiring the tag means the very next render goes
 * to the database and everyone sees the new number -- rather than waiting out
 * the thirty-second window. The path calls then rebuild the affected routes.
 *
 * `updateTag` rather than `revalidateTag`: the latter serves stale content
 * while it refreshes in the background, which is right for a blog and wrong
 * for a scoreline somebody just typed and is watching for. `updateTag` expires
 * the entry outright, so the next read blocks and returns the new number.
 * It is only valid inside a Server Action, which is the only place these run.
 */
export function refreshSite() {
  updateTag(TOURNAMENT_TAG);
  revalidatePath('/', 'layout');
}

/**
 * The narrower version, for a result, goal or card on one match.
 *
 * Both teams' pages are refreshed by id rather than by pattern, so entering a
 * score does not invalidate all twelve squad pages -- only the two that just
 * changed.
 */
export function refreshMatch(match: {
  id: string;
  home_team_id: string;
  away_team_id: string;
}) {
  updateTag(TOURNAMENT_TAG);
  for (const path of SCORE_PATHS) revalidatePath(path);
  revalidatePath(`/match/${match.id}`);
  revalidatePath(`/teams/${match.home_team_id}`);
  revalidatePath(`/teams/${match.away_team_id}`);
}

/** Turns thrown errors into a result the form can show, instead of a crash. */
export async function guard(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotAuthorisedError) return fail(error.message);
    if (error instanceof ZodError) {
      return fail(error.issues[0]?.message ?? 'Those details are not valid.');
    }
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    return fail(message);
  }
}

/** Turns a Postgres constraint violation into something readable. */
export function describeDbError(message: string): string {
  if (message.includes('teams_name_key')) return 'A team with that name already exists.';
  if (message.includes('players_team_jersey_key')) {
    return 'Another player in that squad already has that shirt number.';
  }
  if (message.includes('players_team_captain_key')) {
    return 'That squad already has a captain. Unset the current one first.';
  }
  if (message.includes('short_name')) return 'Short name must be exactly 3 characters.';
  if (message.includes('matches_distinct_teams')) return 'A team cannot play itself.';
  if (message.includes('matches_pens_decisive')) return 'A shootout cannot end level.';
  if (message.includes('matches_group_stage_has_group')) {
    return 'Group matches need a group; knockout matches must not have one.';
  }
  return message;
}
