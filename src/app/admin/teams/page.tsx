import type { Metadata } from 'next';
import Link from 'next/link';
import { requireOrganiserPage } from '@/lib/auth';
import { getLiveSnapshot } from '@/lib/queries';
import { MAX_SQUAD, MIN_SQUAD } from '@/lib/types';
import { TeamCreateForm } from '@/components/admin/team-forms';

export const metadata: Metadata = { title: 'Teams' };

export default async function AdminTeamsPage() {
  await requireOrganiserPage();
  const { teams, players, matches } = await getLiveSnapshot();

  const rows = teams
    .map((team) => ({
      team,
      squadSize: players.filter((p) => p.team_id === team.id).length,
      matchCount: matches.filter(
        (m) => m.home_team_id === team.id || m.away_team_id === team.id,
      ).length,
    }))
    .sort(
      (a, b) =>
        (a.team.group_name ?? 'Z').localeCompare(b.team.group_name ?? 'Z') ||
        a.team.name.localeCompare(b.team.name),
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl uppercase leading-none text-chalk">Teams</h1>
        <p className="mt-0.5 text-xs text-muted">
          {teams.length} registered · squads of {MIN_SQUAD}–{MAX_SQUAD}
        </p>
      </header>

      <TeamCreateForm />

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
          All teams
        </h2>
        {rows.length === 0 ? (
          <p className="glass rounded-2xl border border-line px-3 py-5 text-center text-xs text-faint">
            No teams yet. Add the first one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map(({ team, squadSize, matchCount }) => (
              <li key={team.id}>
                <Link
                  href={`/admin/teams/${team.id}`}
                  className="glass flex min-h-[3.75rem] cursor-pointer items-center gap-3 rounded-2xl border border-line px-3.5 py-2.5 transition-all duration-200 hover:border-pitch-dim"
                >
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line-bright bg-surface-2 text-[0.55rem] font-extrabold tracking-tight text-muted tnum"
                  >
                    {team.short_name}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-chalk">
                      {team.name}
                    </span>
                    <span className="block truncate text-[0.68rem] text-faint">
                      {team.short_name} ·{' '}
                      {team.group_name ? `Group ${team.group_name}` : 'No group'} · {squadSize}{' '}
                      {squadSize === 1 ? 'player' : 'players'} · {matchCount}{' '}
                      {matchCount === 1 ? 'match' : 'matches'}
                    </span>
                  </span>
                  {squadSize < MIN_SQUAD || squadSize > MAX_SQUAD ? (
                    <span title="Squad size is outside the rules" className="shrink-0 text-sm text-yellow-card">
                      ⚠
                    </span>
                  ) : null}
                  <span aria-hidden className="shrink-0 text-lg text-faint">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
