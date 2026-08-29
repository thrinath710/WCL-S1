/**
 * Form validation, exercised the way the browser actually submits.
 *
 * The bug these guard against: an optional field that is *absent* from the
 * form -- not blank, absent -- used to reach z.coerce.number() as undefined
 * and fail with "expected number, received NaN". That blocked every
 * group-stage result, because the penalty inputs are only rendered for a
 * level knockout tie.
 */

import { describe, expect, it } from 'vitest';
import {
  cardSchema,
  goalSchema,
  matchSchema,
  playerSchema,
  resultSchema,
  teamSchema,
} from '../validation';

const MATCH_ID = '33333333-3333-4333-8333-000000000001';
const TEAM_A = '11111111-1111-4111-8111-000000000001';
const TEAM_B = '11111111-1111-4111-8111-000000000002';
const PLAYER = '22222222-2222-4222-8222-000000000001';

describe('saving a result', () => {
  const base = { match_id: MATCH_ID, status: 'completed', home_score: '3', away_score: '1' };

  it('accepts a group result with no penalty fields on the form at all', () => {
    // A group match never renders the shootout inputs, so they are absent.
    const parsed = resultSchema.safeParse({ ...base, notes: '' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.home_pens).toBeNull();
      expect(parsed.data.away_pens).toBeNull();
      expect(parsed.data.home_score).toBe(3);
      expect(parsed.data.away_score).toBe(1);
    }
  });

  it('accepts penalty fields that are present but left empty', () => {
    const parsed = resultSchema.safeParse({ ...base, home_pens: '', away_pens: '', notes: '' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.home_pens).toBeNull();
  });

  it('reads a shootout when one was entered', () => {
    const parsed = resultSchema.safeParse({
      ...base,
      home_score: '1',
      away_score: '1',
      home_pens: '5',
      away_pens: '4',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.home_pens).toBe(5);
      expect(parsed.data.away_pens).toBe(4);
    }
  });

  it('accepts a 0-0 without mistaking zero for blank', () => {
    const parsed = resultSchema.safeParse({ ...base, home_score: '0', away_score: '0' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.home_score).toBe(0);
      expect(parsed.data.away_score).toBe(0);
    }
  });

  it('still rejects a score that is not a number', () => {
    expect(resultSchema.safeParse({ ...base, home_score: 'three' }).success).toBe(false);
  });

  it('still rejects a negative score', () => {
    expect(resultSchema.safeParse({ ...base, home_score: '-1' }).success).toBe(false);
  });
});

describe('creating a match', () => {
  const base = {
    home_team_id: TEAM_A,
    away_team_id: TEAM_B,
    kickoff_at: '2026-03-14T09:00',
    pitch: 'Main Ground',
  };

  it('accepts a knockout match with no group field on the form', () => {
    // The group select is disabled for a knockout stage, and a disabled
    // control is not submitted at all.
    const parsed = matchSchema.safeParse({ ...base, stage: 'semi' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.group_name).toBeNull();
  });

  it('still requires a group on a group-stage match', () => {
    const parsed = matchSchema.safeParse({ ...base, stage: 'group' });
    expect(parsed.success).toBe(false);
  });

  it('accepts a group-stage match with its group', () => {
    expect(matchSchema.safeParse({ ...base, stage: 'group', group_name: 'A' }).success).toBe(true);
  });

  it('refuses a team playing itself', () => {
    const parsed = matchSchema.safeParse({
      ...base,
      stage: 'group',
      group_name: 'A',
      away_team_id: TEAM_A,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('goals and cards', () => {
  it('accepts a goal with no minute given', () => {
    const parsed = goalSchema.safeParse({
      match_id: MATCH_ID,
      player_id: PLAYER,
      team_id: TEAM_A,
      is_own_goal: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.minute).toBeNull();
  });

  it('accepts an unattributed goal', () => {
    const parsed = goalSchema.safeParse({
      match_id: MATCH_ID,
      player_id: 'unknown',
      team_id: TEAM_A,
      minute: '12',
      is_own_goal: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.player_id).toBe('unknown');
  });

  it('keeps minute 0 rather than treating it as blank', () => {
    const parsed = goalSchema.safeParse({
      match_id: MATCH_ID,
      player_id: PLAYER,
      team_id: TEAM_A,
      minute: '0',
      is_own_goal: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.minute).toBe(0);
  });

  it('accepts a card with no minute given', () => {
    const parsed = cardSchema.safeParse({
      match_id: MATCH_ID,
      player_id: PLAYER,
      type: 'yellow',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.minute).toBeNull();
  });
});

describe('teams and players', () => {
  it('accepts a team with only the required fields filled in', () => {
    const parsed = teamSchema.safeParse({ name: 'FC Bhukkad', short_name: 'bhk' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.short_name).toBe('BHK'); // upper-cased for the table
      expect(parsed.data.group_name).toBeNull();
      expect(parsed.data.tiebreak_override).toBeNull();
      expect(parsed.data.captain_phone).toBeNull();
    }
  });

  it('rejects a short name that is not three characters', () => {
    expect(teamSchema.safeParse({ name: 'X', short_name: 'TOOLONG' }).success).toBe(false);
    expect(teamSchema.safeParse({ name: 'X', short_name: 'AB' }).success).toBe(false);
  });

  it('accepts a player with no shirt number or roll number', () => {
    const parsed = playerSchema.safeParse({
      team_id: TEAM_A,
      name: 'Arjun Reddy',
      position: 'GK',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.jersey_number).toBeNull();
      expect(parsed.data.roll_no).toBeNull();
      expect(parsed.data.is_captain).toBe(false);
    }
  });

  it('keeps shirt number 0, which is a legal number', () => {
    const parsed = playerSchema.safeParse({
      team_id: TEAM_A,
      name: 'Arjun Reddy',
      position: 'GK',
      jersey_number: '0',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.jersey_number).toBe(0);
  });
});
