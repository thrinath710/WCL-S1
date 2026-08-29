import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSnapshot, indexById } from '@/lib/queries';
import { cardsForMatch, goalsForMatch } from '@/lib/stats';
import { matchWinner } from '@/lib/standings';
import { formatLongDay, formatTime } from '@/lib/format';
import { HALF_LENGTH_MINUTES, STAGE_LABEL, isCounted } from '@/lib/types';
import type { Goal, Player, Team } from '@/lib/types';
import { LastUpdated } from '@/components/last-updated';
import { kitFor, type Kit } from '@/lib/kit';
import { CardGlyph, KitDot, KitTag, LiveBadge, Page, Panel, Pill } from '@/components/ui';

/**
 * Served from cache for up to 30 seconds, so a hall full of people refreshing
 * during a match costs the database nothing. A save in the admin area calls
 * revalidatePath for this route, so a new scoreline appears at once rather
 * than waiting for the window to lapse.
 */
export const revalidate = 30;

export async function generateMetadata(props: PageProps<'/match/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const { matches, teams } = await getSnapshot();
  const match = matches.find((m) => m.id === id);
  if (!match) return { title: 'Match' };

  const index = indexById(teams);
  const home = index.get(match.home_team_id)?.name ?? 'TBD';
  const away = index.get(match.away_team_id)?.name ?? 'TBD';
  const title = isCounted(match)
    ? `${home} ${match.home_score}–${match.away_score} ${away}`
    : `${home} v ${away}`;

  return {
    title,
    openGraph: { title, images: [{ url: `/api/og?match=${match.id}`, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', images: [`/api/og?match=${match.id}`] },
  };
}

export default async function MatchPage(props: PageProps<'/match/[id]'>) {
  const { id } = await props.params;
  const { teams, players, matches, goals, cards, fetchedAt } = await getSnapshot();

  const match = matches.find((m) => m.id === id);
  if (!match) notFound();

  const teamIndex = indexById(teams);
  const playerIndex = indexById(players);
  const home = teamIndex.get(match.home_team_id);
  const away = teamIndex.get(match.away_team_id);

  const played = isCounted(match);
  const live = match.status === 'live';
  const winnerId = played ? matchWinner(match) : null;
  const hasPens = match.home_pens != null && match.away_pens != null;

  const matchGoals = goalsForMatch(goals, match.id);
  const matchCards = cardsForMatch(cards, match.id);
  const halfLength = HALF_LENGTH_MINUTES[match.stage];

  return (
    <Page>
      <Link href="/fixtures" className="mb-3 inline-block text-xs font-semibold text-pitch">
        ← All fixtures
      </Link>

      <Panel className="mb-5 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.7rem] text-muted">
          <Pill tone="pitch">
            {match.stage === 'group' ? `Group ${match.group_name ?? ''}` : STAGE_LABEL[match.stage]}
          </Pill>
          {live ? <LiveBadge /> : null}
          {match.status === 'walkover' ? <Pill tone="warn">Walkover</Pill> : null}
          <span className="tnum">
            {formatLongDay(match.kickoff_at)} · {formatTime(match.kickoff_at)}
            {match.pitch ? ` · ${match.pitch}` : ''}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamColumn team={home} kit="dark" losing={winnerId != null && winnerId !== match.home_team_id} />
          <div className="text-center">
            {played || live ? (
              <p className={`score text-[3.2rem] ${live ? 'text-live' : 'text-chalk'}`}>
                {match.home_score}
                <span className="mx-1.5 text-muted">–</span>
                {match.away_score}
              </p>
            ) : (
              <p className="score text-[2.2rem] text-pitch">{formatTime(match.kickoff_at)}</p>
            )}
            {hasPens ? (
              <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-pitch tnum">
                {match.home_pens}–{match.away_pens} on penalties
              </p>
            ) : null}
          </div>
          <TeamColumn team={away} kit="light" losing={winnerId != null && winnerId !== match.away_team_id} />
        </div>

        <p className="mt-4 text-center text-[0.68rem] text-faint">
          2 × {halfLength} minutes
          {hasPens ? ' · decided on penalties' : ''}
        </p>
      </Panel>

      {hasPens ? (
        <Panel className="mb-5 border-pitch-dim bg-pitch-glow p-3">
          <p className="text-xs leading-relaxed text-pitch-bright">
            <span className="font-bold">
              {(winnerId === match.home_team_id ? home : away)?.name}
            </span>{' '}
            won the shootout {Math.max(match.home_pens!, match.away_pens!)}–
            {Math.min(match.home_pens!, match.away_pens!)}. Shootout scores decide the tie but do
            not count toward any goal statistic.
          </p>
        </Panel>
      ) : null}

      {played || live ? (
        <>
          <ScorerList
            title="Goals"
            goals={matchGoals}
            players={playerIndex}
            teams={teamIndex}
            match={match}
          />

          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Cards
            </h2>
            {matchCards.length === 0 ? (
              <Panel className="px-4 py-5 text-center text-sm text-muted">
                No cards shown in this match.
              </Panel>
            ) : (
              <Panel className="overflow-hidden">
                {matchCards.map((card) => {
                  const player = playerIndex.get(card.player_id);
                  const team = player ? teamIndex.get(player.team_id) : undefined;
                  return (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
                    >
                      <CardGlyph type={card.type} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">
                        {player?.name ?? 'Unknown player'}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{team?.short_name}</span>
                      <span className="w-9 shrink-0 text-right text-xs text-faint tnum">
                        {card.minute != null ? `${card.minute}'` : '—'}
                      </span>
                    </div>
                  );
                })}
              </Panel>
            )}
          </section>
        </>
      ) : (
        <Panel className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-chalk">Not played yet</p>
          <p className="mt-1 text-xs text-muted">
            Kicks off {formatTime(match.kickoff_at)} on {formatLongDay(match.kickoff_at)}.
          </p>
        </Panel>
      )}

      {match.notes ? (
        <Panel className="mb-4 p-3">
          <p className="text-xs leading-relaxed text-muted">{match.notes}</p>
        </Panel>
      ) : null}

      <LastUpdated at={fetchedAt} />
    </Page>
  );
}

function TeamColumn({
  team,
  kit,
  losing,
}: {
  team: Team | undefined;
  kit: Kit;
  losing: boolean;
}) {
  if (!team) {
    return <div className="text-center text-sm text-faint">TBD</div>;
  }
  return (
    <Link
      href={`/teams/${team.id}`}
      className={`flex min-w-0 flex-col items-center gap-2 ${losing ? 'opacity-60' : ''}`}
    >
      <KitDot kit={kit} size={26} />
      <span className="w-full text-center text-sm font-bold leading-tight text-chalk">
        <span className="hidden sm:inline">{team.name}</span>
        <span className="sm:hidden">{team.short_name}</span>
      </span>
      <KitTag kit={kit} />
    </Link>
  );
}

function ScorerList({
  title,
  goals,
  players,
  teams,
  match,
}: {
  title: string;
  goals: Goal[];
  players: Map<string, Player>;
  teams: Map<string, Team>;
  match: import('@/lib/types').Match;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      {goals.length === 0 ? (
        <Panel className="px-4 py-5 text-center text-sm text-muted">
          {match.home_score + match.away_score === 0
            ? 'Goalless.'
            : 'Scorers for this match have not been entered.'}
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          {goals.map((goal) => {
            const scorer = goal.player_id ? players.get(goal.player_id) : undefined;
            const creditedTo = teams.get(goal.team_id);
            return (
              <div
                key={goal.id}
                className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
              >
                <KitDot kit={creditedTo ? kitFor(match, creditedTo.id) : null} size={10} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">
                  {scorer?.name ?? 'Unattributed'}
                  {goal.is_own_goal ? (
                    <span className="ml-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-red-card">
                      o.g.
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted">{creditedTo?.short_name}</span>
                <span className="w-9 shrink-0 text-right text-xs text-faint tnum">
                  {goal.minute != null ? `${goal.minute}'` : '—'}
                </span>
              </div>
            );
          })}
        </Panel>
      )}
    </section>
  );
}
