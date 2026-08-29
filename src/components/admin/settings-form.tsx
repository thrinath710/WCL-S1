'use client';

import { saveSettings } from '@/lib/actions/fixtures';
import type { TournamentSettings } from '@/lib/types';
import { ActionForm, Field, SubmitButton, TextArea, TextInput } from './form';

export function SettingsForm({
  settings,
  groupStageComplete,
  groupProgress,
}: {
  settings: TournamentSettings;
  groupStageComplete: boolean;
  groupProgress: string;
}) {
  return (
    <ActionForm action={saveSettings} className="space-y-3 glass rounded-2xl border border-line p-3.5">
      <Field label="Tournament name">
        <TextInput name="name" defaultValue={settings.name} required maxLength={80} />
      </Field>
      <Field label="Tagline" hint="One line. Appears on the home page and in link previews.">
        <TextInput name="tagline" defaultValue={settings.tagline ?? ''} maxLength={160} />
      </Field>
      <Field label="Prize note" hint="Optional. Shown in a highlighted box on the home page.">
        <TextArea name="prize_note" defaultValue={settings.prize_note ?? ''} rows={2} maxLength={300} />
      </Field>

      <div className="rounded-2xl border border-line-bright bg-surface-2 p-3.5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            name="is_knockout_unlocked"
            value="true"
            defaultChecked={settings.is_knockout_unlocked}
            className="mt-0.5 h-4 w-4 accent-[var(--color-pitch)]"
          />
          <span>
            <span className="block text-sm font-semibold text-chalk">Show the knockout bracket</span>
            <span className="mt-0.5 block text-[0.68rem] leading-relaxed text-faint">
              The bracket page is hidden from the public until this is on. It also opens by itself
              once every group match has a result. {groupProgress}
              {groupStageComplete ? ' — the group stage is finished.' : '.'}
            </span>
          </span>
        </label>
      </div>

      <SubmitButton size="lg" className="w-full">
        Save settings
      </SubmitButton>
    </ActionForm>
  );
}
