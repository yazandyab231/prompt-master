// Writes e2e/.out/seed-backup.json: 10 weeks of realistic sample data ending yesterday.
// Builds a realistic 10-week backup file so charts and history can be looked at.
const { writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const X = (n) => 'x-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const days = [
  { id: 'r-push', name: 'Push', ex: [['Bench Press', 4, '6-8', 70], ['Overhead Press', 3, '8-10', 40], ['Incline Dumbbell Press', 3, '8-12', 24], ['Lateral Raise', 3, '12-15', 8], ['Triceps Pushdown', 3, '10-12', 25]] },
  { id: 'r-pull', name: 'Pull', ex: [['Deadlift', 3, '5', 110], ['Pull-Up', 3, '6-10', null], ['Barbell Row', 3, '8-10', 60], ['Face Pull', 3, '12-15', 20], ['Barbell Curl', 3, '10-12', 30]] },
  { id: 'r-legs', name: 'Legs', ex: [['Squat', 4, '6-8', 90], ['Romanian Deadlift', 3, '8-10', 80], ['Leg Press', 3, '10-12', 140], ['Leg Curl', 3, '10-12', 40], ['Calf Raise', 4, '12-15', 60]] },
];
// Every weekday has a planned day, so tests that start "today's workout" work on any day they run.
const week = ['r-push', 'r-pull', 'r-legs', 'r-push', 'r-pull', 'r-legs', 'r-push'];
const now = new Date(); now.setHours(12, 0, 0, 0);
const workouts = [], bodyWeights = [], entries = [];
let rnd = 7; const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
for (let back = 70; back >= 1; back--) {
  const d = new Date(now); d.setDate(d.getDate() - back);
  const wd = (d.getDay() + 6) % 7;
  const prog = (70 - back) / 70;
  if (back % 2 === 0 || rand() > 0.6) bodyWeights.push({ date: iso(d), kg: Math.round((84.6 - prog * 3.1 + (rand() - 0.5) * 0.8) * 10) / 10 });
  const r = days.find((x) => x.id === week[wd]);
  if (r && rand() > 0.18) {
    const start = new Date(d); start.setHours(18, 5);
    workouts.push({
      id: 'w' + back, routineId: r.id, name: r.name, date: iso(d), startedAt: +start, finishedAt: +start + (48 + rand() * 20) * 60000,
      exercises: r.ex.map(([n, sets, , base]) => ({
        exerciseId: X(n),
        sets: Array.from({ length: sets }, (_, i) => ({
          weight: base == null ? null : Math.round((base * (1 + prog * 0.14)) / 2.5) * 2.5,
          reps: Math.max(4, Math.round(8 - i * 0.7 + (rand() - 0.5) * 2)), done: true,
        })),
      })),
    });
  }
}
const foods = [['Greek yogurt, 0% fat', 250, 148, 25.8, 9, 1], ['Oats, rolled, dry', 60, 227, 7.9, 40.6, 3.9], ['Chicken breast, cooked', 180, 297, 55.8, 0, 6.5], ['Rice, white, cooked', 250, 325, 6.8, 70.5, 0.8]];
foods.forEach(([name, grams, kcal, p, c, f], i) => {
  const t = new Date(now); t.setHours(8 + i * 3, 10);
  entries.push({ id: 'e' + i, date: iso(now), time: +t, foodId: 'b-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, grams, macros: { kcal, p, c, f } });
});
const state = {
  version: 1, settings: { theme: 'iron', units: 'kg', experimental: true, targets: { kcal: 2400, p: 160, c: 270, f: 75 } }, exercises: [],
  routines: days.map((d) => ({ id: d.id, name: d.name, exercises: d.ex.map(([n, sets, reps]) => ({ exerciseId: X(n), sets, reps })) })),
  week, workouts, bodyWeights, foods: [], entries,
  reminders: [{ id: 'rm1', kind: 'workout', title: 'Time to train', time: '18:00', days: [0, 1, 2, 4, 5, 6], enabled: true }], reminderSeen: {},
};
const out = path.join(__dirname, '.out');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'seed-backup.json'), JSON.stringify({ app: 'logbook', exportedAt: new Date().toISOString(), state }));
console.log(workouts.length, 'workouts', bodyWeights.length, 'weights');
