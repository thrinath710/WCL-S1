'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type Tab = {
  href: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
};

/**
 * Four destinations, no hamburger. Standings are always one tap away.
 * Teams and Bracket live in the header, where there is room for them.
 */
const TABS: Tab[] = [
  {
    href: '/',
    label: 'Home',
    match: (p) => p === '/',
    icon: <path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  },
  {
    href: '/fixtures',
    label: 'Fixtures',
    match: (p) => p.startsWith('/fixtures') || p.startsWith('/match'),
    icon: (
      <path d="M7 2v3M17 2v3M3.5 8.5h17M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    ),
  },
  {
    href: '/table',
    label: 'Table',
    match: (p) => p.startsWith('/table') || p.startsWith('/bracket'),
    icon: <path d="M3 5h18M3 12h18M3 19h18M9 5v14" />,
  },
  {
    href: '/stats',
    label: 'Stats',
    match: (p) => p.startsWith('/stats') || p.startsWith('/teams'),
    icon: <path d="M5 21V10M12 21V3M19 21v-7" />,
  },
];

/** Mobile only. The desktop equivalent lives in the header. */
export function BottomTabs() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Primary"
      className="glass safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-line lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                /* min-h keeps every tap target comfortably past 44px. */
                className={`relative flex min-h-[3.4rem] cursor-pointer flex-col items-center justify-center gap-1 py-2 text-[0.66rem] font-bold tracking-wide transition-colors duration-200 ${
                  active ? 'text-pitch' : 'text-faint active:text-muted'
                }`}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-pitch shadow-[0_0_10px_var(--color-pitch)]"
                  />
                ) : null}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.3 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-[1.3rem] w-[1.3rem] transition-transform duration-200 ${
                    active ? '-translate-y-px scale-110' : ''
                  }`}
                  aria-hidden
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Desktop navigation, in the header.
 *
 * The destinations are not simply the mobile tabs plus two: with only four
 * tabs to spend, the phone folds Teams under Stats and Bracket under Table.
 * Desktop has room to list them separately, so each item matches only its own
 * section -- otherwise visiting /teams would light up Stats and Teams at once.
 */
export function DeskNav({ showBracket }: { showBracket: boolean }) {
  const pathname = usePathname() ?? '/';
  const items: { href: string; label: string; match: (p: string) => boolean }[] = [
    { href: '/', label: 'Home', match: (p) => p === '/' },
    { href: '/fixtures', label: 'Fixtures', match: (p) => p.startsWith('/fixtures') || p.startsWith('/match') },
    { href: '/table', label: 'Table', match: (p) => p.startsWith('/table') },
    { href: '/stats', label: 'Stats', match: (p) => p.startsWith('/stats') },
    { href: '/teams', label: 'Teams', match: (p) => p.startsWith('/teams') },
    ...(showBracket
      ? [{ href: '/bracket', label: 'Bracket', match: (p: string) => p.startsWith('/bracket') }]
      : []),
  ];

  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative block cursor-pointer rounded-lg px-3.5 py-2 text-sm font-bold transition-colors duration-200 ${
                  active ? 'text-pitch' : 'text-muted hover:text-chalk'
                }`}
              >
                {item.label}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-pitch shadow-[0_0_10px_var(--color-pitch)]"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
