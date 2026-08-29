import Link from 'next/link';
import { BottomTabs, DeskNav } from '@/components/bottom-tabs';
import { PitchBackdrop, Football } from '@/components/pitch-backdrop';
import { getSnapshot } from '@/lib/queries';
import { isGroupStageComplete } from '@/lib/standings';

/**
 * Public pages are cached, not rendered fresh.
 *
 * This segment used to be `force-dynamic`, on the reasoning that a database
 * round trip per view costs nothing. That holds for a quiet afternoon and
 * breaks in the hall: two hundred people refreshing between kickoffs is two
 * hundred queries, on a free tier, at the exact moment the site matters.
 *
 * Nothing is given up by caching it. Every page carries `revalidate = 30`, and
 * every admin save calls `updateTag` on the snapshot plus `revalidatePath` for
 * the routes that show a score -- so a corrected scoreline is still right on
 * the next load. The window only ever applies when nobody is editing.
 *
 * Note that `force-dynamic` here would silently override the `revalidate` on
 * each page: a layout's dynamic setting wins over its children.
 */
export const revalidate = 30;

export default async function PublicLayout({ children }: LayoutProps<'/'>) {
  const { settings, matches } = await getSnapshot();
  const bracketReady = settings.is_knockout_unlocked || isGroupStageComplete(matches);

  return (
    <>
      <PitchBackdrop />

      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="group flex min-w-0 flex-1 items-center gap-2.5">
            <Football
              size={26}
              className="shrink-0 text-pitch transition-transform duration-500 group-hover:rotate-180"
            />
            <span className="min-w-0">
              <span className="display block truncate text-lg uppercase leading-none text-chalk sm:text-xl">
                {settings.name}
              </span>
              {settings.tagline ? (
                <span className="mt-0.5 block truncate text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-pitch">
                  {settings.tagline}
                </span>
              ) : null}
            </span>
          </Link>

          <DeskNav showBracket={bracketReady} />

          {/* Mobile keeps only what the tab bar cannot hold. */}
          <nav aria-label="Secondary" className="flex shrink-0 items-center gap-1 lg:hidden">
            <TopLink href="/teams">Teams</TopLink>
            {bracketReady ? <TopLink href="/bracket">Bracket</TopLink> : null}
          </nav>
        </div>
      </header>

      <main>{children}</main>
      <BottomTabs />
    </>
  );
}

function TopLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-bold text-muted transition-colors duration-200 active:bg-surface-2 active:text-pitch"
    >
      {children}
    </Link>
  );
}
