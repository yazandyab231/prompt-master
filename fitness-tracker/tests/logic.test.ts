import { describe, expect, it } from 'vitest';
import { parseNutritionText } from '../src/lib/label';
import { dueNow, localParts, sanitizeRecord, type PushRecord } from '../server/due';
import { dueReminders } from '../src/lib/reminders';
import { e1rm, kcalFromMacros, parseNum, scale, sum } from '../src/lib/units';
import { BUILTIN_FOODS, searchFoods } from '../src/lib/foods';
import { addDays, startOfWeek, weekdayIndex } from '../src/lib/date';

describe('nutrition label parsing', () => {
  it('reads an EU table with per-100g and per-serving columns', () => {
    const r = parseNutritionText(`Nutrition Information
Typical values   Per 100g   Per 30g serving
Energy   1569kJ / 372kcal   471kJ / 112kcal
Fat   6.5g   2.0g
of which saturates   1.2g   0.4g
Carbohydrate   62g   19g
of which sugars   1.0g   0.3g
Fibre   9.0g   2.7g
Protein   12g   3.6g
Salt   0.02g   0.01g`);
    expect(r.basis).toBe('per100');
    expect(r.per100).toEqual({ kcal: 372, p: 12, c: 62, f: 6.5 });
    expect(r.servingG).toBe(30);
    expect(r.found).toBe(4);
  });

  it('picks the per-100g column when the serving column comes first', () => {
    const r = parseNutritionText(`Per serving (40g)   Per 100g
Energy 160kcal 400kcal
Fat 4g 10g
Carbohydrate 24g 60g
Protein 6g 15g`);
    expect(r.per100).toEqual({ kcal: 400, p: 15, c: 60, f: 10 });
  });

  it('converts a US Nutrition Facts panel from per serving to per 100g', () => {
    const r = parseNutritionText(`Nutrition Facts
8 servings per container
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g 10%
Saturated Fat 1g 5%
Trans Fat 0g
Cholesterol 0mg 0%
Sodium 160mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g 14%
Total Sugars 12g
Protein 3g`);
    expect(r.basis).toBe('serving');
    expect(r.servingG).toBe(55);
    expect(r.per100.kcal).toBe(418);
    expect(r.per100.f).toBeCloseTo(14.5, 1);
    expect(r.per100.c).toBeCloseTo(67.3, 1);
    expect(r.per100.p).toBeCloseTo(5.5, 1);
  });

  it('survives common OCR slips (comma decimals, O for 0, kJ only)', () => {
    const r = parseNutritionText(`per 100 g
Energy 1046 kJ
Fat O,5 g
Carbohydrate 2O,4 g
Protein 3,1 g`);
    expect(r.per100.kcal).toBe(250);
    expect(r.per100.f).toBe(0.5);
    expect(r.per100.c).toBe(20.4);
    expect(r.per100.p).toBe(3.1);
  });

  it('treats a trailing 9 as a misread "g" (real OCR output of an EU table)', () => {
    const r = parseNutritionText(`Nutrition Information
Typical values Per 100g Per 30g serving
Energy 1569kJ / 372kcal  471kJ / 112kcal
Fat 6.59 2.09
of which saturates 1.29 0.4g
Carbohydrate 629 199g
of which sugars 1.0g 0.39
Protein 12g 3.69
Salt 0.029 0.019`);
    expect(r.per100).toEqual({ kcal: 372, p: 12, c: 62, f: 6.5 });
  });

  it('reads a bracketed serving size whose "g" became a 9 (real OCR output of a US panel)', () => {
    const r = parseNutritionText(`Nutrition Facts
8 servings per container
Serving size 2/3 cup (559)
Calories 230
Total Fat 8g
Saturated Fat 1g
Trans Fat Og
Cholesterol Omg
Sodium 160mg
Total Carbohydrate 37g
Dietary Fiber 4g
Total Sugars 12g
Protein 3g`);
    expect(r.servingG).toBe(55);
    expect(r.per100.kcal).toBe(418);
    expect(r.per100.p).toBeCloseTo(5.5, 1);
  });

  it('keeps genuine values ending in 9 when the label prints no units', () => {
    const r = parseNutritionText('per 100g\nEnergy 389 kcal\nFat 19\nCarbohydrate 45\nProtein 12');
    expect(r.per100).toEqual({ kcal: 389, p: 12, c: 45, f: 19 });
  });

  it('keeps a genuine value ending in 9 that still has its unit', () => {
    const r = parseNutritionText('per 100g\nEnergy 250 kcal\nFat 9g\nCarbohydrate 29g\nProtein 19.9g');
    expect(r.per100).toEqual({ kcal: 250, p: 19.9, c: 29, f: 9 });
  });

  it('repairs a lost decimal point and a stray 9 using the energy value (tester image 01 / x1)', () => {
    const r = parseNutritionText('Per 100g\nEnergy 1590 kJ / 380 kcal\nFat 6.59\nCarbohydrate 629g\nProtein 135¢');
    expect(r.per100).toEqual({ kcal: 380, p: 13.5, c: 62, f: 6.5 });
    expect(r.adjusted.sort()).toEqual(['c', 'p']);
  });

  it('repairs "3.6 g" read as "369" (tester image 13)', () => {
    const r = parseNutritionText('per 100 g\nEnergy 52 kcal\nFat 0.29\nCarbohydrate 369\nProtein 10.3 ¢g');
    expect(r.per100).toEqual({ kcal: 52, p: 10.3, c: 3.6, f: 0.2 });
  });

  it('repairs a per-serving value with a lost decimal point (tester image x5)', () => {
    const r = parseNutritionText('Per 30g serving\nEnergy 120 kcal\nFat 25g\nCarbohydrate 21g\nProtein 3g');
    expect(r.basis).toBe('serving');
    expect(r.per100.f).toBeCloseTo(8.3, 1);
    expect(r.per100.c).toBe(70);
  });

  it('leaves values alone when they already agree with the energy figure', () => {
    const r = parseNutritionText('per 100g\nEnergy 579 kcal\nFat 49g\nCarbohydrate 22g\nProtein 21g');
    expect(r.per100).toEqual({ kcal: 579, p: 21, c: 22, f: 49 });
    expect(r.adjusted).toEqual([]);
  });

  it('repairs all three values only when they are impossible as read (tester image x2)', () => {
    const r = parseNutritionText('Per 100g\nEnergy 1590 kJ / 380 kcal\nFat 65g\nCarbohydrate 629\nProtein 1359');
    expect(r.per100).toEqual({ kcal: 380, p: 13.5, c: 62, f: 6.5 });
  });

  it('does not invent a repair when nothing fits', () => {
    const r = parseNutritionText('per 100g\nEnergy 50 kcal\nFat 30g\nCarbohydrate 40g\nProtein 20g');
    expect(r.per100).toEqual({ kcal: 50, p: 20, c: 40, f: 30 });
    expect(r.adjusted).toEqual([]);
  });

  it('reports what it could not read instead of inventing it', () => {
    const r = parseNutritionText('INGREDIENTS: water, sugar\nBest before end');
    expect(r.found).toBe(0);
    expect(r.per100).toEqual({ kcal: null, p: null, c: null, f: null });
  });

  it('derives calories from macros when the energy line is unreadable', () => {
    const r = parseNutritionText('per 100g\nFat 10g\nCarbohydrate 20g\nProtein 5g');
    expect(r.per100.kcal).toBe(190);
  });
});

describe('push scheduling', () => {
  const rec = (over: Partial<PushRecord> = {}): PushRecord => ({
    subscription: { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } },
    tz: 'Asia/Amman',
    reminders: [{ id: 'r1', title: 'Train', time: '18:00', days: [0, 1, 2, 3, 4] }],
    sent: {},
    ...over,
  });
  // Friday 13 Nov 2026, 18:05 in Amman (UTC+3) = 15:05 UTC
  const fri1805 = Date.UTC(2026, 10, 13, 15, 5);

  it('converts to the subscriber time zone', () => {
    expect(localParts(fri1805, 'Asia/Amman')).toEqual({ date: '2026-11-13', day: 4, minutes: 18 * 60 + 5 });
  });
  it('sends a reminder that just became due', () => {
    expect(dueNow(rec(), fri1805).map((r) => r.id)).toEqual(['r1']);
  });
  it('does not send before the time, long after it, or on other days', () => {
    expect(dueNow(rec(), fri1805 - 10 * 60000)).toEqual([]);
    expect(dueNow(rec(), fri1805 + 60 * 60000)).toEqual([]);
    expect(dueNow(rec(), fri1805 + 24 * 3600000)).toEqual([]); // Saturday
  });
  it('sends only once a day', () => {
    expect(dueNow(rec({ sent: { r1: '2026-11-13' } }), fri1805)).toEqual([]);
    expect(dueNow(rec({ sent: { r1: '2026-11-12' } }), fri1805)).toHaveLength(1);
  });
  it('falls back to UTC for an unknown time zone', () => {
    expect(localParts(fri1805, 'Not/AZone').date).toBe('2026-11-13');
  });
  it('rejects junk subscriptions and trims reminders', () => {
    expect(sanitizeRecord({})).toBeNull();
    expect(sanitizeRecord({ subscription: { endpoint: 'http://insecure', keys: { p256dh: 'a', auth: 'b' } } })).toBeNull();
    const ok = sanitizeRecord({
      subscription: { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' }, extra: 1 },
      tz: 'Europe/London',
      reminders: [{ id: 'a', title: 'T', time: '07:30', days: [0, 9, 'x'] }, { id: 'bad', time: '7:30', days: [] }],
    });
    expect(ok?.reminders).toEqual([{ id: 'a', title: 'T', body: undefined, time: '07:30', days: [0] }]);
  });
});

describe('in-app reminders', () => {
  const r = { id: 'a', kind: 'meal' as const, title: 'Log', time: '20:30', days: [4], enabled: true };
  const fri = (h: number, m: number) => new Date(2026, 10, 13, h, m);
  it('is due after its time on a scheduled day until dismissed', () => {
    expect(dueReminders([r], {}, fri(20, 29))).toEqual([]);
    expect(dueReminders([r], {}, fri(20, 30))).toHaveLength(1);
    expect(dueReminders([r], { a: '2026-11-13' }, fri(21, 0))).toEqual([]);
    expect(dueReminders([{ ...r, enabled: false }], {}, fri(21, 0))).toEqual([]);
    expect(dueReminders([{ ...r, days: [0] }], {}, fri(21, 0))).toEqual([]);
  });
});

describe('maths', () => {
  it('scales macros by weight', () => {
    const rice = BUILTIN_FOODS.find((f) => f.name === 'Rice, white, cooked')!;
    expect(scale(rice.per100, 100)).toEqual(rice.per100);
    expect(scale(rice.per100, 250).c).toBeCloseTo(70.5, 5);
    expect(sum([scale(rice.per100, 100), scale(rice.per100, 100)]).kcal).toBe(260);
  });
  it('built-in foods roughly agree with 4/4/9', () => {
    const off = BUILTIN_FOODS.filter((f) => {
      const est = kcalFromMacros(f.per100.p, f.per100.c, f.per100.f);
      return Math.abs(est - f.per100.kcal) > Math.max(30, f.per100.kcal * 0.2);
    }).map((f) => f.name);
    expect(off).toEqual([]);
  });
  it('searches foods by every word', () => {
    expect(searchFoods(BUILTIN_FOODS, 'rice')[0].name).toMatch(/^Rice/);
    expect(searchFoods(BUILTIN_FOODS, 'chicken cooked').every((f) => /chicken/i.test(f.name))).toBe(true);
    expect(searchFoods(BUILTIN_FOODS, 'zzzz')).toEqual([]);
  });
  it('parses typed numbers', () => {
    expect(parseNum('82,5')).toBe(82.5);
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
    expect(parseNum('-4')).toBeNull();
  });
  it('estimates 1RM', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 1);
  });
  it('handles week maths', () => {
    expect(weekdayIndex('2026-11-13')).toBe(4); // Friday
    expect(startOfWeek('2026-11-13')).toBe('2026-11-09');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
