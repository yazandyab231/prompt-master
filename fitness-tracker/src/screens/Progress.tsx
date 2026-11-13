import { useMemo, useState } from 'react';
import { exerciseById, finishedWorkouts, setBodyWeight, useApp } from '../lib/store';
import { addDays, daysBetween, fmtDay, fmtShort, today } from '../lib/date';
import { e1rm, fmtWeight, kgToDisplay, num } from '../lib/units';
import { LineChart, type Point } from '../ui/Chart';
import { Icon } from '../ui/Icon';
import { WeighSheet } from './Today';

const RANGES = [
  { id: '1M', days: 30 },
  { id: '3M', days: 91 },
  { id: '1Y', days: 365 },
  { id: 'All', days: Infinity },
] as const;

export function Progress() {
  const s = useApp();
  const units = s.settings.units;
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('3M');
  const [weighDate, setWeighDate] = useState<string | null>(null);
  const [metric, setMetric] = useState<'top' | 'e1rm'>('top');
  const [showAll, setShowAll] = useState(false);
  const from = RANGES.find((r) => r.id === range)!.days === Infinity ? '0000-00-00' : addDays(today(), -RANGES.find((r) => r.id === range)!.days);

  /* body weight */
  const weights = s.bodyWeights.filter((b) => b.date >= from);
  const weightPoints: Point[] = weights.map((b) => ({
    x: daysBetween('2020-01-01', b.date),
    y: Number(num(kgToDisplay(b.kg, units), 1)),
    label: fmtShort(b.date),
  }));
  const first = weights[0];
  const last = weights[weights.length - 1];
  const change = first && last && first !== last ? kgToDisplay(last.kg - first.kg, units) : null;

  /* lifts */
  const workouts = useMemo(() => finishedWorkouts(s).slice().reverse(), [s]);
  const lifted = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of workouts) for (const e of w.exercises) if (e.sets.some((x) => x.weight)) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [workouts]);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const current = exerciseId && lifted.includes(exerciseId) ? exerciseId : lifted[0] ?? null;

  const liftPoints: Point[] = [];
  if (current) {
    for (const w of workouts) {
      if (w.date < from) continue;
      const sets = w.exercises.filter((e) => e.exerciseId === current).flatMap((e) => e.sets).filter((x) => x.weight && x.reps);
      if (!sets.length) continue;
      const best = sets.reduce((a, b) =>
        (metric === 'top' ? b.weight! > a.weight! || (b.weight === a.weight && b.reps! > a.reps!) : e1rm(b.weight!, b.reps!) > e1rm(a.weight!, a.reps!)) ? b : a,
      );
      const value = metric === 'top' ? best.weight! : e1rm(best.weight!, best.reps!);
      liftPoints.push({
        x: daysBetween('2020-01-01', w.date),
        y: Number(num(kgToDisplay(value, units), 1)),
        label: fmtShort(w.date),
        detail: `${fmtWeight(best.weight, units)} × ${best.reps}`,
      });
    }
  }
  const liftFirst = liftPoints[0];
  const liftLast = liftPoints[liftPoints.length - 1];
  const liftBest = liftPoints.length ? Math.max(...liftPoints.map((p) => p.y)) : null;

  const listed = [...s.bodyWeights].reverse();

  return (
    <>
      <header className="masthead">
        <div>
          <span className="label">Trends</span>
          <h1 className="display">Progress</h1>
        </div>
      </header>

      <div className="chips" role="group" aria-label="Time range" style={{ marginBottom: 18 }}>
        {RANGES.map((r) => (
          <button key={r.id} className="chip" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
            {r.id}
          </button>
        ))}
      </div>

      <section className="block">
        <div className="block-head">
          <span className="label">Body weight · {units}</span>
          <button className="link" onClick={() => setWeighDate(today())}>
            <Icon name="plus" /> Log weight
          </button>
        </div>
        {weights.length === 0 ? (
          <p className="hint">
            {s.bodyWeights.length ? 'No weigh-ins in this range. Try a longer one.' : 'No weigh-ins yet. Log your weight a few times a week to see the trend.'}
          </p>
        ) : (
          <>
            <div className="kpis">
              <div className="kpi">
                <div className="v">{fmtWeight(last.kg, units)}</div>
                <div className="k">latest</div>
              </div>
              <div className="kpi">
                <div className="v">{change == null ? '–' : `${change > 0 ? '+' : ''}${num(change, 1)}`}</div>
                <div className="k">change in range</div>
              </div>
              <div className="kpi">
                <div className="v">{weights.length}</div>
                <div className="k">weigh-ins</div>
              </div>
            </div>
            <LineChart points={weightPoints} unit={units} />
          </>
        )}
        {listed.length > 0 && (
          <>
            <div className="rows" style={{ marginTop: 16 }}>
              {(showAll ? listed : listed.slice(0, 5)).map((b) => (
                <button key={b.date} className="row" style={{ minHeight: 48, padding: '8px 0' }} onClick={() => setWeighDate(b.date)}>
                  <span className="row-main">
                    <span className="row-title" style={{ fontWeight: 500 }}>
                      {fmtDay(b.date)}
                    </span>
                  </span>
                  <span className="row-end" style={{ fontSize: 20 }}>
                    {fmtWeight(b.kg, units)}
                  </span>
                  <span
                    className="icon-btn"
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete weigh-in for ${fmtDay(b.date)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBodyWeight(b.date, null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setBodyWeight(b.date, null);
                      }
                    }}
                  >
                    <Icon name="trash" />
                  </span>
                </button>
              ))}
            </div>
            {listed.length > 5 && (
              <button className="btn quiet small" style={{ marginTop: 6, marginLeft: -10 }} onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show fewer' : `Show all ${listed.length}`}
              </button>
            )}
          </>
        )}
      </section>

      <section className="block">
        <div className="block-head">
          <span className="label">Lifts · {units}</span>
        </div>
        {!current ? (
          <p className="hint">Finish a session with weighted sets and each lift gets its own trend here.</p>
        ) : (
          <div className="stack">
            <select className="select" value={current} onChange={(e) => setExerciseId(e.target.value)} aria-label="Exercise">
              {lifted.map((id) => (
                <option key={id} value={id}>
                  {exerciseById(s, id).name}
                </option>
              ))}
            </select>
            <div className="seg" role="group" aria-label="Measure">
              <button aria-pressed={metric === 'top'} onClick={() => setMetric('top')}>
                Heaviest set
              </button>
              <button aria-pressed={metric === 'e1rm'} onClick={() => setMetric('e1rm')}>
                Est. 1-rep max
              </button>
            </div>
            {liftPoints.length === 0 ? (
              <p className="hint">No sessions with this lift in the range. Try a longer one.</p>
            ) : (
              <>
                <div className="kpis" style={{ marginBottom: 0 }}>
                  <div className="kpi">
                    <div className="v">{num(liftLast.y, 1)}</div>
                    <div className="k">latest</div>
                  </div>
                  <div className="kpi">
                    <div className="v">{num(liftBest!, 1)}</div>
                    <div className="k">best in range</div>
                  </div>
                  <div className="kpi">
                    <div className="v">
                      {liftPoints.length > 1 ? `${liftLast.y - liftFirst.y > 0 ? '+' : ''}${num(liftLast.y - liftFirst.y, 1)}` : '–'}
                    </div>
                    <div className="k">change in range</div>
                  </div>
                </div>
                <LineChart points={liftPoints} unit={units} />
                {metric === 'e1rm' && (
                  <p className="hint">Estimated from weight and reps (Epley formula). It is a rough guide, and gets less reliable above about 10 reps.</p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {weighDate && <WeighSheet date={weighDate} onClose={() => setWeighDate(null)} />}
    </>
  );
}
