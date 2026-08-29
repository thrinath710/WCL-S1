import type { Metadata } from 'next';
import Link from 'next/link';
import { getSnapshot, indexById } from '@/lib/queries';
import { groupByDay } from '@/lib/schedule';
import { dayKey, formatLongDay } from '@/lib/format';
import { groupNames } from '@/lib/standings';
import type { GroupName, Match, Team } from '@/lib/types';
import { darkTeamsOn } from '@/lib/kit';
import { MatchCard } from '@/components/match-card';
import { LastUpdated } from '@/components/last-updated';
import { ActionLink, EmptyState, Page, PageTitle, Panel } from '@/components/ui';

export const metadata: Metadata = { title: 'Fixtures' };


/**
 * Served from cache for up to 30 seconds, so a hall full of people refreshing
 * during a match costs the database nothing. A save in the admin area calls
 * revalidatePath for this route, so a new scoreline appears at once rather
 * than waiting for the window to lapse.
 */
export const revalidate = 30;
/**
 * Filters are plain links carrying query parameters rather than client state.
 * They work with JavaScript still loading, they are shareable ("here's just
 * our games"), and the back button behaves the way people expect.
 */
export default async function FixturesPage(props: PageProps<'/fixtures'>) {
  const params = await props.searchParams;
  const { teams, matches, fetchedAt } = await getSnapshot();
  const teamIndex = indexById(teams);

  const groupParam = pickOne(params.group);
  const teamParam = pickOne(params.team);
  const activeGroup = groupNames(teams).includes(groupParam as GroupName)
    ? (groupParam as GroupName)
    : null;
  const activeTeam = teamParam && teamIndex.has(teamParam) ? teamParam : null;

  const filtered = matches.filter((match) => matchPasses(match, activeGroup, activeTeam));
  const days = groupByDay(filtered, dayKey);

  const href = (next: { group?: string | null; team?: string | null }) => {
    const search = new URLSearchParams();
    const group = next.group === undefined ? activeGroup : next.group;
    const team = next.team === undefined ? activeTeam : next.team;
    if (group) search.set('group', group);
    if (team) search.set('team', team);
    const query = search.toString();
    return query ? `/fixtures?${query}` : '/fixtures';
  };

  return (
    <Page wide>
      <PageTitle
        title="Fixtures"
        subtitle={
          matches.length > 0
            ? `${filtered.length} ${filtered.length === 1 ? 'match' : 'matches'}`
            : undefined
        }
      />

      <div className="mb-4 space-y-2">
        <FilterRow label="Group">
          <Chip href={href({ group: null })} active={!activeGroup}>
            All
          </Chip>
          {groupNames(teams).map((name) => (
            <Chip key={name} href={href({ group: name })} active={activeGroup === name}>
              Group {name}
            </Chip>
          ))}
        </FilterRow>

        {teams.length > 0 ? (
          <FilterRow label="Team">
            <Chip href={href({ team: null })} active={!activeTeam}>
              All
            </Chip>
            {teams.map((team) => (
              <Chip key={team.id} href={href({ team: team.id })} active={activeTeam === team.id}>
                {team.short_name}
              </Chip>
            ))}
          </FilterRow>
        ) : null}
      </div>

      {days.length === 0 ? (
        <EmptyState
          title={matches.length === 0 ? 'No fixtures published yet' : 'Nothing matches that filter'}
          hint={
            matches.length === 0
              ? 'Kickoff times, pitches and results all appear here as soon as the schedule goes up.'
              : 'Try clearing the group or team filter.'
          }
          action={
            matches.length > 0 ? (
              <ActionLink href="/fixtures" tone="ghost">Clear filters</ActionLink>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-5">
          {days.map((day) => (
            <section key={day.key}>
              <h2 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                <span aria-hidden className="h-3 w-[3px] rounded-full bg-pitch" />
                {formatLongDay(day.matches[0].kickoff_at)}
              </h2>
              <Panel className="overflow-hidden">
                {day.matches.map((match, i) => (
                  <MatchCard key={match.id} match={match} teams={teamIndex} index={i} />
                ))}
              </Panel>
              <InDark matches={day.matches} teams={teamIndex} />
            </section>
          ))}
        </div>
      )}

      <LastUpdated at={fetchedAt} />
    </Page>
  );
}

/**
 * "In dark tonight", the line the fixture sheet prints under each evening.
 *
 * A team plays all of its matches on a night on the same side, so this is the
 * one thing worth knowing before leaving for the court: which shirt to bring.
 * It is derived from who is at home, never stored -- see lib/kit.ts.
 */
function InDark({ matches, teams }: { matches: Match[]; teams: Map<string, Team> }) {
  const names = [...darkTeamsOn(matches)]
    .map((id) => teams.get(id)?.name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b));

  if (names.length === 0) return null;

  return (
    <p className="mt-2 px-1 text-[0.68rem] leading-relaxed text-faint">
      <span className="font-bold uppercase tracking-wider">In dark tonight</span>
      <span className="mx-1.5">·</span>
      {names.join(' · ')}
    </p>
  );
}

function matchPasses(match: Match, group: GroupName | null, teamId: string | null): boolean {
  if (group && match.group_name !== group) return false;
  if (teamId && match.home_team_id !== teamId && match.away_team_id !== teamId) return false;
  return true;
}

function pickOne(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-11 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wider text-faint">
        {label}
      </span>
      <div className="scroll-x flex gap-1.5 pb-1">{children}</div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`flex min-h-[2.25rem] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-all duration-200 ${
        active
          ? 'border-pitch bg-pitch text-ink shadow-[0_0_16px_var(--color-pitch-glow)]'
          : 'glass border-line text-muted hover:border-pitch-dim hover:text-chalk'
      }`}
    >
      {children}
    </Link>
  );
}
