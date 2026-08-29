import { beforeEach, describe, expect, it } from 'vitest';
import { groupByDay, headlineMatch, liveMatches, recentResults, upcomingMatches } from '../schedule';
import { match, resetIds, team } from './factories';

beforeEach(resetIds);

const alpha = () => team('Alpha');
const bravo = () => team('Bravo');

describe('what is on', () => {
  it('finds the live match first, whatever else is scheduled', () => {
    const a = alpha();
    const b = bravo();
    const fixtures = [
      match({ home: a, away: b, score: [2, 0], hour: 1 }),
      match({ home: b, away: a, status: 'live', score: [1, 1], hour: 2 }),
      match({ home: a, away: b, hour: 3 }),
    ];

    expect(liveMatches(fixtures)).toHaveLength(1);
    expect(headlineMatch(fixtures)?.kind).toBe('live');
  });

  it('falls back to the next kickoff when nothing is live', () => {
    const a = alpha();
    const b = bravo();
    const fixtures = [
      match({ home: a, away: b, score: [2, 0], hour: 1 }),
      match({ home: b, away: a, hour: 5 }),
      match({ home: a, away: b, hour: 3 }),
    ];

    const headline = headlineMatch(fixtures);
    expect(headline?.kind).toBe('next');
    expect(headline?.match.kickoff_at).toBe(fixtures[2].kickoff_at);
  });

  it('falls back to the last result when the tournament is over', () => {
    const a = alpha();
    const b = bravo();
    const fixtures = [
      match({ home: a, away: b, score: [2, 0], hour: 1 }),
      match({ home: b, away: a, score: [0, 1], stage: 'final', hour: 9 }),
    ];

    const headline = headlineMatch(fixtures);
    expect(headline?.kind).toBe('last');
    expect(headline?.match.stage).toBe('final');
  });

  it('has nothing to say before a fixture exists', () => {
    expect(headlineMatch([])).toBeNull();
    expect(upcomingMatches([], 3)).toEqual([]);
    expect(recentResults([], 3)).toEqual([]);
  });
});

describe('recent results', () => {
  it('returns the most recent first', () => {
    const a = alpha();
    const b = bravo();
    const fixtures = [
      match({ home: a, away: b, score: [1, 0], hour: 1 }),
      match({ home: a, away: b, score: [2, 0], hour: 2 }),
      match({ home: a, away: b, score: [3, 0], hour: 3 }),
      match({ home: a, away: b, hour: 4 }),
    ];

    expect(recentResults(fixtures, 2).map((m) => m.home_score)).toEqual([3, 2]);
  });

  it('counts a walkover as a result', () => {
    const a = alpha();
    const b = bravo();
    const fixtures = [match({ home: a, away: b, score: [3, 0], status: 'walkover', hour: 1 })];
    expect(recentResults(fixtures)).toHaveLength(1);
  });
});

describe('grouping by day', () => {
  it('puts the earliest day first and keeps kickoffs in order within it', () => {
    const a = alpha();
    const b = bravo();
    const fixtures = [
      match({ home: a, away: b, hour: 2 }),
      match({ home: a, away: b, hour: 1 }),
      match({ home: a, away: b, hour: 30 }),
    ];

    const days = groupByDay(fixtures, (iso) => iso.slice(0, 10));
    expect(days).toHaveLength(2);
    expect(days[0].matches.map((m) => m.kickoff_at)).toEqual([
      fixtures[1].kickoff_at,
      fixtures[0].kickoff_at,
    ]);
    expect(days[1].matches).toHaveLength(1); // the later day, on its own
  });
});
