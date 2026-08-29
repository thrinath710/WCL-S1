import { beforeEach, describe, expect, it } from 'vitest';
import {
  biggestWins,
  buildDiscipline,
  buildTeamStats,
  cleanSheetLeaders,
  goalsByPlayer,
  mostCarded,
  reconcileGoals,
  suspendedPlayers,
  topScorers,
  tournamentTotals,
} from '../stats';
import { card, goal, match, player, resetIds, team } from './factories';

beforeEach(resetIds);

describe('goal attribution', () => {
  it('never credits an own goal to the player who scored it', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const unlucky = player(bravo.id, 'Unlucky Defender', { position: 'DEF' });
    const m = match({ home: alpha, away: bravo, score: [1, 0] });

    // The goal counts for Alpha; the player who put it in plays for Bravo.
    const goals = [goal(m.id, alpha.id, unlucky.id, { is_own_goal: true })];

    expect(goalsByPlayer(goals).get(unlucky.id)).toBeUndefined();
    expect(topScorers([unlucky], [alpha, bravo], [m], goals)).toEqual([]);

    // ...but Alpha's scoreline and goals-for still include it.
    const stats = buildTeamStats(alpha, [m], [unlucky], []);
    expect(stats.goalsFor).toBe(1);
    expect(tournamentTotals([m], goals, []).totalGoals).toBe(1);
    expect(tournamentTotals([m], goals, []).ownGoals).toBe(1);
  });

  it('ignores goals nobody could attribute', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const striker = player(alpha.id, 'Striker', { position: 'FWD' });
    const m = match({ home: alpha, away: bravo, score: [2, 0] });
    const goals = [
      goal(m.id, alpha.id, striker.id),
      goal(m.id, alpha.id, null), // scorer unknown
    ];

    expect(goalsByPlayer(goals).get(striker.id)).toBe(1);
    expect(topScorers([striker], [alpha, bravo], [m], goals)[0].goals).toBe(1);
    // The scoreline is still the source of truth for the total.
    expect(tournamentTotals([m], goals, []).totalGoals).toBe(2);
  });
});

describe('top scorers', () => {
  it('ranks by goals, then by goals per match', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const one = player(alpha.id, 'Prolific');
    const two = player(bravo.id, 'Efficient');
    const three = player(alpha.id, 'Occasional');

    const played = [
      match({ home: alpha, away: bravo, score: [3, 2], hour: 1 }),
      match({ home: bravo, away: alpha, score: [1, 1], hour: 2 }),
    ];
    const goals = [
      goal(played[0].id, alpha.id, one.id),
      goal(played[0].id, alpha.id, one.id),
      goal(played[0].id, alpha.id, three.id),
      goal(played[0].id, bravo.id, two.id),
      goal(played[0].id, bravo.id, two.id),
      goal(played[1].id, bravo.id, two.id),
      goal(played[1].id, alpha.id, one.id),
    ];

    const rows = topScorers([one, two, three], [alpha, bravo], played, goals);
    expect(rows.map((r) => [r.player.name, r.goals])).toEqual([
      ['Efficient', 3],
      ['Prolific', 3],
      ['Occasional', 1],
    ]);
    // Both played two matches, so the tie falls to name order.
    expect(rows[0].goalsPerMatch).toBeCloseTo(1.5);
    expect(rows[0].teamMatches).toBe(2);
  });

  it('leaves players who have not scored off the list', () => {
    const alpha = team('Alpha');
    const quiet = player(alpha.id, 'Quiet');
    expect(topScorers([quiet], [alpha], [], [])).toEqual([]);
  });

  it('does not divide by zero before a ball is kicked', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const striker = player(alpha.id, 'Striker');
    const scheduled = match({ home: alpha, away: bravo });
    const goals = [goal(scheduled.id, alpha.id, striker.id)];
    const rows = topScorers([striker], [alpha, bravo], [scheduled], goals);
    expect(rows[0].goalsPerMatch).toBe(0);
  });
});

describe('discipline: two yellows is a one match ban', () => {
  const setup = () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const rough = player(alpha.id, 'Rough Tackler');
    return { alpha, bravo, rough };
  };

  it('does not suspend after a single yellow', () => {
    const { alpha, bravo, rough } = setup();
    const m1 = match({ home: alpha, away: bravo, score: [1, 0], hour: 1 });
    const rows = buildDiscipline([rough], [alpha, bravo], [m1], [card(m1.id, rough.id, 'yellow')]);
    expect(rows[0]).toMatchObject({ yellows: 1, bansEarned: 0, isSuspended: false });
  });

  it('suspends once a second yellow arrives, in a later match', () => {
    const { alpha, bravo, rough } = setup();
    const m1 = match({ home: alpha, away: bravo, score: [1, 0], hour: 1 });
    const m2 = match({ home: bravo, away: alpha, score: [0, 0], hour: 2 });
    const m3 = match({ home: alpha, away: bravo, hour: 3 }); // still to come

    const rows = buildDiscipline(
      [rough],
      [alpha, bravo],
      [m1, m2, m3],
      [card(m1.id, rough.id, 'yellow'), card(m2.id, rough.id, 'yellow')],
    );

    expect(rows[0]).toMatchObject({
      yellows: 2,
      bansEarned: 1,
      bansServed: 0,
      isSuspended: true,
      reason: 'two_yellows',
    });
    expect(rows[0].suspendedFor?.id).toBe(m3.id);
  });

  it('suspends for the next match when both yellows land in the same game', () => {
    const { alpha, bravo, rough } = setup();
    const m1 = match({ home: alpha, away: bravo, score: [1, 0], hour: 1 });
    const m2 = match({ home: bravo, away: alpha, hour: 2 });
    const rows = buildDiscipline(
      [rough],
      [alpha, bravo],
      [m1, m2],
      [card(m1.id, rough.id, 'yellow', { minute: 4 }), card(m1.id, rough.id, 'yellow', { minute: 18 })],
    );
    expect(rows[0].isSuspended).toBe(true);
    expect(rows[0].suspendedFor?.id).toBe(m2.id);
  });

  it('clears the suspension once the match has been sat out', () => {
    const { alpha, bravo, rough } = setup();
    const m1 = match({ home: alpha, away: bravo, score: [1, 0], hour: 1 });
    const m2 = match({ home: bravo, away: alpha, score: [2, 2], hour: 2 });
    const m3 = match({ home: alpha, away: bravo, score: [0, 1], hour: 3 }); // ban served here

    const rows = buildDiscipline(
      [rough],
      [alpha, bravo],
      [m1, m2, m3],
      [card(m1.id, rough.id, 'yellow'), card(m2.id, rough.id, 'yellow')],
    );

    expect(rows[0]).toMatchObject({ bansEarned: 1, bansServed: 1, isSuspended: false });
  });

  it('bans again on the fourth yellow', () => {
    const { alpha, bravo, rough } = setup();
    const played = [1, 2, 3, 4, 5].map((h) =>
      match({ home: alpha, away: bravo, score: [0, 0], hour: h }),
    );
    // Yellows in matches 1 and 2 -> ban served in 3. Yellows in 4 and 5 -> ban outstanding.
    const cards = [
      card(played[0].id, rough.id, 'yellow'),
      card(played[1].id, rough.id, 'yellow'),
      card(played[3].id, rough.id, 'yellow'),
      card(played[4].id, rough.id, 'yellow'),
    ];

    const rows = buildDiscipline([rough], [alpha, bravo], played, cards);
    expect(rows[0]).toMatchObject({
      yellows: 4,
      bansEarned: 2,
      bansServed: 1,
      isSuspended: true,
    });
  });
});

describe('discipline: a straight red is a one match ban', () => {
  it('suspends immediately', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const sentOff = player(alpha.id, 'Sent Off');
    const m1 = match({ home: alpha, away: bravo, score: [1, 0], hour: 1 });
    const m2 = match({ home: bravo, away: alpha, hour: 2 });

    const rows = buildDiscipline(
      [sentOff],
      [alpha, bravo],
      [m1, m2],
      [card(m1.id, sentOff.id, 'red', { minute: 12 })],
    );

    expect(rows[0]).toMatchObject({
      reds: 1,
      bansEarned: 1,
      isSuspended: true,
      reason: 'red_card',
    });
    expect(rows[0].suspendedFor?.id).toBe(m2.id);
  });

  it('stacks a red on top of an outstanding yellow-card ban', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const repeat = player(alpha.id, 'Repeat Offender');
    const played = [1, 2, 3].map((h) => match({ home: alpha, away: bravo, score: [0, 0], hour: h }));

    const rows = buildDiscipline(
      [repeat],
      [alpha, bravo],
      played,
      [
        card(played[0].id, repeat.id, 'yellow'),
        card(played[1].id, repeat.id, 'yellow'),
        card(played[1].id, repeat.id, 'red'),
      ],
    );

    // Two bans earned in match 2, one served in match 3, one still to serve.
    expect(rows[0]).toMatchObject({ bansEarned: 2, bansServed: 1, isSuspended: true });
  });

  it('serves a ban only against matches that have a result', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const sentOff = player(alpha.id, 'Sent Off');
    const m1 = match({ home: alpha, away: bravo, score: [1, 0], hour: 1 });
    const live = match({ home: bravo, away: alpha, status: 'live', score: [0, 0], hour: 2 });

    const rows = buildDiscipline(
      [sentOff],
      [alpha, bravo],
      [m1, live],
      [card(m1.id, sentOff.id, 'red')],
    );

    // The player is sitting out the match happening right now, so they are
    // still suspended -- the ban is not served until that match has a result.
    expect(rows[0].isSuspended).toBe(true);
    expect(rows[0].suspendedFor?.id).toBe(live.id);
  });

  it('reports no upcoming match when the tournament is over', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const sentOff = player(alpha.id, 'Sent Off');
    const final = match({ home: alpha, away: bravo, score: [1, 0], stage: 'final', hour: 9 });

    const rows = buildDiscipline(
      [sentOff],
      [alpha, bravo],
      [final],
      [card(final.id, sentOff.id, 'red')],
    );
    expect(rows[0].isSuspended).toBe(true);
    expect(rows[0].suspendedFor).toBeNull();
  });

  it('only counts a suspension against the player who was carded', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const carded = player(alpha.id, 'Carded');
    const clean = player(alpha.id, 'Clean');
    const m1 = match({ home: alpha, away: bravo, score: [1, 0], hour: 1 });

    const rows = buildDiscipline(
      [carded, clean],
      [alpha, bravo],
      [m1, match({ home: alpha, away: bravo, hour: 2 })],
      [card(m1.id, carded.id, 'red')],
    );

    expect(suspendedPlayers(rows).map((r) => r.player.name)).toEqual(['Carded']);
  });
});

describe('most carded', () => {
  it('puts reds above yellows', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const many = player(alpha.id, 'Many Yellows');
    const one = player(alpha.id, 'One Red');
    const m = match({ home: alpha, away: bravo, score: [0, 0], hour: 1 });

    const rows = buildDiscipline(
      [many, one],
      [alpha, bravo],
      [m],
      [
        card(m.id, many.id, 'yellow'),
        card(m.id, many.id, 'yellow'),
        card(m.id, one.id, 'red'),
      ],
    );

    expect(mostCarded(rows).map((r) => r.player.name)).toEqual(['One Red', 'Many Yellows']);
  });

  it('leaves clean players off the list', () => {
    const alpha = team('Alpha');
    const clean = player(alpha.id, 'Clean');
    expect(mostCarded(buildDiscipline([clean], [alpha], [], []))).toEqual([]);
  });
});

describe('team stats', () => {
  it('counts goals, clean sheets and cards across every stage', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const p1 = player(alpha.id, 'One');
    const group = match({ home: alpha, away: bravo, score: [2, 0], hour: 1 });
    const semi = match({ home: bravo, away: alpha, score: [1, 3], stage: 'semi', hour: 9 });

    const stats = buildTeamStats(
      alpha,
      [group, semi],
      [p1],
      [card(group.id, p1.id, 'yellow'), card(semi.id, p1.id, 'red')],
    );

    expect(stats).toMatchObject({
      played: 2,
      won: 2,
      drawn: 0,
      lost: 0,
      goalsFor: 5,
      goalsAgainst: 1,
      goalDifference: 4,
      cleanSheets: 1,
      yellows: 1,
      reds: 1,
    });
  });

  it('treats a shootout win as a win, with the normal-time score intact', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const final = match({
      home: alpha, away: bravo, score: [1, 1], pens: [5, 3], stage: 'final', hour: 9,
    });

    const stats = buildTeamStats(alpha, [final], [], []);
    expect(stats).toMatchObject({ won: 1, drawn: 0, goalsFor: 1, goalsAgainst: 1 });
  });

  it('is all zeroes before the team has played', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const stats = buildTeamStats(alpha, [match({ home: alpha, away: bravo })], [], []);
    expect(stats).toMatchObject({ played: 0, goalsFor: 0, cleanSheets: 0 });
  });
});

describe('clean sheets', () => {
  it('credits the keeper with the team clean sheets', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const keeper = player(alpha.id, 'Keeper', { position: 'GK' });
    const outfield = player(alpha.id, 'Winger', { position: 'FWD' });
    const matches = [
      match({ home: alpha, away: bravo, score: [1, 0], hour: 1 }),
      match({ home: bravo, away: alpha, score: [0, 0], hour: 2 }),
      match({ home: alpha, away: bravo, score: [2, 1], hour: 3 }),
    ];

    const rows = cleanSheetLeaders([keeper, outfield], [alpha, bravo], matches);
    expect(rows).toHaveLength(1); // only goalkeepers appear
    expect(rows[0]).toMatchObject({ cleanSheets: 2, played: 3, shared: false });
  });

  it('flags a shared total when a squad registered two keepers', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const first = player(alpha.id, 'First Choice', { position: 'GK' });
    const second = player(alpha.id, 'Understudy', { position: 'GK' });
    const matches = [match({ home: alpha, away: bravo, score: [1, 0], hour: 1 })];

    const rows = cleanSheetLeaders([first, second], [alpha, bravo], matches);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.shared && r.cleanSheets === 1)).toBe(true);
  });
});

describe('tournament totals', () => {
  it('averages goals over the matches actually played', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const matches = [
      match({ home: alpha, away: bravo, score: [3, 1], hour: 1 }),
      match({ home: bravo, away: alpha, score: [0, 0], hour: 2 }),
      match({ home: alpha, away: bravo, hour: 3 }), // not played
    ];

    const totals = tournamentTotals(matches, [], []);
    expect(totals).toMatchObject({
      matchesPlayed: 2,
      matchesScheduled: 1,
      totalGoals: 4,
      // 3-1 keeps nobody out; the 0-0 is a clean sheet for both sides.
      cleanSheets: 2,
    });
    expect(totals.averageGoalsPerMatch).toBe(2);
  });

  it('reports zero, not NaN, before any match is played', () => {
    const totals = tournamentTotals([], [], []);
    expect(totals.averageGoalsPerMatch).toBe(0);
    expect(totals.totalGoals).toBe(0);
  });

  it('leaves penalty shootout scores out of the goal count', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const final = match({
      home: alpha, away: bravo, score: [1, 1], pens: [5, 4], stage: 'final', hour: 9,
    });
    expect(tournamentTotals([final], [], []).totalGoals).toBe(2);
  });
});

describe('biggest wins', () => {
  it('ranks by margin, then by goals scored', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const cyan = team('Cyan');
    const matches = [
      match({ home: alpha, away: bravo, score: [5, 0], hour: 1 }),
      match({ home: cyan, away: bravo, score: [6, 1], hour: 2 }),
      match({ home: alpha, away: cyan, score: [1, 0], hour: 3 }),
      match({ home: bravo, away: cyan, score: [2, 2], hour: 4 }),
    ];

    const wins = biggestWins(matches, [alpha, bravo, cyan]);
    expect(wins.map((w) => w.scoreline)).toEqual(['6-1', '5-0', '1-0']);
    expect(wins[0].winner?.name).toBe('Cyan');
    expect(wins[0].loser?.name).toBe('Bravo');
  });

  it('returns nothing when every match was drawn', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    expect(biggestWins([match({ home: alpha, away: bravo, score: [1, 1] })], [alpha, bravo])).toEqual([]);
  });
});

describe('scoreline reconciliation', () => {
  it('agrees when the scorers add up', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const p1 = player(alpha.id, 'One');
    const m = match({ home: alpha, away: bravo, score: [2, 1] });
    const goals = [
      goal(m.id, alpha.id, p1.id),
      goal(m.id, alpha.id, null),
      goal(m.id, bravo.id, null),
    ];
    expect(reconcileGoals(m, goals)).toEqual({ home: 2, away: 1, matches: true });
  });

  it('flags a mismatch when a scorer is missing', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const m = match({ home: alpha, away: bravo, score: [3, 0] });
    expect(reconcileGoals(m, [goal(m.id, alpha.id, null)])).toMatchObject({ home: 1, matches: false });
  });

  it('counts an own goal against the team it was credited to', () => {
    const alpha = team('Alpha');
    const bravo = team('Bravo');
    const unlucky = player(bravo.id, 'Unlucky');
    const m = match({ home: alpha, away: bravo, score: [1, 0] });
    const goals = [goal(m.id, alpha.id, unlucky.id, { is_own_goal: true })];
    expect(reconcileGoals(m, goals)).toEqual({ home: 1, away: 0, matches: true });
  });
});
