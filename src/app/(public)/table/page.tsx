import type { Metadata } from 'next';
import { getSnapshot } from '@/lib/queries';
import { buildStandings } from '@/lib/standings';
import { StandingsTable, TiebreakerNote } from '@/components/standings-table';
import { LastUpdated } from '@/components/last-updated';
import { ActionLink, EmptyState, Page, PageTitle, Pill } from '@/components/ui';

export const metadata: Metadata = { title: 'Table' };


/**
 * Served from cache for up to 30 seconds, so a hall full of people refreshing
 * during a match costs the database nothing. A save in the admin area calls
 * revalidatePath for this route, so a new scoreline appears at once rather
 * than waiting for the window to lapse.
 */
export const revalidate = 30;
export default async function TablePage() {
  const { teams, matches, fetchedAt } = await getSnapshot();
  const tables = buildStandings(teams, matches);

  return (
    <Page wide>
      <PageTitle
        title="Standings"
        subtitle={teams.length > 0 ? 'Win 3 points · Draw 1 · Loss 0' : undefined}
      />

      {teams.length === 0 ? (
        <EmptyState
          title="No teams registered yet"
          hint="The league table builds itself from results as soon as squads are entered and matches are played."
          action={<ActionLink href="/" tone="ghost">Back to home</ActionLink>}
        />
      ) : (
        <>
          {/* Two groups sit side by side on a laptop and stack on a phone. */}
          <div
            className={`gap-6 space-y-7 lg:space-y-0 ${
              tables.length > 1 ? 'lg:grid lg:grid-cols-2' : ''
            }`}
          >
            {tables.map((table) => (
              <section key={table.groupName ?? 'all'}>
                <div className="mb-2.5 flex items-center gap-2">
                  <h2 className="display text-2xl uppercase text-chalk">
                    {table.groupName ? `Group ${table.groupName}` : 'Unassigned teams'}
                  </h2>
                  {table.groupName && table.qualifyCount > 0 ? (
                    <Pill tone="gold">Top {table.qualifyCount} qualify</Pill>
                  ) : null}
                </div>
                <StandingsTable table={table} />
                {!table.groupName ? (
                  <p className="mt-2 text-[0.72rem] text-faint">
                    These teams have not been put in a group yet.
                  </p>
                ) : null}
              </section>
            ))}
          </div>
          <TiebreakerNote />
        </>
      )}

      <LastUpdated at={fetchedAt} />
    </Page>
  );
}
