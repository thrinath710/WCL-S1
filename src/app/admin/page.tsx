import type { Metadata } from 'next';
import Link from 'next/link';
import { isAdmin, requireAdminPage, ROLE_LABEL } from '@/lib/auth';
import { getLiveSnapshot, indexById } from '@/lib/queries';
import { liveMatches, recentResults, upcomingMatches } from '@/lib/schedule';
import { isGroupStageComplete } from '@/lib/standings';
import { reconcileGoals } from '@/lib/stats';
import { formatDay, formatTime } from '@/lib/format';
import { isCounted, MIN_SQUAD, STAGE_LABEL } from '@/lib/types';
import type { Match, Team } from '@/lib/types';

export const metadata: Metadata = { title: 'Today' };

/**
 * The landing screen: whatever needs entering next, at the top, one tap away.
 */
export default async function AdminHome() {
  const session = await requireAdminPage();
  // A host runs the evening; squads and groups are not theirs to fix, so the
  // notices that only an organiser could act on are not shown to them.
  const organiser = isAdmin(session);
  const { settings, teams, players, matches, goals } = await getLiveSnapshot();
  const teamIndex = indexById(teams);

  const live = liveMatches(matches);
  const next = upcomingMatches(matches, 5);
  const recent = recentResults(matches, 5);

  // Anything a reader would notice as wrong, surfaced before they do.
  const mismatched = matches
    .filter(isCounted)
    .filter((m) => !reconcileGoals(m, goals).matches);
  const thinSquads = teams.filter(
    (t) => players.filter((p) => p.team_id === t.id).length < MIN_SQUAD,
  );
  const ungrouped = teams.filter((t) => !t.group_name);
  const groupsDone = isGroupStageComplete(matches);
  // Squads entered but no schedule yet -- the next thing to do is obvious,
  // so say it rather than showing two empty lists.
  const needsFixtures = teams.length >= 2 && matches.length === 0;

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <h1 className="display text-4xl uppercase leading-none text-chalk">{settings.name}</h1>
        <p className="mt-2 text-xs text-muted">
          Signed in as {session.email} · {ROLE_LABEL[session.role]}
        </p>
      </header>

      {organiser && needsFixtures ? (
        <Notice tone="pitch">
          {teams.length} teams are registered and there are no fixtures yet.{' '}
          <Link href="/admin/fixtures" className="font-bold underline">
            Generate the group fixtures
          </Link>{' '}
          — one press per group, then set the kickoff times.
        </Notice>
      ) : null}

      {(mismatched.length > 0 ||
        (organiser && thinSquads.length > 0) ||
        (organiser && ungrouped.length > 0) ||
        (groupsDone && !settings.is_knockout_unlocked)) && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            <span aria-hidden className="h-3 w-[3px] rounded-full bg-yellow-card" />
            Needs a look
          </h2>
          {groupsDone && !settings.is_knockout_unlocked ? (
            <Notice tone="pitch">
              Every group match has a result.{' '}
              <Link href="/admin/knockout" className="font-bold underline">
                Close the group stage and draw the semi-finals
              </Link>
              .
            </Notice>
          ) : null}
          {mismatched.length > 0 ? (
            <Notice tone="warn">
              {mismatched.length} completed{' '}
              {mismatched.length === 1 ? 'match has' : 'matches have'} scorers that do not add up to
              the score.{' '}
              <Link href="/admin/fixtures" className="font-bold underline">
                Review fixtures
              </Link>
              .
            </Notice>
          ) : null}
          {organiser && ungrouped.length > 0 ? (
            <Notice tone="warn">
              {ungrouped.length} {ungrouped.length === 1 ? 'team is' : 'teams are'} not in a group
              yet.{' '}
              <Link href="/admin/teams" className="font-bold underline">
                Assign groups
              </Link>
              .
            </Notice>
          ) : null}
          {organiser && thinSquads.length > 0 ? (
            <Notice tone="warn">
              {thinSquads.length} {thinSquads.length === 1 ? 'squad has' : 'squads have'} fewer than{' '}
              {MIN_SQUAD} players: {thinSquads.map((t) => t.short_name).join(', ')}.
            </Notice>
          ) : null}
        </section>
      )}

      {live.length > 0 ? (
        <MatchList title="Live now" matches={live} teams={teamIndex} highlight />
      ) : null}

      <MatchList
        title="Next up"
        matches={next}
        teams={teamIndex}
        empty="No fixtures scheduled."
        action={{ href: '/admin/fixtures', label: 'All fixtures' }}
      />

      <MatchList
        title="Recently completed"
        matches={recent}
        teams={teamIndex}
        empty="Nothing played yet."
      />

      {organiser && teams.length === 0 ? (
        <Notice tone="pitch">
          Start by{' '}
          <Link href="/admin/teams" className="font-bold underline">
            adding the teams
          </Link>{' '}
          from your registration form.
        </Notice>
      ) : null}
    </div>
  );
}

function Notice({ tone, children }: { tone: 'pitch' | 'warn'; children: React.ReactNode }) {
  const tones = {
    pitch: 'border-pitch-dim bg-pitch-glow text-pitch',
    warn: 'border-yellow-card/50 bg-yellow-card/10 text-yellow-card',
  };
  return (
    <p className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${tones[tone]}`}>
      {children}
    </p>
  );
}

function MatchList({
  title,
  matches,
  teams,
  empty,
  highlight = false,
  action,
}: {
  title: string;
  matches: Match[];
  teams: Map<string, Team>;
  empty?: string;
  highlight?: boolean;
  action?: { href: string; label: string };
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
          <span aria-hidden className="h-3 w-[3px] rounded-full bg-pitch" />
          {title}
        </h2>
        {action ? (
          <Link href={action.href} className="text-xs font-semibold text-pitch">
            {action.label}
          </Link>
        ) : null}
      </div>

      {matches.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-3 py-4 text-center text-xs text-faint">
          {empty}
        </p>
      ) : (
        <ul
          className={`glass divide-y divide-line overflow-hidden rounded-2xl border ${
            highlight ? 'border-live/50' : 'border-line'
          }`}
        >
          {matches.map((match) => {
            const home = teams.get(match.home_team_id);
            const away = teams.get(match.away_team_id);
            const played = isCounted(match) || match.status === 'live';
            return (
              <li key={match.id}>
                <Link
                  href={`/admin/matches/${match.id}`}
                  className="flex min-h-[3.75rem] cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors duration-200 hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-chalk">
                      {home?.short_name} v {away?.short_name}
                    </span>
                    <span className="block truncate text-[0.68rem] text-faint tnum">
                      {match.stage === 'group'
                        ? `Group ${match.group_name ?? ''}`
                        : STAGE_LABEL[match.stage]}{' '}
                      · {formatDay(match.kickoff_at)} {formatTime(match.kickoff_at)}
                    </span>
                  </span>
                  <span className="score shrink-0 text-xl text-chalk">
                    {played ? `${match.home_score}–${match.away_score}` : '–'}
                  </span>
                  <span aria-hidden className="shrink-0 text-lg text-faint">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
