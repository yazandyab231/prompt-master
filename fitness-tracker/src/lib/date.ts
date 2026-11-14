const pad = (n: number) => String(n).padStart(2, '0');

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/**
 * Hour (0-6) at which a new day starts. Night-shift workers and people eating late in Ramadan
 * can set this so a 01:00 meal still counts toward the evening before.
 */
let dayStartHour = 0;
export const setDayStartHour = (h: number) => {
  dayStartHour = Math.min(6, Math.max(0, Math.round(h) || 0));
};
export const today = () => toISO(new Date(Date.now() - dayStartHour * 3600_000));
export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
/** 0 = Monday … 6 = Sunday */
export const weekdayIndex = (iso: string) => (fromISO(iso).getDay() + 6) % 7;
export const startOfWeek = (iso: string) => addDays(iso, -weekdayIndex(iso));

export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const yearSuffix = (d: Date) => (d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`);
export const fmtDay = (iso: string) => {
  const d = fromISO(iso);
  return `${DAYS_SHORT[weekdayIndex(iso)]} ${d.getDate()} ${MONTHS[d.getMonth()]}${yearSuffix(d)}`;
};
export const fmtShort = (iso: string) => {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${yearSuffix(d)}`;
};
export const fmtRelative = (iso: string) => {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  if (iso === addDays(t, 1)) return 'Tomorrow';
  return fmtDay(iso);
};
export const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fmtDuration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`;
};
export const daysBetween = (a: string, b: string) =>
  Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
