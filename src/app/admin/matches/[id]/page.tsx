import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth';
import { getLiveSnapshot, indexById } from '@/lib/queries';
import { cardsForMatch, goalsForMatch } from '@/lib/stats';
import { formatLongDay, formatTime } from '@/lib/format';
import { HALF_LENGTH_MINUTES, STAGE_LABEL } from '@/lib/types';
import { MatchEditor } from '@/components/admin/match-editor';

export const metadata: Metadata = { title: 'Enter result' };

export default async function AdminMatchPage(props: PageProps<'/admin/matches/[id]'>) {
  await requireAdminPage();
  const { id } = await props.params;
  const { teams, players, matches, goals, cards } = await getLiveSnapshot();

  const match = matches.find((m) => m.id === id);
  if (!match) notFound();

  const teamIndex = indexById(teams);
  const home = teamIndex.get(match.home_team_id);
  const away = teamIndex.get(match.away_team_id);
  if (!home || !away) notFound();

  // The scorer and card dropdowns only ever offer these two squads.
  const squad = players.filter(
    (p) => p.team_id === match.home_team_id || p.team_id === match.away_team_id,
  );

  return (
    <div>
      <Link href="/admin/fixtures" className="mb-3 inline-block text-xs font-semibold text-pitch">
        ← All fixtures
      </Link>

      <header className="glass animate-rise mb-5 rounded-2xl border border-line p-4">
        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
          {match.stage === 'group' ? `Group ${match.group_name ?? ''}` : STAGE_LABEL[match.stage]} ·
          2 × {HALF_LENGTH_MINUTES[match.stage]} min
        </p>
        <h1 className="display mt-1.5 text-2xl uppercase leading-none text-chalk">
          {home.name} <span className="text-faint">v</span> {away.name}
        </h1>
        <p className="mt-1 text-xs text-muted tnum">
          {formatLongDay(match.kickoff_at)} · {formatTime(match.kickoff_at)}
          {match.pitch ? ` · ${match.pitch}` : ''}
        </p>
        <Link
          href={`/match/${match.id}`}
          className="mt-2 inline-block text-xs font-semibold text-pitch"
        >
          View public page →
        </Link>
      </header>

      <MatchEditor
        match={match}
        home={home}
        away={away}
        squad={squad}
        goals={goalsForMatch(goals, match.id)}
        cards={cardsForMatch(cards, match.id)}
      />
    </div>
  );
}
