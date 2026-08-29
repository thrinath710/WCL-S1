/**
 * Validates supabase/seed_wcl.sql -- the real file, parsed from disk.
 *
 * This is not a fixture that mirrors the tournament; it is the tournament. If
 * the SQL and the rules ever disagree, this fails, so the seed can never drift
 * away from what the app can actually handle.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAX_SQUAD, MIN_SQUAD, type Player, type PlayerPosition, type Team } from '../types';
import { buildStandings, qualifyPerGroup } from '../standings';
import { cleanSheetLeaders } from '../stats';
import { pairKey, roundRobin } from '../fixtures';
import { dayKey, formatTime } from '../format';
import { darkTeamsOn, kitClashes } from '../kit';

const here = dirname(fileURLToPath(import.meta.url));
// Comments are stripped first: they carry squad sizes like "(8)", which the
// tuple regex below would otherwise read as a row.
const sql = readFileSync(resolve(here, '../../../supabase/seed_wcl.sql'), 'utf8').replace(
  /--[^\n]*/g,
  '',
);

/** Pulls the tuples out of one `insert into <table> ... values (...),(...);` */
function tuples(table: string): string[][] {
  const start = sql.indexOf(`insert into ${table} (`);
  if (start === -1) throw new Error(`no insert for ${table}`);
  const body = sql.slice(sql.indexOf('values', start) + 'values'.length, sql.indexOf(';', start));

  return [...body.matchAll(/\(([^)]*)\)/g)].map((match) =>
    match[1]
      .split(',')
      .map((field) => field.trim().replace(/^'(.*)'$/, '$1').replace(/''/g, "'")),
  );
}

const teams: Team[] = tuples('teams').map(
  ([id, name, short_name, group_name, captain_name]) => ({
    id,
    name,
    short_name,
    group_name: group_name as 'A' | 'B',
    captain_name,
    logo_url: null,
    tiebreak_override: null,
    created_at: '',
  }),
);

const players: Player[] = tuples('players').map(([id, team_id, name, position, is_captain]) => ({
  id,
  team_id,
  name,
  position: position as PlayerPosition,
  // The team list does not record shirt numbers, so the column stays null.
  jersey_number: null,
  is_captain: is_captain === 'true',
  created_at: '',
}));

const matches = tuples('matches').map(
  ([id, stage, group_name, home_team_id, away_team_id, kickoff_at, pitch]) => ({
    id,
    stage: stage as 'group',
    group_name: group_name as 'A' | 'B',
    home_team_id,
    away_team_id,
    // '2026-08-31 18:00+05:30' is not a format Date parses everywhere.
    kickoff_at: new Date(kickoff_at.replace(' ', 'T')).toISOString(),
    pitch,
    status: 'scheduled' as const,
    home_score: 0,
    away_score: 0,
    home_pens: null,
    away_pens: null,
    notes: null,
    created_at: '',
  }),
);

const squadOf = (teamId: string) => players.filter((p) => p.team_id === teamId);
const byId = new Map(teams.map((t) => [t.id, t]));

describe('the WCL roster', () => {
  it('has twelve teams and one hundred and five players', () => {
    expect(teams).toHaveLength(12);
    expect(players).toHaveLength(105);
  });

  it('splits six teams into each group', () => {
    expect(teams.filter((t) => t.group_name === 'A').map((t) => t.name)).toEqual([
      'Bihari Chusta',
      'The Defenderz',
      'Red Dragon',
      'Fighters FC',
      'Dragonstone FC',
      'Diddydon FC',
    ]);
    expect(teams.filter((t) => t.group_name === 'B').map((t) => t.name)).toEqual([
      'Cooked FC',
      'Vikings',
      'Under Dogs',
      'Titans',
      'Blood Hounds FC',
      'Unsporting United',
    ]);
  });

  it('keeps every squad inside the squad size rule', () => {
    for (const team of teams) {
      const size = squadOf(team.id).length;
      expect(size, team.name).toBeGreaterThanOrEqual(MIN_SQUAD);
      expect(size, team.name).toBeLessThanOrEqual(MAX_SQUAD);
    }
    // The Defenderz are the largest squad and set the ceiling the rule allows.
    expect(Math.max(...teams.map((t) => squadOf(t.id).length))).toBe(MAX_SQUAD);
  });

  it('gives every squad exactly one captain and at least one keeper', () => {
    for (const team of teams) {
      const squad = squadOf(team.id);
      expect(squad.filter((p) => p.is_captain), team.name).toHaveLength(1);
      expect(squad.some((p) => p.position === 'GK'), team.name).toBe(true);
    }
  });

  it('names the same captain on the team as in the squad', () => {
    for (const team of teams) {
      const captain = squadOf(team.id).find((p) => p.is_captain);
      expect(captain?.name, team.name).toBe(team.captain_name);
    }
  });

  it('satisfies the database constraints it will be inserted against', () => {
    // short_name is checked as exactly three characters
    expect(teams.every((t) => /^[A-Z]{3}$/.test(t.short_name))).toBe(true);
    // teams_name_key is unique on lower(name), and the badges should differ too
    expect(new Set(teams.map((t) => t.name.toLowerCase())).size).toBe(12);
    expect(new Set(teams.map((t) => t.short_name)).size).toBe(12);
    // CF on the team sheet is stored as the FWD the enum allows
    expect(players.every((p) => ['GK', 'DEF', 'MID', 'FWD'].includes(p.position))).toBe(true);
  });
});

describe('the group schedule', () => {
  it('is thirty matches, all group stage', () => {
    expect(matches).toHaveLength(30);
    expect(matches.every((m) => m.stage === 'group')).toBe(true);
  });

  it('puts every match between two teams of its own group', () => {
    for (const match of matches) {
      const home = byId.get(match.home_team_id);
      const away = byId.get(match.away_team_id);
      expect(home?.group_name, match.id).toBe(match.group_name);
      expect(away?.group_name, match.id).toBe(match.group_name);
      expect(home?.id).not.toBe(away?.id);
    }
  });

  it('is exactly one round robin per group -- every pair meets once', () => {
    for (const group of ['A', 'B'] as const) {
      const members = teams.filter((t) => t.group_name === group);
      const played = matches
        .filter((m) => m.group_name === group)
        .map((m) => pairKey(m.home_team_id, m.away_team_id));

      expect(played).toHaveLength(15);
      expect(new Set(played).size, group).toBe(15);
      // the same set of ties the fixture generator would have produced
      const expected = new Set(roundRobin(members).map(([h, a]) => pairKey(h.id, a.id)));
      expect(new Set(played)).toEqual(expected);
    }
  });

  it('runs over three evenings, ten matches a night', () => {
    const nights = new Map<string, number>();
    for (const match of matches) {
      nights.set(dayKey(match.kickoff_at), (nights.get(dayKey(match.kickoff_at)) ?? 0) + 1);
    }
    expect([...nights.entries()]).toEqual([
      ['2026-08-31', 10],
      ['2026-09-01', 10],
      ['2026-09-02', 10],
    ]);
  });

  it('reads back the printed kickoff times in campus time', () => {
    const times = [...new Set(matches.map((m) => formatTime(m.kickoff_at)))];
    expect(times).toEqual(['6:00 pm', '6:30 pm', '7:00 pm', '7:30 pm', '8:00 pm', '8:30 pm', '9:00 pm', '9:30 pm']);
  });

  it('uses Court 1 only for the 9:00 and 9:30 slots', () => {
    for (const match of matches) {
      const late = ['9:00 pm', '9:30 pm'].includes(formatTime(match.kickoff_at));
      if (match.pitch === 'Court 1') expect(late, match.id).toBe(true);
      else expect(match.pitch).toBe('Court 2');
    }
    // and there is one Court 1 match in each of those six slots
    expect(matches.filter((m) => m.pitch === 'Court 1')).toHaveLength(6);
  });

  it('never asks a team to wear both kits on the same night', () => {
    // The home side wears dark and the away side light, so a team that is at
    // home in one match and away in another on the same evening would need two
    // shirts. The printed sheet never does this and neither must the seed.
    for (const day of ['2026-08-31', '2026-09-01', '2026-09-02']) {
      const night = matches.filter((m) => dayKey(m.kickoff_at) === day);
      expect(kitClashes(night), day).toEqual([]);
    }
  });

  it('puts the printed six teams in dark each night', () => {
    const darkNames = (day: string) =>
      [...darkTeamsOn(matches.filter((m) => dayKey(m.kickoff_at) === day))]
        .map((id) => byId.get(id)!.name)
        .sort();

    // Straight off the "IN DARK TONIGHT" line under each day of the sheet.
    expect(darkNames('2026-08-31')).toEqual([
      'Bihari Chusta',
      'Cooked FC',
      'Dragonstone FC',
      'Red Dragon',
      'Titans',
      'Unsporting United',
    ]);
    expect(darkNames('2026-09-01')).toEqual([
      'Cooked FC',
      'Dragonstone FC',
      'Fighters FC',
      'Red Dragon',
      'Titans',
      'Under Dogs',
    ]);
    expect(darkNames('2026-09-02')).toEqual([
      'Fighters FC',
      'Red Dragon',
      'The Defenderz',
      'Titans',
      'Under Dogs',
      'Vikings',
    ]);
  });

  it('splits each night six in dark and six in light', () => {
    for (const day of ['2026-08-31', '2026-09-01', '2026-09-02']) {
      const night = matches.filter((m) => dayKey(m.kickoff_at) === day);
      const dark = darkTeamsOn(night);
      const light = new Set(night.map((m) => m.away_team_id));
      expect(dark.size, day).toBe(6);
      expect(light.size, day).toBe(6);
      expect([...dark].filter((id) => light.has(id)), day).toEqual([]);
    }
  });

  it('never asks a team to play two matches at once', () => {
    const seen = new Set<string>();
    for (const match of matches) {
      for (const teamId of [match.home_team_id, match.away_team_id]) {
        const slot = `${match.kickoff_at}:${teamId}`;
        expect(seen.has(slot), `${byId.get(teamId)?.name} at ${match.kickoff_at}`).toBe(false);
        seen.add(slot);
      }
    }
  });

  it('leaves the knockouts to be drawn once the groups are decided', () => {
    // Thursday's semi-finals and final have no teams yet, and the schema
    // requires both. They are created from /admin/fixtures instead.
    expect(matches.some((m) => m.stage !== 'group')).toBe(false);
  });
});

describe('the roster against the tournament rules', () => {
  it('sends two from each group to the semi-finals', () => {
    expect(qualifyPerGroup([], 2)).toBe(2);
    const tables = buildStandings(teams, []);
    expect(tables.map((t) => t.groupName)).toEqual(['A', 'B']);
    expect(tables.every((t) => t.rows.length === 6)).toBe(true);
    expect(tables[0].rows.filter((r) => r.qualified)).toHaveLength(2);
  });

  it('renders a full table before a single match is played', () => {
    const tables = buildStandings(teams, matches);
    for (const table of tables) {
      expect(table.rows.every((r) => r.played === 0 && r.points === 0)).toBe(true);
      expect(table.rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });
});

describe('the two-goalkeeper squad', () => {
  const twoKeepers = teams.find((t) => t.short_name === 'BIH')!;

  it('really does have two keepers, so the case is covered', () => {
    expect(squadOf(twoKeepers.id).filter((p) => p.position === 'GK')).toHaveLength(2);
  });

  it('credits both keepers with the team total and flags it as shared', () => {
    // Give the squad two clean sheets between three matches.
    const other = teams.find((t) => t.short_name === 'RED')!;
    const played = [
      { home: twoKeepers.id, away: other.id, hs: 2, as: 0 },
      { home: other.id, away: twoKeepers.id, hs: 0, as: 1 },
      { home: twoKeepers.id, away: other.id, hs: 1, as: 3 },
    ].map((m, i) => ({
      id: `m${i}`,
      stage: 'group' as const,
      group_name: 'A' as const,
      home_team_id: m.home,
      away_team_id: m.away,
      kickoff_at: new Date(Date.UTC(2026, 7, 31, 12 + i)).toISOString(),
      pitch: null,
      status: 'completed' as const,
      home_score: m.hs,
      away_score: m.as,
      home_pens: null,
      away_pens: null,
      notes: null,
      created_at: '',
    }));

    const rows = cleanSheetLeaders(players, teams, played).filter(
      (r) => r.team.id === twoKeepers.id,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.player.name).sort()).toEqual(['Arya', 'Krish']);
    // Both carry the team's two clean sheets, and both say so.
    expect(rows.every((r) => r.cleanSheets === 2)).toBe(true);
    expect(rows.every((r) => r.shared)).toBe(true);
    expect(rows.every((r) => r.played === 3)).toBe(true);
  });

  it('does not mark a single-keeper squad as shared', () => {
    const single = teams.find((t) => t.short_name === 'FIG')!;
    const rows = cleanSheetLeaders(players, teams, []).filter((r) => r.team.id === single.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].shared).toBe(false);
  });

  it('lists every registered keeper across the tournament, and only keepers', () => {
    const rows = cleanSheetLeaders(players, teams, []);
    const keepers = players.filter((p) => p.position === 'GK');
    expect(rows).toHaveLength(keepers.length);
    expect(rows.every((r) => r.player.position === 'GK')).toBe(true);
  });
});
