import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSnapshot, indexById } from '@/lib/queries';
import { buildDiscipline, buildTeamStats, goalsByPlayer } from '@/lib/stats';
import { matchesForTeam } from '@/lib/standings';
import { MIN_SQUAD, PLAYER_POSITIONS, type PlayerPosition } from '@/lib/types';
import { MatchCard } from '@/components/match-card';
import { LastUpdated } from '@/components/last-updated';
import {
  CardGlyph,
  EmptyState,
  Page,
  Panel,
  Pill,
  Section,
  TeamCrest,
} from '@/components/ui';

/**
 * Served from cache for up to 30 seconds, so a hall full of people refreshing
 * during a match costs the database nothing. A save in the admin area calls
 * revalidatePath for this route, so a new scoreline appears at once rather
 * than waiting for the window to lapse.
 */
export const revalidate = 30;

export async function generateMetadata(props: PageProps<'/teams/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const { teams } = await getSnapshot();
  const team = teams.find((t) => t.id === id);
  return { title: team?.name ?? 'Team' };
}

const POSITION_LABEL: Record<PlayerPosition, string> = {
  GK: 'Goalkeepers',
  DEF: 'Defenders',
  MID: 'Midfielders',
  FWD: 'Forwards',
};

export default async function TeamPage(props: PageProps<'/teams/[id]'>) {
  const { id } = await props.params;
  const { teams, players, matches, goals, cards, fetchedAt } = await getSnapshot();

  const team = teams.find((t) => t.id === id);
  if (!team) notFound();

  const teamIndex = indexById(teams);
  const squad = players.filter((p) => p.team_id === team.id);
  const stats = buildTeamStats(team, matches, players, cards);
  const fixtures = matchesForTeam(matches, team.id);
  const scored = goalsByPlayer(goals);
  const discipline = new Map(
    buildDiscipline(squad, teams, matches, cards).map((row) => [row.player.id, row]),
  );

  return (
    <Page wide>
      <Link href="/teams" className="mb-3 inline-block text-xs font-semibold text-pitch">
        ← All teams
      </Link>

      <header className="mb-5 flex items-start gap-3">
        <TeamCrest team={team} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="display text-3xl uppercase leading-none text-chalk sm:text-4xl">{team.name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {team.captain_name ? (
              <span>
                Captain <span className="font-semibold text-chalk">{team.captain_name}</span>
              </span>
            ) : (
              <span>Captain not set</span>
            )}
          </p>
        </div>
        {team.group_name ? <Pill tone="pitch">Group {team.group_name}</Pill> : null}
      </header>

      {/* ---- team stats ---- */}
      <Panel className="mb-6 grid grid-cols-3 divide-x divide-line xs:grid-cols-6">
        <Stat label="Played" value={stats.played} />
        <Stat label="Won" value={stats.won} accent />
        <Stat label="Lost" value={stats.lost} />
        <Stat label="GF" value={stats.goalsFor} />
        <Stat label="GA" value={stats.goalsAgainst} />
        <Stat label="Clean" value={stats.cleanSheets} />
      </Panel>

      {stats.yellows + stats.reds > 0 ? (
        <p className="-mt-4 mb-6 flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <CardGlyph type="yellow" /> {stats.yellows} yellow
          </span>
          <span className="flex items-center gap-1.5">
            <CardGlyph type="red" /> {stats.reds} red
          </span>
        </p>
      ) : null}

      {/* ---- squad ---- */}
      <Section title={`Squad · ${squad.length}`}>
        {squad.length === 0 ? (
          <EmptyState title="Squad not entered yet" />
        ) : (
          <>
            <Panel className="overflow-hidden">
              {PLAYER_POSITIONS.map((position) => {
                const group = squad
                  .filter((p) => p.position === position)
                  .sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));
                if (group.length === 0) return null;

                return (
                  <div key={position}>
                    <p className="border-b border-line bg-surface-2 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-faint">
                      {POSITION_LABEL[position]}
                    </p>
                    {group.map((player) => {
                      const record = discipline.get(player.id);
                      const playerGoals = scored.get(player.id) ?? 0;
                      return (
                        <div
                          key={player.id}
                          className="flex items-center gap-2.5 border-b border-line px-3 py-2.5 last:border-b-0"
                        >
                          <span className="w-6 shrink-0 text-center text-sm font-bold text-faint tnum">
                            {player.jersey_number ?? '–'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-chalk">
                                {player.name}
                              </span>
                              {player.is_captain ? (
                                <span
                                  title="Captain"
                                  className="shrink-0 rounded bg-surface-3 px-1 text-[0.6rem] font-bold text-muted"
                                >
                                  C
                                </span>
                              ) : null}
                            </span>
                            {record?.isSuspended ? (
                              <span className="mt-0.5 flex items-center gap-1 text-[0.65rem] font-semibold text-red-card">
                                <span aria-hidden>⚑</span>
                                Suspended —{' '}
                                {record.reason === 'red_card' ? 'red card' : 'two yellows'}
                              </span>
                            ) : null}
                          </span>

                          <span className="flex shrink-0 items-center gap-2">
                            {record && record.yellows > 0 ? (
                              <span className="flex items-center gap-0.5 text-[0.7rem] text-muted tnum">
                                <CardGlyph type="yellow" />
                                {record.yellows}
                              </span>
                            ) : null}
                            {record && record.reds > 0 ? (
                              <span className="flex items-center gap-0.5 text-[0.7rem] text-muted tnum">
                                <CardGlyph type="red" />
                                {record.reds}
                              </span>
                            ) : null}
                            {playerGoals > 0 ? (
                              <span className="flex min-w-[2.2rem] items-center justify-end gap-1 text-sm font-bold text-pitch tnum">
                                {playerGoals}
                                <span className="text-[0.6rem] font-semibold uppercase text-faint">
                                  {playerGoals === 1 ? 'gl' : 'gls'}
                                </span>
                              </span>
                            ) : (
                              <span className="min-w-[2.2rem]" />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </Panel>
            {squad.length < MIN_SQUAD ? (
              <p className="mt-1.5 text-[0.7rem] text-yellow-card">
                Squad is below the {MIN_SQUAD} player minimum.
              </p>
            ) : null}
          </>
        )}
      </Section>

      {/* ---- fixtures ---- */}
      <Section title="Fixtures & results">
        {fixtures.length === 0 ? (
          <EmptyState title="No fixtures scheduled yet" />
        ) : (
          <Panel className="overflow-hidden">
            {fixtures.map((match, i) => (
              <MatchCard key={match.id} match={match} teams={teamIndex} showDate index={i} />
            ))}
          </Panel>
        )}
      </Section>

      <LastUpdated at={fetchedAt} />
    </Page>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="px-1 py-2.5 text-center">
      <p className={`score text-xl ${accent ? 'text-pitch' : 'text-chalk'}`}>{value}</p>
      <p className="mt-0.5 text-[0.58rem] uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}
