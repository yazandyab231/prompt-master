export type ID = string;
export type ThemeId = 'clean' | 'iron' | 'ember' | 'tide' | 'chalk' | 'clay';
/** A theme, or 'auto': Iron (soft dark) when the phone is in dark mode, Clean when it is light. */
export type ThemeChoice = ThemeId | 'auto';
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
  /** Last time a set was changed; used to end a forgotten session at a sensible time. */
  lastAt?: number;
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
  /** Measured in ml rather than g (values are per 100 ml). */
  liquid?: boolean;
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
  theme: ThemeChoice;
  units: Units;
  targets: Macros;
  /** Targets as they were from a date on, so changing them never rewrites past days. */
  targetHistory: { from: string; targets: Macros }[];
  /** Hour (0-6) at which a new day starts; 0 = midnight. */
  dayStart: number;
  /** True once the person answered the target questions. No calorie or macro target is shown before that. */
  targetsReviewed: boolean;
  /** True once the person picked a theme themselves (otherwise the default can change). */
  themeChosen?: boolean;
  /** Sentence-case, normal-width text instead of spaced capitals (easier for dyslexia and low vision). */
  readableText: boolean;
  /** Date of the last backup export, to nudge now and then. */
  lastExport?: string;
}

export interface AppState {
  version: 1;
  settings: Settings;
  exercises: Exercise[]; // custom exercises only
  routines: Routine[];
  /** The person's name for their split, e.g. "PPL". */
  splitName?: string;
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
