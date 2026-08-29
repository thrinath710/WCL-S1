import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrganiserPage } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getLiveSnapshot } from '@/lib/queries';
import type { AdminPlayer, AdminTeam } from '@/lib/types';
import { PlayerEditor, TeamEditForm } from '@/components/admin/team-forms';

export const metadata: Metadata = { title: 'Edit team' };

export default async function AdminTeamPage(props: PageProps<'/admin/teams/[id]'>) {
  await requireOrganiserPage();
  const { id } = await props.params;

  const snapshot = await getLiveSnapshot();
  const base = snapshot.teams.find((t) => t.id === id);
  if (!base) notFound();

  // The admin screen is the one place the registration-form details -- the
  // captain's phone and the players' roll numbers -- are read back, so they
  // are fetched with the service-role client rather than the public one.
  const db = createSupabaseAdminClient();
  let team: AdminTeam = { ...base, captain_phone: null };
  let squad: AdminPlayer[] = snapshot.players
    .filter((p) => p.team_id === id)
    .map((p) => ({ ...p, roll_no: null }));

  if (db) {
    const [teamRow, playerRows] = await Promise.all([
      db.from('teams').select('*').eq('id', id).maybeSingle(),
      db.from('players').select('*').eq('team_id', id),
    ]);
    if (teamRow.data) team = teamRow.data as AdminTeam;
    if (playerRows.data) squad = playerRows.data as AdminPlayer[];
  }

  squad = [...squad].sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));

  return (
    <div className="space-y-6">
      <Link href="/admin/teams" className="inline-block text-xs font-semibold text-pitch">
        ← All teams
      </Link>

      <header>
        <h1 className="display text-4xl uppercase leading-none text-chalk">{team.name}</h1>
        <Link href={`/teams/${team.id}`} className="mt-1 inline-block text-xs font-semibold text-pitch">
          View public page →
        </Link>
      </header>

      <TeamEditForm team={team} />
      <PlayerEditor teamId={team.id} teamName={team.name} squad={squad} />
    </div>
  );
}
