import { useRef, useState } from 'react';
import type { AppState, SetLog, Workout } from '../lib/types';
import { deleteWorkout, exerciseById, finishWorkout, finishedWorkouts, getState, lastSets, replaceState, routineById, update, useApp } from '../lib/store';
import { fmtDay, fmtDuration, today } from '../lib/date';
import { cleanDecimal, displayToKg, e1rm, fmtWeight, kgToDisplay, num, parseNum, plural, toLatinDigits } from '../lib/units';
import { Icon } from '../ui/Icon';
import { ExercisePicker } from '../ui/ExercisePicker';
import { Sheet, useModal } from '../ui/Sheet';
import { toast, useTick } from '../ui/bits';

/** Personal bests this session set, compared with every earlier finished session. */
function newBests(s: AppState, w: Workout): string[] {
  const out: string[] = [];
  const earlier = finishedWorkouts(s).filter((x) => x.id !== w.id && x.startedAt < w.startedAt);
  const seen = new Set<string>();
  for (const ex of w.exercises) {
    if (seen.has(ex.exerciseId)) continue;
    seen.add(ex.exerciseId);
    const now = ex.sets.filter((x) => x.done && x.weight && x.reps);
    if (!now.length) continue;
    const before = earlier.flatMap((x) => x.exercises.filter((e) => e.exerciseId === ex.exerciseId).flatMap((e) => e.sets)).filter((x) => x.weight && x.reps);
    if (!before.length) continue; // a first session is not a record
    const bestW = Math.max(...before.map((x) => x.weight!));
    const bestE = Math.max(...before.map((x) => e1rm(x.weight!, x.reps!)));
    const topW = now.reduce((a, b) => (b.weight! > a.weight! ? b : a));
    const topE = now.reduce((a, b) => (e1rm(b.weight!, b.reps!) > e1rm(a.weight!, a.reps!) ? b : a));
    const name = exerciseById(s, ex.exerciseId).name;
    const u = s.settings.units;
    if (topW.weight! > bestW + 1e-9) out.push(`${name} ${fmtWeight(topW.weight, u)} ${u}`);
    else if (e1rm(topE.weight!, topE.reps!) > bestE + 1e-9) out.push(`${name} ${fmtWeight(topE.weight, u)} ${u} × ${topE.reps}`);
  }
  return out;
}

export function WorkoutLogger({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const s = useApp();
  const units = s.settings.units;
  const routine = routineById(s, workout.routineId);
  const editing = workout.finishedAt != null; // changing a session that was already saved
  const [picking, setPicking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [restFrom, setRestFrom] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  /** Leaving the editor of a saved session tidies it; an edit that ends up empty removes the session. */
  const close = () => {
    if (editing) {
      finishWorkout(workout.id);
      const after = getState().workouts.find((w) => w.id === workout.id);
      if (after && after.exercises.length === 0) deleteWorkout(workout.id);
    }
    onClose();
  };
  useModal(root, close);
  useTick(restFrom ? 1000 : 15_000);

  const edit = (fn: (w: Workout) => void) =>
    update((d) => {
      const w = d.workouts.find((x) => x.id === workout.id);
      if (w) {
        fn(w);
        w.lastAt = Date.now();
      }
    });

  /** Make a change that can be taken back from the toast. */
  const undoable = (message: string, fn: (w: Workout) => void) => {
    const before = getState();
    edit(fn);
    toast(message, { label: 'Undo', run: () => replaceState(before) });
  };

  const doneSets = workout.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const rest = restFrom ? Math.floor((Date.now() - restFrom) / 1000) : null;

  const save = () => {
    const bests = editing ? [] : newBests(getState(), workout);
    finishWorkout(workout.id);
    if (bests.length) toast(`New best: ${bests.slice(0, 2).join(', ')}${bests.length > 2 ? ` +${bests.length - 2} more` : ''}`);
    else toast(editing ? 'Changes saved' : 'Session saved');
    if (editing && (getState().workouts.find((w) => w.id === workout.id)?.exercises.length ?? 0) === 0) deleteWorkout(workout.id);
    onClose();
  };

  return (
    <div className="workout" role="dialog" aria-modal="true" aria-label={`${editing ? 'Edit session' : 'Session'}: ${workout.name}`} tabIndex={-1} ref={root}>
      <div className="workout-inner">
        <div className="workout-bar">
          <button className="icon-btn" onClick={close} aria-label={editing ? 'Close' : 'Minimise session'}>
            <Icon name={editing ? 'x' : 'down'} />
          </button>
          <div className="title">
            <b>{workout.name}</b>
            <span>
              {editing ? `Editing · ${fmtDay(workout.date)}` : `${fmtDuration(Date.now() - workout.startedAt)} · ${doneSets}/${totalSets} sets`}
            </span>
          </div>
          {rest != null && !editing && (
            <button className="rest" onClick={() => setRestFrom(null)} aria-label={`Rest ${Math.floor(rest / 60)} minutes ${rest % 60} seconds. Tap to hide.`}>
              <span className="label">Rest</span>
              <b>
                {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}
              </b>
            </button>
          )}
        </div>

        {editing && (
          <label className="field" style={{ marginTop: 18 }}>
            <span className="label">Date</span>
            <input
              className="input"
              type="date"
              value={workout.date}
              max={today()}
              onChange={(e) => {
                const v = e.target.value;
                if (!v || v > today()) return;
                edit((w) => {
                  const [y, m, d] = v.split('-').map(Number);
                  const old = new Date(w.startedAt);
                  const start = new Date(y, m - 1, d, old.getHours(), old.getMinutes()).getTime();
                  const dur = (w.finishedAt ?? w.startedAt) - w.startedAt;
                  w.date = v;
                  w.startedAt = start;
                  w.finishedAt = start + dur;
                });
              }}
            />
          </label>
        )}

        {workout.exercises.length === 0 && (
          <div className="empty">
            <strong>Empty session</strong>
            Add the first exercise and start logging sets.
          </div>
        )}

        {workout.exercises.map((ex, ei) => {
          const info = exerciseById(s, ex.exerciseId);
          const last = lastSets(s, ex.exerciseId, workout.id, workout.routineId);
          const target = routine?.exercises.find((r) => r.exerciseId === ex.exerciseId);
          return (
            <section className="ex" key={`${ex.exerciseId}-${ei}-${workout.exercises.length}`} aria-label={info.name}>
              <div className="ex-head">
                <h3>
                  {info.name}
                  <span className="mono">
                    {target ? `Target ${target.sets} sets of ${target.reps} reps` : info.group}
                    {last ? '' : ' · no history yet'}
                  </span>
                </h3>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${info.name} from session`}
                  onClick={() => undoable(`${info.name} removed`, (w) => void w.exercises.splice(ei, 1))}
                >
                  <Icon name="trash" />
                </button>
              </div>
              <div className="set-grid head" aria-hidden="true">
                <span>Set</span>
                <span className="col-last">Last</span>
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
                  onTicked={() => setRestFrom(Date.now())}
                  onChange={(patch) =>
                    edit((w) => {
                      const sets = w.exercises[ei].sets;
                      const old = sets[si].weight;
                      Object.assign(sets[si], patch);
                      // A new weight on one set carries down to the sets below that still show the old one.
                      if ('weight' in patch && patch.weight !== old) {
                        for (let j = si + 1; j < sets.length; j++) {
                          if (!sets[j].done && (sets[j].weight === old || sets[j].weight == null)) sets[j].weight = patch.weight ?? null;
                        }
                      }
                    })
                  }
                />
              ))}
              <div className="ex-actions">
                <button
                  className="btn quiet small"
                  onClick={() =>
                    edit((w) => {
                      const sets = w.exercises[ei].sets;
                      const prev = sets[sets.length - 1];
                      sets.push({ weight: prev?.weight ?? null, reps: null, done: editing });
                    })
                  }
                >
                  <Icon name="plus" /> Add set
                </button>
                {ex.sets.length > 1 && (
                  <button className="btn quiet small" onClick={() => undoable('Set removed', (w) => void w.exercises[ei].sets.pop())}>
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
        <button className="btn wide" onClick={() => (editing ? save() : setEnding(true))}>
          {editing ? 'Save changes' : 'Finish session'}
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            const prev = lastSets(s, id, workout.id, workout.routineId);
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
        <Sheet
          title="Finish session"
          onClose={() => {
            setEnding(false);
            setConfirmDiscard(false);
          }}
        >
          <div className="stack">
            {doneSets > 0 ? (
              <>
                <p className="hint">
                  {plural(doneSets, 'completed set')} will be saved.
                  {totalSets > doneSets ? ` ${totalSets - doneSets} unticked ${totalSets - doneSets === 1 ? 'set is' : 'sets are'} left out.` : ''}
                </p>
                <button className="btn wide" onClick={save}>
                  Save session
                </button>
              </>
            ) : (
              <p className="hint">No sets are ticked yet, so there is nothing to save. Tick the sets you did, or discard the session.</p>
            )}
            {/* Kept well away from the Finish button and always asks first: a double tap must never delete a workout. */}
            <div style={{ marginTop: 28 }}>
              {confirmDiscard ? (
                <div className="stack tight">
                  <p className="error">Discard this session and its {plural(doneSets, 'ticked set')}? This cannot be undone.</p>
                  <div className="btn-row">
                    <button className="btn ghost" onClick={() => setConfirmDiscard(false)}>
                      Keep it
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => {
                        deleteWorkout(workout.id);
                        onClose();
                      }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn quiet" style={{ color: 'var(--danger)', marginLeft: -10 }} onClick={() => setConfirmDiscard(true)}>
                  <Icon name="trash" /> Discard session
                </button>
              )}
            </div>
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
  onTicked: () => void;
}) {
  const { set, last, units } = props;
  // Two decimals in kg so plate maths like 61.25 survives; one is enough in lb.
  const show = (kg: number | null) => (kg == null ? '' : num(kgToDisplay(kg, units), units === 'kg' ? 2 : 1));
  const [w, setW] = useState(show(set.weight));
  const [r, setR] = useState(set.reps == null ? '' : String(set.reps));
  /** The person typed in or cleared the weight: an empty field then means bodyweight, not "same as last time". */
  const [weightTouched, setWeightTouched] = useState(false);
  const [focused, setFocused] = useState(false);

  // Follow changes made elsewhere (a weight carried down from the set above), but not while typing here.
  const shown = show(set.weight);
  if (!focused && parseNum(w) !== (set.weight == null ? null : parseNum(shown)) && w !== shown) setW(shown);

  const toggle = () => {
    if (set.done) return props.onChange({ done: false });
    // Ticking an empty set repeats last time's numbers, so one tap logs a matched set.
    const reps = set.reps ?? last?.reps ?? null;
    if (reps == null) {
      toast('Enter the reps first');
      return;
    }
    const weight = set.weight ?? (weightTouched ? null : last?.weight ?? null);
    setR(String(reps));
    setW(show(weight));
    props.onChange({ done: true, reps, weight });
    props.onTicked();
  };

  return (
    <div className={'set-grid set-row' + (set.done ? ' is-done' : '')}>
      <span className="set-n">{props.n}</span>
      <span className="set-last col-last">{last ? `${last.weight != null ? show(last.weight) : 'BW'}×${last.reps}` : '–'}</span>
      <input
        className="set-input"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`${props.name} set ${props.n} weight in ${units}${last ? `, last time ${last.weight != null ? show(last.weight) : 'bodyweight'}` : ''}`}
        placeholder={weightTouched ? 'BW' : last?.weight != null ? show(last.weight) : 'BW'}
        value={w}
        maxLength={7}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const t = cleanDecimal(e.target.value);
          setW(t);
          setWeightTouched(true);
          const v = parseNum(t);
          props.onChange({ weight: v == null ? null : displayToKg(Math.min(v, 2000), units) });
        }}
        onBlur={() => {
          setFocused(false);
          setW(show(set.weight));
        }}
      />
      <input
        className="set-input"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${props.name} set ${props.n} reps${last?.reps != null ? `, last time ${last.reps}` : ''}`}
        placeholder={last?.reps != null ? String(last.reps) : '0'}
        value={r}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const t = toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 3);
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
