'use client';

import { useEffect, useState } from 'react';
import { formatStamp, relativeTime } from '@/lib/format';

/**
 * "Updated 2 min ago", on every page.
 *
 * The absolute stamp is rendered on the server so the markup matches on
 * hydration; the relative phrasing takes over in the browser and ticks along,
 * which is what actually tells a reader the score they are looking at is current.
 */
export function LastUpdated({ at }: { at: string }) {
  const [relative, setRelative] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setRelative(relativeTime(at));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [at]);

  return (
    <p className="mt-6 text-center text-[0.7rem] text-faint">
      Updated <time dateTime={at}>{relative ?? formatStamp(at)}</time>
    </p>
  );
}
