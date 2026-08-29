import Link from 'next/link';
import type { GroupStandings } from '@/lib/standings';
import { TIEBREAK_LABEL } from '@/lib/standings';
import { signed } from '@/lib/format';
import { FormPills, Panel } from './ui';

/**
 * A group table.
 *
 * On a narrow screen team names collapse to their three letter short name and
 * the widest columns drop away, so the numbers still fit without the page
 * scrolling sideways. Qualifying rows carry a gold rail -- gold is used
 * nowhere else except for winning, so its meaning is never diluted.
 */
export function StandingsTable({
  table,
  condensed = false,
  showForm = true,
  compact = false,
}: {
  table: GroupStandings;
  /** Top four only, for the home page. */
  condensed?: boolean;
  showForm?: boolean;
  /**
   * Always use the three-letter short name. The home page sidebar is
   * narrower than the `sm` breakpoint even on a large screen, so it cannot
   * rely on viewport width to decide.
   */
  compact?: boolean;
}) {
  const rows = condensed ? table.rows.slice(0, 4) : table.rows;

  // Column visibility is normally a viewport question, but the home page
  // sidebar is narrow on a *wide* screen, so `sm:` would wrongly reveal
  // columns there. In compact mode the decision is made here instead.
  const drawnCol = compact ? 'hidden' : 'hidden xs:table-cell';
  const goalsCol = compact ? 'hidden' : 'hidden sm:table-cell';
  const teamCell = compact ? 'w-16 py-2.5 pl-1 pr-1' : 'max-w-0 py-2.5 pl-1 pr-2';

  if (rows.length === 0) {
    return (
      <Panel className="px-4 py-6 text-center text-sm text-muted">
        No teams in this group yet.
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2/50 text-[0.6rem] uppercase tracking-[0.1em] text-faint">
            <th scope="col" className="w-8 py-2.5 pl-3 text-left font-bold">
              <span className="sr-only">Position</span>
              <span aria-hidden>#</span>
            </th>
            <th scope="col" className="py-2.5 pl-1 text-left font-bold">Team</th>
            <Numeric header>P</Numeric>
            <Numeric header>W</Numeric>
            <Numeric header className={drawnCol}>D</Numeric>
            <Numeric header>L</Numeric>
            <Numeric header className={goalsCol}>GF</Numeric>
            <Numeric header className={goalsCol}>GA</Numeric>
            <Numeric header>GD</Numeric>
            <Numeric header className="pr-3 text-pitch">Pts</Numeric>
            {showForm && !compact ? (
              <th scope="col" className="hidden py-2.5 pr-3 text-left font-bold md:table-cell">
                Form
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.team.id}
              style={{ '--i': index } as React.CSSProperties}
              className={`animate-rise stagger relative border-b border-line/60 transition-colors duration-200 last:border-b-0 hover:bg-surface-2/60 ${
                row.qualified ? 'bg-gold-glow' : ''
              }`}
            >
              <td className="relative py-2.5 pl-3">
                {row.qualified ? (
                  <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-gold" />
                ) : null}
                <span
                  className={`stat text-xs ${row.qualified ? 'text-gold' : 'text-faint'}`}
                >
                  {row.position}
                </span>
              </td>
              <td className={teamCell}>
                <Link
                  href={`/teams/${row.team.id}`}
                  className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-pitch"
                >
                  {compact ? (
                    <span className="tnum font-bold text-chalk">{row.team.short_name}</span>
                  ) : (
                    <>
                      <span className="hidden truncate font-bold text-chalk sm:inline">
                        {row.team.name}
                      </span>
                      <span className="tnum font-bold text-chalk sm:hidden">
                        {row.team.short_name}
                      </span>
                    </>
                  )}
                  {row.separatedBy === 'head_to_head' || row.separatedBy === 'admin_override' ? (
                    <abbr
                      title={`Separated from the team above on ${TIEBREAK_LABEL[row.separatedBy]}`}
                      className="shrink-0 text-[0.58rem] font-extrabold text-pitch no-underline"
                    >
                      {row.separatedBy === 'head_to_head' ? 'h2h' : '†'}
                    </abbr>
                  ) : null}
                </Link>
              </td>
              <Numeric>{row.played}</Numeric>
              <Numeric>{row.won}</Numeric>
              <Numeric className={drawnCol}>{row.drawn}</Numeric>
              <Numeric>{row.lost}</Numeric>
              <Numeric className={goalsCol}>{row.goalsFor}</Numeric>
              <Numeric className={goalsCol}>{row.goalsAgainst}</Numeric>
              <Numeric
                className={
                  row.goalDifference > 0
                    ? 'text-pitch'
                    : row.goalDifference < 0
                      ? 'text-red-card/80'
                      : ''
                }
              >
                {signed(row.goalDifference)}
              </Numeric>
              <td className="stat w-9 py-2.5 pr-3 text-center text-base text-pitch">
                {row.points}
              </td>
              {showForm && !compact ? (
                <td className="hidden py-2.5 pr-3 md:table-cell">
                  <FormPills form={row.form} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Numeric({
  children,
  header = false,
  className = '',
}: {
  children: React.ReactNode;
  header?: boolean;
  className?: string;
}) {
  const shared = `w-8 py-2.5 text-center ${className}`;
  return header ? (
    <th scope="col" className={`${shared} font-bold`}>
      {children}
    </th>
  ) : (
    <td className={`stat ${shared} text-muted`}>{children}</td>
  );
}

/** The footnote that makes the ordering above defensible. */
export function TiebreakerNote() {
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface/60 p-3.5">
      <p className="text-[0.72rem] leading-relaxed text-faint">
        <span className="font-bold text-muted">Tiebreakers, in order:</span> points, then goal
        difference, then goals scored, then the head-to-head result between the tied teams, then a
        ruling by the organisers. <span className="font-bold text-pitch">h2h</span> marks a team
        separated on head-to-head, <span className="font-bold text-pitch">†</span> one separated by
        a ruling. <span className="font-bold text-gold">Gold rows</span> qualify for the knockout
        stage.
      </p>
    </div>
  );
}
