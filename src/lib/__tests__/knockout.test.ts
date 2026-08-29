import { beforeEach, describe, expect, it } from 'vitest';
import { planFinal, planSemiFinals, seedOf, semisDecided } from '../knockout';
import { buildStandings } from '../standings';
import { match, resetIds, team } from './factories';
import type { Match, Team } from '../types';

beforeEach(resetIds);

/**
 * A finished group stage with a known order, so the draw is predictable.
 *
 * Each group plays a small round robin whose results are chosen to leave one
 * clear winner and one clear runner-up.
 */
function tournament() {
  const a1 = team('Alpha One', { group_name: 'A' });
  const a2 = team('Alpha Two', { group_name: 'A' });
  const a3 = team('Alpha Three', { group_name: 'A' });
  const b1 = team('Bravo One', { group_name: 'B' });
  const b2 = team('Bravo Two', { group_name: 'B' });
  const b3 = team('Bravo Three', { group_name: 'B' });

  const teams: Team[] = [a1, a2, a3, b1, b2, b3];
  const matches: Match[] = [
    // Group A: a1 wins both, a2 wins one.
    match({ home: a1, away: a2, score: [3, 0], group: 'A', hour: 1 }),
    match({ home: a1, away: a3, score: [2, 0], group: 'A', hour: 2 }),
    match({ home: a2, away: a3, score: [1, 0], group: 'A', hour: 3 }),
    // Group B: b1 wins both, b2 wins one.
    match({ home: b1, away: b2, score: [2, 0], group: 'B', hour: 4 }),
    match({ home: b1, away: b3, score: [1, 0], group: 'B', hour: 5 }),
    match({ home: b2, away: b3, score: [4, 0], group: 'B', hour: 6 }),
  ];

  return { teams, matches, a1, a2, a3, b1, b2, b3 };
}

describe('the semi-final draw', () => {
  it('crosses the groups, so the two winners can only meet in the final', () => {
    const { teams, matches, a1, a2, b1, b2 } = tournament();
    const [sf1, sf2] = planSemiFinals(buildStandings(teams, matches));

    expect(sf1.home?.id).toBe(a1.id);
    expect(sf1.away?.id).toBe(b2.id);
    expect(sf2.home?.id).toBe(b1.id);
    expect(sf2.away?.id).toBe(a2.id);
  });

  it('places each group winner at home, which is what puts them in dark', () => {
    const { teams, matches, a1, b1 } = tournament();
    const [sf1, sf2] = planSemiFinals(buildStandings(teams, matches));
    expect([sf1.home?.id, sf2.home?.id]).toEqual([a1.id, b1.id]);
  });

  it('keeps the printed labels when a group has nobody in it yet', () => {
    const [sf1, sf2] = planSemiFinals([]);
    expect(sf1.home).toBeNull();
    expect(sf1.homeLabel).toBe('Winner Group A');
    expect(sf1.awayLabel).toBe('Runner-up Group B');
    expect(sf2.homeLabel).toBe('Winner Group B');
    expect(sf2.awayLabel).toBe('Runner-up Group A');
  });
});

describe('seeding', () => {
  it('ranks both group winners above both runners-up', () => {
    const { teams, matches, a1, a2, b1, b2 } = tournament();
    const standings = buildStandings(teams, matches);

    expect(seedOf(a1.id, standings)).toBe(1);
    expect(seedOf(b1.id, standings)).toBe(1);
    expect(seedOf(a2.id, standings)).toBe(2);
    expect(seedOf(b2.id, standings)).toBe(2);
  });

  it('has no seed for a team that played in no group', () => {
    expect(seedOf('nobody', buildStandings([], []))).toBeNull();
  });
});

describe('filling the final', () => {
  const semisOf = (home: Team, away: Team, home2: Team, away2: Team, scores: [number, number][]) => [
    match({ home, away, stage: 'semi', group: null, score: scores[0], hour: 20 }),
    match({ home: home2, away: away2, stage: 'semi', group: null, score: scores[1], hour: 21 }),
  ];

  it('waits until both semi-finals are played', () => {
    const { teams, matches, a1, a2, b1, b2 } = tournament();
    const standings = buildStandings(teams, matches);

    const onlyOne = [
      ...matches,
      match({ home: a1, away: b2, stage: 'semi', group: null, score: [1, 0], hour: 20 }),
      match({ home: b1, away: a2, stage: 'semi', group: null, hour: 21 }),
    ];

    expect(semisDecided(onlyOne)).toBe(false);
    expect(planFinal(onlyOne, standings)).toBeNull();
  });

  it('puts the two winners in, higher seed at home so they wear dark', () => {
    const { teams, matches, a1, a2, b1, b2 } = tournament();
    const standings = buildStandings(teams, matches);
    // a1 (group winner) beats b2; a2 (runner-up) beats b1.
    const all = [...matches, ...semisOf(a1, b2, b1, a2, [[2, 0], [0, 1]])];

    expect(semisDecided(all)).toBe(true);
    const plan = planFinal(all, standings)!;
    expect(plan.stage).toBe('final');
    expect(plan.home_team_id).toBe(a1.id); // seed 1
    expect(plan.away_team_id).toBe(a2.id); // seed 2
  });

  it('separates two group winners by the record that got them there', () => {
    const { teams, matches, a1, a2, b1, b2 } = tournament();
    const standings = buildStandings(teams, matches);
    // Both group winners come through, so both are seed 1.
    const all = [...matches, ...semisOf(a1, b2, b1, a2, [[3, 0], [3, 0]])];
    const plan = planFinal(all, standings)!;

    const rowOf = (id: string) =>
      standings.flatMap((t) => t.rows).find((r) => r.team.id === id)!;
    const home = rowOf(plan.home_team_id);
    const away = rowOf(plan.away_team_id);

    expect(home.position).toBe(1);
    expect(away.position).toBe(1);
    // a1 scored 5 and conceded 0; b1 scored 3 and conceded 0.
    expect(home.goalDifference).toBeGreaterThanOrEqual(away.goalDifference);
    expect(plan.home_team_id).toBe(a1.id);
  });

  it('refuses a semi-final that ended level with no shootout', () => {
    const { teams, matches, a1, a2, b1, b2 } = tournament();
    const standings = buildStandings(teams, matches);
    const all = [...matches, ...semisOf(a1, b2, b1, a2, [[1, 1], [2, 0]])];

    expect(planFinal(all, standings)).toBeNull();
  });

  it('lets a shootout decide who goes through', () => {
    const { teams, matches, a1, a2, b1, b2 } = tournament();
    const standings = buildStandings(teams, matches);
    const all = [
      ...matches,
      match({ home: a1, away: b2, stage: 'semi', group: null, score: [1, 1], pens: [2, 4], hour: 20 }),
      match({ home: b1, away: a2, stage: 'semi', group: null, score: [2, 0], hour: 21 }),
    ];

    const plan = planFinal(all, standings)!;
    // b2 won the shootout; b1 won theirs and is the higher seed.
    expect(plan.home_team_id).toBe(b1.id);
    expect(plan.away_team_id).toBe(b2.id);
  });

  it('re-derives the final when a semi-final result is corrected', () => {
    const { teams, matches, a1, a2, b1, b2 } = tournament();
    const standings = buildStandings(teams, matches);

    const first = planFinal([...matches, ...semisOf(a1, b2, b1, a2, [[2, 0], [2, 0]])], standings)!;
    expect(first.away_team_id).toBe(b1.id);

    // The second semi-final is corrected: a2 went through after all.
    const corrected = planFinal([...matches, ...semisOf(a1, b2, b1, a2, [[2, 0], [0, 2]])], standings)!;
    expect(corrected.home_team_id).toBe(a1.id);
    expect(corrected.away_team_id).toBe(a2.id);
  });
});
