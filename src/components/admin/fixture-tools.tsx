'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  createMatch,
  deleteMatch,
  generateGroupFixtures,
  updateKickoff,
  updateMatch,
} from '@/lib/actions/fixtures';
import type { GroupName, MatchStage, MatchStatus, Team } from '@/lib/types';
import { STAGE_LABEL } from '@/lib/types';
import {
  ActionForm,
  Field,
  InlineAction,
  Select,
  SubmitButton,
  TextInput,
} from './form';

export type FixtureRow = {
  id: string;
  label: string;
  stage: MatchStage;
  group_name: GroupName | null;
  home_team_id: string;
  away_team_id: string;
  kickoffLocal: string;
  kickoffLabel: string;
  pitch: string | null;
  status: MatchStatus;
  score: string | null;
  stageLabel: string;
  scorersAddUp: boolean;
};

export function FixtureTools({
  teams,
  groups,
  stages,
  matches,
  canManage,
}: {
  teams: Team[];
  groups: GroupName[];
  stages: MatchStage[];
  matches: FixtureRow[];
  /**
   * False for a match host. They run the evening -- times, courts, sides and
   * results -- but the published schedule itself is the organiser's, so the
   * buttons that add and remove fixtures are simply not rendered for them.
   * The server actions behind those buttons check the role again anyway.
   */
  canManage: boolean;
}) {
  const [open, setOpen] = useState<'generate' | 'create' | null>(null);

  return (
    <>
      {canManage ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Toggle active={open === 'generate'} onClick={() => setOpen(open === 'generate' ? null : 'generate')}>
              Generate group fixtures
            </Toggle>
            <Toggle active={open === 'create'} onClick={() => setOpen(open === 'create' ? null : 'create')}>
              Add one match
            </Toggle>
          </div>

          {open === 'generate' ? <GenerateForm groups={groups} /> : null}
          {open === 'create' ? <CreateForm teams={teams} stages={stages} /> : null}
        </>
      ) : null}

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
          All matches
        </h2>
        {matches.length === 0 ? (
          <p className="glass rounded-2xl border border-line px-3 py-5 text-center text-xs text-faint">
            No fixtures yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {matches.map((match) => (
              <FixtureCard key={match.id} match={match} teams={teams} canManage={canManage} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`min-h-[3rem] cursor-pointer rounded-xl border px-3 text-xs font-bold transition-all duration-200 ${
        active
          ? 'border-pitch bg-pitch text-ink shadow-[0_0_16px_var(--color-pitch-glow)]'
          : 'border-line-bright bg-surface-2 text-chalk hover:border-pitch-dim'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Round-robins a whole group in one press. Times are set from a first
 * kickoff and a gap, and can be corrected per match afterwards.
 */
function GenerateForm({ groups }: { groups: GroupName[] }) {
  const options = groups.length > 0 ? groups : (['A', 'B'] as GroupName[]);
  return (
    <ActionForm
      action={generateGroupFixtures}
      className="glass space-y-3.5 rounded-2xl border border-pitch-dim bg-pitch-glow p-3.5"
    >
      <p className="text-xs leading-relaxed text-pitch-bright">
        Creates every match within a group, once per pairing. Ties that already exist are skipped,
        so running it again is safe.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Group">
          <Select name="group_name" defaultValue={options[0]} required>
            {options.map((group) => (
              <option key={group} value={group}>
                Group {group}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Gap (minutes)">
          <TextInput name="minutes_between" type="number" inputMode="numeric" min={5} max={240} defaultValue={45} />
        </Field>
      </div>
      <Field label="First kickoff">
        <TextInput name="first_kickoff" type="datetime-local" required />
      </Field>
      <Field label="Pitch" hint="Optional. Applied to every generated match.">
        <TextInput name="pitch" placeholder="Main Ground" maxLength={60} />
      </Field>
      <SubmitButton size="lg" className="w-full">
        Generate fixtures
      </SubmitButton>
    </ActionForm>
  );
}

function CreateForm({ teams, stages }: { teams: Team[]; stages: MatchStage[] }) {
  const [stage, setStage] = useState<MatchStage>('group');

  return (
    <ActionForm
      action={createMatch}
      resetOnSuccess
      className="space-y-3 glass rounded-2xl border border-line p-3.5"
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Stage">
          <Select
            name="stage"
            value={stage}
            onChange={(event) => setStage(event.target.value as MatchStage)}
          >
            {stages.map((value) => (
              <option key={value} value={value}>
                {STAGE_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Group" hint={stage === 'group' ? undefined : 'Knockout matches have no group.'}>
          <Select name="group_name" disabled={stage !== 'group'} defaultValue="A">
            <option value="A">A</option>
            <option value="B">B</option>
          </Select>
        </Field>
      </div>

      <Field label="Home team">
        <Select name="home_team_id" required defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Away team">
        <Select name="away_team_id" required defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kickoff">
          <TextInput name="kickoff_at" type="datetime-local" required />
        </Field>
        <Field label="Pitch">
          <TextInput name="pitch" placeholder="Main Ground" maxLength={60} />
        </Field>
      </div>
      <SubmitButton size="lg" className="w-full">
        Create match
      </SubmitButton>
    </ActionForm>
  );
}

function FixtureCard({
  match,
  teams,
  canManage,
}: {
  match: FixtureRow;
  teams: Team[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<'time' | 'sides' | null>(null);

  return (
    <li className="glass rounded-2xl border border-line">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Link href={`/admin/matches/${match.id}`} className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-chalk">{match.label}</span>
          <span className="block truncate text-[0.68rem] text-faint tnum">
            {match.stageLabel} · {match.kickoffLabel}
            {match.pitch ? ` · ${match.pitch}` : ''}
          </span>
        </Link>
        {!match.scorersAddUp ? (
          <span
            title="Scorers do not add up to the score"
            className="shrink-0 text-sm text-yellow-card"
          >
            ⚠
          </span>
        ) : null}
        <span className="score shrink-0 text-lg text-chalk">{match.score ?? '–'}</span>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <Link
          href={`/admin/matches/${match.id}`}
          className="inline-flex min-h-[2.5rem] cursor-pointer items-center rounded-lg bg-pitch px-3.5 text-xs font-bold text-ink transition-colors duration-200 hover:bg-pitch-bright"
        >
          Enter result
        </Link>
        <button
          type="button"
          onClick={() => setEditing((value) => (value === 'time' ? null : 'time'))}
          className="min-h-[2.5rem] cursor-pointer rounded-lg border border-line-bright bg-surface-2 px-3.5 text-xs font-bold text-chalk transition-colors duration-200 hover:border-pitch-dim"
        >
          {editing === 'time' ? 'Cancel' : 'Time & pitch'}
        </button>
        <button
          type="button"
          onClick={() => setEditing((value) => (value === 'sides' ? null : 'sides'))}
          className="min-h-[2.5rem] cursor-pointer rounded-lg border border-line-bright bg-surface-2 px-3.5 text-xs font-bold text-chalk transition-colors duration-200 hover:border-pitch-dim"
        >
          {editing === 'sides' ? 'Cancel' : 'Teams & kit'}
        </button>
        {canManage ? (
          <span className="ml-auto">
            <InlineAction
              action={deleteMatch}
              id={match.id}
              confirm={`Delete ${match.label}? Its goals and cards go with it. This cannot be undone.`}
            >
              Delete
            </InlineAction>
          </span>
        ) : null}
      </div>

      {editing === 'time' ? (
        <ActionForm action={updateKickoff} className="space-y-2 border-t border-line p-3">
          <input type="hidden" name="id" value={match.id} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kickoff">
              <TextInput name="kickoff_at" type="datetime-local" defaultValue={match.kickoffLocal} required />
            </Field>
            <Field label="Pitch">
              <TextInput name="pitch" defaultValue={match.pitch ?? ''} maxLength={60} />
            </Field>
          </div>
          <SubmitButton className="w-full">Save time</SubmitButton>
        </ActionForm>
      ) : null}

      {editing === 'sides' ? <SidesForm match={match} teams={teams} /> : null}
    </li>
  );
}

/**
 * Change who is playing, and with it who wears which shirt.
 *
 * Home and away are not cosmetic here: the home side wears dark and the away
 * side light, which is what the black and white boxes on the fixture sheet
 * mean. Swapping the two is therefore how a kit clash gets fixed, and the
 * form says so rather than leaving it to be discovered.
 */
function SidesForm({ match, teams }: { match: FixtureRow; teams: Team[] }) {
  return (
    <ActionForm action={updateMatch} className="space-y-2 border-t border-line p-3">
      <input type="hidden" name="id" value={match.id} />
      <input type="hidden" name="stage" value={match.stage} />
      <input type="hidden" name="group_name" value={match.group_name ?? ''} />
      <input type="hidden" name="kickoff_at" value={match.kickoffLocal} />
      <input type="hidden" name="pitch" value={match.pitch ?? ''} />

      <p className="text-[0.68rem] leading-relaxed text-faint">
        The home side wears <span className="font-bold text-chalk">dark</span>, the away side{' '}
        <span className="font-bold text-chalk">light</span>. Swap them to swap the kits.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Home · dark">
          <Select name="home_team_id" defaultValue={match.home_team_id} required>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Away · light">
          <Select name="away_team_id" defaultValue={match.away_team_id} required>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <SubmitButton className="w-full">Save teams</SubmitButton>
    </ActionForm>
  );
}
