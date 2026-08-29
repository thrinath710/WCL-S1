import type { Metadata } from 'next';
import Link from 'next/link';
import { isAdmin, requireAdminPage } from '@/lib/auth';
import { getLiveSnapshot, indexById } from '@/lib/queries';
import { byKickoff, groupNames } from '@/lib/standings';
import { reconcileGoals } from '@/lib/stats';
import { formatDay, formatTime, toLocalInput } from '@/lib/format';
import { isCounted, MATCH_STAGES, STAGE_LABEL } from '@/lib/types';
import { FixtureTools } from '@/components/admin/fixture-tools';

export const metadata: Metadata = { title: 'Fixtures' };

export default async function AdminFixturesPage() {
  const session = await requireAdminPage();
  const { teams, matches, goals } = await getLiveSnapshot();
  const teamIndex = indexById(teams);
  const ordered = [...matches].sort(byKickoff);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl uppercase leading-none text-chalk">Fixtures</h1>
        <p className="mt-0.5 text-xs text-muted">
          {matches.length} scheduled · {matches.filter(isCounted).length} played
        </p>
      </header>

      <FixtureTools
        canManage={isAdmin(session)}
        teams={teams}
        groups={groupNames(teams)}
        stages={MATCH_STAGES}
        matches={ordered.map((match) => ({
          id: match.id,
          label: `${teamIndex.get(match.home_team_id)?.short_name ?? '?'} v ${
            teamIndex.get(match.away_team_id)?.short_name ?? '?'
          }`,
          stage: match.stage,
          group_name: match.group_name,
          home_team_id: match.home_team_id,
          away_team_id: match.away_team_id,
          kickoffLocal: toLocalInput(match.kickoff_at),
          kickoffLabel: `${formatDay(match.kickoff_at)} ${formatTime(match.kickoff_at)}`,
          pitch: match.pitch,
          status: match.status,
          score: isCounted(match) || match.status === 'live'
            ? `${match.home_score}–${match.away_score}`
            : null,
          stageLabel:
            match.stage === 'group'
              ? `Group ${match.group_name ?? ''}`
              : STAGE_LABEL[match.stage],
          scorersAddUp: !isCounted(match) || reconcileGoals(match, goals).matches,
        }))}
      />

      {isAdmin(session) && teams.length < 2 ? (
        <p className="rounded-xl border border-yellow-card/50 bg-yellow-card/10 px-3 py-2.5 text-xs text-yellow-card">
          Add at least two teams before creating fixtures.{' '}
          <Link href="/admin/teams" className="font-bold underline">
            Go to teams
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
