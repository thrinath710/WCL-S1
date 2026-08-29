import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminSession, ROLE_LABEL } from '@/lib/auth';
import { signOut } from '@/lib/actions/auth';
import { PitchBackdrop, Football } from '@/components/pitch-backdrop';
import { AdminNav } from '@/components/admin/admin-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  // The control room is never indexed and never previewed.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const session = await getAdminSession();

  return (
    <div className="min-h-screen">
      <PitchBackdrop />

      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex max-w-4xl items-center gap-2.5 px-4 py-3">
          <Football size={22} className="shrink-0 text-pitch" />
          <Link href="/admin" className="display text-lg uppercase leading-none text-chalk">
            Control room
          </Link>
          <Link
            href="/"
            className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-bold text-pitch transition-colors hover:text-pitch-bright"
          >
            View site →
          </Link>
          {session ? (
            <span className="ml-auto hidden rounded-full border border-line-bright bg-surface-2 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-muted sm:inline-block">
              {ROLE_LABEL[session.role]}
            </span>
          ) : null}
          {session ? (
            <form action={signOut} className="ml-auto sm:ml-2">
              <button
                type="submit"
                className="min-h-[2.25rem] cursor-pointer rounded-lg px-2.5 text-xs font-bold text-muted transition-colors hover:text-chalk"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>

        {session ? <AdminNav role={session.role} /> : null}
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-5 pb-20">{children}</main>
    </div>
  );
}
