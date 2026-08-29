import Link from 'next/link';
import { getSnapshot, indexById } from '@/lib/queries';
import { buildStandings } from '@/lib/standings';
import { topScorers } from '@/lib/stats';
import { headlineMatch, recentResults, upcomingMatches } from '@/lib/schedule';
import { formatDay, formatTime, relativeTime } from '@/lib/format';
import { STAGE_LABEL, type Match, type Team } from '@/lib/types';
import { MatchCard, ResultChip } from '@/components/match-card';
import { StandingsTable } from '@/components/standings-table';
import type { Kit } from '@/lib/kit';
import { WclIntro } from '@/components/wcl-intro';
import { ScoreLine } from '@/components/score-display';
import { LastUpdated } from '@/components/last-updated';
import { Football } from '@/components/pitch-backdrop';
import {
  ActionLink,
  EmptyState,
  KitDot,
  KitTag,
  LiveBadge,
  MoreLink,
  Page,
  Panel,
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

export default async function HomePage() {
  const snapshot = await getSnapshot();
  const { settings, teams, players, matches, goals, fetchedAt } = snapshot;
  const teamIndex = indexById(teams);

  const headline = headlineMatch(matches);
  const results = recentResults(matches, 4);
  const upcoming = upcomingMatches(matches, 4);
  const tables = buildStandings(teams, matches);
  const leader = topScorers(players, teams, matches, goals, 1)[0];

  // Before anything has been entered the home page is a welcome, not a
  // skeleton of empty widgets.
  if (teams.length === 0 && matches.length === 0) {
    return (
      <>
        <WclIntro />
        <Page>
          <Hero settings={settings} />
          <EmptyState
            title="The tournament has not started yet"
            hint="Teams, fixtures and the league table will appear here as soon as the organisers publish them. Check back soon."
          />
          <LastUpdated at={fetchedAt} />
        </Page>
      </>
    );
  }

  return (
    <>
      <WclIntro />
      <Page wide>
        <Hero settings={settings} />

        {headline ? <StatusStrip headline={headline} teams={teamIndex} /> : null}

        {/* Two columns on a laptop: the run of play on the left, the standings
            and the scoring charts on the right. One column on a phone. */}
        <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-7">
          <div className="min-w-0">
            {results.length > 0 ? (
              <Section title="Latest results" action={<MoreLink href="/fixtures">All results</MoreLink>}>
                <div className="scroll-x -mx-4 flex gap-2.5 px-4 pb-2 sm:-mx-6 sm:px-6">
                  {results.map((match, i) => (
                    <ResultChip key={match.id} match={match} teams={teamIndex} index={i} />
                  ))}
                </div>
              </Section>
            ) : null}

            {upcoming.length > 0 ? (
              <Section title="Next up" action={<MoreLink href="/fixtures">All fixtures</MoreLink>}>
                <Panel className="overflow-hidden">
                  {upcoming.map((match, i) => (
                    <MatchCard key={match.id} match={match} teams={teamIndex} showDate index={i} />
                  ))}
                </Panel>
              </Section>
            ) : null}

            {matches.length === 0 && teams.length > 0 ? (
              <Section title="Fixtures">
                <EmptyState
                  title="No fixtures published yet"
                  hint={`${teams.length} ${teams.length === 1 ? 'team has' : 'teams have'} registered. The schedule goes up once the groups are drawn.`}
                  action={<ActionLink href="/teams" tone="ghost">See the teams</ActionLink>}
                />
              </Section>
            ) : null}
          </div>

          <aside className="min-w-0">
            {teams.length > 0 ? (
              <Section title="Standings" action={<MoreLink href="/table">Full table</MoreLink>}>
                <div className="space-y-3.5">
                  {tables.map((table) => (
                    <div key={table.groupName ?? 'all'}>
                      {table.groupName ? (
                        <p className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted">
                          Group {table.groupName}
                        </p>
                      ) : null}
                      <StandingsTable table={table} condensed showForm={false} compact />
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {leader ? (
              <Section title="Top scorer" action={<MoreLink href="/stats">All stats</MoreLink>}>
                <Panel tone="gold" className="flex items-center gap-3 p-3.5">
                  {leader.team ? <TeamCrest team={leader.team} size={42} /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-chalk">{leader.player.name}</p>
                    <p className="truncate text-xs text-muted">{leader.team?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="score text-4xl text-gold">{leader.goals}</p>
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-gold/70">
                      {leader.goals === 1 ? 'goal' : 'goals'}
                    </p>
                  </div>
                </Panel>
              </Section>
            ) : null}

            {settings.prize_note ? (
              <Panel tone="pitch" className="mb-7 flex gap-2.5 p-3.5">
                <Football size={18} className="mt-0.5 shrink-0 text-pitch" />
                <p className="text-xs leading-relaxed text-pitch-bright">{settings.prize_note}</p>
              </Panel>
            ) : null}
          </aside>
        </div>

        <LastUpdated at={fetchedAt} />
      </Page>
    </>
  );
}

function Hero({ settings }: { settings: { name: string; tagline: string | null } }) {
  return (
    <div className="animate-rise mb-6 lg:mb-8">
      <h1 className="display text-[2.6rem] uppercase leading-[0.92] text-chalk sm:text-6xl lg:text-7xl">
        {settings.name}
      </h1>
      {settings.tagline ? (
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.22em] text-pitch sm:text-base">
          {settings.tagline}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The strip at the top of the home page. It answers the one question a
 * visitor arrives with: is anything happening right now, and if not, when?
 */
function StatusStrip({
  headline,
  teams,
}: {
  headline: { match: Match; kind: 'live' | 'next' | 'last' };
  teams: Map<string, Team>;
}) {
  const { match, kind } = headline;
  const home = teams.get(match.home_team_id);
  const away = teams.get(match.away_team_id);
  const live = kind === 'live';

  return (
    <Link
      href={`/match/${match.id}`}
      className={`animate-rise glass mb-7 block cursor-pointer rounded-2xl border p-4 transition-all duration-200 sm:p-6 ${
        live
          ? 'border-live/55 bg-live/[0.07] hover:border-live'
          : 'border-pitch-dim bg-pitch-glow hover:border-pitch'
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        {live ? (
          <LiveBadge />
        ) : (
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-pitch">
            {kind === 'next' ? 'Next kickoff' : 'Latest result'}
          </span>
        )}
        <span className="ml-auto text-[0.7rem] text-muted tnum">
          {kind === 'next'
            ? `${formatDay(match.kickoff_at)} · ${formatTime(match.kickoff_at)}`
            : relativeTime(match.kickoff_at)}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <Squad team={home} kit="dark" align="left" />
        <div className="text-center">
          {live || kind === 'last' ? (
            <ScoreLine
              home={match.home_score}
              away={match.away_score}
              size="hero"
              tone={live ? 'live' : 'default'}
            />
          ) : (
            <span className="score block text-[2.6rem] text-pitch sm:text-[3.4rem]">
              {formatTime(match.kickoff_at)}
            </span>
          )}
          {match.home_pens != null && match.away_pens != null ? (
            <p className="mt-1.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-gold tnum">
              {match.home_pens}–{match.away_pens} pens
            </p>
          ) : null}
        </div>
        <Squad team={away} kit="light" align="right" />
      </div>

      <p className="mt-4 text-center text-[0.68rem] text-faint">
        {match.stage === 'group' ? `Group ${match.group_name ?? ''}` : STAGE_LABEL[match.stage]}
        {match.pitch ? ` · ${match.pitch}` : ''}
      </p>
    </Link>
  );
}

function Squad({
  team,
  kit,
  align,
}: {
  team: Team | undefined;
  kit: Kit;
  align: 'left' | 'right';
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-2 ${
        align === 'right' ? 'sm:items-end' : 'sm:items-start'
      }`}
    >
      <KitDot kit={team ? kit : null} size={24} />
      <p
        className={`w-full truncate text-center text-xs font-bold leading-tight text-chalk sm:text-sm ${
          align === 'right' ? 'sm:text-right' : 'sm:text-left'
        }`}
      >
        <span className="hidden sm:inline">{team?.name ?? 'TBD'}</span>
        <span className="sm:hidden">{team?.short_name ?? 'TBD'}</span>
      </p>
      {team ? <KitTag kit={kit} /> : null}
    </div>
  );
}
