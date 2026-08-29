import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Team } from '@/lib/types';
import { KIT_LABEL, type Kit } from '@/lib/kit';
import { Football } from './pitch-backdrop';

/**
 * Page shell.
 *
 * One column on a phone, widening to a comfortable reading measure on a
 * laptop. Pages that benefit from a second column opt into `wide`.
 */
export function Page({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`mx-auto w-full px-4 pb-tabbar pt-5 sm:px-6 ${
        wide ? 'max-w-6xl' : 'max-w-3xl'
      }`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="animate-rise mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="display text-4xl uppercase text-chalk sm:text-5xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-7 ${className}`}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-muted">
          <span aria-hidden className="h-3 w-[3px] rounded-full bg-pitch" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({
  children,
  className = '',
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'pitch' | 'gold' | 'live';
}) {
  const tones = {
    default: 'border-line',
    pitch: 'border-pitch-dim bg-pitch-glow',
    gold: 'border-gold-dim bg-gold-glow',
    live: 'border-live/45 bg-live/[0.07]',
  } as const;
  return (
    <div className={`glass rounded-2xl border ${tones[tone]} ${className}`}>{children}</div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="animate-rise px-5 py-10 text-center">
      <Football size={44} drift className="mx-auto mb-4 text-pitch opacity-50" />
      <p className="text-base font-semibold text-chalk">{title}</p>
      {hint ? <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Panel>
  );
}

/**
 * Kit swatches.
 *
 * A team has no colour of its own -- it wears dark at home and light away, so
 * every one of these takes the kit for a particular match. `null` means there
 * is no match in view (a league table, a squad page), and draws a neutral
 * marker rather than implying a shirt the team is not wearing.
 */
const KIT_FILL: Record<Kit, string> = { dark: '#14181c', light: '#eef1ed' };
const KIT_EDGE: Record<Kit, string> = {
  dark: 'rgba(255,255,255,0.38)',
  light: 'rgba(0,0,0,0.35)',
};
const NEUTRAL_FILL = '#4b5563';

/** The kit for one side of a match, where the name is already shown. */
export function KitDot({ kit, size = 12 }: { kit: Kit | null; size?: number }) {
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: kit ? KIT_FILL[kit] : NEUTRAL_FILL,
        boxShadow: `inset 0 0 0 1px ${kit ? KIT_EDGE[kit] : 'rgba(255,255,255,0.15)'}`,
      }}
    />
  );
}

/** The same thing as a shirt. */
export function JerseySwatch({ kit, size = 'md' }: { kit: Kit | null; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 14 : 20;
  return (
    <svg aria-hidden width={px} height={px} viewBox="0 0 24 24" className="shrink-0">
      <path
        d="M8 3 L4 5.5 L5.5 9 L7 8.5 V20 a1 1 0 0 0 1 1 h8 a1 1 0 0 0 1-1 V8.5 L18.5 9 L20 5.5 L16 3 a4 4 0 0 1-8 0 Z"
        fill={kit ? KIT_FILL[kit] : NEUTRAL_FILL}
        stroke={kit ? KIT_EDGE[kit] : 'rgba(255,255,255,0.22)'}
        strokeWidth="1"
      />
    </svg>
  );
}

/**
 * Which shirt to bring, said in words.
 *
 * The dot alone is ambiguous on a dark page -- a black circle can read as an
 * empty one -- and this is the one piece of information a player checks the
 * site for on the way to the court, so it is spelled out.
 */
export function KitTag({ kit }: { kit: Kit }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: kit === 'dark' ? 'rgba(20,24,28,0.9)' : 'rgba(238,241,237,0.92)',
        borderColor: KIT_EDGE[kit],
        color: kit === 'dark' ? '#e6ebe6' : '#14181c',
      }}
    >
      {KIT_LABEL[kit]}
    </span>
  );
}

/**
 * A team's badge: its three-letter code, in the kit it is wearing when there
 * is a match in view and in the site's own colours when there is not.
 */
export function TeamCrest({ team, size = 38, kit = null }: { team: Team; size?: number; kit?: Kit | null }) {
  const style = kit
    ? {
        width: size,
        height: size,
        backgroundColor: KIT_FILL[kit],
        borderColor: KIT_EDGE[kit],
        color: kit === 'dark' ? '#e6ebe6' : '#14181c',
      }
    : {
        width: size,
        height: size,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.14)',
        color: '#cbd5cb',
      };

  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl border text-[0.62rem] font-extrabold tracking-tight tnum"
      style={style}
      aria-hidden
    >
      {team.short_name}
    </span>
  );
}

/**
 * A team's name, which collapses to its three letter short name when space is
 * tight. Both are rendered and one is hidden by CSS, so there is no layout
 * shift and no JavaScript involved.
 */
export function TeamName({
  team,
  className = '',
}: {
  team: Team | undefined;
  className?: string;
}) {
  if (!team) return <span className={className}>TBD</span>;
  return (
    <span className={className}>
      <span className="hidden truncate sm:inline">{team.name}</span>
      <span className="tnum sm:hidden">{team.short_name}</span>
    </span>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'pitch' | 'gold' | 'live' | 'warn' | 'danger';
}) {
  const tones = {
    neutral: 'border-line bg-surface-2 text-muted',
    pitch: 'border-pitch-dim bg-pitch-glow text-pitch',
    gold: 'border-gold-dim bg-gold-glow text-gold',
    live: 'border-live/45 bg-live/10 text-live',
    warn: 'border-yellow-card/40 bg-yellow-card/10 text-yellow-card',
    danger: 'border-red-card/45 bg-red-card/10 text-red-card',
  } as const;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.09em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="live-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-live/45 bg-live/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.09em] text-live">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" aria-hidden />
      Live
    </span>
  );
}

/** Last five results, newest last, as W/D/L pills. */
export function FormPills({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (form.length === 0) return <span className="text-xs text-faint">—</span>;

  const tone = {
    W: 'bg-pitch text-ink',
    D: 'bg-surface-3 text-muted ring-1 ring-inset ring-line-bright',
    L: 'bg-red-card/85 text-ink',
  } as const;

  return (
    <span className="flex items-center gap-[3px]" aria-label={`Form: ${form.join(', ')}`}>
      {form.map((result, i) => (
        <span
          key={i}
          aria-hidden
          style={{ '--i': i } as React.CSSProperties}
          className={`animate-rise stagger grid h-[17px] w-[17px] place-items-center rounded text-[0.58rem] font-extrabold ${tone[result]}`}
        >
          {result}
        </span>
      ))}
    </span>
  );
}

export function CardGlyph({ type }: { type: 'yellow' | 'red' }) {
  return (
    <span
      aria-label={`${type} card`}
      title={`${type} card`}
      className={`inline-block h-3.5 w-[10px] rotate-[7deg] rounded-[2px] align-middle shadow-sm ${
        type === 'yellow' ? 'bg-yellow-card' : 'bg-red-card'
      }`}
    />
  );
}

/** Primary call to action, used sparingly. */
export function ActionLink({
  href,
  children,
  tone = 'pitch',
}: {
  href: string;
  children: ReactNode;
  tone?: 'pitch' | 'ghost';
}) {
  const tones = {
    pitch: 'bg-pitch text-ink hover:bg-pitch-bright',
    ghost: 'border border-line-bright bg-surface-2 text-chalk hover:border-pitch-dim',
  } as const;
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[2.75rem] cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors duration-200 ${tones[tone]}`}
    >
      {children}
    </Link>
  );
}

/** Small inline "see all" link that sits beside a section heading. */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-pitch transition-colors hover:text-pitch-bright"
    >
      {children}
      <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
