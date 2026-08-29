'use client';

import { useEffect, useState } from 'react';

/**
 * A scoreline that animates when the number changes.
 *
 * The digit is server-rendered as plain text, so the correct score is on the
 * page before any JavaScript runs and is what a crawler or a link preview
 * sees. The animation is purely additive: when a poll or a navigation brings
 * a new value in, the digit pops rather than silently swapping, which is the
 * difference between a reader noticing a goal and missing it.
 */
export function AnimatedNumber({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  const [previous, setPrevious] = useState(value);
  const [changed, setChanged] = useState(false);

  // Adjusting state during render is React's recommended way to respond to a
  // changed prop -- an effect would render twice and flash the old number.
  // On first mount previous === value, so a page load never animates.
  if (value !== previous) {
    setPrevious(value);
    setChanged(true);
  }

  useEffect(() => {
    if (!changed) return;
    const timer = setTimeout(() => setChanged(false), 500);
    return () => clearTimeout(timer);
  }, [changed]);

  return (
    <span className={`inline-block ${changed ? 'animate-score' : ''} ${className}`}>
      {value}
    </span>
  );
}

/**
 * The canonical scoreline: two numbers and a separator, in the display face.
 * `size` maps to the three places a score appears -- a hero, a card, a row.
 */
export function ScoreLine({
  home,
  away,
  size = 'md',
  tone = 'default',
  label,
}: {
  home: number;
  away: number;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  tone?: 'default' | 'live';
  label?: string;
}) {
  const sizes = {
    sm: 'text-2xl gap-1',
    md: 'text-[2.4rem] gap-1.5',
    lg: 'text-[3.2rem] gap-2',
    hero: 'text-[4rem] sm:text-[5rem] gap-2.5',
  } as const;

  return (
    <span
      className={`score inline-flex items-baseline ${sizes[size]} ${
        tone === 'live' ? 'text-live' : 'text-chalk'
      }`}
      aria-label={label}
    >
      <AnimatedNumber value={home} />
      <span className="text-muted opacity-60" aria-hidden>
        –
      </span>
      <AnimatedNumber value={away} />
    </span>
  );
}
