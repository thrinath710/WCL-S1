import type { Metadata } from 'next';
import Link from 'next/link';
import { getSnapshot } from '@/lib/queries';
import { buildTeamStats } from '@/lib/stats';
import { LastUpdated } from '@/components/last-updated';
import { EmptyState, Page, PageTitle, Pill, TeamCrest } from '@/components/ui';

export const metadata: Metadata = { title: 'Teams' };


/**
 * Served from cache for up to 30 seconds, so a hall full of people refreshing
 * during a match costs the database nothing. A save in the admin area calls
 * revalidatePath for this route, so a new scoreline appears at once rather
 * than waiting for the window to lapse.
 */
export const revalidate = 30;
export default async function TeamsPage() {
  const { teams, players, matches, cards, fetchedAt } = await getSnapshot();

  const withStats = teams
    .map((team) => ({
      team,
      stats: buildTeamStats(team, matches, players, cards),
      squadSize: players.filter((p) => p.team_id === team.id).length,
    }))
    .sort(
      (a, b) =>
        (a.team.group_name ?? 'Z').localeCompare(b.team.group_name ?? 'Z') ||
        a.team.name.localeCompare(b.team.name),
    );

  return (
    <Page wide>
      <PageTitle
        title="Teams"
        subtitle={
          teams.length > 0
            ? `${teams.length} ${teams.length === 1 ? 'squad' : 'squads'} registered`
            : undefined
        }
      />

      {teams.length === 0 ? (
        <EmptyState
          title="No teams registered yet"
          hint="Squads appear here once the organisers have entered them from the registration form."
        />
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {withStats.map(({ team, stats, squadSize }, index) => (
            <li key={team.id} style={{ '--i': index } as React.CSSProperties} className="animate-rise stagger">
              <Link
                href={`/teams/${team.id}`}
                className="glass group flex h-full cursor-pointer flex-col gap-3.5 rounded-2xl border border-line p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-pitch-dim"
              >
                <div className="flex items-start gap-2.5">
                  <TeamCrest team={team} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold leading-tight text-chalk transition-colors group-hover:text-pitch">
                      {team.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <span className="truncate">{team.captain_name ?? 'Captain not set'}</span>
                    </p>
                  </div>
                  {team.group_name ? <Pill tone="pitch">{team.group_name}</Pill> : null}
                </div>

                <dl className="mt-auto grid grid-cols-4 gap-1 border-t border-line pt-3 text-center">
                  <Stat label="Played" value={stats.played} />
                  <Stat label="Won" value={stats.won} accent />
                  <Stat label="Lost" value={stats.lost} />
                  <Stat label="Squad" value={squadSize} />
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <LastUpdated at={fetchedAt} />
    </Page>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <dd className={`score text-xl ${accent ? 'text-pitch' : 'text-chalk'}`}>{value}</dd>
      <dt className="mt-0.5 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-faint">
        {label}
      </dt>
    </div>
  );
}
