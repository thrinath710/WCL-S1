import { beforeEach, describe, expect, it } from 'vitest';
import { CLEARED_RESULT, matchesOnDay, resetDays, staleKnockoutWarning } from '../reset';
import { isCounted } from '../types';
import { match, resetIds, team } from './factories';
import type { Card, Goal, Match } from '../types';

beforeEach(resetIds);

/** Kickoffs in tournament time (Asia/Kolkata), so the day keys are real. */
const ist = (day: string, time: string) => new Date(`${day}T${time}:00+05:30`).toISOString();

function tournament() {
  const a = team('Alpha');
  const b = team('Bravo');
  const c = team('Charlie');

  const on = (day: string, time: string, extra: Partial<Match> = {}): Match => ({
    ...match({ home: a, away: b, hour: 1 }),
    id: `${day}-${time}`,
    kickoff_at: ist(day, time),
    ...extra,
  });

  const matches: Match[] = [
    on('2026-08-31', '18:00', { status: 'completed', home_score: 2, away_score: 1 }),
    on('2026-08-31', '19:00', { status: 'completed', home_score: 0, away_score: 0 }),
    on('2026-09-01', '18:00', { status: 'completed', home_score: 3, away_score: 2 }),
    on('2026-09-01', '19:00'), // still scheduled
    on('2026-09-03', '19:00', { stage: 'semi', group_name: null }),
  ];

  const goals: Goal[] = [
    { id: 'g1', match_id: '2026-08-31-18:00', player_id: null, team_id: a.id, minute: 3, is_own_goal: false, created_at: '' },
    { id: 'g2', match_id: '2026-08-31-18:00', player_id: null, team_id: b.id, minute: 8, is_own_goal: false, created_at: '' },
    { id: 'g3', match_id: '2026-09-01-18:00', player_id: null, team_id: a.id, minute: 5, is_own_goal: false, created_at: '' },
  ];
  const cards: Card[] = [
    { id: 'c1', match_id: '2026-08-31-18:00', player_id: 'p1', type: 'yellow', minute: 11, created_at: '' },
  ];

  return { matches, goals, cards, a, b, c };
}

describe('the days a reset can target', () => {
  it('lists every day with fixtures, earliest first', () => {
    const { matches, goals, cards } = tournament();
    expect(resetDays(matches, goals, cards).map((d) => d.key)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-03',
    ]);
  });

  it('counts what each day would actually clear', () => {
    const { matches, goals, cards } = tournament();
    const [monday, tuesday, thursday] = resetDays(matches, goals, cards);

    expect(monday).toMatchObject({ total: 2, played: 2, goals: 2, cards: 1, knockout: false });
    expect(tuesday).toMatchObject({ total: 2, played: 1, goals: 1, cards: 0, knockout: false });
    expect(thursday).toMatchObject({ total: 1, played: 0, goals: 0, cards: 0, knockout: true });
  });

  it('names each day the way the site does', () => {
    const { matches, goals, cards } = tournament();
    expect(resetDays(matches, goals, cards)[0].label).toBe('Monday 31 August');
  });

  it('keeps a day with nothing entered, so the row can say zero', () => {
    const { matches, goals, cards } = tournament();
    const thursday = resetDays(matches, goals, cards).find((d) => d.key === '2026-09-03')!;
    expect(thursday.played).toBe(0);
  });

  it('groups a late kickoff with its own evening, not the next UTC day', () => {
    // 9:30 pm IST is already the following day in UTC; the reset must still
    // treat it as part of that night.
    const { matches, goals, cards } = tournament();
    const late = [
      ...matches,
      { ...matches[0], id: 'late', kickoff_at: ist('2026-08-31', '21:30') },
    ];
    const monday = resetDays(late, goals, cards).find((d) => d.key === '2026-08-31')!;
    expect(monday.total).toBe(3);
  });
});

describe('picking a day out', () => {
  it('returns exactly that evening', () => {
    const { matches } = tournament();
    expect(matchesOnDay(matches, '2026-08-31').map((m) => m.id)).toEqual([
      '2026-08-31-18:00',
      '2026-08-31-19:00',
    ]);
  });

  it('returns nothing for a day with no fixtures', () => {
    const { matches } = tournament();
    expect(matchesOnDay(matches, '2026-09-02')).toEqual([]);
  });
});

describe('the cleared shape', () => {
  it('is what an unplayed match looks like', () => {
    const { matches } = tournament();
    const cleared = { ...matches[0], ...CLEARED_RESULT };
    expect(isCounted(cleared)).toBe(false);
    expect(cleared.home_score).toBe(0);
    expect(cleared.away_score).toBe(0);
    expect(cleared.home_pens).toBeNull();
    expect(cleared.notes).toBeNull();
  });

  it('leaves the fixture itself alone', () => {
    const { matches } = tournament();
    const cleared = { ...matches[0], ...CLEARED_RESULT };
    expect(cleared.kickoff_at).toBe(matches[0].kickoff_at);
    expect(cleared.home_team_id).toBe(matches[0].home_team_id);
    expect(cleared.away_team_id).toBe(matches[0].away_team_id);
  });
});

describe('warning about a stale draw', () => {
  it('warns when a group night is cleared under an existing semi-final', () => {
    const { matches } = tournament();
    expect(staleKnockoutWarning(matches, '2026-08-31')).toMatch(/semi-finals and final/i);
  });

  it('says nothing when the knockout day is the one being reset', () => {
    const { matches } = tournament();
    expect(staleKnockoutWarning(matches, '2026-09-03')).toBeNull();
  });

  it('says nothing when no knockout matches exist yet', () => {
    const { matches } = tournament();
    const groupsOnly = matches.filter((m) => m.stage === 'group');
    expect(staleKnockoutWarning(groupsOnly, '2026-08-31')).toBeNull();
  });
});
