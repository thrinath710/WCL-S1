import Link from 'next/link';
import type { Match, Team } from '@/lib/types';
import { STAGE_LABEL, STAGE_LABEL_SHORT, isCounted, isKnockout } from '@/lib/types';
import { matchWinner } from '@/lib/standings';
import { formatDay, formatTime } from '@/lib/format';
import { ScoreLine } from './score-display';
import type { Kit } from '@/lib/kit';
import { KitDot, LiveBadge, Pill } from './ui';

type TeamLookup = Map<string, Team>;

function stageTag(match: Match) {
  if (match.stage === 'group') return match.group_name ? `Group ${match.group_name}` : 'Group';
  return STAGE_LABEL[match.stage];
}

/**
 * One match, as a result or as a fixture.
 *
 * The scoreline is deliberately the largest thing in the row: on a phone held
 * one-handed it should be readable without focusing on anything else.
 */
export function MatchCard({
  match,
  teams,
  showDate = false,
  index = 0,
}: {
  match: Match;
  teams: TeamLookup;
  showDate?: boolean;
  /** Drives the stagger delay when a list of these animates in. */
  index?: number;
}) {
  const home = teams.get(match.home_team_id);
  const away = teams.get(match.away_team_id);
  const played = isCounted(match);
  const live = match.status === 'live';
  const hasPens = match.home_pens != null && match.away_pens != null;

  // matchWinner accounts for a shootout, so a team that went through on
  // penalties is never dimmed as though it lost.
  const winnerId = played ? matchWinner(match) : null;
  const losing = (teamId: string) => winnerId != null && winnerId !== teamId;

  return (
    <Link
      href={`/match/${match.id}`}
      style={{ '--i': index } as React.CSSProperties}
      className={`animate-rise stagger group relative block cursor-pointer border-b border-line px-3.5 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-surface-2/70 sm:px-4 ${
        live ? 'bg-live/[0.05]' : ''
      }`}
    >
      {live ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-live" />
      ) : null}

      <div className="mb-2.5 flex items-center gap-1.5 text-[0.68rem] text-faint">
        <MetaLine
          parts={[
            <span key="stage" className="font-bold uppercase tracking-[0.09em] text-muted">
              {stageTag(match)}
            </span>,
            showDate ? (
              <span key="date" className="tnum">
                {formatDay(match.kickoff_at)}
              </span>
            ) : null,
            /* An unplayed match already shows its kickoff time in the score
               slot, so repeating it here would just be noise. */
            played || live ? (
              <span key="time" className="tnum">
                {formatTime(match.kickoff_at)}
              </span>
            ) : null,
            match.pitch ? (
              <span key="pitch" className="truncate">
                {match.pitch}
              </span>
            ) : null,
          ]}
        />
        <span className="ml-auto shrink-0">
          {live ? <LiveBadge /> : null}
          {match.status === 'walkover' ? <Pill tone="warn">W/O</Pill> : null}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <TeamSide team={home} kit="dark" align="left" dimmed={losing(match.home_team_id)} />

        <div className="px-1 text-center">
          {played || live ? (
            <ScoreLine
              home={match.home_score}
              away={match.away_score}
              size="md"
              tone={live ? 'live' : 'default'}
              label={`${home?.name ?? 'Home'} ${match.home_score}, ${away?.name ?? 'Away'} ${match.away_score}`}
            />
          ) : (
            <span className="score block text-[1.5rem] text-pitch tnum">
              {formatTime(match.kickoff_at)}
            </span>
          )}
          {hasPens ? (
            <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.09em] text-gold tnum">
              {match.home_pens}–{match.away_pens} pens
            </p>
          ) : null}
        </div>

        <TeamSide team={away} kit="light" align="right" dimmed={losing(match.away_team_id)} />
      </div>
    </Link>
  );
}

/** Joins whichever meta bits are present with a single separator between them. */
function MetaLine({ parts }: { parts: (React.ReactNode | null)[] }) {
  const present = parts.filter(Boolean);
  return (
    <>
      {present.map((part, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 ? <span aria-hidden>·</span> : null}
          {part}
        </span>
      ))}
    </>
  );
}

function TeamSide({
  kit,
  team,
  align,
  dimmed,
}: {
  team: Team | undefined;
  align: 'left' | 'right';
  dimmed: boolean;
  kit: Kit;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 transition-opacity duration-200 ${
        align === 'right' ? 'flex-row-reverse text-right' : 'text-left'
      } ${dimmed ? 'opacity-50' : ''}`}
    >
      {/* The home side wears dark, the away side light -- see lib/kit.ts. */}
      <KitDot kit={team ? kit : null} size={14} />
      <p className="min-w-0 truncate text-sm font-bold leading-tight text-chalk">
        <span className="hidden sm:inline">{team?.name ?? 'TBD'}</span>
        <span className="tnum sm:hidden">{team?.short_name ?? 'TBD'}</span>
      </p>
    </div>
  );
}

/**
 * Compact result, for the home page's "latest results" rail. Same
 * information, one card, still score-forward.
 */
export function ResultChip({
  match,
  teams,
  index = 0,
}: {
  match: Match;
  teams: TeamLookup;
  index?: number;
}) {
  const home = teams.get(match.home_team_id);
  const away = teams.get(match.away_team_id);
  const hasPens = match.home_pens != null && match.away_pens != null;
  const winnerId = matchWinner(match);

  return (
    <Link
      href={`/match/${match.id}`}
      style={{ '--i': index } as React.CSSProperties}
      className="animate-rise stagger glass flex min-w-[10.5rem] shrink-0 cursor-pointer flex-col gap-2.5 rounded-2xl border border-line p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-pitch-dim"
    >
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-faint">
        {isKnockout(match.stage) ? STAGE_LABEL_SHORT[match.stage] : `GRP ${match.group_name ?? ''}`}
      </span>
      <Side team={home} kit="dark" score={match.home_score} won={winnerId === match.home_team_id} />
      <Side team={away} kit="light" score={match.away_score} won={winnerId === match.away_team_id} />
      {hasPens ? (
        <span className="text-[0.58rem] font-bold uppercase tracking-[0.09em] text-gold tnum">
          {match.home_pens}–{match.away_pens} pens
        </span>
      ) : null}
    </Link>
  );
}

function Side({
  team,
  kit,
  score,
  won,
}: {
  team: Team | undefined;
  kit: Kit;
  score: number;
  won: boolean;
}) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span className={`flex min-w-0 items-center gap-1.5 ${won ? '' : 'opacity-55'}`}>
        <KitDot kit={team ? kit : null} size={9} />
        <span className="truncate text-[0.8rem] font-bold text-chalk">
          {team?.short_name ?? 'TBD'}
        </span>
      </span>
      <span className={`score text-xl ${won ? 'text-pitch' : 'text-muted'}`}>{score}</span>
    </span>
  );
}
