import type { Activity } from '../types';
import { parseMovingTime } from '../hooks/useActivities';
import { weekKey, type WeekStart } from './week';

export type SummaryPeriod = 'year' | 'month' | 'week' | 'day' | 'life';

// Use the recorded local calendar date, independent of the viewer's timezone.
export function summaryKey(
  date: string,
  period: SummaryPeriod,
  weekStartsOn: WeekStart = 1
): string {
  if (period === 'life') return 'Life';
  if (period === 'year') return date.slice(0, 4);
  if (period === 'month') return date.slice(0, 7);
  if (period === 'day') return date.slice(0, 10);
  return weekKey(date, weekStartsOn);
}

export function summarize(activities: Activity[]) {
  const distance = activities.reduce((sum, a) => sum + a.distance, 0);
  const seconds = activities.reduce(
    (sum, a) => sum + parseMovingTime(a.moving_time),
    0
  );
  const heartRates = activities.filter((a) => (a.average_heartrate ?? 0) > 0);
  const speeds = activities.map((a) => {
    const time = parseMovingTime(a.moving_time);
    return time > 0 ? a.distance / time : 0;
  });
  return {
    distance,
    seconds,
    count: activities.length,
    speed: seconds > 0 ? distance / seconds : 0,
    maxDistance: Math.max(0, ...activities.map((a) => a.distance)),
    maxSpeed: Math.max(0, ...speeds),
    elevation: activities.reduce((sum, a) => sum + (a.elevation_gain ?? 0), 0),
    heartRate: heartRates.length
      ? heartRates.reduce((sum, a) => sum + a.average_heartrate!, 0) /
        heartRates.length
      : null,
  };
}

export function groupSummary(
  activities: Activity[],
  period: SummaryPeriod,
  weekStartsOn: WeekStart = 1
) {
  const groups = new Map<string, Activity[]>();
  for (const activity of activities) {
    const key = summaryKey(activity.start_date_local, period, weekStartsOn);
    const group = groups.get(key) ?? [];
    group.push(activity);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

export function summaryChart(
  activities: Activity[],
  period: SummaryPeriod,
  key: string,
  weekStartsOn: WeekStart = 1
) {
  const buckets = new Map<string, number>();
  const bucketFor = (a: Activity) => {
    const date = a.start_date_local.slice(0, 10);
    if (period === 'life') return date.slice(0, 4);
    if (period === 'year') return date.slice(5, 7);
    if (period === 'month') return date.slice(8, 10);
    if (period === 'week')
      return String(
        ((new Date(`${date}T00:00:00Z`).getUTCDay() - weekStartsOn + 7) % 7) + 1
      );
    return a.start_date_local.slice(11, 16);
  };
  let length = 0;
  if (period === 'year') length = 12;
  if (period === 'month')
    length = new Date(
      Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)
    ).getUTCDate();
  if (period === 'week') length = 7;
  for (let i = 1; i <= length; i++)
    buckets.set(period === 'week' ? String(i) : String(i).padStart(2, '0'), 0);
  for (const activity of activities) {
    const bucket = bucketFor(activity);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + activity.distance / 1000);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, km]) => ({ label, km: Number(km.toFixed(2)) }));
}
