import type { Metadata } from 'next';
import Link from 'next/link';
import { getSnapshot } from '@/lib/queries';
import {
  biggestWins,
  buildDiscipline,
  cleanSheetLeaders,
  mostCarded,
  suspendedPlayers,
  topScorers,
  tournamentTotals,
} from '@/lib/stats';
import { decimal, formatDayMonth } from '@/lib/format';
import { LastUpdated } from '@/components/last-updated';
import {
  CardGlyph,
  EmptyState,
  Page,
  PageTitle,
  Panel,
  Section,
  TeamCrest,
} from '@/components/ui';

export const metadata: Metadata = { title: 'Stats' };


/**
 * Served from cache for up to 30 seconds, so a hall full of people refreshing
 * during a match costs the database nothing. A save in the admin area calls
 * revalidatePath for this route, so a new scoreline appears at once rather
 * than waiting for the window to lapse.
 */
export const revalidate = 30;
export default async function StatsPage() {
  const { teams, players, matches, goals, cards, fetchedAt } = await getSnapshot();

  const totals = tournamentTotals(matches, goals, cards);
  const scorers = topScorers(players, teams, matches, goals, 15);
  const discipline = buildDiscipline(players, teams, matches, cards);
  const suspended = suspendedPlayers(discipline);
  const carded = mostCarded(discipline, 10);
  const keepers = cleanSheetLeaders(players, teams, matches, 8);
  const wins = biggestWins(matches, teams, 5);
  const sharedKeeper = keepers.some((k) => k.shared);

  if (totals.matchesPlayed === 0) {
    return (
      <Page wide>
        <PageTitle title="Statistics" />
        <EmptyState
          title="Nothing to count yet"
          hint="Top scorers, clean sheets, cards and suspensions are all worked out from results, and appear here as soon as matches are played."
        />
        <LastUpdated at={fetchedAt} />
      </Page>
    );
  }

  return (
    <Page wide>
      <PageTitle title="Statistics" subtitle={`From ${totals.matchesPlayed} matches played`} />

      {/* ---- headline totals ---- */}
      <Panel className="mb-6 grid grid-cols-2 divide-line xs:grid-cols-4 xs:divide-x">
        <Total label="Goals" value={String(totals.totalGoals)} accent />
        <Total label="Per match" value={decimal(totals.averageGoalsPerMatch, 2)} />
        <Total label="Clean sheets" value={String(totals.cleanSheets)} />
        <Total label="Cards" value={String(totals.yellows + totals.reds)} />
      </Panel>

      {/* On a laptop the stat blocks flow into two columns; each one is kept
          whole so a leaderboard never splits across the gutter. */}
      {/* On a laptop the stat blocks sit in two explicit columns. CSS
          multi-column was the obvious choice but clips panels that use a
          backdrop filter, so the split is made here instead. */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="min-w-0">
        <Section title="Currently suspended">
          {suspended.length === 0 ? (
            <Panel className="px-4 py-5 text-center text-sm text-muted">
              Nobody is suspended right now.
            </Panel>
          ) : (
            <Panel className="overflow-hidden border-red-card/40">
              {suspended.map((row) => (
                <div
                  key={row.player.id}
                  className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
                >
                  <span aria-hidden className="text-sm text-red-card">
                    ⚑
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/teams/${row.player.team_id}`}
                      className="block truncate text-sm font-semibold text-chalk"
                    >
                      {row.player.name}
                    </Link>
                    <span className="text-[0.68rem] text-muted">
                      {row.team?.short_name} ·{' '}
                      {row.reason === 'red_card' ? 'Straight red' : 'Two yellow cards'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[0.68rem] text-faint">
                    {row.suspendedFor ? (
                      <>
                        misses
                        <br />
                        <span className="tnum">{formatDayMonth(row.suspendedFor.kickoff_at)}</span>
                      </>
                    ) : (
                      'ban outstanding'
                    )}
                  </span>
                </div>
              ))}
            </Panel>
          )}
          <p className="mt-1.5 text-[0.7rem] text-faint">
            Two yellow cards across the tournament, or one straight red, means a one match ban.
          </p>
        </Section>

        {/* ---- top scorers ---- */}
        <Section title="Top scorers">
          {scorers.length === 0 ? (
            <Panel className="px-4 py-5 text-center text-sm text-muted">
              No goals have been attributed to a player yet.
            </Panel>
          ) : (
            <Panel className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-wider text-faint">
                <span className="w-5" />
                <span className="flex-1">Player</span>
                <span className="w-12 text-right">Per match</span>
                <span className="w-8 text-right">Goals</span>
              </div>
              {scorers.map((row, index) => (
                <div
                  key={row.player.id}
                  className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-faint tnum">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/teams/${row.player.team_id}`}
                      className="block truncate text-sm font-semibold text-chalk"
                    >
                      {row.player.name}
                    </Link>
                    <span className="truncate text-[0.68rem] text-muted">{row.team?.short_name}</span>
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs text-muted tnum">
                    {decimal(row.goalsPerMatch, 2)}
                  </span>
                  <span className="w-8 shrink-0 text-right">
                    <span className="score text-lg text-pitch">{row.goals}</span>
                  </span>
                </div>
              ))}
            </Panel>
          )}
          <p className="mt-1.5 text-[0.7rem] text-faint">
            Own goals count toward the team&apos;s score but never toward a player&apos;s tally. Goals
            per match uses the team&apos;s completed matches.
          </p>
        </Section>

        {/* ---- clean sheets ---- */}
        </div>

        <div className="min-w-0">
        <Section title="Clean sheets">
          {keepers.length === 0 ? (
            <Panel className="px-4 py-5 text-center text-sm text-muted">
              No goalkeepers registered yet.
            </Panel>
          ) : (
            <Panel className="overflow-hidden">
              {keepers.map((row) => (
                <div
                  key={row.player.id}
                  className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
                >
                  <TeamCrest team={row.team} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-chalk">
                      {row.player.name}
                      {row.shared ? <span className="ml-1 text-[0.65rem] text-faint">*</span> : null}
                    </span>
                    <span className="text-[0.68rem] text-muted tnum">
                      {row.played} {row.played === 1 ? 'match' : 'matches'}
                    </span>
                  </span>
                  <span className="score shrink-0 text-lg text-pitch">{row.cleanSheets}</span>
                </div>
              ))}
            </Panel>
          )}
          {sharedKeeper ? (
            <p className="mt-1.5 text-[0.7rem] text-faint">
              * No lineups are recorded, so clean sheets are counted for the team. Squads with more
              than one registered goalkeeper share the total.
            </p>
          ) : null}
        </Section>

        {/* ---- discipline ---- */}
        <Section title="Most cards">
          {carded.length === 0 ? (
            <Panel className="px-4 py-5 text-center text-sm text-muted">
              No cards shown so far.
            </Panel>
          ) : (
            <Panel className="overflow-hidden">
              {carded.map((row) => (
                <div
                  key={row.player.id}
                  className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/teams/${row.player.team_id}`}
                      className="block truncate text-sm font-semibold text-chalk"
                    >
                      {row.player.name}
                    </Link>
                    <span className="text-[0.68rem] text-muted">{row.team?.short_name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5 text-sm text-muted tnum">
                    {row.yellows > 0 ? (
                      <span className="flex items-center gap-1">
                        <CardGlyph type="yellow" />
                        {row.yellows}
                      </span>
                    ) : null}
                    {row.reds > 0 ? (
                      <span className="flex items-center gap-1">
                        <CardGlyph type="red" />
                        {row.reds}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </Panel>
          )}
        </Section>

        {/* ---- biggest wins ---- */}
        <Section title="Biggest wins">
          {wins.length === 0 ? (
            <Panel className="px-4 py-5 text-center text-sm text-muted">
              Every match so far has been drawn.
            </Panel>
          ) : (
            <Panel className="overflow-hidden">
              {wins.map((win) => (
                <Link
                  key={win.match.id}
                  href={`/match/${win.match.id}`}
                  className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 transition-colors active:bg-surface-2 sm:hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-chalk">
                      {win.winner?.name ?? 'Unknown'}
                    </span>
                    <span className="truncate text-[0.68rem] text-muted">
                      beat {win.loser?.short_name ?? '—'} ·{' '}
                      <span className="tnum">{formatDayMonth(win.match.kickoff_at)}</span>
                    </span>
                  </span>
                  <span className="score shrink-0 text-lg text-chalk">{win.scoreline}</span>
                </Link>
              ))}
            </Panel>
          )}
        </Section>

        </div>
      </div>

      <LastUpdated at={fetchedAt} />
    </Page>
  );
}

function Total({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-b border-line px-2 py-3 text-center last:border-b-0 xs:border-b-0">
      <p className={`score text-2xl ${accent ? 'text-pitch' : 'text-chalk'}`}>{value}</p>
      <p className="mt-0.5 text-[0.6rem] uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}
