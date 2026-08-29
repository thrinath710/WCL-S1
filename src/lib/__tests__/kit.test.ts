import { describe, expect, it } from 'vitest';
import { darkTeamsOn, kitClashes, kitFor } from '../kit';
import { match, resetIds, team } from './factories';
import { beforeEach } from 'vitest';

beforeEach(resetIds);

describe('who wears what', () => {
  it('puts the home side in dark and the away side in light', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const tie = match({ home: a, away: b, hour: 1 });

    expect(kitFor(tie, a.id)).toBe('dark');
    expect(kitFor(tie, b.id)).toBe('light');
  });

  it('says nothing about a team that is not in the match', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const c = team('Charlie');
    expect(kitFor(match({ home: a, away: b, hour: 1 }), c.id)).toBeNull();
  });

  it('swaps both kits when the two sides are swapped', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const swapped = match({ home: b, away: a, hour: 1 });

    expect(kitFor(swapped, a.id)).toBe('light');
    expect(kitFor(swapped, b.id)).toBe('dark');
  });
});

describe('the "in dark tonight" line', () => {
  it('lists each home team once, however many times it plays', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const c = team('Charlie');
    const night = [
      match({ home: a, away: b, hour: 1 }),
      match({ home: a, away: c, hour: 2 }),
      match({ home: c, away: b, hour: 3 }),
    ];

    expect([...darkTeamsOn(night)].sort()).toEqual([a.id, c.id].sort());
  });

  it('is empty when nothing is on', () => {
    expect(darkTeamsOn([]).size).toBe(0);
  });
});

describe('kit clashes', () => {
  it('finds nobody when every team keeps to one side all night', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const c = team('Charlie');
    const d = team('Delta');
    const night = [
      match({ home: a, away: b, hour: 1 }),
      match({ home: a, away: d, hour: 2 }),
      match({ home: c, away: b, hour: 3 }),
    ];

    expect(kitClashes(night)).toEqual([]);
  });

  it('names a team asked to wear both shirts on the same night', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const c = team('Charlie');
    const night = [
      match({ home: a, away: b, hour: 1 }),
      // Alpha is away here, so they would need dark at 6 and light at 7.
      match({ home: c, away: a, hour: 2 }),
    ];

    expect(kitClashes(night)).toEqual([a.id]);
  });
});
