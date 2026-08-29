'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; exact?: boolean; organiserOnly?: boolean };

const ITEMS: Item[] = [
  { href: '/admin', label: 'Today', exact: true },
  { href: '/admin/fixtures', label: 'Fixtures' },
  { href: '/admin/knockout', label: 'Knockout' },
  { href: '/admin/teams', label: 'Teams', organiserOnly: true },
  { href: '/admin/settings', label: 'Settings', organiserOnly: true },
];

export function AdminNav({ role }: { role: 'admin' | 'host' }) {
  const pathname = usePathname() ?? '/admin';
  const items = ITEMS.filter((item) => role === 'admin' || !item.organiserOnly);

  return (
    <nav aria-label="Admin" className="scroll-x mx-auto max-w-4xl px-4 pb-2.5">
      <ul className="flex gap-1.5">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block shrink-0 cursor-pointer rounded-lg border px-3.5 py-2 text-xs font-bold transition-all duration-200 ${
                  active
                    ? 'border-pitch bg-pitch text-ink'
                    : 'border-line bg-surface-2 text-muted hover:border-pitch-dim hover:text-chalk'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
