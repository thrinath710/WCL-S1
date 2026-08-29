import type { Metadata } from 'next';
import Link from 'next/link';
import { getSnapshot, indexById } from '@/lib/queries';
import { buildBracket } from '@/lib/bracket';
import { isGroupStageComplete, matchWinner } from '@/lib/standings';
import { formatDayMonth, formatTime } from '@/lib/format';
import { STAGE_LABEL, isCounted, type Match, type Team } from '@/lib/types';
import { LastUpdated } from '@/components/last-updated';
import type { Kit } from '@/lib/kit';
import { EmptyState, KitDot, LiveBadge, Page, PageTitle, Panel, TeamCrest } from '@/components/ui';

export const metadata: Metadata = { title: 'Bracket' };


/**
 * Served from cache for up to 30 seconds, so a hall full of people refreshing
 * during a match costs the database nothing. A save in the admin area calls
 * revalidatePath for this route, so a new scoreline appears at once rather
 * than waiting for the window to lapse.
 */
export const revalidate = 30;
export default async function BracketPage() {
  const { settings, teams, matches, fetchedAt } = await getSnapshot();
  const teamIndex = indexById(teams);

  // The bracket stays sealed until the group stage is done, or until the
  // organiser opens it early from the admin area.
  const unlocked = settings.is_knockout_unlocked || isGroupStageComplete(matches);
  if (!unlocked) {
    return (
      <Page>
        <PageTitle title="Knockout bracket" />
        <EmptyState
          title="Locked until the group stage finishes"
          hint="The bracket opens as soon as every group match has a result."
        />
        <p className="mt-4 text-center">
          <Link href="/table" className="text-xs font-semibold text-pitch">
            See who is qualifying →
          </Link>
        </p>
        <LastUpdated at={fetchedAt} />
      </Page>
    );
  }

  const bracket = buildBracket(matches);
  const champion = bracket.champion ? teamIndex.get(bracket.champion) : undefined;

  return (
    <Page>
      <PageTitle title="Knockout bracket" />

      {champion ? (
        <Panel className="mb-6 border-pitch bg-pitch-glow p-4 text-center">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-pitch">
            Champions
          </p>
          <p className="mt-2 flex items-center justify-center gap-2 text-xl font-bold text-chalk">
            <TeamCrest team={champion} size={34} />
            {champion.name}
          </p>
        </Panel>
      ) : null}

      {/* ---- mobile: a stacked list, round by round ---- */}
      <div className="space-y-5 lg:hidden">
        {bracket.rounds.map((round) => (
          <section key={round.stage}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
              {round.label}
            </h2>
            <div className="space-y-2">
              {round.slots.map((slot, index) => (
                <BracketTie
                  key={slot?.id ?? `${round.stage}-${index}`}
                  match={slot}
                  teams={teamIndex}
                />
              ))}
            </div>
          </section>
        ))}

        {bracket.thirdPlace ? (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
              {STAGE_LABEL.third_place}
            </h2>
            <BracketTie match={bracket.thirdPlace} teams={teamIndex} />
          </section>
        ) : null}
      </div>

      {/* ---- desktop: a real bracket, rounds side by side ---- */}
      <div className="hidden lg:block">
        <div className="flex items-stretch gap-4">
          {bracket.rounds.map((round) => (
            <div key={round.stage} className="flex-1">
              <h2 className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-muted">
                {round.label}
              </h2>
              <div className="flex h-full flex-col justify-around gap-4">
                {round.slots.map((slot, index) => (
                  <BracketTie
                    key={slot?.id ?? `${round.stage}-${index}`}
                    match={slot}
                    teams={teamIndex}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {bracket.thirdPlace ? (
          <div className="mx-auto mt-6 max-w-xs">
            <h2 className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-muted">
              {STAGE_LABEL.third_place}
            </h2>
            <BracketTie match={bracket.thirdPlace} teams={teamIndex} />
          </div>
        ) : null}
      </div>

      <p className="mt-5 text-[0.7rem] leading-relaxed text-faint">
        Knockout matches are 2 × 15 minutes and cannot end level. A tie still level at full time is
        settled by a penalty shootout; the shootout score decides who goes through but does not
        count toward any goal statistic.
      </p>

      <LastUpdated at={fetchedAt} />
    </Page>
  );
}

/** One tie: either a drawn fixture, or an empty slot waiting on a result. */
function BracketTie({
  match,
  teams,
}: {
  match: Match | null;
  teams: Map<string, Team>;
}) {
  if (!match) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/50 px-3 py-4 text-center">
        <p className="text-xs font-medium text-faint">To be decided</p>
      </div>
    );
  }

  const played = isCounted(match);
  const winnerId = played ? matchWinner(match) : null;
  const hasPens = match.home_pens != null && match.away_pens != null;

  return (
    <Link
      href={`/match/${match.id}`}
      className="block rounded-xl border border-line bg-surface transition-colors active:border-pitch-dim sm:hover:border-pitch-dim"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 text-[0.62rem] text-faint">
        <span className="tnum">
          {formatDayMonth(match.kickoff_at)} · {formatTime(match.kickoff_at)}
        </span>
        {match.status === 'live' ? <LiveBadge /> : null}
      </div>
      <BracketSide
        team={teams.get(match.home_team_id)}
        kit="dark"
        score={match.home_score}
        pens={match.home_pens}
        show={played || match.status === 'live'}
        won={winnerId === match.home_team_id}
        hasPens={hasPens}
      />
      <BracketSide
        team={teams.get(match.away_team_id)}
        kit="light"
        score={match.away_score}
        pens={match.away_pens}
        show={played || match.status === 'live'}
        won={winnerId === match.away_team_id}
        hasPens={hasPens}
      />
    </Link>
  );
}

function BracketSide({
  team,
  kit,
  score,
  pens,
  show,
  won,
  hasPens,
}: {
  team: Team | undefined;
  score: number;
  pens: number | null;
  show: boolean;
  won: boolean;
  hasPens: boolean;
  kit: Kit;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${won ? '' : 'opacity-60'} border-b border-line last:border-b-0`}
    >
      <KitDot kit={team ? kit : null} size={10} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">
        {team?.name ?? 'TBD'}
      </span>
      {hasPens && show ? (
        <span className="shrink-0 text-[0.65rem] font-bold text-pitch tnum">({pens})</span>
      ) : null}
      <span className={`score shrink-0 text-lg ${won ? 'text-chalk' : 'text-muted'}`}>
        {show ? score : '–'}
      </span>
    </div>
  );
}
