import { produce } from 'immer';
import { getMany, setMany } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import type { AppState, Exercise, Food, ID, Macros, Routine, SetLog, ThemeChoice, ThemeId, Workout } from './types';
import { BUILTIN_EXERCISES } from './exercises';
import { BUILTIN_FOODS } from './foods';
import { setDayStartHour, today, weekdayIndex } from './date';

const KEY = 'logbook.state';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const defaultState = (): AppState => ({
  version: 1,
  settings: {
    theme: 'clean',
    units: 'kg',
    targets: { kcal: 2400, p: 160, c: 270, f: 75 },
    targetHistory: [],
    dayStart: 0,
    targetsReviewed: false,
    readableText: false,
  },
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

const THEME_IDS = ['clean', 'iron', 'ember', 'tide', 'chalk', 'clay', 'auto'];
export const THEME_BG: Record<string, string> = {
  clean: '#f6f7f9', iron: '#16171a', ember: '#100d0b', tide: '#081018', chalk: '#f2efe9', clay: '#ece2d5',
};
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Read a number, also when an older or hand-edited file wrote it as text ("80", "61,25"). */
const toNum = (v: unknown): number | null => {
  if (isNum(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
/** "7:30" -> "07:30"; anything that is not a time -> null. */
const toTime = (v: unknown): string | null => {
  const m = typeof v === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(v.trim()) : null;
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
};
const isDate = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const numOr = (v: unknown, fallback: number) => {
  const n = toNum(v);
  return n != null && n >= 0 ? n : fallback;
};
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

  const pickedTheme = isObj(raw.settings) && THEME_IDS.includes(raw.settings.theme) ? raw.settings.theme : d.settings.theme;
  const themeChosen = isObj(raw.settings) && raw.settings.themeChosen === true;
  const settings: AppState['settings'] = {
    // The old neon default (Iron) moves to the new clean default unless the person chose a theme themselves.
    theme: pickedTheme === 'iron' && !themeChosen ? 'clean' : pickedTheme,
    ...(themeChosen ? { themeChosen: true } : {}),
    units: isObj(raw.settings) && raw.settings.units === 'lb' ? 'lb' : 'kg',
    targets: { ...d.settings.targets, ...(isObj(raw.settings) ? macros(raw.settings.targets) ?? {} : {}) },
    targetHistory: (isObj(raw.settings) && Array.isArray(raw.settings.targetHistory) ? raw.settings.targetHistory : [])
      .filter((h: any) => isObj(h) && isDate(h.from) && isObj(h.targets))
      .map((h: any) => ({ from: h.from, targets: macros(h.targets)! }))
      .sort((a: any, b: any) => a.from.localeCompare(b.from)),
    dayStart: isObj(raw.settings) ? Math.min(6, Math.max(0, Math.round(numOr(raw.settings.dayStart, 0)))) : 0,
    readableText: isObj(raw.settings) && raw.settings.readableText === true,
    // Anyone restoring real data has been using the app: do not greet them as new.
    targetsReviewed: isObj(raw.settings) && raw.settings.targetsReviewed === true,
    ...(isObj(raw.settings) && isDate(raw.settings.lastExport) ? { lastExport: raw.settings.lastExport } : {}),
  };
  if (isObj(raw.settings) && isObj(raw.settings.targets)) {
    for (const k of ['kcal', 'p', 'c', 'f'] as const) {
      const n = toNum(raw.settings.targets[k]);
      settings.targets[k] = n != null && n > 0 ? n : d.settings.targets[k];
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
  const splitName = isStr(raw.splitName) ? raw.splitName.slice(0, 30) : undefined;
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
      ...(isNum(x.lastAt) ? { lastAt: x.lastAt } : {}),
      ...(isStr(x.note) ? { note: x.note } : {}),
      exercises: list(x.exercises, (e) =>
        isStr(e.exerciseId)
          ? {
              exerciseId: e.exerciseId,
              sets: list<SetLog>(e.sets, (st) => ({
                weight: (toNum(st.weight) ?? -1) >= 0 ? toNum(st.weight) : null,
                reps: (toNum(st.reps) ?? -1) >= 0 ? Math.round(toNum(st.reps)!) : null,
                done: st.done === true || st.done === 'true' || st.done === 'yes' || st.done === 1,
              })),
            }
          : null,
      ),
    };
  });

  // Inside a finished session every set was done (unticked sets are removed when it finishes).
  for (const w of workouts) {
    if (w.finishedAt == null) continue;
    for (const ex of w.exercises) ex.sets = ex.sets.filter((x) => x.done && x.reps != null);
    w.exercises = w.exercises.filter((ex) => ex.sets.length);
  }
  const seenDates = new Set<string>();
  const bodyWeights = list<AppState['bodyWeights'][number]>(raw.bodyWeights, (x) => {
    const kg = toNum(x.kg);
    if (!isDate(x.date) || kg == null || kg <= 0 || seenDates.has(x.date)) return null;
    seenDates.add(x.date);
    return { date: x.date, kg };
  }).sort((a, b) => a.date.localeCompare(b.date));

  const foods = list<Food>(raw.foods, (x) => {
    const per100 = macros(x.per100);
    if (!isStr(x.id) || !isStr(x.name) || !per100) return null;
    return {
      id: x.id,
      name: x.name,
      brand: isStr(x.brand) ? x.brand : undefined,
      per100,
      servingG: (toNum(x.servingG) ?? 0) > 0 ? toNum(x.servingG)! : undefined,
      ...(x.liquid === true ? { liquid: true } : {}),
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
      grams: (toNum(x.grams) ?? 0) > 0 ? toNum(x.grams) : null,
      macros: m,
    };
  });
  const reminders = list<AppState['reminders'][number]>(raw.reminders, (x) =>
    isStr(x.id) && isStr(x.title) && toTime(x.time) && Array.isArray(x.days)
      ? {
          id: x.id,
          kind: ['workout', 'meal', 'weigh', 'custom'].includes(x.kind) ? x.kind : 'custom',
          title: x.title,
          time: toTime(x.time)!,
          days: x.days.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6),
          enabled: x.enabled !== false,
        }
      : null,
  );
  const reminderSeen: Record<ID, string> = {};
  if (isObj(raw.reminderSeen)) for (const [k, v] of Object.entries(raw.reminderSeen)) if (isStr(v)) reminderSeen[k] = v;

  // The same id twice would make one delete remove both: keep the first of each.
  const unique = <T extends { id: string }>(items: T[]): T[] => {
    const seen = new Set<string>();
    return items.filter((x) => {
      if (seen.has(x.id)) {
        dropped++;
        return false;
      }
      seen.add(x.id);
      return true;
    });
  };

  return {
    state: {
      version: 1,
      settings,
      exercises: unique(exercises),
      routines: unique(routines),
      ...(splitName ? { splitName } : {}),
      week,
      workouts: unique(workouts),
      bodyWeights,
      foods: unique(foods),
      entries: unique(entries),
      reminders: unique(reminders),
      reminderSeen,
    },
    dropped,
  };
}

export const normalize = (raw: unknown): AppState => normalizeWithReport(raw).state;

let state: AppState = defaultState();
let loaded = false;
const listeners = new Set<() => void>();
const AT_KEY = KEY + '.savedAt'; // when the IndexedDB copy was written
const PENDING_KEY = KEY + '.pending'; // emergency copy written synchronously when the page goes away

/** Bumped on every change; `savedRev` catches up when a write finishes. */
let rev = 0;
let savedRev = 0;
let writing = false;
let lastSavedAt = 0;
let storageBroken = false;
/** True when the browser refuses to save anything: the app should warn the person. */
export const isStorageBroken = () => storageBroken;
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('logbook') : null;

/** Write the current state to IndexedDB straight away, coalescing bursts into one write. */
async function persist() {
  if (writing) return;
  writing = true;
  try {
    while (savedRev < rev) {
      const target = rev;
      const snapshot = state;
      const at = Date.now();
      try {
        await setMany([
          [KEY, snapshot],
          [AT_KEY, at],
        ]);
        storageBroken = false;
      } catch {
        try {
          localStorage.setItem(KEY, JSON.stringify(snapshot));
          localStorage.setItem(AT_KEY, String(at));
          storageBroken = false;
        } catch {
          // Neither IndexedDB nor localStorage works (private mode, blocked site data):
          // say so on screen rather than letting data vanish on reload.
          if (!storageBroken) {
            storageBroken = true;
            for (const l of listeners) l();
          }
        }
      }
      savedRev = target;
      lastSavedAt = at;
      channel?.postMessage({ type: 'saved', at });
    }
    // Everything is on disk, so an emergency copy from an earlier close is no longer needed.
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  } finally {
    writing = false;
  }
}

/**
 * Called as the page is hidden or closed. An IndexedDB write may not finish in time, so if
 * anything is unsaved, also write it synchronously to localStorage; the next load picks it up.
 */
export function flush() {
  if (savedRev >= rev) return;
  void persist();
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ at: Date.now(), state }));
  } catch {
    /* too large or blocked: the IndexedDB write is still under way */
  }
}

const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
export const resolveTheme = (t: ThemeChoice): ThemeId => (t === 'auto' ? (darkQuery?.matches ? 'iron' : 'clean') : t);

function applyTheme() {
  setDayStartHour(state.settings.dayStart);
  const theme = resolveTheme(state.settings.theme);
  document.documentElement.dataset.theme = theme;
  if (state.settings.readableText) document.documentElement.dataset.readable = '';
  else delete document.documentElement.dataset.readable;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[theme] ?? THEME_BG.iron);
  try {
    localStorage.setItem('logbook.theme', theme);
    localStorage.setItem('logbook.dayStart', String(state.settings.dayStart));
    localStorage.setItem('logbook.readable', state.settings.readableText ? '1' : '');
  } catch {
    /* ignore */
  }
}

function emit() {
  rev++;
  for (const l of listeners) l();
  applyTheme();
  queueMicrotask(() => void persist());
}

/** Read the newest saved copy: IndexedDB, the localStorage fallback, or an emergency copy. */
async function readSaved(): Promise<{ raw: unknown; at: number }> {
  const candidates: { raw: unknown; at: number }[] = [];
  try {
    const [raw, at] = await getMany([KEY, AT_KEY]);
    if (raw) candidates.push({ raw, at: Number(at) || 1 });
  } catch {
    /* fall through */
  }
  try {
    const s = localStorage.getItem(KEY);
    if (s) candidates.push({ raw: JSON.parse(s), at: Number(localStorage.getItem(AT_KEY)) || 0 });
  } catch {
    /* ignore */
  }
  try {
    const p = localStorage.getItem(PENDING_KEY);
    if (p) {
      const parsed = JSON.parse(p);
      if (parsed?.state) candidates.push({ raw: parsed.state, at: Number(parsed.at) || 0 });
    }
  } catch {
    /* ignore */
  }
  candidates.sort((x, y) => y.at - x.at);
  return candidates[0] ?? { raw: undefined, at: 0 };
}

export async function loadState() {
  if (loaded) return;
  const { raw, at } = await readSaved();
  state = normalize(raw);
  lastSavedAt = at;
  loaded = true;
  applyTheme();
  for (const l of listeners) l();
  // If the newest copy was the emergency one, write it properly now.
  try {
    if (localStorage.getItem(PENDING_KEY)) {
      rev++;
      void persist();
    }
  } catch {
    /* ignore */
  }
  // Ask the browser not to evict our data under storage pressure.
  void navigator.storage?.persist?.().catch(() => undefined);
}

/**
 * Another tab saved: take its copy, so this tab never writes an older state back over it.
 * Only when this tab has nothing unsaved of its own.
 */
async function adoptOtherTab() {
  if (!loaded || savedRev < rev || writing) return;
  const { raw, at } = await readSaved();
  if (raw && at > lastSavedAt) {
    state = normalize(raw);
    lastSavedAt = at;
    applyTheme();
    for (const l of listeners) l();
  }
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
/** Re-renders when saving starts or stops failing (the app state itself does not change then). */
export const useStorageBroken = () => useSyncExternalStore(subscribe, isStorageBroken);

if (typeof window !== 'undefined') {
  // 'auto' theme follows the phone switching between light and dark.
  darkQuery?.addEventListener?.('change', () => {
    if (state.settings.theme === 'auto') applyTheme();
  });
  // Apply the saved start of day before the first render, so the first "today" is already right.
  try {
    setDayStartHour(Number(localStorage.getItem('logbook.dayStart')) || 0);
  } catch {
    /* ignore */
  }
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else void adoptOtherTab();
  });
  if (channel) channel.onmessage = () => void adoptOtherTab();
  window.addEventListener('focus', () => void adoptOtherTab());
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
export function lastSets(s: AppState, exerciseId: ID, beforeWorkoutId?: ID, routineId?: ID | null): SetLog[] | null {
  const find = (sameDay: boolean) => {
    for (const w of finishedWorkouts(s)) {
      if (w.id === beforeWorkoutId) continue;
      if (sameDay && w.routineId !== routineId) continue;
      const done = w.exercises
        .filter((e) => e.exerciseId === exerciseId)
        .flatMap((e) => e.sets)
        .filter((x) => x.done && x.reps != null);
      if (done.length) return done;
    }
    return null;
  };
  // Prefer the same training day (heavy bench on Friday should not suggest Monday's light bench).
  return (routineId ? find(true) : null) ?? find(false);
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
    lastAt: Date.now(),
    finishedAt: null,
    exercises: (routine?.exercises ?? []).map((re) => {
      const last = lastSets(s, re.exerciseId, undefined, routine?.id);
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
    // When editing a saved session, a set with reps filled in counts as done even if not ticked.
    if (w.finishedAt != null) for (const ex of w.exercises) for (const x of ex.sets) if (x.reps != null) x.done = true;
    // Keep only what was actually done.
    for (const ex of w.exercises) ex.sets = ex.sets.filter((x) => x.done && x.reps != null);
    w.exercises = w.exercises.filter((ex) => ex.sets.length);
    if (w.finishedAt != null) return; // editing an already finished session keeps its times
    // A session left open for hours (forgotten) ends at its last activity, not now.
    const now = Date.now();
    const last = Math.max(w.lastAt ?? w.startedAt, w.startedAt);
    w.finishedAt = now - last > 3 * 3600_000 ? last + 5 * 60_000 : now;
  });
}

/** Create an empty, already finished session on a past date, for logging after the fact. */
export function createPastWorkout(date: string, routine: Routine | null): ID {
  const id = uid();
  const s = getState();
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(y, m - 1, d, 12, 0).getTime();
  update((dr) => {
    dr.workouts.push({
      id,
      routineId: routine?.id ?? null,
      name: routine?.name ?? 'Session',
      date,
      startedAt: at,
      finishedAt: at, // same as start: duration unknown
      exercises: (routine?.exercises ?? []).map((re) => {
        const last = lastSets(s, re.exerciseId, undefined, routine?.id);
        return {
          exerciseId: re.exerciseId,
          sets: Array.from({ length: Math.max(1, re.sets) }, (_, i) => ({
            weight: last?.[Math.min(i, last.length - 1)]?.weight ?? null,
            reps: null,
            done: false,
          })),
        };
      }),
    });
  });
  return id;
}

/** True when a finished session has no real duration (it was logged after the fact). */
export const durationUnknown = (w: Workout) => w.finishedAt != null && w.finishedAt - w.startedAt < 60_000;

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

/* ---------- targets ---------- */

/** The targets that applied on a given day (changing targets today never rewrites the past). */
export function targetsFor(s: AppState, date: string): Macros {
  let found: Macros | null = null;
  for (const h of s.settings.targetHistory) if (h.from <= date) found = h.targets;
  return found ?? s.settings.targetHistory[0]?.targets ?? s.settings.targets;
}

/** Change today's targets, remembering what applied before. */
export function setTargets(next: Macros) {
  update((d) => {
    const day = today();
    // The first real targets (from the questions) apply to every earlier day too: the placeholder
    // shown before was never the person's target.
    if (!d.settings.targetsReviewed) {
      d.settings.targetHistory = [{ from: '0000-01-01', targets: { ...next } }];
      d.settings.targets = { ...next };
      return;
    }
    const hist = d.settings.targetHistory;
    if (!hist.length) hist.push({ from: '0000-01-01', targets: { ...d.settings.targets } });
    const last = hist[hist.length - 1];
    if (last.from === day) last.targets = { ...next };
    else hist.push({ from: day, targets: { ...next } });
    d.settings.targets = { ...next };
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
    if (!d.splitName) d.splitName = tpl.name;
    d.routines.push(...routines);
    d.week = tpl.week.map((i) => (i == null ? null : routines[i].id));
  });
}
