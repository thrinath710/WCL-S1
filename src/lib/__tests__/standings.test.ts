import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildGroupTable,
  buildStandings,
  isGroupStageComplete,
  matchWinner,
  qualifyPerGroup,
  resultFor,
  teamForm,
} from '../standings';
import { at, match, resetIds, team } from './factories';

beforeEach(resetIds);

/** Positions in order, by short name, so assertions read like a table. */
const order = (rows: { team: { name: string } }[]) => rows.map((r) => r.team.name);

describe('points', () => {
  it('awards 3 for a win, 1 for a draw, 0 for a loss', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const c = team('Cyan');
    const matches = [
      match({ home: a, away: b, score: [2, 0], hour: 1 }),
      match({ home: a, away: c, score: [1, 1], hour: 2 }),
      match({ home: b, away: c, score: [0, 3], hour: 3 }),
    ];

    const { rows } = buildGroupTable([a, b, c], matches, 'A');
    const byName = new Map(rows.map((r) => [r.team.name, r]));

    expect(byName.get('Alpha')).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, points: 4 });
    expect(byName.get('Cyan')).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, points: 4 });
    expect(byName.get('Bravo')).toMatchObject({ played: 2, won: 0, drawn: 0, lost: 2, points: 0 });
  });

  it('counts a walkover as a played match', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const matches = [match({ home: a, away: b, score: [3, 0], status: 'walkover' })];

    const { rows } = buildGroupTable([a, b], matches, 'A');
    expect(rows[0]).toMatchObject({ team: a, played: 1, won: 1, points: 3, goalsFor: 3 });
    expect(rows[1]).toMatchObject({ team: b, played: 1, lost: 1, points: 0, goalsAgainst: 3 });
  });

  it('ignores matches that have not been played', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const matches = [
      match({ home: a, away: b, hour: 1 }), // scheduled
      match({ home: a, away: b, status: 'live', score: [5, 0], hour: 2 }),
    ];

    const { rows } = buildGroupTable([a, b], matches, 'A');
    expect(rows.every((r) => r.played === 0 && r.points === 0 && r.goalsFor === 0)).toBe(true);
  });
});

describe('tiebreakers, in the published order', () => {
  it('1. separates on points before anything else', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    // Bravo has a far better goal difference but fewer points.
    const c = team('Cyan');
    const matches = [
      match({ home: a, away: c, score: [1, 0], hour: 1 }),
      match({ home: b, away: c, score: [9, 0], hour: 2 }),
      match({ home: a, away: b, score: [1, 0], hour: 3 }),
    ];

    const { rows } = buildGroupTable([a, b, c], matches, 'A');
    expect(order(rows)[0]).toBe('Alpha');
    expect(rows[0].points).toBe(6);
    expect(rows[1].separatedBy).toBe('points');
  });

  it('2. falls to goal difference when points are level', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const c = team('Cyan');
    const d = team('Delta');
    const matches = [
      match({ home: a, away: c, score: [4, 0], hour: 1 }), // Alpha GD +4
      match({ home: b, away: d, score: [1, 0], hour: 2 }), // Bravo GD +1
    ];

    const { rows } = buildGroupTable([a, b, c, d], matches, 'A');
    expect(order(rows).slice(0, 2)).toEqual(['Alpha', 'Bravo']);
    expect(rows[1].separatedBy).toBe('goal_difference');
  });

  it('3. falls to goals scored when points and goal difference are level', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const c = team('Cyan');
    const d = team('Delta');
    const matches = [
      match({ home: a, away: c, score: [3, 1], hour: 1 }), // Alpha +2, GF 3
      match({ home: b, away: d, score: [2, 0], hour: 2 }), // Bravo +2, GF 2
    ];

    const { rows } = buildGroupTable([a, b, c, d], matches, 'A');
    expect(order(rows).slice(0, 2)).toEqual(['Alpha', 'Bravo']);
    expect(rows[1].separatedBy).toBe('goals_for');
  });

  it('4. falls to head-to-head when points, GD and GF are all level', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const c = team('Cyan');
    const d = team('Delta');
    // Alpha and Bravo both finish on 6 points, +3, 5 scored -- and Bravo
    // won the meeting between them.
    const matches = [
      match({ home: a, away: c, score: [3, 0], hour: 1 }),
      match({ home: a, away: d, score: [2, 1], hour: 2 }),
      match({ home: b, away: a, score: [1, 0], hour: 3 }),
      match({ home: b, away: c, score: [4, 1], hour: 4 }),
      match({ home: d, away: b, score: [1, 0], hour: 5 }),
      match({ home: c, away: d, score: [1, 1], hour: 6 }),
    ];

    const { rows } = buildGroupTable([a, b, c, d], matches, 'A');
    const alpha = rows.find((r) => r.team.name === 'Alpha')!;
    const bravo = rows.find((r) => r.team.name === 'Bravo')!;

    expect(alpha.points).toBe(bravo.points);
    expect(alpha.goalDifference).toBe(bravo.goalDifference);
    expect(alpha.goalsFor).toBe(bravo.goalsFor);
    expect(order(rows).slice(0, 2)).toEqual(['Bravo', 'Alpha']);
    expect(alpha.separatedBy).toBe('head_to_head');
  });

  it('4b. resolves a three-way tie as a mini-league, not as pairs', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const c = team('Cyan');
    const d = team('Delta');
    const e = team('Echo');

    // Alpha, Bravo and Cyan all finish on 6 points, 0, 2 scored. Comparing
    // them pair by pair is not enough; only the mini-league of the matches
    // between the three separates them -- Alpha 6 points, Bravo 3, Cyan 0.
    const matches = [
      match({ home: a, away: b, score: [1, 0], hour: 1 }),
      match({ home: a, away: c, score: [1, 0], hour: 2 }),
      match({ home: b, away: c, score: [1, 0], hour: 3 }),
      match({ home: a, away: d, score: [0, 1], hour: 4 }),
      match({ home: a, away: e, score: [0, 1], hour: 5 }),
      match({ home: b, away: d, score: [1, 0], hour: 6 }),
      match({ home: b, away: e, score: [0, 1], hour: 7 }),
      match({ home: c, away: d, score: [1, 0], hour: 8 }),
      match({ home: c, away: e, score: [1, 0], hour: 9 }),
    ];

    const { rows } = buildGroupTable([a, b, c, d, e], matches, 'A');
    const tied = rows.filter((r) => ['Alpha', 'Bravo', 'Cyan'].includes(r.team.name));

    // All three really are level on points, goal difference and goals scored.
    expect(tied.map((r) => r.points)).toEqual([6, 6, 6]);
    expect(tied.map((r) => r.goalDifference)).toEqual([0, 0, 0]);
    expect(tied.map((r) => r.goalsFor)).toEqual([2, 2, 2]);

    expect(tied.map((r) => r.team.name)).toEqual(['Alpha', 'Bravo', 'Cyan']);
    expect(tied[1].separatedBy).toBe('head_to_head');
    expect(tied[2].separatedBy).toBe('head_to_head');
  });

  it('5. falls to the admin override when even head-to-head is level', () => {
    const a = team('Alpha', { tiebreak_override: 2 });
    const b = team('Bravo', { tiebreak_override: 1 });
    const c = team('Cyan');
    const d = team('Delta');
    const matches = [
      match({ home: a, away: c, score: [2, 1], hour: 1 }),
      match({ home: b, away: d, score: [2, 1], hour: 2 }),
      match({ home: a, away: b, score: [1, 1], hour: 3 }), // drawn meeting
      match({ home: c, away: d, score: [0, 0], hour: 4 }),
      match({ home: c, away: b, score: [1, 2], hour: 5 }),
      match({ home: d, away: a, score: [1, 2], hour: 6 }),
    ];

    const { rows } = buildGroupTable([a, b, c, d], matches, 'A');
    const alpha = rows.find((r) => r.team.name === 'Alpha')!;
    const bravo = rows.find((r) => r.team.name === 'Bravo')!;

    expect(alpha.points).toBe(bravo.points);
    expect(alpha.goalDifference).toBe(bravo.goalDifference);
    expect(alpha.goalsFor).toBe(bravo.goalsFor);
    // Bravo's lower override number ranks it above Alpha.
    expect(order(rows).slice(0, 2)).toEqual(['Bravo', 'Alpha']);
    expect(alpha.separatedBy).toBe('admin_override');
  });

  it('treats a missing override as ranked below a set one', () => {
    const a = team('Alpha'); // no override
    const b = team('Bravo', { tiebreak_override: 5 });
    const { rows } = buildGroupTable([a, b], [], 'A');
    expect(order(rows)).toEqual(['Bravo', 'Alpha']);
    expect(rows[1].separatedBy).toBe('admin_override');
  });

  it('is deterministic when absolutely everything is level', () => {
    const a = team('Zulu');
    const b = team('Alpha');
    const first = buildGroupTable([a, b], [], 'A');
    const second = buildGroupTable([b, a], [], 'A');
    expect(order(first.rows)).toEqual(['Alpha', 'Zulu']);
    expect(order(second.rows)).toEqual(['Alpha', 'Zulu']);
    expect(first.rows[1].separatedBy).toBe('alphabetical');
  });
});

describe('scope of a group table', () => {
  it('excludes knockout matches', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const matches = [
      match({ home: a, away: b, score: [1, 0], hour: 1 }),
      match({ home: a, away: b, score: [4, 0], stage: 'semi', hour: 9 }),
    ];

    const { rows } = buildGroupTable([a, b], matches, 'A');
    expect(rows[0]).toMatchObject({ played: 1, goalsFor: 1, points: 3 });
  });

  it('excludes matches against teams outside the group', () => {
    const a = team('Alpha', { group_name: 'A' });
    const b = team('Bravo', { group_name: 'A' });
    const x = team('Xray', { group_name: 'B' });
    const matches = [
      match({ home: a, away: b, score: [1, 0], hour: 1 }),
      match({ home: a, away: x, score: [7, 0], group: 'B', hour: 2 }),
    ];

    const { rows } = buildGroupTable([a, b], matches, 'A');
    expect(rows[0]).toMatchObject({ played: 1, goalsFor: 1 });
  });

  it('never lets a penalty shootout touch goals for, against or difference', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    // A knockout tie level at 1-1, won 5-4 on penalties.
    const knockout = match({ home: a, away: b, score: [1, 1], pens: [5, 4], stage: 'semi', hour: 9 });

    expect(resultFor(knockout, a.id)).toBe('W');
    expect(resultFor(knockout, b.id)).toBe('L');
    expect(matchWinner(knockout)).toBe(a.id);

    // And in a table built over that match, the score is still 1-1.
    const { rows } = buildGroupTable([a, b], [{ ...knockout, stage: 'group', group_name: 'A' }], 'A');
    const alpha = rows.find((r) => r.team.name === 'Alpha')!;
    expect(alpha).toMatchObject({ goalsFor: 1, goalsAgainst: 1, goalDifference: 0 });
    // In a group, penalties do not exist -- it stays a draw worth one point.
    expect(alpha.points).toBe(1);
  });
});

describe('form', () => {
  it('returns the last five results, oldest first', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const matches = [
      match({ home: a, away: b, score: [1, 0], hour: 1 }), // W
      match({ home: a, away: b, score: [0, 1], hour: 2 }), // L
      match({ home: b, away: a, score: [0, 0], hour: 3 }), // D
      match({ home: a, away: b, score: [2, 0], hour: 4 }), // W
      match({ home: a, away: b, score: [3, 0], hour: 5 }), // W
      match({ home: b, away: a, score: [0, 1], hour: 6 }), // W
    ];

    expect(teamForm(matches, a.id)).toEqual(['L', 'D', 'W', 'W', 'W']);
    expect(teamForm(matches, a.id, 2)).toEqual(['W', 'W']);
  });

  it('counts a shootout win as a W, not a D', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const matches = [
      match({ home: a, away: b, score: [2, 2], pens: [4, 2], stage: 'final', hour: 9 }),
    ];
    expect(teamForm(matches, a.id)).toEqual(['W']);
    expect(teamForm(matches, b.id)).toEqual(['L']);
  });
});

describe('qualification', () => {
  it('sends two per group when there are two groups and no bracket yet', () => {
    expect(qualifyPerGroup([], 2)).toBe(2);
  });

  it('sends four when the whole tournament is one group', () => {
    expect(qualifyPerGroup([], 1)).toBe(4);
  });

  it('follows the bracket once knockout matches exist', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const quarters = Array.from({ length: 4 }, (_, i) =>
      match({ home: a, away: b, stage: 'quarter', hour: 10 + i }),
    );
    expect(qualifyPerGroup(quarters, 2)).toBe(4); // 8 through, 4 per group
    expect(qualifyPerGroup(quarters, 1)).toBe(8);
  });

  it('marks the qualifying rows', () => {
    const teams = ['Alpha', 'Bravo', 'Cyan', 'Delta'].map((n) => team(n));
    const tables = buildStandings(teams, [], { qualifyCount: 2 });
    expect(tables[0].rows.map((r) => r.qualified)).toEqual([true, true, false, false]);
  });
});

describe('shapes the tournament can take', () => {
  it('renders a single flat table when nobody has a group', () => {
    const teams = ['Alpha', 'Bravo'].map((n) => team(n, { group_name: null }));
    const tables = buildStandings(teams, []);
    expect(tables).toHaveLength(1);
    expect(tables[0].groupName).toBeNull();
    expect(tables[0].rows).toHaveLength(2);
  });

  it('renders two tables when there are two groups', () => {
    const teams = [
      team('Alpha', { group_name: 'A' }),
      team('Bravo', { group_name: 'A' }),
      team('Xray', { group_name: 'B' }),
      team('Yankee', { group_name: 'B' }),
    ];
    const tables = buildStandings(teams, []);
    expect(tables.map((t) => t.groupName)).toEqual(['A', 'B']);
    expect(tables.every((t) => t.rows.length === 2)).toBe(true);
  });

  it('keeps ungrouped teams visible in their own table', () => {
    const teams = [
      team('Alpha', { group_name: 'A' }),
      team('Nomad', { group_name: null }),
    ];
    const tables = buildStandings(teams, []);
    expect(tables.map((t) => t.groupName)).toEqual(['A', null]);
    expect(tables[1].rows[0].qualified).toBe(false);
  });

  it('handles a twenty team, two group tournament', () => {
    const teams = Array.from({ length: 20 }, (_, i) =>
      team(`Team ${String(i).padStart(2, '0')}`, { group_name: i % 2 === 0 ? 'A' : 'B' }),
    );
    const tables = buildStandings(teams, []);
    expect(tables).toHaveLength(2);
    expect(tables[0].rows).toHaveLength(10);
    expect(tables[0].rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('survives a six team tournament with no matches at all', () => {
    const teams = Array.from({ length: 6 }, (_, i) => team(`Team ${i}`));
    const tables = buildStandings(teams, []);
    expect(tables[0].rows).toHaveLength(6);
    expect(tables[0].rows.every((r) => r.played === 0 && r.form.length === 0)).toBe(true);
  });

  it('survives having no teams at all', () => {
    expect(buildStandings([], [])[0].rows).toEqual([]);
  });
});

describe('group stage completion', () => {
  it('is false while any group match is unplayed', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    expect(
      isGroupStageComplete([
        match({ home: a, away: b, score: [1, 0], hour: 1 }),
        match({ home: b, away: a, hour: 2 }),
      ]),
    ).toBe(false);
  });

  it('is true once every group match has a result', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    expect(
      isGroupStageComplete([
        match({ home: a, away: b, score: [1, 0], hour: 1 }),
        match({ home: b, away: a, score: [0, 0], hour: 2 }),
        match({ home: a, away: b, stage: 'final', hour: 9 }),
      ]),
    ).toBe(true);
  });

  it('is false before any fixture exists', () => {
    expect(isGroupStageComplete([])).toBe(false);
  });
});

describe('kickoff ordering', () => {
  it('does not depend on the order rows arrive in', () => {
    const a = team('Alpha');
    const b = team('Bravo');
    const early = match({ home: a, away: b, score: [1, 0], hour: 1 });
    const late = match({ home: b, away: a, score: [1, 0], hour: 5 });
    expect(teamForm([late, early], a.id)).toEqual(['W', 'L']);
    expect(at(1) < at(5)).toBe(true);
  });
});
