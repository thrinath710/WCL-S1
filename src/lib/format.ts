/**
 * Date and number formatting.
 *
 * Every date is formatted in one fixed tournament timezone rather than the
 * reader's. Two reasons: kickoff times mean the local campus clock, and
 * pinning the zone means the server and the browser render the same string,
 * so nothing flickers or mismatches on hydration.
 */

export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE?.trim() || 'Asia/Kolkata';

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, ...options });

const timeFmt = fmt({ hour: 'numeric', minute: '2-digit', hour12: true });
const weekdayFmt = fmt({ weekday: 'short' });
const dayFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const longDayFmt = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const dayMonthFmt = fmt({ day: 'numeric', month: 'short' });
const dateKeyFmt = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });
const stampFmt = fmt({ day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

/** "7:30 pm" */
export const formatTime = (iso: string) => timeFmt.format(new Date(iso)).replace(/\s?([ap])m/i, ' $1m');

/** "Sat 14 Mar" */
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));

/** "Saturday 14 March" */
export const formatLongDay = (iso: string) => longDayFmt.format(new Date(iso));

/** "14 Mar" */
export const formatDayMonth = (iso: string) => dayMonthFmt.format(new Date(iso));

/** "Sat" */
export const formatWeekday = (iso: string) => weekdayFmt.format(new Date(iso));

/** "14 Mar, 7:30 pm" -- used for the last-updated stamp. */
export const formatStamp = (iso: string) => stampFmt.format(new Date(iso));

/** Stable YYYY-MM-DD key in tournament time, for grouping fixtures by day. */
export function dayKey(iso: string): string {
  const parts = dateKeyFmt.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "in 20 min", "3 h ago", "just now". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = new Date(iso).getTime() - now;
  const past = diffMs < 0;
  const mins = Math.round(Math.abs(diffMs) / 60_000);

  if (mins < 1) return 'just now';
  if (mins < 60) return past ? `${mins} min ago` : `in ${mins} min`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return past ? `${hours} h ago` : `in ${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return past ? 'yesterday' : 'tomorrow';
  if (days < 7) return past ? `${days} days ago` : `in ${days} days`;
  return formatDayMonth(iso);
}

/** "+3", "0", "-2" -- goal difference always carries its sign. */
export const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

/** "1.83" with a fixed number of places, so a column stays aligned. */
export const decimal = (value: number, places = 2) =>
  Number.isFinite(value) ? value.toFixed(places) : '0.00';

/** Readable initials fallback for a team with no logo. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

/**
 * ISO timestamp -> the value a <input type="datetime-local"> expects, in
 * tournament time. The inverse lives in lib/actions/fixtures.ts.
 */
export function toLocalInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}
