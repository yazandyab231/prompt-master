// Pure scheduling logic for the push service. No network, no storage: easy to test.

export interface PushReminder {
  id: string;
  title: string;
  body?: string;
  time: string; // HH:MM in the subscriber's own time zone
  days: number[]; // 0 = Monday … 6 = Sunday
}

export interface PushRecord {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  tz: string; // IANA time zone, e.g. "Asia/Amman"
  reminders: PushReminder[];
  /** reminder id -> local date (YYYY-MM-DD) it was last sent, so each fires once a day. */
  sent: Record<string, string>;
}

const DAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function localParts(nowMs: number, tz: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(nowMs));
  } catch {
    return localParts(nowMs, 'UTC'); // unknown zone: fall back rather than crash the whole run
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    day: DAY_INDEX[get('weekday')] ?? 0,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/**
 * Reminders to send now: scheduled for today, due within the last `graceMinutes`
 * (so a late or skipped run still delivers), and not already sent today.
 */
export function dueNow(record: PushRecord, nowMs: number, graceMinutes = 30): PushReminder[] {
  const now = localParts(nowMs, record.tz);
  return record.reminders.filter((r) => {
    const [h, m] = r.time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
    const at = h * 60 + m;
    return (
      r.days.includes(now.day) &&
      now.minutes >= at &&
      now.minutes - at <= graceMinutes &&
      record.sent[r.id] !== now.date
    );
  });
}

/** Validate and trim what a browser sends us, so junk cannot be stored. */
export function sanitizeRecord(body: any): Omit<PushRecord, 'sent'> | null {
  const sub = body?.subscription;
  if (
    !sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000 ||
    typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string'
  ) {
    return null;
  }
  const reminders: PushReminder[] = (Array.isArray(body.reminders) ? body.reminders : [])
    .slice(0, 30)
    .filter((r: any) => r && typeof r.id === 'string' && /^\d{2}:\d{2}$/.test(r.time) && Array.isArray(r.days))
    .map((r: any) => ({
      id: r.id.slice(0, 40),
      title: String(r.title ?? 'Reminder').slice(0, 80),
      body: r.body ? String(r.body).slice(0, 140) : undefined,
      time: r.time,
      days: r.days.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6),
    }));
  return {
    subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    tz: typeof body.tz === 'string' ? body.tz.slice(0, 60) : 'UTC',
    reminders,
  };
}
