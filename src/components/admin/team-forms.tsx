'use client';

import { useState } from 'react';
import {
  createPlayer,
  createTeam,
  deletePlayer,
  deleteTeam,
  updatePlayer,
  updateTeam,
} from '@/lib/actions/teams';
import type { AdminPlayer, AdminTeam, PlayerPosition } from '@/lib/types';
import { MAX_SQUAD, MIN_SQUAD, PLAYER_POSITIONS } from '@/lib/types';
import { ActionForm, Field, InlineAction, Select, SubmitButton, TextInput } from './form';

const POSITION_LABEL: Record<PlayerPosition, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};


export function TeamCreateForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[3.25rem] w-full cursor-pointer rounded-xl bg-pitch text-sm font-bold text-ink shadow-[0_0_20px_var(--color-pitch-glow)] transition-colors duration-200 hover:bg-pitch-bright"
      >
        Add a team
      </button>
    );
  }

  return (
    <ActionForm
      action={createTeam}
      resetOnSuccess
      className="space-y-3 glass rounded-2xl border border-line p-3.5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">New team</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[2.25rem] cursor-pointer px-2 text-xs font-bold text-faint transition-colors hover:text-chalk"
        >
          Close
        </button>
      </div>
      <TeamFields />
      <SubmitButton size="lg" className="w-full">
        Add team
      </SubmitButton>
    </ActionForm>
  );
}

export function TeamEditForm({ team }: { team: AdminTeam }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">Details</h2>
      <ActionForm action={updateTeam} className="space-y-3 glass rounded-2xl border border-line p-3.5">
        <input type="hidden" name="id" value={team.id} />
        <TeamFields team={team} />
        <div className="flex items-center gap-2">
          <SubmitButton size="lg" className="flex-1">
            Save team
          </SubmitButton>
          <InlineAction
            action={deleteTeam}
            id={team.id}
            confirm={`Delete ${team.name}? Its whole squad and every match it appears in will be deleted too. This cannot be undone.`}
          >
            Delete team
          </InlineAction>
        </div>
      </ActionForm>
    </section>
  );
}

function TeamFields({ team }: { team?: AdminTeam }) {
  return (
    <>
      <Field label="Name">
        <TextInput name="name" defaultValue={team?.name ?? ''} required maxLength={80} placeholder="Hostel A Hurricanes" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Short name" hint="Exactly 3 characters. Used in tables.">
          <TextInput
            name="short_name"
            defaultValue={team?.short_name ?? ''}
            required
            maxLength={3}
            minLength={3}
            placeholder="HAH"
            className="uppercase"
          />
        </Field>
        <Field label="Group">
          <Select name="group_name" defaultValue={team?.group_name ?? ''}>
            <option value="">Not assigned</option>
            <option value="A">Group A</option>
            <option value="B">Group B</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Captain">
          <TextInput name="captain_name" defaultValue={team?.captain_name ?? ''} maxLength={80} />
        </Field>
        <Field label="Captain phone" hint="Never shown publicly.">
          <TextInput name="captain_phone" type="tel" defaultValue={team?.captain_phone ?? ''} maxLength={30} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tiebreak rank" hint="Last resort only, when everything else is level. Lower is better.">
          <TextInput
            name="tiebreak_override"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            defaultValue={team?.tiebreak_override ?? ''}
            placeholder="—"
          />
        </Field>
      </div>
    </>
  );
}

export function PlayerEditor({
  teamId,
  teamName,
  squad,
}: {
  teamId: string;
  teamName: string;
  squad: AdminPlayer[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const outOfRange = squad.length < MIN_SQUAD || squad.length > MAX_SQUAD;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
          Squad · {squad.length}
        </h2>
        {outOfRange ? (
          <span className="text-[0.7rem] font-semibold text-yellow-card">
            Rules say {MIN_SQUAD}–{MAX_SQUAD}
          </span>
        ) : null}
      </div>

      {squad.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {squad.map((player) => (
            <li key={player.id} className="glass rounded-2xl border border-line">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-7 shrink-0 text-center text-sm font-bold text-faint tnum">
                  {player.jersey_number ?? '–'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-chalk">
                    {player.name}
                    {player.is_captain ? (
                      <span className="ml-1.5 rounded bg-surface-3 px-1 text-[0.6rem] font-bold text-muted">
                        C
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-[0.68rem] text-faint">
                    {POSITION_LABEL[player.position]}
                    {player.roll_no ? ` · ${player.roll_no}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(editing === player.id ? null : player.id)}
                  className="min-h-[2.5rem] shrink-0 cursor-pointer rounded-lg border border-line-bright bg-surface-2 px-3.5 text-xs font-bold text-chalk transition-colors duration-200 hover:border-pitch-dim"
                >
                  {editing === player.id ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {editing === player.id ? (
                <ActionForm
                  action={updatePlayer}
                  onSuccess={() => setEditing(null)}
                  className="space-y-3 border-t border-line p-3"
                >
                  <input type="hidden" name="id" value={player.id} />
                  <input type="hidden" name="team_id" value={teamId} />
                  <PlayerFields player={player} />
                  <div className="flex items-center gap-2">
                    <SubmitButton className="flex-1">Save player</SubmitButton>
                    <InlineAction
                      action={deletePlayer}
                      id={player.id}
                      confirm={`Remove ${player.name} from ${teamName}? Their goals and cards go too.`}
                    >
                      Remove
                    </InlineAction>
                  </div>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 glass rounded-2xl border border-line px-3 py-5 text-center text-xs text-faint">
          No players yet.
        </p>
      )}

      <ActionForm
        action={createPlayer}
        resetOnSuccess
        className="space-y-3 glass rounded-2xl border border-line p-3.5"
      >
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Add a player</h3>
        <input type="hidden" name="team_id" value={teamId} />
        <PlayerFields />
        <SubmitButton size="lg" className="w-full">
          Add player
        </SubmitButton>
      </ActionForm>
    </section>
  );
}

function PlayerFields({ player }: { player?: AdminPlayer }) {
  return (
    <>
      <Field label="Name">
        <TextInput name="name" defaultValue={player?.name ?? ''} required maxLength={80} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Position">
          <Select name="position" defaultValue={player?.position ?? 'MID'}>
            {PLAYER_POSITIONS.map((position) => (
              <option key={position} value={position}>
                {POSITION_LABEL[position]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Shirt number">
          <TextInput
            name="jersey_number"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            defaultValue={player?.jersey_number ?? ''}
            placeholder="—"
          />
        </Field>
      </div>
      <Field label="Roll number" hint="From the registration form. Never shown publicly.">
        <TextInput name="roll_no" defaultValue={player?.roll_no ?? ''} maxLength={30} />
      </Field>
      <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded-xl border border-line-bright bg-surface-2 px-3 text-xs font-semibold text-muted">
        <input
          type="checkbox"
          name="is_captain"
          value="true"
          defaultChecked={player?.is_captain ?? false}
          className="h-4 w-4 accent-[var(--color-pitch)]"
        />
        Squad captain
      </label>
    </>
  );
}
