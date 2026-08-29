import { beforeEach, describe, expect, it } from 'vitest';
import { pairKey, planGroupFixtures, roundRobin } from '../fixtures';
import { match, resetIds, team } from './factories';

beforeEach(resetIds);

describe('round robin', () => {
  it('pairs every team with every other exactly once', () => {
    for (const size of [2, 3, 4, 5, 6, 7, 8, 10]) {
      const teams = Array.from({ length: size }, (_, i) => `t${i}`);
      const pairs = roundRobin(teams);

      expect(pairs).toHaveLength((size * (size - 1)) / 2);
      const seen = new Set(pairs.map(([a, b]) => pairKey(a, b)));
      expect(seen.size).toBe(pairs.length);
      expect(pairs.every(([a, b]) => a !== b)).toBe(true);
    }
  });

  it('gives every team the same number of matches when the count is even', () => {
    const teams = ['a', 'b', 'c', 'd', 'e', 'f'];
    const counts = new Map(teams.map((t) => [t, 0]));
    for (const [home, away] of roundRobin(teams)) {
      counts.set(home, counts.get(home)! + 1);
      counts.set(away, counts.get(away)! + 1);
    }
    expect([...counts.values()]).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it('does not spread the home side unevenly', () => {
    const teams = ['a', 'b', 'c', 'd'];
    const homeCounts = new Map(teams.map((t) => [t, 0]));
    for (const [home] of roundRobin(teams)) homeCounts.set(home, homeCounts.get(home)! + 1);
    // Nobody is listed first in every one of their matches.
    expect(Math.max(...homeCounts.values())).toBeLessThan(3);
  });

  it('produces nothing for a group of one or none', () => {
    expect(roundRobin(['solo'])).toEqual([]);
    expect(roundRobin([])).toEqual([]);
  });
});

describe('planning a group', () => {
  const setup = (size: number) =>
    Array.from({ length: size }, (_, i) => team(`Team ${i}`, { group_name: 'A' }));

  it('spaces kickoffs evenly from the first one', () => {
    const teams = setup(4);
    const planned = planGroupFixtures({
      teams,
      group: 'A',
      firstKickoff: new Date('2026-03-14T09:00:00.000Z'),
      minutesBetween: 45,
      pitch: 'Main Ground',
      existing: [],
    });

    expect(planned).toHaveLength(6);
    expect(planned[0].kickoff_at).toBe('2026-03-14T09:00:00.000Z');
    expect(planned[1].kickoff_at).toBe('2026-03-14T09:45:00.000Z');
    expect(planned[5].kickoff_at).toBe('2026-03-14T12:45:00.000Z');
    expect(planned.every((m) => m.pitch === 'Main Ground' && m.group_name === 'A')).toBe(true);
  });

  it('only takes teams from the group it was asked for', () => {
    const teams = [...setup(3), team('Outsider', { group_name: 'B' })];
    const planned = planGroupFixtures({
      teams,
      group: 'A',
      firstKickoff: new Date('2026-03-14T09:00:00.000Z'),
      minutesBetween: 45,
      pitch: null,
      existing: [],
    });
    expect(planned).toHaveLength(3);
  });

  it('does not duplicate a pairing that is already scheduled', () => {
    const teams = setup(4);
    // The reverse ordering of an existing tie must still count as scheduled.
    const existing = [match({ home: teams[1], away: teams[0], hour: 1 })];

    const planned = planGroupFixtures({
      teams,
      group: 'A',
      firstKickoff: new Date('2026-03-14T09:00:00.000Z'),
      minutesBetween: 45,
      pitch: null,
      existing,
    });

    expect(planned).toHaveLength(5);
    expect(
      planned.some((m) => pairKey(m.home_team_id, m.away_team_id) === pairKey(teams[0].id, teams[1].id)),
    ).toBe(false);
  });

  it('plans nothing when every tie has already been created', () => {
    const teams = setup(3);
    const existing = roundRobin(teams).map(([home, away], i) =>
      match({ home, away, hour: i + 1 }),
    );
    const planned = planGroupFixtures({
      teams,
      group: 'A',
      firstKickoff: new Date('2026-03-14T09:00:00.000Z'),
      minutesBetween: 45,
      pitch: null,
      existing,
    });
    expect(planned).toEqual([]);
  });
});
