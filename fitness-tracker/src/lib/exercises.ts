import type { Exercise } from './types';

// The id comes from the name, so a name must never change once shipped (logged sets point at it).
const G = (group: string, names: string[]): Exercise[] =>
  names.map((name) => ({
    id: 'x-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    group,
  }));

export const BUILTIN_EXERCISES: Exercise[] = [
  ...G('Chest', [
    'Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press',
    'Smith Machine Bench Press', 'Smith Machine Incline Press', 'Machine Chest Press', 'Dumbbell Fly', 'Cable Fly',
    'Low-to-High Cable Fly', 'Pec Deck', 'Push-Up', 'Dip', 'Landmine Press',
  ]),
  ...G('Back', [
    'Deadlift', 'Trap Bar Deadlift', 'Rack Pull', 'Pull-Up', 'Chin-Up', 'Lat Pulldown', 'Close-Grip Lat Pulldown',
    'Single-Arm Lat Pulldown', 'Barbell Row', 'Pendlay Row', 'Dumbbell Row', 'Meadows Row', 'Seated Cable Row',
    'T-Bar Row', 'Chest-Supported Row', 'Machine Row', 'Inverted Row', 'Straight-Arm Pulldown', 'Dumbbell Pullover',
    'Back Extension',
  ]),
  ...G('Shoulders', [
    'Overhead Press', 'Push Press', 'Dumbbell Shoulder Press', 'Arnold Press', 'Machine Shoulder Press', 'Lateral Raise',
    'Cable Lateral Raise', 'Front Raise', 'Upright Row', 'Rear Delt Fly', 'Reverse Pec Deck', 'Face Pull', 'Shrug',
    'Dumbbell Shrug',
  ]),
  ...G('Biceps', [
    'Barbell Curl', 'EZ-Bar Curl', 'Dumbbell Curl', 'Hammer Curl', 'Incline Dumbbell Curl', 'Preacher Curl',
    'Concentration Curl', 'Spider Curl', 'Cable Curl', 'Bayesian Cable Curl', 'Machine Curl',
  ]),
  ...G('Triceps', [
    'Triceps Pushdown', 'Rope Pushdown', 'Overhead Triceps Extension', 'Overhead Cable Extension', 'Skull Crusher',
    'Close-Grip Bench Press', 'JM Press', 'Dumbbell Kickback', 'Bench Dip', 'Diamond Push-Up', 'Machine Triceps Extension',
  ]),
  ...G('Forearms', [
    'Wrist Curl', 'Reverse Wrist Curl', 'Reverse Curl', "Farmer's Carry", 'Dead Hang', 'Plate Pinch', 'Wrist Roller',
  ]),
  ...G('Legs', [
    'Squat', 'Front Squat', 'Goblet Squat', 'Smith Machine Squat', 'Leg Press', 'Hack Squat', 'Pendulum Squat',
    'Bulgarian Split Squat', 'Lunge', 'Walking Lunge', 'Step-Up', 'Romanian Deadlift', 'Sumo Deadlift',
    'Stiff-Leg Deadlift', 'Good Morning', 'Leg Extension', 'Leg Curl', 'Seated Leg Curl', 'Nordic Curl', 'Hip Thrust',
    'Glute Bridge', 'Hip Abduction', 'Hip Adduction', 'Calf Raise', 'Seated Calf Raise',
  ]),
  ...G('Core', [
    'Plank', 'Side Plank', 'Crunch', 'Cable Crunch', 'Hanging Leg Raise', 'Lying Leg Raise', 'Ab Wheel Rollout',
    'Russian Twist', 'Dead Bug', 'Pallof Press', 'Decline Sit-Up', 'Mountain Climber',
  ]),
];

/** Tabs in the exercise picker, in order. Arms are split so each list stays short. */
export const EXERCISE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Legs', 'Core', 'Other'];

/** Custom exercises saved under the old single "Arms" group get the closest new group. */
export function groupForOldArms(name: string): string {
  const n = name.toLowerCase();
  if (/tricep|pushdown|push-down|extension|skull|kickback|dip|close.?grip|jm press/.test(n)) return 'Triceps';
  if (/wrist|forearm|grip|farmer|hang|pinch|roller/.test(n)) return 'Forearms';
  if (/curl|bicep/.test(n)) return 'Biceps';
  return 'Other';
}
