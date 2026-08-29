-- =====================================================================
-- Kit is a property of a match, not of a team.
-- =====================================================================
-- The fixture sheet prints one side of every tie in a black box and the
-- other in a white box: the home team wears dark, the away team wears
-- light. That holds for all thirty group matches, and the knockout rule
-- ("the higher-seeded team wears dark") is the same rule with the higher
-- seed listed at home.
--
-- So a team has no fixed colour. It wears dark on one night and light on
-- the next, entirely according to which side of the fixture it is on --
-- which means the kit is derived from home/away and must not be stored.
-- See src/lib/kit.ts.
-- =====================================================================

alter table teams drop column if exists jersey_colour;
