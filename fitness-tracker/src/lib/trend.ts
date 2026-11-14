import type { BodyWeight } from './types';
import { addDays } from './date';

/** Average of the weigh-ins in the 7 days ending on `end` (inclusive), or null if there are none. */
export function weekAverage(weights: BodyWeight[], end: string): { kg: number; n: number } | null {
  const from = addDays(end, -6);
  const inside = weights.filter((w) => w.date >= from && w.date <= end);
  if (!inside.length) return null;
  return { kg: inside.reduce((a, w) => a + w.kg, 0) / inside.length, n: inside.length };
}

/**
 * This week's average against last week's. Daily weight swings by a kilo or more with water and
 * food, so comparing two single weigh-ins says little; comparing weekly averages does.
 */
export function weeklyChange(weights: BodyWeight[], end: string): { now: number; change: number | null; n: number } | null {
  const now = weekAverage(weights, end);
  if (!now) return null;
  const before = weekAverage(weights, addDays(end, -7));
  return { now: now.kg, change: before ? now.kg - before.kg : null, n: now.n };
}

/** 7-day trailing average for each weigh-in, for a smooth trend line. */
export function smoothed(weights: BodyWeight[]): number[] {
  return weights.map((w) => weekAverage(weights, w.date)!.kg);
}
