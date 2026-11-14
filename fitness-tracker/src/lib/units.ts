import type { Macros, Units } from './types';

export const LB_PER_KG = 2.2046226218;

export const kgToDisplay = (kg: number, units: Units) => (units === 'kg' ? kg : kg * LB_PER_KG);
export const displayToKg = (v: number, units: Units) => (units === 'kg' ? v : v / LB_PER_KG);

/** Trim to at most `dp` decimals without trailing zeros. */
export const num = (v: number, dp = 1) => {
  const f = 10 ** dp;
  return String(Math.round(v * f) / f);
};

/** Two decimals in kg (61.25 kg micro-plates), one in lb. Trailing zeros are dropped. */
export const fmtWeight = (kg: number | null, units: Units, dp = units === 'kg' ? 2 : 1) =>
  kg == null ? '–' : num(kgToDisplay(kg, units), dp);

/** "1 set", "3 sets". */
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0 };

export const scale = (per100: Macros, grams: number): Macros => ({
  kcal: (per100.kcal * grams) / 100,
  p: (per100.p * grams) / 100,
  c: (per100.c * grams) / 100,
  f: (per100.f * grams) / 100,
});

export const sum = (list: Macros[]): Macros =>
  list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), ZERO);

/** Calories implied by macros (4/4/9). Used when a label gives no energy value. */
export const kcalFromMacros = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;

/** Estimated one-rep max (Epley). Only meaningful for low rep counts. */
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

/** Parse user-typed decimals, accepting a comma as the decimal separator. */
export const parseNum = (s: string): number | null => {
  const t = toLatinDigits(s).trim().replace(',', '.');
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : null;
};

/** Keep only digits and a single decimal separator, so "1.2.3" or "1e3" can never be typed. */
export const toLatinDigits = (s: string) =>
  s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/\u066b/g, '.');
export const cleanDecimal = (raw: string): string => {
  const t = toLatinDigits(raw).replace(/[^\d.,]/g, '');
  const i = t.search(/[.,]/);
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/[.,]/g, '');
};
