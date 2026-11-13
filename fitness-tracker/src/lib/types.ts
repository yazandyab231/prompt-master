export type ID = string;
export type ThemeId = 'iron' | 'ember' | 'tide' | 'chalk' | 'clay';
export type Units = 'kg' | 'lb';

export interface Macros {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface Exercise {
  id: ID;
  name: string;
  group: string;
  custom?: boolean;
}

export interface RoutineExercise {
  exerciseId: ID;
  sets: number;
  reps: string; // free text target, e.g. "8-12"
}

/** One training day of the split, e.g. "Push". */
export interface Routine {
  id: ID;
  name: string;
  exercises: RoutineExercise[];
}

export interface SetLog {
  /** Always stored in kilograms; null = not entered yet. */
  weight: number | null;
  reps: number | null;
  done: boolean;
}

export interface WorkoutExercise {
  exerciseId: ID;
  sets: SetLog[];
}

export interface Workout {
  id: ID;
  routineId: ID | null;
  name: string;
  date: string; // YYYY-MM-DD (local)
  startedAt: number;
  finishedAt: number | null; // null = in progress
  exercises: WorkoutExercise[];
  note?: string;
}

export interface BodyWeight {
  date: string;
  kg: number;
}

export type FoodSource = 'builtin' | 'custom' | 'barcode' | 'label';

export interface Food {
  id: ID;
  name: string;
  brand?: string;
  per100: Macros; // per 100 g (or 100 ml)
  servingG?: number;
  source: FoodSource;
  barcode?: string;
}

export interface FoodEntry {
  id: ID;
  date: string;
  time: number;
  foodId?: ID;
  name: string;
  grams: number | null; // null for quick-add entries
  macros: Macros; // snapshot at the time of logging
}

export type ReminderKind = 'workout' | 'meal' | 'weigh' | 'custom';

export interface Reminder {
  id: ID;
  kind: ReminderKind;
  title: string;
  time: string; // HH:MM local
  days: number[]; // 0 = Monday … 6 = Sunday
  enabled: boolean;
}

export interface Settings {
  theme: ThemeId;
  units: Units;
  targets: Macros;
}

export interface AppState {
  version: 1;
  settings: Settings;
  exercises: Exercise[]; // custom exercises only
  routines: Routine[];
  /** Weekly split: index 0 = Monday … 6 = Sunday; null = rest day. */
  week: (ID | null)[];
  workouts: Workout[];
  bodyWeights: BodyWeight[];
  foods: Food[]; // saved foods (custom, barcode, label)
  entries: FoodEntry[];
  reminders: Reminder[];
  /** reminder id -> YYYY-MM-DD it was last shown, so it fires once a day. */
  reminderSeen: Record<ID, string>;
}
