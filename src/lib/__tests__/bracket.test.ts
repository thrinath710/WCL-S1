import { beforeEach, describe, expect, it } from 'vitest';
import { buildBracket, hasKnockoutMatches } from '../bracket';
import { match, resetIds, team } from './factories';

beforeEach(resetIds);

describe('bracket shape', () => {
  it('shows empty semi-final and final slots before anything is drawn', () => {
    const bracket = buildBracket([]);
    expect(bracket.rounds.map((r) => r.stage)).toEqual(['semi', 'final']);
    expect(bracket.rounds[0].slots).toEqual([null, null]);
    expect(bracket.rounds[1].slots).toEqual([null]);
    expect(bracket.champion).toBeNull();
    expect(hasKnockoutMatches([])).toBe(false);
  });

  it('adds a quarter-final round once quarter-finals exist', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const quarters = [1, 2].map((h) => match({ home: a, away: b, stage: 'quarter', hour: h }));
    const bracket = buildBracket(quarters);
    expect(bracket.rounds.map((r) => r.stage)).toEqual(['quarter', 'semi', 'final']);
    expect(bracket.rounds[0].slots.filter(Boolean)).toHaveLength(2);
    expect(bracket.rounds[0].slots).toHaveLength(4); // padded to a full round
  });

  it('keeps group matches out of it', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const bracket = buildBracket([match({ home: a, away: b, score: [1, 0], hour: 1 })]);
    expect(bracket.rounds.every((r) => r.slots.every((s) => s === null))).toBe(true);
  });

  it('names the champion once the final has a result', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const final = match({ home: a, away: b, score: [2, 1], stage: 'final', hour: 9 });
    const bracket = buildBracket([final]);
    expect(bracket.champion).toBe(a.id);
    expect(bracket.runnerUp).toBe(b.id);
  });

  it('names the champion when the final went to penalties', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const final = match({
      home: a, away: b, score: [1, 1], pens: [3, 5], stage: 'final', hour: 9,
    });
    const bracket = buildBracket([final]);
    expect(bracket.champion).toBe(b.id);
    expect(bracket.runnerUp).toBe(a.id);
  });

  it('leaves the champion unnamed while the final is still to be played', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    expect(buildBracket([match({ home: a, away: b, stage: 'final', hour: 9 })]).champion).toBeNull();
  });

  it('picks up a third place playoff separately from the rounds', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const third = match({ home: a, away: b, score: [3, 2], stage: 'third_place', hour: 8 });
    const bracket = buildBracket([third]);
    expect(bracket.thirdPlace?.id).toBe(third.id);
    expect(bracket.rounds.flatMap((r) => r.slots).filter(Boolean)).toHaveLength(0);
  });
});
