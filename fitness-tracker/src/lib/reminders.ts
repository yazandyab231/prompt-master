import type { AppState, Reminder } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Reminders that should be showing right now: enabled, scheduled for this weekday,
 * their time has passed today, and they have not been dismissed today.
 */
export function dueReminders(
  reminders: Reminder[],
  seen: AppState['reminderSeen'],
  now: Date = new Date(),
): Reminder[] {
  const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const day = (now.getDay() + 6) % 7;
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return reminders
    .filter((r) => r.enabled && r.days.includes(day) && r.time <= hhmm && seen[r.id] !== iso)
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** The calendar date right now (reminders follow the clock, not the start-of-day setting). */
export const clockDate = (now: Date = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** True if the reminder's time today has already passed (a new one should not go off at once). */
export const alreadyPassedToday = (time: string, now: Date = new Date()) => time <= `${pad(now.getHours())}:${pad(now.getMinutes())}`;

export const REMINDER_PRESETS: { kind: Reminder['kind']; title: string; time: string; days: number[] }[] = [
  { kind: 'workout', title: 'Time to train', time: '18:00', days: [0, 1, 2, 3, 4] },
  { kind: 'meal', title: 'Log your meals', time: '20:30', days: [0, 1, 2, 3, 4, 5, 6] },
  { kind: 'weigh', title: 'Weigh in', time: '07:30', days: [0, 1, 2, 3, 4, 5, 6] },
];
