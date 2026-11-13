import { produce } from 'immer';
import { get, set } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import type { AppState, Exercise, Food, ID, Macros, Routine, SetLog, Workout } from './types';
import { BUILTIN_EXERCISES } from './exercises';
import { BUILTIN_FOODS } from './foods';
import { today, weekdayIndex } from './date';

const KEY = 'logbook.state';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const defaultState = (): AppState => ({
  version: 1,
  settings: { theme: 'iron', units: 'kg', targets: { kcal: 2400, p: 160, c: 270, f: 75 } },
  exercises: [],
  routines: [],
  week: [null, null, null, null, null, null, null],
  workouts: [],
  bodyWeights: [],
  foods: [],
  entries: [],
  reminders: [],
  reminderSeen: {},
});

const THEME_IDS = ['iron', 'ember', 'tide', 'chalk', 'clay'];
export const THEME_BG: Record<string, string> = {
  iron: '#0b0b0c', ember: '#100d0b', tide: '#081018', chalk: '#f2efe9', clay: '#ece2d5',
};
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDate = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const numOr = (v: unknown, fallback: number) => (isNum(v) && v >= 0 ? v : fallback);
const macros = (v: unknown): Macros | null =>
  isObj(v) ? { kcal: numOr(v.kcal, 0), p: numOr(v.p, 0), c: numOr(v.c, 0), f: numOr(v.f, 0) } : null;

/**
 * Turn anything (an old backup, a hand-edited file, corrupted storage) into a state the app can
 * always render. Unreadable items are dropped and counted rather than trusted.
 */
export function normalizeWithReport(raw: unknown): { state: AppState; dropped: number } {
  const d = defaultState();
  if (!isObj(raw)) return { state: d, dropped: 0 };
  let dropped = 0;
  const list = <T,>(v: unknown, read: (x: any) => T | null): T[] => {
    if (!Array.isArray(v)) return [];
    const out: T[] = [];
    for (const x of v) {
      const item = isObj(x) ? read(x) : null;
      if (item) out.push(item);
      else dropped++;
    }
    return out;
  };

  const settings: AppState['settings'] = {
    theme: isObj(raw.settings) && THEME_IDS.includes(raw.settings.theme) ? raw.settings.theme : d.settings.theme,
    units: isObj(raw.settings) && raw.settings.units === 'lb' ? 'lb' : 'kg',
    targets: { ...d.settings.targets, ...(isObj(raw.settings) ? macros(raw.settings.targets) ?? {} : {}) },
  };
  if (isObj(raw.settings) && isObj(raw.settings.targets)) {
    for (const k of ['kcal', 'p', 'c', 'f'] as const) {
      if (!isNum(raw.settings.targets[k])) settings.targets[k] = d.settings.targets[k];
    }
  }

  const exercises = list<Exercise>(raw.exercises, (x) =>
    isStr(x.id) && isStr(x.name) ? { id: x.id, name: x.name, group: isStr(x.group) ? x.group : 'Other', custom: true } : null,
  );
  const routines = list<Routine>(raw.routines, (x) =>
    isStr(x.id) && isStr(x.name)
      ? {
          id: x.id,
          name: x.name,
          exercises: list(x.exercises, (e) =>
            isStr(e.exerciseId)
              ? { exerciseId: e.exerciseId, sets: Math.min(12, Math.max(1, Math.round(numOr(e.sets, 3)))), reps: isStr(e.reps) ? e.reps : '' }
              : null,
          ),
        }
      : null,
  );
  const routineIds = new Set(routines.map((r) => r.id));
  const week: (ID | null)[] = Array.from({ length: 7 }, (_, i) => {
    const v = Array.isArray(raw.week) ? raw.week[i] : null;
    return isStr(v) && routineIds.has(v) ? v : null;
  });

  let sawActive = false;
  const workouts = list<Workout>(raw.workouts, (x) => {
    if (!isStr(x.id) || !isDate(x.date) || !isNum(x.startedAt)) return null;
    const finishedAt = isNum(x.finishedAt) ? x.finishedAt : null;
    if (finishedAt == null) {
      if (sawActive) return null; // only one session can be in progress
      sawActive = true;
    }
    return {
      id: x.id,
      routineId: isStr(x.routineId) ? x.routineId : null,
      name: isStr(x.name) ? x.name : 'Session',
      date: x.date,
      startedAt: x.startedAt,
      finishedAt,
      exercises: list(x.exercises, (e) =>
        isStr(e.exerciseId)
          ? {
              exerciseId: e.exerciseId,
              sets: list<SetLog>(e.sets, (st) => ({
                weight: isNum(st.weight) && st.weight >= 0 ? st.weight : null,
                reps: isNum(st.reps) && st.reps >= 0 ? Math.round(st.reps) : null,
                done: st.done === true,
              })),
            }
          : null,
      ),
    };
  });

  const seenDates = new Set<string>();
  const bodyWeights = list<AppState['bodyWeights'][number]>(raw.bodyWeights, (x) => {
    if (!isDate(x.date) || !isNum(x.kg) || x.kg <= 0 || seenDates.has(x.date)) return null;
    seenDates.add(x.date);
    return { date: x.date, kg: x.kg };
  }).sort((a, b) => a.date.localeCompare(b.date));

  const foods = list<Food>(raw.foods, (x) => {
    const per100 = macros(x.per100);
    if (!isStr(x.id) || !isStr(x.name) || !per100) return null;
    return {
      id: x.id,
      name: x.name,
      brand: isStr(x.brand) ? x.brand : undefined,
      per100,
      servingG: isNum(x.servingG) && x.servingG > 0 ? x.servingG : undefined,
      source: ['custom', 'barcode', 'label'].includes(x.source) ? x.source : 'custom',
      barcode: isStr(x.barcode) ? x.barcode : undefined,
    };
  });
  const entries = list<AppState['entries'][number]>(raw.entries, (x) => {
    const m = macros(x.macros);
    if (!isStr(x.id) || !isDate(x.date) || !isStr(x.name) || !m) return null;
    return {
      id: x.id,
      date: x.date,
      time: numOr(x.time, 0),
      foodId: isStr(x.foodId) ? x.foodId : undefined,
      name: x.name,
      grams: isNum(x.grams) && x.grams > 0 ? x.grams : null,
      macros: m,
    };
  });
  const reminders = list<AppState['reminders'][number]>(raw.reminders, (x) =>
    isStr(x.id) && isStr(x.title) && isStr(x.time) && /^\d{2}:\d{2}$/.test(x.time) && Array.isArray(x.days)
      ? {
          id: x.id,
          kind: ['workout', 'meal', 'weigh', 'custom'].includes(x.kind) ? x.kind : 'custom',
          title: x.title,
          time: x.time,
          days: x.days.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6),
          enabled: x.enabled !== false,
        }
      : null,
  );
  const reminderSeen: Record<ID, string> = {};
  if (isObj(raw.reminderSeen)) for (const [k, v] of Object.entries(raw.reminderSeen)) if (isStr(v)) reminderSeen[k] = v;

  return {
    state: { version: 1, settings, exercises, routines, week, workouts, bodyWeights, foods, entries, reminders, reminderSeen },
    dropped,
  };
}

export const normalize = (raw: unknown): AppState => normalizeWithReport(raw).state;

let state: AppState = defaultState();
let loaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function persist() {
  saveTimer = undefined;
  try {
    await set(KEY, state);
  } catch {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: the app still works for this session */
    }
  }
}

export function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    void persist();
  }
}

function applyTheme() {
  const theme = state.settings.theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[theme] ?? THEME_BG.iron);
  try {
    localStorage.setItem('logbook.theme', theme);
  } catch {
    /* ignore */
  }
}

function emit() {
  for (const l of listeners) l();
  applyTheme();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 120);
}

export async function loadState() {
  if (loaded) return;
  let raw: unknown;
  try {
    raw = await get(KEY);
  } catch {
    /* fall through to localStorage */
  }
  if (!raw) {
    try {
      const s = localStorage.getItem(KEY);
      if (s) raw = JSON.parse(s);
    } catch {
      /* ignore */
    }
  }
  state = normalize(raw);
  loaded = true;
  applyTheme();
  for (const l of listeners) l();
  // Ask the browser not to evict our data under storage pressure.
  void navigator.storage?.persist?.().catch(() => undefined);
}

export const getState = () => state;
export function update(recipe: (draft: AppState) => void) {
  state = produce(state, recipe);
  emit();
}
export function replaceState(next: AppState) {
  state = next;
  emit();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useApp = () => useSyncExternalStore(subscribe, getState);

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/* ---------- lookups ---------- */

export const allExercises = (s: AppState): Exercise[] => [...s.exercises, ...BUILTIN_EXERCISES];
export const exerciseById = (s: AppState, id: ID): Exercise =>
  s.exercises.find((e) => e.id === id) ??
  BUILTIN_EXERCISES.find((e) => e.id === id) ?? { id, name: 'Deleted exercise', group: 'Other' };
export const allFoods = (s: AppState): Food[] => [...s.foods, ...BUILTIN_FOODS];
export const routineById = (s: AppState, id: ID | null) => s.routines.find((r) => r.id === id) ?? null;
export const routineForDate = (s: AppState, iso: string) => routineById(s, s.week[weekdayIndex(iso)]);
export const activeWorkout = (s: AppState) => s.workouts.find((w) => w.finishedAt == null) ?? null;
export const finishedWorkouts = (s: AppState) =>
  s.workouts.filter((w) => w.finishedAt != null).sort((a, b) => b.startedAt - a.startedAt);

/** The most recent finished sets for an exercise, to show "last time" next to each set. */
export function lastSets(s: AppState, exerciseId: ID, beforeWorkoutId?: ID): SetLog[] | null {
  for (const w of finishedWorkouts(s)) {
    if (w.id === beforeWorkoutId) continue;
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    const done = ex?.sets.filter((x) => x.done && x.reps != null);
    if (done?.length) return done;
  }
  return null;
}

/* ---------- training actions ---------- */

export function startWorkout(routine: Routine | null): ID {
  const s = getState();
  const existing = activeWorkout(s);
  if (existing) return existing.id;
  const id = uid();
  const w: Workout = {
    id,
    routineId: routine?.id ?? null,
    name: routine?.name ?? 'Open session',
    date: today(),
    startedAt: Date.now(),
    finishedAt: null,
    exercises: (routine?.exercises ?? []).map((re) => {
      const last = lastSets(s, re.exerciseId);
      return {
        exerciseId: re.exerciseId,
        sets: Array.from({ length: Math.max(1, re.sets) }, (_, i) => ({
          // Pre-fill the weight from last time; reps stay empty so nothing is logged by accident.
          weight: last?.[Math.min(i, last.length - 1)]?.weight ?? null,
          reps: null,
          done: false,
        })),
      };
    }),
  };
  update((d) => {
    d.workouts.push(w);
  });
  return id;
}

export function finishWorkout(id: ID) {
  update((d) => {
    const w = d.workouts.find((x) => x.id === id);
    if (!w) return;
    // Keep only what was actually done.
    for (const ex of w.exercises) ex.sets = ex.sets.filter((x) => x.done && x.reps != null);
    w.exercises = w.exercises.filter((ex) => ex.sets.length);
    w.finishedAt = Date.now();
  });
}

export const deleteWorkout = (id: ID) =>
  update((d) => {
    d.workouts = d.workouts.filter((w) => w.id !== id);
  });

export function setBodyWeight(date: string, kg: number | null) {
  update((d) => {
    d.bodyWeights = d.bodyWeights.filter((b) => b.date !== date);
    if (kg != null && kg > 0) d.bodyWeights.push({ date, kg });
    d.bodyWeights.sort((a, b) => a.date.localeCompare(b.date));
  });
}

/* ---------- food actions ---------- */

export function logFood(args: { date: string; name: string; grams: number | null; macros: Macros; foodId?: ID }) {
  update((d) => {
    d.entries.push({ id: uid(), time: Date.now(), ...args });
  });
}

export function saveFood(food: Omit<Food, 'id'> & { id?: ID }): Food {
  const full: Food = { ...food, id: food.id ?? uid() };
  update((d) => {
    const i = d.foods.findIndex((f) => f.id === full.id || (full.barcode && f.barcode === full.barcode));
    if (i >= 0) d.foods[i] = { ...full, id: d.foods[i].id };
    else d.foods.unshift(full);
  });
  return getState().foods.find((f) => f.id === full.id || (full.barcode && f.barcode === full.barcode)) ?? full;
}

/** Foods logged most recently, most recent first, without duplicates. */
export function recentFoods(s: AppState, limit = 12): Food[] {
  const foods = allFoods(s);
  const seen = new Set<ID>();
  const out: Food[] = [];
  for (let i = s.entries.length - 1; i >= 0 && out.length < limit; i--) {
    const id = s.entries[i].foodId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const f = foods.find((x) => x.id === id);
    if (f) out.push(f);
  }
  return out;
}

/* ---------- split templates ---------- */

type Tpl = { name: string; days: { name: string; ex: [string, number, string][] }[]; week: (number | null)[] };
const X = (name: string) => 'x-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const TEMPLATES: Tpl[] = [
  {
    name: 'Push / Pull / Legs',
    days: [
      { name: 'Push', ex: [['Bench Press', 4, '6-8'], ['Overhead Press', 3, '8-10'], ['Incline Dumbbell Press', 3, '8-12'], ['Lateral Raise', 3, '12-15'], ['Triceps Pushdown', 3, '10-12']] },
      { name: 'Pull', ex: [['Deadlift', 3, '5'], ['Pull-Up', 3, '6-10'], ['Barbell Row', 3, '8-10'], ['Face Pull', 3, '12-15'], ['Barbell Curl', 3, '10-12']] },
      { name: 'Legs', ex: [['Squat', 4, '6-8'], ['Romanian Deadlift', 3, '8-10'], ['Leg Press', 3, '10-12'], ['Leg Curl', 3, '10-12'], ['Calf Raise', 4, '12-15']] },
    ],
    week: [0, 1, 2, null, 0, 1, 2],
  },
  {
    name: 'Upper / Lower',
    days: [
      { name: 'Upper', ex: [['Bench Press', 4, '6-8'], ['Barbell Row', 4, '6-8'], ['Overhead Press', 3, '8-10'], ['Lat Pulldown', 3, '10-12'], ['Dumbbell Curl', 3, '10-12'], ['Triceps Pushdown', 3, '10-12']] },
      { name: 'Lower', ex: [['Squat', 4, '6-8'], ['Romanian Deadlift', 3, '8-10'], ['Leg Press', 3, '10-12'], ['Leg Curl', 3, '10-12'], ['Calf Raise', 4, '12-15']] },
    ],
    week: [0, 1, null, 0, 1, null, null],
  },
  {
    name: 'Full body ×3',
    days: [
      { name: 'Full body A', ex: [['Squat', 3, '5-8'], ['Bench Press', 3, '5-8'], ['Barbell Row', 3, '8-10'], ['Plank', 3, '45s']] },
      { name: 'Full body B', ex: [['Deadlift', 3, '5'], ['Overhead Press', 3, '6-8'], ['Lat Pulldown', 3, '8-12'], ['Hanging Leg Raise', 3, '10-12']] },
    ],
    week: [0, null, 1, null, 0, null, null],
  },
];

export function applyTemplate(index: number) {
  const tpl = TEMPLATES[index];
  const routines: Routine[] = tpl.days.map((d) => ({
    id: uid(),
    name: d.name,
    exercises: d.ex.map(([n, sets, reps]) => ({ exerciseId: X(n), sets, reps })),
  }));
  update((d) => {
    d.routines.push(...routines);
    d.week = tpl.week.map((i) => (i == null ? null : routines[i].id));
  });
}
