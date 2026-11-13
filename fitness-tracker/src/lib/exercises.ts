import type { Exercise } from './types';

const G = (group: string, names: string[]): Exercise[] =>
  names.map((name) => ({
    id: 'x-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    group,
  }));

export const BUILTIN_EXERCISES: Exercise[] = [
  ...G('Chest', [
    'Bench Press', 'Incline Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press',
    'Machine Chest Press', 'Cable Fly', 'Pec Deck', 'Push-Up', 'Dip',
  ]),
  ...G('Back', [
    'Deadlift', 'Pull-Up', 'Chin-Up', 'Lat Pulldown', 'Barbell Row', 'Dumbbell Row',
    'Seated Cable Row', 'T-Bar Row', 'Chest-Supported Row', 'Straight-Arm Pulldown',
  ]),
  ...G('Shoulders', [
    'Overhead Press', 'Dumbbell Shoulder Press', 'Machine Shoulder Press', 'Lateral Raise',
    'Cable Lateral Raise', 'Rear Delt Fly', 'Face Pull', 'Shrug',
  ]),
  ...G('Arms', [
    'Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl',
    'Triceps Pushdown', 'Overhead Triceps Extension', 'Skull Crusher', 'Close-Grip Bench Press',
  ]),
  ...G('Legs', [
    'Squat', 'Front Squat', 'Leg Press', 'Hack Squat', 'Bulgarian Split Squat', 'Lunge',
    'Romanian Deadlift', 'Leg Extension', 'Leg Curl', 'Hip Thrust', 'Calf Raise', 'Seated Calf Raise',
  ]),
  ...G('Core', ['Plank', 'Hanging Leg Raise', 'Cable Crunch', 'Ab Wheel Rollout']),
];

export const EXERCISE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Other'];
