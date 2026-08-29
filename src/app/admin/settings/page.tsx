import type { Metadata } from 'next';
import { requireOrganiserPage } from '@/lib/auth';
import { getLiveSnapshot } from '@/lib/queries';
import { isGroupStageComplete } from '@/lib/standings';
import { SettingsForm } from '@/components/admin/settings-form';
import { ResetTools } from '@/components/admin/reset-tools';
import { resetDays } from '@/lib/reset';

export const metadata: Metadata = { title: 'Settings' };

export default async function AdminSettingsPage() {
  await requireOrganiserPage();
  const { settings, matches, goals, cards } = await getLiveSnapshot();

  const groupMatches = matches.filter((m) => m.stage === 'group');
  const played = groupMatches.filter((m) => m.status === 'completed' || m.status === 'walkover');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl uppercase leading-none text-chalk">Settings</h1>
        <p className="mt-0.5 text-xs text-muted">
          The name and tagline here are what a shared link previews with.
        </p>
      </header>

      <SettingsForm
        settings={settings}
        groupStageComplete={isGroupStageComplete(matches)}
        groupProgress={`${played.length} of ${groupMatches.length} group matches played`}
      />

      <ResetTools days={resetDays(matches, goals, cards)} />
    </div>
  );
}
