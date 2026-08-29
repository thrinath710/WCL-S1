-- =====================================================================
-- 6-a-side tournament: initial schema
-- =====================================================================
-- Design note: NOTHING derived is stored. Standings, scorer counts,
-- clean sheets and suspensions are all computed at read time from
-- matches / goals / cards. See src/lib/standings.ts and src/lib/stats.ts.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
do $$ begin
  create type player_position as enum ('GK', 'DEF', 'MID', 'FWD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_stage as enum ('group', 'quarter', 'semi', 'third_place', 'final');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status as enum ('scheduled', 'live', 'completed', 'walkover');
exception when duplicate_object then null; end $$;

do $$ begin
  create type card_type as enum ('yellow', 'red');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- teams
create table if not exists teams (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  short_name    text not null check (char_length(short_name) = 3),
  captain_name  text,
  captain_phone text,
  jersey_colour text,
  group_name    text check (group_name in ('A', 'B')),
  logo_url      text,
  -- Final tiebreaker in the published order: an explicit admin ranking that
  -- is only consulted when points / GD / GF / head-to-head are all level.
  -- Lower number ranks higher. Null means "no override".
  tiebreak_override integer,
  created_at    timestamptz not null default now()
);

create unique index if not exists teams_name_key on teams (lower(name));

-- -------------------------------------------------------------- players
create table if not exists players (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams (id) on delete cascade,
  name          text not null,
  roll_no       text,
  position      player_position not null,
  jersey_number integer check (jersey_number between 0 and 99),
  is_captain    boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists players_team_id_idx on players (team_id);
-- one shirt number per squad (nulls are allowed and unconstrained)
create unique index if not exists players_team_jersey_key
  on players (team_id, jersey_number) where jersey_number is not null;
-- at most one captain per squad
create unique index if not exists players_team_captain_key
  on players (team_id) where is_captain;

-- -------------------------------------------------------------- matches
create table if not exists matches (
  id           uuid primary key default gen_random_uuid(),
  stage        match_stage not null default 'group',
  group_name   text check (group_name in ('A', 'B')),
  home_team_id uuid not null references teams (id) on delete cascade,
  away_team_id uuid not null references teams (id) on delete cascade,
  kickoff_at   timestamptz not null,
  pitch        text,
  status       match_status not null default 'scheduled',
  home_score   integer not null default 0 check (home_score >= 0),
  away_score   integer not null default 0 check (away_score >= 0),
  -- Penalty shootouts are stored apart from normal time on purpose: they
  -- decide a knockout tie but never touch goals for / against anywhere.
  home_pens    integer check (home_pens >= 0),
  away_pens    integer check (away_pens >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  constraint matches_distinct_teams check (home_team_id <> away_team_id),
  constraint matches_pens_paired check (
    (home_pens is null and away_pens is null)
    or (home_pens is not null and away_pens is not null)
  ),
  -- a shootout cannot itself be a draw
  constraint matches_pens_decisive check (
    home_pens is null or home_pens <> away_pens
  ),
  -- group matches belong to a group; knockout matches never do
  constraint matches_group_stage_has_group check (
    (stage = 'group' and group_name is not null)
    or (stage <> 'group' and group_name is null)
  )
);

create index if not exists matches_kickoff_idx  on matches (kickoff_at);
create index if not exists matches_home_idx     on matches (home_team_id);
create index if not exists matches_away_idx     on matches (away_team_id);

-- ---------------------------------------------------------------- goals
create table if not exists goals (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches (id) on delete cascade,
  -- nullable: some goals in a student tournament are simply never attributed
  player_id   uuid references players (id) on delete set null,
  -- the team the goal COUNTS FOR. For an own goal this is the opponent of
  -- the scorer's team, which is why it is stored rather than derived.
  team_id     uuid not null references teams (id) on delete cascade,
  minute      integer check (minute between 0 and 130),
  is_own_goal boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists goals_match_idx  on goals (match_id);
create index if not exists goals_player_idx on goals (player_id);

-- ---------------------------------------------------------------- cards
create table if not exists cards (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches (id) on delete cascade,
  player_id  uuid not null references players (id) on delete cascade,
  type       card_type not null,
  minute     integer check (minute between 0 and 130),
  created_at timestamptz not null default now()
);

create index if not exists cards_match_idx  on cards (match_id);
create index if not exists cards_player_idx on cards (player_id);

-- --------------------------------------------------- tournament_settings
create table if not exists tournament_settings (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null default 'Tournament',
  tagline              text,
  prize_note           text,
  is_knockout_unlocked boolean not null default false,
  created_at           timestamptz not null default now()
);

-- exactly one row, ever
create unique index if not exists tournament_settings_singleton
  on tournament_settings ((true));
