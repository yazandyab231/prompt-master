import { useState } from 'react';
import type { SetLog, Workout } from '../lib/types';
import { deleteWorkout, exerciseById, finishWorkout, lastSets, routineById, update, useApp } from '../lib/store';
import { fmtDuration } from '../lib/date';
import { displayToKg, fmtWeight, kgToDisplay, num, parseNum } from '../lib/units';
import { Icon } from '../ui/Icon';
import { ExercisePicker } from '../ui/ExercisePicker';
import { Sheet } from '../ui/Sheet';
import { toast, useTick } from '../ui/bits';

export function WorkoutLogger({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const s = useApp();
  const units = s.settings.units;
  const routine = routineById(s, workout.routineId);
  const [picking, setPicking] = useState(false);
  const [ending, setEnding] = useState(false);
  useTick(15_000);

  const edit = (fn: (w: Workout) => void) =>
    update((d) => {
      const w = d.workouts.find((x) => x.id === workout.id);
      if (w) fn(w);
    });

  const doneSets = workout.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <div className="workout" role="dialog" aria-label={`Session: ${workout.name}`}>
      <div className="workout-inner">
        <div className="workout-bar">
          <button className="icon-btn" onClick={onClose} aria-label="Minimise session">
            <Icon name="down" />
          </button>
          <div className="title">
            <b>{workout.name}</b>
            <span>
              {fmtDuration(Date.now() - workout.startedAt)} · {doneSets}/{totalSets} sets
            </span>
          </div>
        </div>

        {workout.exercises.length === 0 && (
          <div className="empty">
            <strong>Empty session</strong>
            Add the first exercise and start logging sets.
          </div>
        )}

        {workout.exercises.map((ex, ei) => {
          const info = exerciseById(s, ex.exerciseId);
          const last = lastSets(s, ex.exerciseId, workout.id);
          const target = routine?.exercises.find((r) => r.exerciseId === ex.exerciseId);
          return (
            <section className="ex" key={`${ex.exerciseId}-${ei}-${workout.exercises.length}`} aria-label={info.name}>
              <div className="ex-head">
                <h3>
                  {info.name}
                  <span className="mono">
                    {target ? `Target ${target.sets} × ${target.reps}` : info.group}
                    {last ? '' : ' · no history yet'}
                  </span>
                </h3>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${info.name} from session`}
                  onClick={() => edit((w) => void w.exercises.splice(ei, 1))}
                >
                  <Icon name="trash" />
                </button>
              </div>
              <div className="set-grid head" aria-hidden="true">
                <span>Set</span>
                <span>Last</span>
                <span>{units}</span>
                <span>Reps</span>
                <span />
              </div>
              {ex.sets.map((set, si) => (
                <SetRow
                  key={si}
                  n={si + 1}
                  set={set}
                  last={last?.[Math.min(si, (last?.length ?? 1) - 1)] ?? null}
                  units={units}
                  name={info.name}
                  onChange={(patch) => edit((w) => void Object.assign(w.exercises[ei].sets[si], patch))}
                />
              ))}
              <div className="ex-actions">
                <button
                  className="btn quiet small"
                  onClick={() =>
                    edit((w) => {
                      const sets = w.exercises[ei].sets;
                      const prev = sets[sets.length - 1];
                      sets.push({ weight: prev?.weight ?? null, reps: null, done: false });
                    })
                  }
                >
                  <Icon name="plus" /> Add set
                </button>
                {ex.sets.length > 1 && (
                  <button className="btn quiet small" onClick={() => edit((w) => void w.exercises[ei].sets.pop())}>
                    Remove last set
                  </button>
                )}
              </div>
            </section>
          );
        })}

        <button className="btn ghost wide" style={{ marginTop: 20 }} onClick={() => setPicking(true)}>
          <Icon name="plus" /> Add exercise
        </button>
      </div>

      <div className="workout-foot">
        <button className="btn wide" onClick={() => setEnding(true)}>
          Finish session
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            const prev = lastSets(s, id, workout.id);
            edit((w) => {
              w.exercises.push({
                exerciseId: id,
                sets: [{ weight: prev?.[0]?.weight ?? null, reps: null, done: false }],
              });
            });
            setPicking(false);
          }}
        />
      )}

      {ending && (
        <Sheet title="Finish session" onClose={() => setEnding(false)}>
          <div className="stack">
            {doneSets > 0 ? (
              <>
                <p className="hint">
                  {doneSets} completed {doneSets === 1 ? 'set' : 'sets'} will be saved.
                  {totalSets > doneSets ? ` ${totalSets - doneSets} unticked ${totalSets - doneSets === 1 ? 'set is' : 'sets are'} left out.` : ''}
                </p>
                <button
                  className="btn wide"
                  onClick={() => {
                    finishWorkout(workout.id);
                    toast('Session saved');
                    onClose();
                  }}
                >
                  Save session
                </button>
              </>
            ) : (
              <p className="hint">No sets are ticked yet, so there is nothing to save. Tick the sets you did, or discard the session.</p>
            )}
            <button
              className="btn danger wide"
              onClick={() => {
                deleteWorkout(workout.id);
                onClose();
              }}
            >
              Discard session
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function SetRow(props: {
  n: number;
  set: SetLog;
  last: SetLog | null;
  units: 'kg' | 'lb';
  name: string;
  onChange: (patch: Partial<SetLog>) => void;
}) {
  const { set, last, units } = props;
  const show = (kg: number | null) => (kg == null ? '' : num(kgToDisplay(kg, units), units === 'kg' ? 2 : 1));
  const [w, setW] = useState(show(set.weight));
  const [r, setR] = useState(set.reps == null ? '' : String(set.reps));

  const toggle = () => {
    if (set.done) return props.onChange({ done: false });
    // Ticking an empty set repeats last time's numbers, so one tap logs a matched set.
    const reps = set.reps ?? last?.reps ?? null;
    if (reps == null) {
      toast('Enter the reps first');
      return;
    }
    const weight = set.weight ?? (w.trim() === '' ? last?.weight ?? null : set.weight);
    setR(String(reps));
    setW(show(weight));
    props.onChange({ done: true, reps, weight });
  };

  return (
    <div className={'set-grid set-row' + (set.done ? ' is-done' : '')}>
      <span className="set-n">{props.n}</span>
      <span className="set-last">{last ? `${last.weight != null ? fmtWeight(last.weight, units) : 'BW'}×${last.reps}` : '–'}</span>
      <input
        className="set-input"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`${props.name} set ${props.n} weight in ${units}`}
        placeholder={last?.weight != null ? fmtWeight(last.weight, units) : '0'}
        value={w}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, '');
          setW(t);
          const v = parseNum(t);
          props.onChange({ weight: v == null ? null : displayToKg(v, units) });
        }}
      />
      <input
        className="set-input"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${props.name} set ${props.n} reps`}
        placeholder={last?.reps != null ? String(last.reps) : '0'}
        value={r}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '').slice(0, 3);
          setR(t);
          props.onChange({ reps: t === '' ? null : Number(t), ...(t === '' ? { done: false } : {}) });
        }}
      />
      <button className="set-check" onClick={toggle} aria-pressed={set.done} aria-label={`${props.name} set ${props.n} done`}>
        <Icon name="check" />
      </button>
    </div>
  );
}
