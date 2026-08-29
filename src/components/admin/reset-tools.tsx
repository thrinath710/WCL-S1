'use client';

import { resetDay, resetTournament } from '@/lib/actions/reset';
import { RESET_PHRASE, type ResetDay } from '@/lib/reset';
import { ActionForm, Field, SubmitButton, TextInput } from './form';

/**
 * Undo controls, kept behind their own heading and their own colour.
 *
 * Everything here throws work away, so nothing is a single unguarded tap: a
 * day asks for a browser confirm naming what it will clear, and the whole
 * tournament asks for a word to be typed. Both are checked again on the
 * server, which is also where the organiser-only rule is enforced.
 */
export function ResetTools({ days }: { days: ResetDay[] }) {
  return (
    <section className="space-y-3 rounded-2xl border border-red-card/40 bg-red-card/[0.04] p-3.5">
      <header>
        <h2 className="flex items-center gap-2 text-sm font-bold text-chalk">
          <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-red-card" />
          Reset results
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Clears scorelines, penalties, scorers and cards so a night can be entered again. The
          fixtures themselves stay, so the public schedule never disappears.
        </p>
      </header>

      {days.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs text-faint">
          There are no fixtures yet, so there is nothing to reset.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {days.map((day) => (
            <DayRow key={day.key} day={day} />
          ))}
        </ul>
      )}

      <div className="border-t border-red-card/25 pt-3">
        <ActionForm action={resetTournament} resetOnSuccess className="space-y-2.5">
          <p className="text-xs leading-relaxed text-muted">
            <span className="font-bold text-chalk">Reset the whole tournament.</span> Every result
            across all {days.length || 0} {days.length === 1 ? 'day' : 'days'} goes, and the
            semi-finals and final are removed so the group stage can be drawn again. Teams, squads
            and the group fixtures are untouched.
          </p>
          <Field label={`Type ${RESET_PHRASE} to confirm`}>
            <TextInput
              name="confirm"
              placeholder={RESET_PHRASE}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </Field>
          <SubmitButton tone="danger" size="lg" className="w-full">
            Reset the whole tournament
          </SubmitButton>
        </ActionForm>
      </div>
    </section>
  );
}

function DayRow({ day }: { day: ResetDay }) {
  const nothingEntered = day.played === 0;
  const bits = [
    `${day.played} of ${day.total} played`,
    day.goals > 0 ? `${day.goals} ${day.goals === 1 ? 'goal' : 'goals'}` : null,
    day.cards > 0 ? `${day.cards} ${day.cards === 1 ? 'card' : 'cards'}` : null,
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-chalk">
          {day.label}
          {day.knockout ? (
            <span className="ml-1.5 text-[0.6rem] font-bold uppercase tracking-wider text-faint">
              knockout
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[0.68rem] text-faint tnum">{bits.join(' · ')}</span>
      </span>

      <ActionForm
        action={resetDay}
        className="shrink-0"
        confirm={
          nothingEntered
            ? undefined
            : `Reset ${day.label}?\n\nThis clears ${day.played} ${
                day.played === 1 ? 'result' : 'results'
              }${day.goals > 0 ? `, ${day.goals} ${day.goals === 1 ? 'goal' : 'goals'}` : ''}${
                day.cards > 0 ? ` and ${day.cards} ${day.cards === 1 ? 'card' : 'cards'}` : ''
              }. The ${day.total} ${
                day.total === 1 ? 'fixture stays' : 'fixtures stay'
              } and can be entered again.\n\nThis cannot be undone.`
        }
      >
        <input type="hidden" name="day" value={day.key} />
        <SubmitButton tone="danger" className="px-3" disabled={nothingEntered}>
          Reset
        </SubmitButton>
      </ActionForm>
    </li>
  );
}
