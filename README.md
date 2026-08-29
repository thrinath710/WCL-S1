# Woxsen Champions League — Season 1

A public, display-only site for a student-run 6-a-side football tournament:
teams, squads, fixtures, results, standings and statistics. One organiser
enters everything through a private admin area. There is no public
registration, no payments and no user accounts.

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase · deploys to Vercel.

---

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

The site ships with **no data at all**. Every page has a real empty state, so
an empty tournament looks deliberate rather than broken. Teams, fixtures and
results only ever come from what the organiser enters — the Season 1 roster and
schedule are loaded once from `supabase/seed_wcl.sql` (below).

```bash
npm test               # 153 unit tests over the standings / stats / kit / knockout / reset rules
npm run typecheck
npm run lint
npm run build
```

---

## Connecting the database

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run in order:
   - `supabase/migrations/0001_init.sql` — tables, enums, constraints
   - `supabase/migrations/0002_rls.sql` — row level security
   - `supabase/migrations/0003_settings_seed.sql` — the tournament name row
   - `supabase/migrations/0004_kit_by_day.sql` — drops the per-team colour
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, the `service_role` key. **Server only.**
   - `ADMIN_EMAILS` — your email address
   - `HOST_EMAILS` — the match host's address, if you are using one
4. Create your admin user: Authentication → Users → Add user, with that same
   email and a password. Then turn **off** public sign-ups under
   Authentication → Sign In / Providers → Email.
5. Restart `npm run dev` and sign in at `/admin/login`.

### Loading the Season 1 tournament

`supabase/seed_wcl.sql` holds the real thing: **12 teams, 105 players and the
30 group fixtures** for 31 August – 2 September 2026. Run it in the SQL editor
after the migrations. It clears the tournament tables first, so it is safe to
re-run, and `delete from teams;` wipes it again.

It is built from two files kept in the repo, so it can always be rebuilt:

| File | What it holds |
| --- | --- |
| `docs/teamlist.md` | squads, captains and positions |
| `docs/fixtures.md` | the group schedule, courts and kickoff times |

Two things it deliberately leaves out:

- **Shirt numbers.** The team list does not record them, so `jersey_number`
  stays null rather than being invented.
- **The knockouts.** Thursday's semi-finals and final are "Winner Group A v
  Runner-up Group B" — they have no teams until the groups are decided, and
  `matches.home_team_id` is `NOT NULL`. Add them from `/admin/fixtures` once
  the tables are final, then flip the knockout switch in `/admin/settings`.

Kickoff times are stored with an explicit `+05:30`, so they read back as the
times printed on the fixture sheet in `Asia/Kolkata` (`NEXT_PUBLIC_TIMEZONE`).
Positions are written `CF` on the team sheet and stored as the `FWD` the schema
enum allows; the site renders them as "Forward" either way. Jersey colours are
not on the team sheet — the seed picks twelve distinguishable ones, editable in
`/admin/teams`.

`src/lib/__tests__/seed-data.test.ts` parses that exact file and checks it
against the tournament rules — squad sizes, one captain and one keeper per
team, one full round robin per group, ten matches a night, Court 1 used only
for the 9:00 and 9:30 slots, no team double-booked in a slot, and Bihari
Chusta's two keepers sharing a clean sheet total correctly.

Deploying to Vercel: set the same four variables in the project settings.

---

## Kit: dark or light, by the day

Teams have no colour of their own. The fixture sheet prints one side of every
tie in a black box and the other in white, and the rule behind it is simply
home and away: **the home team wears dark, the away team wears light.** The
knockout note — "the higher-seeded team wears dark" — is the same rule with the
higher seed placed at home.

So Titans are in dark on Monday and again on Wednesday because they are at home
both nights, while Cooked FC go from dark on Tuesday to light on Wednesday. A
team plays every one of its matches on a night on the same side, which is what
makes the "in dark tonight" line under each day meaningful.

None of it is stored. `src/lib/kit.ts` derives it from `home_team_id` /
`away_team_id`, so swapping the two sides of a fixture in the admin area swaps
both kits — that is how a clash gets fixed. `kitClashes()` catches the case
where an edit would leave one team needing both shirts on the same evening, and
`seed-data.test.ts` checks the seeded schedule against all three printed
"IN DARK TONIGHT" lines.

---

## Caching, and why

Two hundred people refresh between kickoffs. Rendering each of those views
against the database would be two hundred queries on a free tier at the exact
moment the site matters, so the public site is cached and the cache is
invalidated on save rather than waited out.

**One snapshot, shared by everyone.** `getSnapshot()` reads the whole
tournament through `unstable_cache`, tagged `tournament`, with a 30 second
window. Every public page and every viewer share that one entry, so the number
of queries Supabase sees follows the clock rather than the crowd.

**Pages are cached too.** Every public route exports `revalidate = 30`. `/`,
`/table`, `/stats`, `/teams` and `/bracket` are prerendered outright.
`/fixtures` renders per request because its filters live in the URL
(`?group=A&team=…`), and `/match/[id]` and `/teams/[id]` render on demand
because they are dynamic segments — but all three read the cached snapshot, so
none of them costs a query.

**A save is visible immediately.** Every action that writes a result, goal or
card calls `refreshMatch()`, which does two things: `updateTag('tournament')`
drops the shared snapshot, and `revalidatePath` rebuilds `/`, `/table`,
`/fixtures`, `/stats`, `/bracket`, that match's page and both teams' pages.
`updateTag` rather than `revalidateTag` is deliberate — the latter serves stale
content while it refreshes behind the scenes, which is right for a blog and
wrong for a scoreline somebody just typed and is standing there watching for.

**The admin area is never cached.** It reads `getLiveSnapshot()`, which skips
the shared cache entirely. The control room is one or two people, so the extra
queries are irrelevant next to the confusion of entering a result and not
seeing it.

Measured on a production build: **200 concurrent requests across `/`, `/table`,
`/fixtures` and `/stats` produced 0 Supabase queries.**

> One line to be careful with: `export const dynamic = 'force-dynamic'` in
> `(public)/layout.tsx` silently overrides the `revalidate` on every page
> beneath it. A layout's dynamic setting wins over its children, so that single
> line turns the whole scheme off. It is `revalidate = 30` for a reason.

There is no client-side data fetching anywhere. Nothing polls, nothing loads
standings or scores on mount; the only two `useEffect`s in the codebase drive a
score-flash animation and the "updated 2 min ago" ticker.

---

## Supabase free tier

**There is no connection pool to configure.** The app never opens a Postgres
connection — there is no `pg` driver and no `DATABASE_URL`. Everything goes
through `@supabase/supabase-js` over HTTPS to PostgREST, which manages its own
pooling server-side. The pooler-vs-direct-connection choice only applies to
clients that speak the Postgres wire protocol (Prisma, Drizzle, `psql`); if you
ever add one, use the **Session/Transaction pooler** URI from Project Settings →
Database, never the direct connection, because serverless functions open a
connection per instance and will exhaust the direct limit.

**The project pauses after 7 days without database activity.** A paused project
returns errors until somebody restores it from the Supabase dashboard, which
takes a minute or two. Between the group stage and any later season the site
will simply sit there and go to sleep — so if the tournament is dormant for a
week, restore the project *before* the first match rather than discovering it at
kickoff. Any query resets the clock; loading the public site is enough.

---

## Who sees what

There are two kinds of account, and one public site.

| | Organiser | Match host |
| --- | --- | --- |
| Enter and edit results, goals, cards | ✅ | ✅ |
| Kickoff times, courts, the two sides of a fixture | ✅ | ✅ |
| Close the group stage, draw the semis, fill the final | ✅ | ✅ |
| Add or delete fixtures | ✅ | ❌ |
| Reset a day's results, or the whole tournament | ✅ | ❌ |
| Teams, squads, groups, tiebreaks | ✅ | ❌ |
| Tournament settings | ✅ | ❌ |

Set `ADMIN_EMAILS` for the first and `HOST_EMAILS` for the second. An address on
both is an organiser: the stronger role wins, so adding yourself as a host by
mistake cannot lock you out of your own tournament.

The host's restrictions are enforced in two independent places. The nav and the
buttons they cannot use are not rendered, and every Server Action calls
`requireAdminDb(role)` again on the server — which defaults to `'admin'`, so a
newly written action is organiser-only until somebody deliberately opens it up.

### Resetting results

`/admin/settings` carries the undo controls, and they are the organiser's alone.
A host can correct any scoreline they typed — that is the job — but throwing
away a whole evening is a different decision, so `resetDay` and
`resetTournament` both take the default `requireAdminDb()` and are closed to a
host on the server as well as hidden from them.

A reset only ever removes **results**: scorelines, penalties, notes, scorers
and cards. The fixtures survive, so the public schedule never disappears — each
match simply goes back to being scheduled, ready to be entered again.

- **Reset a day** lists each night of the tournament with what it would clear
  ("6 of 10 played · 14 goals · 2 cards"), and asks to confirm by name. A night
  with nothing entered has its button disabled rather than hidden, so the row
  still reads as an answer.
- **Reset the whole tournament** asks for the word `RESET` to be typed. It also
  deletes the semi-finals and the final — not for tidiness, but because those
  ties exist only as a consequence of the group tables. Leaving them behind
  would mean a draw standing on results that no longer exist, and would block
  the group stage from being closed again. Teams, squads and the thirty group
  fixtures are untouched, and the bracket goes back behind its lock.

Clearing a group night while a semi-final already exists returns a warning
rather than a refusal: the draw came from results that just went, so it is
worth a look, but the organiser may well be mid-correction and does not need to
be stopped.

### Running the knockout

`/admin/knockout` is the whole run-in on one screen, in three steps:

1. **Close the group stage.** Enabled only once every group match has a result.
   It draws the semi-finals crossed — winner of one group against the other
   group's runner-up — so the two group winners can only meet in the final, and
   places each winner at home so they wear dark. Either side can still be
   changed afterwards from **Fixtures → Teams & kit**.
2. **Play the semi-finals.** Enter each result as normal.
3. **The final fills itself in.** Saving the second semi-final result puts both
   winners into the final automatically, higher seed at home. Correct a
   scoreline later and it re-derives; the button on the screen re-runs it by
   hand if you ever need it.

**Everyone else** lands on the public site. They can read fixtures, results,
the table, stats and squads — and that is all they can do. There is no sign-up
link, no comment box, no form. `/admin` is not linked from anywhere on the
public site, and if anyone finds the URL they are redirected to a sign-in
screen they cannot get past.

**You** sign in at `/admin/login` with your email and password, and the same
site gains a control room: enter results, manage squads, generate fixtures,
open the bracket. Set `NEXT_PUBLIC_ADMIN_EMAIL` if you want the address
pre-filled so that a password is all you ever type.

Three independent locks, so no single mistake exposes the data:

1. **Row level security** allows public `SELECT` and nothing else. There is not
   a single insert, update or delete policy in the schema. Even with the public
   API key, nobody can write anything.
2. **Every write goes through a Server Action** that checks the signed-in email
   against the allowlists *before* touching the service-role key, and checks
   the role it needs on top. Someone who somehow creates a Supabase account
   still cannot change any data.
3. **The service-role key never reaches the browser.** It has no
   `NEXT_PUBLIC_` prefix, so it exists only on the server.

Privacy: captain phone numbers and student roll numbers are collected on the
registration form but are **not public**. `SELECT` on those columns is revoked
from the `anon` Postgres role, and the public `Team` / `Player` types do not
contain them — so a public page cannot render them even by accident. They are
readable only inside the admin area.

---

## How the data works

**Nothing derived is ever stored.** There are no standings, scorer or
suspension tables. Every table, every goal tally and every suspension is
computed from `matches`, `goals` and `cards` on each request, by pure functions
in `src/lib/standings.ts`, `src/lib/stats.ts` and `src/lib/bracket.ts`.

That is what makes a mis-typed scoreline harmless: correct it in the admin area
and every number on the site is right on the next load, because there is no
second copy of the truth to go stale.

Each page loads one snapshot of the whole tournament (`src/lib/queries.ts`) and
derives what it needs. The dataset is tiny — at most ~20 teams and ~60 matches —
so this is both cheaper than per-page joins and guarantees the home page, the
table and the stats page can never disagree with each other.

### Rules encoded

| Rule | Where |
| --- | --- |
| Win 3, draw 1, loss 0 | `standings.ts` |
| Tiebreakers: points → GD → goals scored → head-to-head → admin ruling | `buildGroupTable` |
| Home wears dark, away wears light | `kit.ts` |
| Semis are crossed: A1 v B2, B1 v A2 | `planSemiFinals` |
| The final is higher seed (dark) v lower seed | `planFinal` |
| Head-to-head as a mini-league (correct for 3+ way ties, not just pairs) | `headToHeadOrder` |
| Penalties decide a knockout tie but never count as goals | `resultFor`, `applyMatch` |
| Own goals count for the team, never for the player | `goalsByPlayer` |
| Two yellows across the tournament, or one red, = a one match ban | `buildDiscipline` |
| Bans are served by the team's next match that has a result | `buildDiscipline` |
| Group games 2 × 10 min, knockouts 2 × 15 min | `HALF_LENGTH_MINUTES` |
| Squads of 7–11 | `MIN_SQUAD` / `MAX_SQUAD`, warned in admin |

Works with 6 to 20 teams, in one group or two. The number of qualifiers is
derived from the knockout matches that exist, falling back to two per group
(or four from a single group) before the bracket is drawn.

---

## The admin area

`/admin` — whatever needs entering next, plus warnings: scorers that do not add
up, squads outside 7–11, teams with no group, and a nudge to open the bracket
once the group stage finishes.

`/admin/matches/[id]` — the screen used most, built for a phone at the side of
a pitch. Big +/− steppers for the score (local state, so tapping is instant and
the whole result saves in one press), a scorer dropdown filtered to the two
squads, one-tap yellow/red, and penalties that appear exactly when a knockout
tie is level. Everything saves through Server Actions without a page reload.

Guard rails:

- A knockout match **cannot be completed level** without a shootout — blocked.
- A shootout cannot itself end level — blocked.
- Scorers that do not add up to the scoreline — **warned, never blocked.** The
  scoreline is what the referee gave and must be recordable immediately; the
  missing scorers can follow.
- Every delete confirms first, and says what else goes with it.

`/admin/fixtures` — create matches by hand, or round-robin a whole group in one
press and set the kickoff times afterwards. Re-running the generator skips
pairings that already exist.

`/admin/teams` — teams, groups, squads, and the tiebreak override.

`/admin/settings` — tournament name, tagline, prize note, and the switch that
opens the public bracket.

---

## Design

A floodlit pitch at night. The backdrop is one inline SVG of real pitch
markings — halfway line, centre circle, penalty areas, corner arcs — over mown
turf stripes, with a floodlight sweeping slowly across it. It is fixed,
decorative and `aria-hidden`, so it costs nothing and never scrolls.

- **Type**: Bebas Neue for anything that shouts — scores, headlines, team names
  in a bracket. Source Sans 3 carries the reading text.
- **Colour**: pitch green is primary and carries every live and interactive
  state. Gold is reserved strictly for winning — champions, qualification —
  so it never loses its meaning. Red means live or a red card, nothing else.
- **Scores** are the loudest thing on every page, in tabular figures so digits
  stay aligned in columns.
- **Motion** is CSS-only and runs on the compositor: rows rise in with a
  stagger, a changed scoreline pops, the live badge pulses, form pills deal in
  one by one. Server-rendered content is never hidden behind an animation, and
  `prefers-reduced-motion` switches all of it off in one rule.
- **Mobile**: no hamburger — a sticky bottom tab bar with Home / Fixtures /
  Table / Stats, so standings are always one tap away. Team names collapse to
  their three-letter code on narrow screens.
- **Desktop**: the tab bar gives way to header navigation, the home page splits
  into a run-of-play column and a standings sidebar, and the bracket renders as
  a real bracket rather than a stacked list.
- Every page carries a "last updated" stamp. `/api/og` renders a share preview
  with the tournament name and the current score.

## Not built, on purpose

Public registration, payments, file uploads, email, comments, multi-tenancy,
mobile apps, AI features. There is no user table beyond the single admin
account that lives in Supabase Auth.
