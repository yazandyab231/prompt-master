import type { Macros } from './types';

export interface Profile {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  activity: 1.2 | 1.375 | 1.55 | 1.725;
  goal: 'lose' | 'maintain' | 'gain';
}

/**
 * A starting point, not a prescription: Mifflin-St Jeor resting energy x activity, adjusted for
 * the goal; protein 1.8 g per kg, fat 25% of energy, carbs the rest.
 */
export function suggestTargets(p: Profile): Macros {
  const rest = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const maintain = rest * p.activity;
  const kcal = p.goal === 'lose' ? maintain - Math.min(500, maintain * 0.2) : p.goal === 'gain' ? maintain * 1.1 : maintain;
  const protein = Math.round(1.8 * p.weightKg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const round10 = (v: number) => Math.round(v / 10) * 10;
  return { kcal: round10(protein * 4 + carbs * 4 + fat * 9), p: protein, c: carbs, f: fat };
}
