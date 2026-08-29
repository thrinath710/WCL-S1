-- =====================================================================
-- Row level security
-- =====================================================================
-- The public site is display-only, so every table is world-readable and
-- NOTHING is world-writable: there is not a single insert/update/delete
-- policy below. All admin writes go through Server Actions that verify the
-- signed-in email against the ADMIN_EMAILS allowlist and then use the
-- service-role key, which bypasses RLS. That way even if someone manages
-- to create a Supabase auth user, they still cannot change any data.
-- =====================================================================

alter table teams               enable row level security;
alter table players             enable row level security;
alter table matches             enable row level security;
alter table goals               enable row level security;
alter table cards               enable row level security;
alter table tournament_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['teams','players','matches','goals','cards','tournament_settings']
  loop
    execute format('drop policy if exists %I on %I', t || '_public_read', t);
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true)',
      t || '_public_read', t
    );
  end loop;
end $$;

-- ------------------------------------------------------------------ PII
-- Captain phone numbers and student roll numbers are collected on the
-- registration form but are not public information. The public site never
-- selects them, and the anon role is not allowed to either -- so they
-- cannot be scraped through the auto-generated REST API.
--
-- IMPORTANT: this has to be done as revoke-then-grant, not as a column-level
-- revoke. `revoke select (captain_phone) on teams from anon` is a no-op,
-- because a column-level revoke cannot remove access that a table-level
-- SELECT grant already gives -- and Supabase grants table-level SELECT on
-- everything in `public` to anon by default. Dropping the table grant and
-- granting back only the allowed columns is what actually restricts it.
--
-- Consequence: anon queries must use explicit column lists, never
-- `select *`, on teams and players. See src/lib/queries.ts.

revoke select on teams from anon;
grant select (
  id,
  name,
  short_name,
  captain_name,
  jersey_colour,
  group_name,
  logo_url,
  tiebreak_override,
  created_at
) on teams to anon;

revoke select on players from anon;
grant select (
  id,
  team_id,
  name,
  position,
  jersey_number,
  is_captain,
  created_at
) on players to anon;
