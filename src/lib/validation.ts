import { z } from 'zod';
import { MATCH_STAGES, MATCH_STATUSES, PLAYER_POSITIONS } from './types';

/**
 * Optional form fields, normalised to null when they carry no value.
 *
 * A field can be "not set" in three different ways, and all of them have to
 * land on null:
 *   - present but empty:   <input value="">
 *   - absent entirely:     the input was never rendered (the penalty boxes
 *                          only appear for a level knockout tie)
 *   - absent because disabled: browsers do not submit a disabled control
 *                          (the group select on a knockout match)
 *
 * Only the first was handled originally, so a group-stage result -- which
 * never renders the penalty inputs -- failed with "expected number, received
 * NaN", because z.coerce.number() ran Number(undefined).
 */
const blankToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  }, schema.nullable());

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.string().uuid('That does not look like a valid id.');

const optionalInt = (min: number, max: number) =>
  blankToNull(z.coerce.number().int().min(min).max(max));

export const teamSchema = z.object({
  name: trimmed(80),
  short_name: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3}$/, 'Short name must be exactly 3 letters or digits.'),
  captain_name: blankToNull(z.string().trim().max(80)),
  captain_phone: blankToNull(z.string().trim().max(30)),
  group_name: blankToNull(z.enum(['A', 'B'])),
  tiebreak_override: optionalInt(1, 99),
});

export const playerSchema = z.object({
  team_id: uuid,
  name: trimmed(80),
  roll_no: blankToNull(z.string().trim().max(30)),
  position: z.enum(PLAYER_POSITIONS as [string, ...string[]]),
  jersey_number: optionalInt(0, 99),
  is_captain: z.coerce.boolean().default(false),
});

export const matchSchema = z
  .object({
    stage: z.enum(MATCH_STAGES as [string, ...string[]]),
    group_name: blankToNull(z.enum(['A', 'B'])),
    home_team_id: uuid,
    away_team_id: uuid,
    kickoff_at: z.string().min(1, 'A kickoff time is required.'),
    pitch: blankToNull(z.string().trim().max(60)),
  })
  .refine((value) => value.home_team_id !== value.away_team_id, {
    message: 'A team cannot play itself.',
    path: ['away_team_id'],
  })
  .refine((value) => value.stage !== 'group' || value.group_name != null, {
    message: 'A group match needs a group.',
    path: ['group_name'],
  });

export const resultSchema = z.object({
  match_id: uuid,
  status: z.enum(MATCH_STATUSES as [string, ...string[]]),
  home_score: z.coerce.number().int().min(0).max(99),
  away_score: z.coerce.number().int().min(0).max(99),
  home_pens: optionalInt(0, 99),
  away_pens: optionalInt(0, 99),
  notes: blankToNull(z.string().trim().max(500)),
});

export const goalSchema = z.object({
  match_id: uuid,
  /** 'unknown' means the scorer was never identified. */
  player_id: z.union([uuid, z.literal('unknown')]),
  /** Only consulted when the scorer is unknown. */
  team_id: uuid,
  minute: optionalInt(0, 130),
  is_own_goal: z.coerce.boolean().default(false),
});

export const cardSchema = z.object({
  match_id: uuid,
  player_id: uuid,
  type: z.enum(['yellow', 'red']),
  minute: optionalInt(0, 130),
});

export const settingsSchema = z.object({
  name: trimmed(80),
  tagline: blankToNull(z.string().trim().max(160)),
  prize_note: blankToNull(z.string().trim().max(300)),
  is_knockout_unlocked: z.coerce.boolean().default(false),
});

export const generateFixturesSchema = z.object({
  group_name: z.enum(['A', 'B']),
  /** Local datetime-local value for the first kickoff. */
  first_kickoff: z.string().min(1, 'Pick a time for the first match.'),
  minutes_between: z.coerce.number().int().min(5).max(240).default(45),
  pitch: blankToNull(z.string().trim().max(60)),
});

export const idSchema = z.object({ id: uuid });

export type TeamInput = z.infer<typeof teamSchema>;
export type PlayerInput = z.infer<typeof playerSchema>;
export type ResultInput = z.infer<typeof resultSchema>;
