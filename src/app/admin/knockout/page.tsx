import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth';
import { getLiveSnapshot, indexById } from '@/lib/queries';
import { buildStandings, byKickoff, isGroupStageComplete, matchWinner } from '@/lib/standings';
import { planSemiFinals, semisDecided } from '@/lib/knockout';
import { formatDay, formatTime } from '@/lib/format';
import { isCounted, STAGE_LABEL } from '@/lib/types';
import { CloseGroupStageButton, FillFinalButton } from '@/components/admin/knockout-tools';

export const metadata: Metadata = { title: 'Knockout' };

export default async function AdminKnockoutPage() {
  await requireAdminPage();
  const { teams, matches } = await getLiveSnapshot();
  const teamIndex = indexById(teams);

  const groupMatches = matches.filter((m) => m.stage === 'group');
  const played = groupMatches.filter(isCounted).length;
  const groupsDone = isGroupStageComplete(matches);

  const standings = buildStandings(teams, matches);
  const draw = planSemiFinals(standings);

  const semis = matches.filter((m) => m.stage === 'semi').sort(byKickoff);
  const final = matches.find((m) => m.stage === 'final');
  const bothSemisWon = semisDecided(matches);

  const nameOf = (id: string | null | undefined) =>
    (id && teamIndex.get(id)?.name) || 'TBD';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl uppercase leading-none text-chalk">Knockout</h1>
        <p className="mt-0.5 text-xs text-muted">
          {played} of {groupMatches.length} group matches played
        </p>
      </header>

      {/* ---------------------------------------------- step 1: the draw */}
      <section className="glass space-y-3 rounded-2xl border border-line p-3.5">
        <Step n={1} title="Draw the semi-finals" done={semis.length > 0} />

        <p className="text-xs leading-relaxed text-muted">
          The draw is crossed, so the two group winners can only meet in the final. The winner is
          placed at home and so wears <span className="font-bold text-chalk">dark</span>.
        </p>

        <ul className="space-y-1.5">
          {draw.map((tie) => (
            <li key={tie.label} className="rounded-xl border border-line bg-surface-2 px-3 py-2">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-faint">
                {tie.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-chalk">
                {tie.home?.name ?? tie.homeLabel} <span className="text-faint">v</span>{' '}
                {tie.away?.name ?? tie.awayLabel}
              </p>
            </li>
          ))}
        </ul>

        {semis.length > 0 ? (
          <p className="rounded-xl border border-pitch-dim bg-pitch-glow px-3 py-2 text-xs leading-relaxed text-pitch-bright">
            The semi-finals are drawn. Change either side from{' '}
            <Link href="/admin/fixtures" className="font-bold underline">
              Fixtures → Teams &amp; kit
            </Link>{' '}
            if you need to; the final follows whatever they end up being.
          </p>
        ) : (
          <CloseGroupStageButton
            ready={groupsDone}
            hint={
              groupsDone
                ? 'Every group match has a result. This creates the two semi-finals on the evening after the last group match.'
                : `${groupMatches.length - played} group ${groupMatches.length - played === 1 ? 'match still needs' : 'matches still need'} a result before the group stage can be closed.`
            }
          />
        )}
      </section>

      {/* ------------------------------------------- step 2: the results */}
      <section className="glass space-y-3 rounded-2xl border border-line p-3.5">
        <Step n={2} title="Play the semi-finals" done={bothSemisWon} />

        {semis.length === 0 ? (
          <p className="text-xs text-faint">Nothing to play yet — draw the semi-finals first.</p>
        ) : (
          <ul className="space-y-1.5">
            {semis.map((match) => (
              <li key={match.id} className="rounded-xl border border-line bg-surface-2">
                <Link href={`/admin/matches/${match.id}`} className="block px-3 py-2">
                  <p className="text-[0.62rem] font-bold uppercase tracking-wider text-faint tnum">
                    {STAGE_LABEL[match.stage]} · {formatDay(match.kickoff_at)}{' '}
                    {formatTime(match.kickoff_at)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-chalk">
                    <span className="min-w-0 flex-1 truncate">
                      {nameOf(match.home_team_id)} <span className="text-faint">v</span>{' '}
                      {nameOf(match.away_team_id)}
                    </span>
                    <span className="score shrink-0 text-lg">
                      {isCounted(match) ? `${match.home_score}–${match.away_score}` : '–'}
                    </span>
                  </p>
                  {isCounted(match) ? (
                    <p className="mt-0.5 text-[0.68rem] text-pitch">
                      {nameOf(matchWinner(match))} go through
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[0.68rem] text-faint">Tap to enter the result</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --------------------------------------------- step 3: the final */}
      <section className="glass space-y-3 rounded-2xl border border-line p-3.5">
        <Step n={3} title="The final" done={Boolean(final && isCounted(final))} />

        {final ? (
          <Link
            href={`/admin/matches/${final.id}`}
            className="block rounded-xl border border-line bg-surface-2 px-3 py-2"
          >
            <p className="text-[0.62rem] font-bold uppercase tracking-wider text-faint tnum">
              Final · {formatDay(final.kickoff_at)} {formatTime(final.kickoff_at)}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-chalk">
              <span className="min-w-0 flex-1 truncate">
                {nameOf(final.home_team_id)} <span className="text-faint">v</span>{' '}
                {nameOf(final.away_team_id)}
              </span>
              <span className="score shrink-0 text-lg">
                {isCounted(final) ? `${final.home_score}–${final.away_score}` : '–'}
              </span>
            </p>
            <p className="mt-0.5 text-[0.68rem] text-faint">
              {nameOf(final.home_team_id)} are the higher seed and wear dark.
            </p>
          </Link>
        ) : null}

        <FillFinalButton
          ready={bothSemisWon}
          hint={
            bothSemisWon
              ? 'Both semi-finals are won. This is done for you when the second result is saved — the button is here for when a scoreline is corrected afterwards.'
              : 'The final fills itself in as soon as both semi-finals have a winner.'
          }
        />
      </section>
    </div>
  );
}

function Step({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <h2 className="flex items-center gap-2.5">
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.65rem] font-extrabold ${
          done ? 'bg-pitch text-ink' : 'border border-line-bright bg-surface-2 text-muted'
        }`}
      >
        {done ? '✓' : n}
      </span>
      <span className="text-sm font-bold text-chalk">{title}</span>
    </h2>
  );
}
