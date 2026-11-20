/**
 * Calendar-week helpers for activity data.
 *
 * Activity dates come from `start_date_local`, which is a wall-clock date
 * without an offset. Week grouping therefore treats the recorded date as a
 * floating calendar date and performs all arithmetic in UTC. This keeps week
 * keys independent of the viewer's timezone and of daylight-saving changes.
 */

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const MS_PER_DAY = 86_400_000;

const WEEK_START_NAMES: Record<string, WeekStart> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDateParts(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [year, month, day];
}

function formatDate(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

export function dateKeyToUtcMs(key: string): number {
  const parts = parseDateParts(key);
  if (!parts) throw new Error(`Invalid date key: ${key}`);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

export function addDays(key: string, days: number): string {
  return formatDate(dateKeyToUtcMs(key) + days * MS_PER_DAY);
}

export function addWeeks(key: string, weeks: number): string {
  return addDays(key, weeks * 7);
}

/**
 * Returns the `YYYY-MM-DD` start date of the week containing `date`.
 * The key is unique for a calendar week, including weeks that span New Year.
 * Invalid dates return an empty string.
 */
export function weekKey(date: string, weekStartsOn: WeekStart): string {
  const parts = parseDateParts(date);
  if (!parts) return '';

  const [year, month, day] = parts;
  const ms = Date.UTC(year, month - 1, day);
  const dayOfWeek = new Date(ms).getUTCDay();
  const diff = (dayOfWeek - weekStartsOn + 7) % 7;

  return formatDate(ms - diff * MS_PER_DAY);
}

/**
 * ISO-style week-year: the year containing the week's fourth day.
 * For Monday-start weeks this is exactly the ISO 8601 week-year.
 */
export function weekYear(weekStartKey: string): number {
  return Number(addDays(weekStartKey, 3).slice(0, 4));
}

export function weeksBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (dateKeyToUtcMs(toKey) - dateKeyToUtcMs(fromKey)) / (7 * MS_PER_DAY)
  );
}

/**
 * Week number within the week-year. Week 1 is the week containing Jan 4,
 * which matches ISO 8601 when weeks start on Monday.
 */
export function weekNumber(
  weekStartKey: string,
  weekStartsOn: WeekStart
): number {
  const year = weekYear(weekStartKey);
  const firstWeek = weekKey(`${year}-01-04`, weekStartsOn);
  return weeksBetween(firstWeek, weekStartKey) + 1;
}

export function formatWeekLabel(
  weekStartKey: string,
  weekStartsOn: WeekStart
): string {
  const week = weekNumber(weekStartKey, weekStartsOn);
  return `${weekYear(weekStartKey)}-W${String(week).padStart(2, '0')}`;
}

/** Rotates a Sunday-first label array so it starts on `weekStartsOn`. */
export function rotateWeekdays<T>(
  labels: readonly T[],
  weekStartsOn: WeekStart
): T[] {
  return Array.from({ length: 7 }, (_, i) => labels[(weekStartsOn + i) % 7]);
}

export function longestWeekStreak(
  dates: readonly string[],
  weekStartsOn: WeekStart
): number {
  const keys = [
    ...new Set(
      dates.map((date) => weekKey(date, weekStartsOn)).filter(Boolean)
    ),
  ].sort();

  let longest = 0;
  let run = 0;

  for (let i = 0; i < keys.length; i++) {
    run = i > 0 && addWeeks(keys[i - 1], 1) === keys[i] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  return longest;
}

/**
 * Counts consecutive weeks ending with the current week. If the current week
 * has no activity yet, the previous week is used as the starting point, which
 * keeps the streak alive before the first run of a new week.
 */
export function currentWeekStreak(
  dates: readonly string[],
  weekStartsOn: WeekStart,
  today: string
): number {
  const keys = new Set(
    dates.map((date) => weekKey(date, weekStartsOn)).filter(Boolean)
  );

  let cursor = weekKey(today, weekStartsOn);
  if (!cursor) return 0;
  if (!keys.has(cursor)) cursor = addWeeks(cursor, -1);

  let streak = 0;
  while (keys.has(cursor)) {
    streak++;
    cursor = addWeeks(cursor, -1);
  }

  return streak;
}

/** Today's date in the viewer's local timezone, as `YYYY-MM-DD`. */
export function localTodayKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
}

export function normalizeWeekStart(value: unknown): WeekStart | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 6
      ? (value as WeekStart)
      : null;
  }

  if (typeof value === 'string') {
    return WEEK_START_NAMES[value.trim().toLowerCase()] ?? null;
  }

  return null;
}
