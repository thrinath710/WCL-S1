'use client';

import { useMemo, useState } from 'react';
import { addCard, addGoal, deleteCard, deleteGoal, saveResult } from '@/lib/actions/matches';
import type { Card, Goal, Match, Player, Team } from '@/lib/types';
import { isKnockout } from '@/lib/types';
import { kitFor } from '@/lib/kit';
import { KitDot } from '@/components/ui';
import {
  ActionForm,
  Field,
  InlineAction,
  Segmented,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from './form';

type Props = {
  match: Match;
  home: Team;
  away: Team;
  squad: Player[];
  goals: Goal[];
  cards: Card[];
};

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Completed' },
  { value: 'walkover', label: 'Walkover' },
];

export function MatchEditor({ match, home, away, squad, goals, cards }: Props) {
  return (
    <div className="space-y-6">
      <ResultSection match={match} home={home} away={away} />
      <GoalsSection match={match} home={home} away={away} squad={squad} goals={goals} />
      <CardsSection match={match} home={home} away={away} squad={squad} cards={cards} />
    </div>
  );
}

/**
 * Score, status and penalties in one form with one save.
 *
 * The steppers are local state, so tapping "+1" three times is instantaneous
 * and costs nothing; the single save at the end avoids a race between rapid
 * taps and keeps the whole result atomic.
 */
function ResultSection({ match, home, away }: { match: Match; home: Team; away: Team }) {
  const [homeScore, setHomeScore] = useState(match.home_score);
  const [awayScore, setAwayScore] = useState(match.away_score);
  const [status, setStatus] = useState<string>(match.status);

  const level = homeScore === awayScore;
  const finishing = status === 'completed' || status === 'walkover';
  // Knockout ties cannot be left level, so the shootout fields appear exactly
  // when they are needed -- and the server blocks the save if they are missing.
  const needsPens = isKnockout(match.stage) && level && finishing;
  const showPens = needsPens || match.home_pens != null;

  return (
    <Section title="Result">
      <ActionForm action={saveResult} className="space-y-4">
        <input type="hidden" name="match_id" value={match.id} />

        <div className="flex items-start justify-center gap-3">
          <StepperShell value={homeScore} onChange={setHomeScore} name="home_score" label={home.short_name} />
          <span className="score pt-8 text-2xl text-faint">–</span>
          <StepperShell value={awayScore} onChange={setAwayScore} name="away_score" label={away.short_name} />
        </div>

        <Field label="Status">
          <Segmented
            name="status"
            defaultValue={match.status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
        </Field>

        {showPens ? (
          <div className="rounded-xl border border-pitch-dim bg-pitch-glow p-3">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-pitch">
              Penalty shootout
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label={home.short_name}>
                <TextInput
                  name="home_pens"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  defaultValue={match.home_pens ?? ''}
                  placeholder="0"
                />
              </Field>
              <Field label={away.short_name}>
                <TextInput
                  name="away_pens"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  defaultValue={match.away_pens ?? ''}
                  placeholder="0"
                />
              </Field>
            </div>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-pitch-bright">
              Shootout scores decide who goes through. They never count toward goals for, against
              or any player&apos;s tally.
            </p>
          </div>
        ) : null}

        {needsPens && match.home_pens == null ? (
          <p className="rounded-lg border border-yellow-card/50 bg-yellow-card/10 px-3 py-2 text-xs font-medium text-yellow-card">
            This is a knockout match and the score is level. Enter the shootout before completing it.
          </p>
        ) : null}

        <Field label="Notes" hint="Optional. Shown on the public match page.">
          <TextArea name="notes" defaultValue={match.notes ?? ''} rows={2} maxLength={500} />
        </Field>

        <SubmitButton size="lg" className="w-full">
          Save result
        </SubmitButton>
      </ActionForm>
    </Section>
  );
}

/** Wraps ScoreStepper so the parent can react to the value for penalties. */
function StepperShell({
  value,
  onChange,
  name,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  name: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="max-w-[6rem] truncate text-[0.7rem] font-bold uppercase tracking-wider text-muted">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-1.5">
        <StepButton onClick={() => onChange(Math.max(0, value - 1))} label={`One fewer for ${label}`}>
          −
        </StepButton>
        <span className="score w-14 text-center text-[2.8rem] text-chalk" aria-live="polite">
          {value}
        </span>
        <StepButton onClick={() => onChange(Math.min(99, value + 1))} label={`One more for ${label}`}>
          +
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-full border border-line-bright bg-surface-2 text-2xl font-bold text-chalk transition-all duration-150 hover:border-pitch hover:text-pitch active:scale-95 active:bg-pitch active:text-ink"
    >
      {children}
    </button>
  );
}

/** One dropdown covering both squads, plus an "unknown scorer" per side. */
function PlayerSelect({
  home,
  away,
  squad,
  value,
  onChange,
  allowUnknown,
  name,
}: {
  home: Team;
  away: Team;
  squad: Player[];
  value: string;
  onChange: (next: string) => void;
  allowUnknown: boolean;
  name?: string;
}) {
  const bySide = useMemo(
    () =>
      [home, away].map((team) => ({
        team,
        players: squad
          .filter((p) => p.team_id === team.id)
          .sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99)),
      })),
    [home, away, squad],
  );

  return (
    <Select name={name} value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Choose a player…</option>
      {bySide.map(({ team, players }) => (
        <optgroup key={team.id} label={team.name}>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.jersey_number != null ? `${player.jersey_number}. ` : ''}
              {player.name}
            </option>
          ))}
          {allowUnknown ? (
            <option value={`unknown:${team.id}`}>— Unknown scorer ({team.short_name}) —</option>
          ) : null}
        </optgroup>
      ))}
    </Select>
  );
}

function GoalsSection({
  match,
  home,
  away,
  squad,
  goals,
}: {
  match: Match;
  home: Team;
  away: Team;
  squad: Player[];
  goals: Goal[];
}) {
  const [choice, setChoice] = useState('');
  const playerById = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);

  const unknown = choice.startsWith('unknown:');
  const playerId = unknown ? 'unknown' : choice;
  const teamId = unknown
    ? choice.slice('unknown:'.length)
    : (playerById.get(choice)?.team_id ?? home.id);

  const entered = {
    home: goals.filter((g) => g.team_id === home.id).length,
    away: goals.filter((g) => g.team_id === away.id).length,
  };
  const adds_up = entered.home === match.home_score && entered.away === match.away_score;

  return (
    <Section title={`Goals · ${goals.length}`}>
      {!adds_up ? (
        <p className="mb-3 rounded-lg border border-yellow-card/50 bg-yellow-card/10 px-3 py-2 text-xs font-medium text-yellow-card">
          Scorers entered ({entered.home}–{entered.away}) do not match the score ({match.home_score}–
          {match.away_score}).
        </p>
      ) : null}

      {goals.length > 0 ? (
        <ul className="glass mb-3 divide-y divide-line rounded-2xl border border-line">
          {goals.map((goal) => {
            const scorer = goal.player_id ? playerById.get(goal.player_id) : undefined;
            return (
              <li key={goal.id} className="flex items-center gap-2 px-3 py-2">
                <KitDot kit={kitFor(match, goal.team_id)} size={10} />
                <span className="min-w-0 flex-1 truncate text-sm text-chalk">
                  {scorer?.name ?? 'Unattributed'}
                  {goal.is_own_goal ? (
                    <span className="ml-1.5 text-[0.65rem] font-bold uppercase text-red-card">o.g.</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-faint tnum">
                  {goal.minute != null ? `${goal.minute}'` : '—'}
                </span>
                <InlineAction
                  action={deleteGoal}
                  id={goal.id}
                  confirm="Remove this goal?"
                  tone="ghost"
                >
                  Remove
                </InlineAction>
              </li>
            );
          })}
        </ul>
      ) : null}

      <ActionForm
        action={addGoal}
        resetOnSuccess
        onSuccess={() => setChoice('')}
        className="glass space-y-2.5 rounded-2xl border border-line p-3.5"
      >
        <input type="hidden" name="match_id" value={match.id} />
        <input type="hidden" name="player_id" value={playerId} />
        <input type="hidden" name="team_id" value={teamId} />

        <PlayerSelect
          home={home}
          away={away}
          squad={squad}
          value={choice}
          onChange={setChoice}
          allowUnknown
        />

        <div className="flex items-center gap-2">
          <TextInput
            name="minute"
            type="number"
            inputMode="numeric"
            min={0}
            max={130}
            placeholder="Min"
            className="w-20 shrink-0"
            aria-label="Minute"
          />
          <label className="flex min-h-[2.75rem] flex-1 cursor-pointer items-center gap-2 rounded-xl border border-line-bright bg-surface-2 px-3 text-xs font-semibold text-muted">
            <input
              type="checkbox"
              name="is_own_goal"
              value="true"
              className="h-4 w-4 accent-[var(--color-red-card)]"
            />
            Own goal
          </label>
        </div>

        <SubmitButton size="lg" className="w-full">
          Add goal
        </SubmitButton>
        <p className="text-[0.68rem] leading-relaxed text-faint">
          An own goal is credited to the other team&apos;s score and never appears in the
          scorer&apos;s tally. Pick the player who put it in.
        </p>
      </ActionForm>
    </Section>
  );
}

function CardsSection({
  match,
  home,
  away,
  squad,
  cards,
}: {
  match: Match;
  home: Team;
  away: Team;
  squad: Player[];
  cards: Card[];
}) {
  const [choice, setChoice] = useState('');
  const playerById = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);

  return (
    <Section title={`Cards · ${cards.length}`}>
      {cards.length > 0 ? (
        <ul className="glass mb-3 divide-y divide-line rounded-2xl border border-line">
          {cards.map((card) => (
            <li key={card.id} className="flex items-center gap-2 px-3 py-2">
              <span
                aria-hidden
                className={`h-3.5 w-2.5 shrink-0 rounded-[2px] ${
                  card.type === 'yellow' ? 'bg-yellow-card' : 'bg-red-card'
                }`}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-chalk">
                {playerById.get(card.player_id)?.name ?? 'Unknown player'}
              </span>
              <span className="shrink-0 text-xs text-faint tnum">
                {card.minute != null ? `${card.minute}'` : '—'}
              </span>
              <InlineAction action={deleteCard} id={card.id} confirm="Remove this card?" tone="ghost">
                Remove
              </InlineAction>
            </li>
          ))}
        </ul>
      ) : null}

      <ActionForm
        action={addCard}
        resetOnSuccess
        onSuccess={() => setChoice('')}
        className="glass space-y-2.5 rounded-2xl border border-line p-3.5"
      >
        <input type="hidden" name="match_id" value={match.id} />
        <input type="hidden" name="player_id" value={choice} />

        <PlayerSelect
          home={home}
          away={away}
          squad={squad}
          value={choice}
          onChange={setChoice}
          allowUnknown={false}
        />

        <div className="flex items-center gap-2">
          <TextInput
            name="minute"
            type="number"
            inputMode="numeric"
            min={0}
            max={130}
            placeholder="Min"
            className="w-20 shrink-0"
            aria-label="Minute"
          />
          <div className="flex-1">
            <Segmented
              name="type"
              defaultValue="yellow"
              columns={2}
              options={[
                { value: 'yellow', label: 'Yellow' },
                { value: 'red', label: 'Red' },
              ]}
            />
          </div>
        </div>

        <SubmitButton size="lg" className="w-full">
          Add card
        </SubmitButton>
        <p className="text-[0.68rem] leading-relaxed text-faint">
          Two yellows across the tournament, or one red, means a one match ban. Suspensions are
          worked out automatically.
        </p>
      </ActionForm>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
        <span aria-hidden className="h-3 w-[3px] rounded-full bg-pitch" />
        {title}
      </h2>
      {children}
    </section>
  );
}
