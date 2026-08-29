-- The singleton settings row. Safe to run on an existing database.
-- This is configuration, not tournament data: no teams, players or fixtures
-- are ever seeded. Everything on the public site is entered by the organiser.
insert into tournament_settings (name, tagline, prize_note, is_knockout_unlocked)
select
  'Woxsen Champions League',
  'Season 1',
  null,
  false
where not exists (select 1 from tournament_settings);
