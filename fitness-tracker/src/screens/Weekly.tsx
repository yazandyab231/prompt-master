import { useState } from 'react';
import type { Nav } from '../App';
import { exerciseById, finishedWorkouts, routineById, targetsFor, useApp } from '../lib/store';
import { addDays, DAYS_SHORT, fmtShort, fromISO, startOfWeek, today } from '../lib/date';
import { e1rm, fmtWeight, kgToDisplay, num, plural, sum } from '../lib/units';
import { weekAverage } from '../lib/trend';
import { Icon } from '../ui/Icon';
import { DaySheet, TargetsSheet } from './Today';

/** One week at a glance: lifts, food against targets, and the days that were missed. */
export function WeeklyReport({ nav }: { nav: Nav }) {
  const s = useApp();
  const t = today();
  const units = s.settings.units;
  const [start, setStart] = useState(startOfWeek(t));
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const end = addDays(start, 6);
  const isThisWeek = start === startOfWeek(t);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const done = finishedWorkouts(s);

  /* days */
  const info = days.map((d, i) => {
    const planned = routineById(s, s.week[i]);
    const workouts = done.filter((w) => w.date === d && w.exercises.some((e) => e.sets.some((x) => x.done)));
    const entries = s.entries.filter((e) => e.date === d);
    const past = d < t;
    return {
      date: d,
      planned,
      trained: workouts.length > 0,
      food: entries.length > 0,
      kcal: sum(entries.map((e) => e.macros)).kcal,
      missedWorkout: past && !!planned && workouts.length === 0,
      missedFood: past && entries.length === 0,
      future: d > t,
    };
  });
  const missedWorkouts = info.filter((d) => d.missedWorkout).length;
  const missedFood = info.filter((d) => d.missedFood).length;

  /* food */
  const loggedDays = info.filter((d) => d.food);
  const avg = loggedDays.length
    ? (() => {
        const tot = sum(loggedDays.map((d) => sum(s.entries.filter((e) => e.date === d.date).map((e) => e.macros))));
        const n = loggedDays.length;
        return { kcal: tot.kcal / n, p: tot.p / n, c: tot.c / n, f: tot.f / n };
      })()
    : null;
  const avgTarget = loggedDays.length
    ? (() => {
        const ts = loggedDays.map((d) => targetsFor(s, d.date));
        const n = ts.length;
        return { kcal: sum(ts).kcal / n, p: sum(ts).p / n, c: sum(ts).c / n, f: sum(ts).f / n };
      })()
    : null;
  const onTarget = loggedDays.filter((d) => Math.abs(d.kcal - targetsFor(s, d.date).kcal) <= targetsFor(s, d.date).kcal * 0.1).length;

  /* lifts: best set this week against the best before it */
  const weekWorkouts = done.filter((w) => w.date >= start && w.date <= end);
  const exerciseIds = [...new Set(weekWorkouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))];
  const lifts = exerciseIds.flatMap((id) => {
    // Only sets actually done count (a missed day being filled in has empty sets until saved).
    const sets = weekWorkouts.flatMap((w) => w.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets)).filter((x) => x.done && x.reps);
    if (!sets.length) return [];
    const before = done
      .filter((w) => w.date < start)
      .flatMap((w) => w.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets))
      .filter((x) => x.done && x.reps);
    const score = (x: { weight: number | null; reps: number | null }) => (x.weight ? e1rm(x.weight, x.reps!) : x.reps!);
    const best = sets.reduce((a, b) => (score(b) > score(a) ? b : a), sets[0]);
    const prevBest = before.length ? Math.max(...before.map(score)) : null;
    const trend = prevBest == null ? 'first' : score(best) > prevBest + 1e-9 ? 'up' : score(best) < prevBest - 1e-9 ? 'below' : 'same';
    return [{ id, name: exerciseById(s, id).name, best, sets: sets.length, trend }];
  });

  /* body weight */
  const wNow = weekAverage(s.bodyWeights, end);
  const wPrev = weekAverage(s.bodyWeights, addDays(end, -7));
  const inWeek = s.bodyWeights.some((b) => b.date >= start && b.date <= end);

  return (
    <section className="block">
      <div className="block-head">
        <h2 className="label">Weekly report</h2>
        <div style={{ display: 'flex' }}>
          <button className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">
            <Icon name="left" />
          </button>
          <button className="icon-btn" disabled={isThisWeek} onClick={() => setStart(addDays(start, 7))} aria-label="Next week">
            <Icon name="right" />
          </button>
        </div>
      </div>
      <p className="week-title">
        {isThisWeek ? 'This week' : `${fmtShort(start)} – ${fmtShort(end)}`}
      </p>

      {/* Days: tap any past day to fill it in */}
      <ul className="report-days" aria-label="Days of the week. Tap a day to log for it.">
        {info.map((d, i) => {
          const missed = d.missedWorkout || d.missedFood;
          const spoken = `${DAYS_SHORT[i]} ${fromISO(d.date).getDate()}: ${d.trained ? 'trained' : d.missedWorkout ? 'missed workout' : 'no workout'}, ${d.food ? 'food logged' : d.missedFood ? 'no food logged' : 'no food yet'}`;
          return (
            <li key={d.date}>
              <button
                className={'report-day' + (missed ? ' is-missed' : '') + (d.date === t ? ' is-today' : '')}
                disabled={d.future}
                onClick={() => setDayOpen(d.date)}
                aria-label={spoken}
              >
                <span className="d">{DAYS_SHORT[i]}</span>
                <span className="n">{fromISO(d.date).getDate()}</span>
                <span className="marks" aria-hidden="true">
                  <i className={d.trained ? 'm-on' : d.missedWorkout ? 'm-miss' : 'm-off'} title="Workout" />
                  <i className={d.food ? 'm-on' : d.missedFood ? 'm-miss' : 'm-off'} title="Food" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint report-legend">
        <span>
          <i className="m-on" /> logged
        </span>
        <span>
          <i className="m-miss" /> missed
        </span>
        <span>Top dot workout, bottom dot food. Tap a day to fill it in.</span>
      </p>
      {missedWorkouts + missedFood > 0 && (
        <p className="report-missed">
          Missed: {[missedWorkouts && plural(missedWorkouts, 'workout'), missedFood && plural(missedFood, 'day') + ' without food'].filter(Boolean).join(', ')}
        </p>
      )}

      {/* Lifts */}
      <h3 className="report-h">Lifts</h3>
      {lifts.length === 0 ? (
        <p className="hint">No workouts this week.</p>
      ) : (
        <div className="rows">
          {lifts.map((l) => (
            <div key={l.id} className="row" style={{ minHeight: 52 }}>
              <span className="row-main">
                <span className="row-title">{l.name}</span>
                <span className="row-sub">{plural(l.sets, 'set')}</span>
              </span>
              <span className="row-end" style={{ fontSize: 16 }}>
                {l.best.weight != null ? `${fmtWeight(l.best.weight, units)} ${units} × ${l.best.reps}` : `${l.best.reps} reps`}
                <small className={'trend-' + l.trend}>
                  {l.trend === 'up' ? '▲ new best' : l.trend === 'same' ? 'equal to best' : l.trend === 'below' ? 'below best' : 'first time'}
                </small>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Food */}
      <h3 className="report-h">Food</h3>
      {!avg ? (
        <p className="hint">No food logged this week.</p>
      ) : s.settings.targetsReviewed && avgTarget ? (
        <div className="report-table" role="table" aria-label="Daily average against target">
          <div role="row" className="rt-head">
            <span role="columnheader">Daily average</span>
            <span role="columnheader">Eaten</span>
            <span role="columnheader">Target</span>
          </div>
          {(
            [
              ['Calories', avg.kcal, avgTarget.kcal, 'kcal'],
              ['Protein', avg.p, avgTarget.p, 'g'],
              ['Carbs', avg.c, avgTarget.c, 'g'],
              ['Fat', avg.f, avgTarget.f, 'g'],
            ] as const
          ).map(([name, a, tg, u]) => (
            <div role="row" key={name}>
              <span role="cell">{name}</span>
              <span role="cell" className={a > tg * 1.1 ? 'is-over' : ''}>
                {Math.round(a).toLocaleString('en-US')} {u}
              </span>
              <span role="cell">
                {Math.round(tg).toLocaleString('en-US')} {u}
              </span>
            </div>
          ))}
          <p className="hint" style={{ marginTop: 8 }}>
            Calories within 10% of target on {onTarget} of {plural(loggedDays.length, 'logged day')}.
          </p>
        </div>
      ) : (
        <>
          <p className="mono">
            Average {Math.round(avg.kcal).toLocaleString('en-US')} kcal · P {Math.round(avg.p)} · C {Math.round(avg.c)} · F {Math.round(avg.f)} g per logged day
          </p>
          <button className="btn ghost wide" style={{ marginTop: 10 }} onClick={() => setTargetsOpen(true)}>
            Set my calorie target
          </button>
        </>
      )}

      {/* Body weight */}
      <h3 className="report-h">Body weight</h3>
      {inWeek && wNow ? (
        <p className="mono">
          Average {fmtWeight(wNow.kg, units, 1)} {units}
          {wPrev ? ` · ${wNow.kg - wPrev.kg > 0 ? '+' : ''}${num(kgToDisplay(wNow.kg - wPrev.kg, units), 1)} ${units} vs the week before` : ''}
        </p>
      ) : (
        <p className="hint">No weigh-ins this week.</p>
      )}

      {dayOpen && <DaySheet date={dayOpen} nav={nav} onClose={() => setDayOpen(null)} />}
      {targetsOpen && <TargetsSheet onClose={() => setTargetsOpen(false)} />}
    </section>
  );
}
