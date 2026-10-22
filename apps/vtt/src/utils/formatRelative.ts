/**
 * @file formatRelative.ts
 * @description Compact relative-time labels ("3 days ago") for dashboard cards.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const plural = (n: number, unit: string): string =>
  `${n} ${unit}${n === 1 ? '' : 's'} ago`;

/**
 * Format an ISO date (or Date) relative to `now`. Returns an empty string for
 * missing or unparseable input so callers can simply hide the label.
 */
export const formatRelative = (
  value: string | Date | null | undefined,
  now: number = Date.now(),
): string => {
  if (!value) return '';
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(time)) return '';

  const diff = Math.max(0, now - time);
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return plural(Math.floor(diff / MINUTE), 'minute');
  if (diff < DAY) return plural(Math.floor(diff / HOUR), 'hour');
  if (diff < WEEK) return plural(Math.floor(diff / DAY), 'day');
  if (diff < MONTH) return plural(Math.floor(diff / WEEK), 'week');
  if (diff < YEAR) return plural(Math.floor(diff / MONTH), 'month');
  return plural(Math.floor(diff / YEAR), 'year');
};
