import { useState } from 'react';
import type { Nav } from '../App';
import type { ID, Workout } from '../lib/types';
import {
  activeWorkout, applyTemplate, deleteWorkout, exerciseById, finishedWorkouts, routineById, routineForDate,
  startWorkout, TEMPLATES, uid, update, useApp,
} from '../lib/store';
import { DAYS_LONG, fmtDay, fmtDuration, today, weekdayIndex } from '../lib/date';
import { fmtWeight, kgToDisplay } from '../lib/units';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { ExercisePicker } from '../ui/ExercisePicker';
import { NumField, TextField, toast } from '../ui/bits';

export function Train({ nav }: { nav: Nav }) {
  const s = useApp();
  const [view, setView] = useState<'split' | 'history'>('split');
  const [editing, setEditing] = useState<ID | null>(null);
  const [detail, setDetail] = useState<ID | null>(null);
  const active = activeWorkout(s);
  const todays = routineForDate(s, today());
  const history = finishedWorkouts(s);

  const begin = (routineId: ID | null) => {
    startWorkout(routineById(s, routineId));
    nav.openWorkout();
  };
  const newDay = () => {
    const id = uid();
    update((d) => {
      d.routines.push({ id, name: `Day ${d.routines.length + 1}`, exercises: [] });
    });
    setEditing(id);
  };

  return (
    <>
      <header className="masthead">
        <div>
          <span className="label">Training</span>
          <h1 className="display">Train</h1>
        </div>
      </header>

      <div className="seg" style={{ marginBottom: 20 }}>
        <button aria-pressed={view === 'split'} onClick={() => setView('split')}>
          Split
        </button>
        <button aria-pressed={view === 'history'} onClick={() => setView('history')}>
          History{history.length ? ` · ${history.length}` : ''}
        </button>
      </div>

      {view === 'split' && (
        <>
          {s.routines.length === 0 ? (
            <section className="block">
              <div className="empty" style={{ paddingTop: 0 }}>
                <strong>Build your split</strong>
                Start from a common layout and change anything, or build your own days from nothing.
              </div>
              <div className="rows" style={{ marginTop: 16 }}>
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={tpl.name}
                    className="row"
                    onClick={() => {
                      applyTemplate(i);
                      toast(`${tpl.name} added. Edit any day to make it yours.`);
                    }}
                  >
                    <span className="row-main">
                      <span className="row-title">{tpl.name}</span>
                      <span className="row-sub">
                        {tpl.days.map((d) => d.name).join(' / ')} · {tpl.week.filter((x) => x != null).length} days a week
                      </span>
                    </span>
                    <Icon name="plus" />
                  </button>
                ))}
              </div>
              <button className="btn ghost wide" style={{ marginTop: 16 }} onClick={newDay}>
                <Icon name="plus" /> Build my own day
              </button>
            </section>
          ) : (
            <>
              <section className="block">
                <div className="block-head">
                  <span className="label">{active ? 'In progress' : 'Start a session'}</span>
                </div>
                {active ? (
                  <button className="btn wide" onClick={nav.openWorkout}>
                    Resume {active.name}
                  </button>
                ) : (
                  <div className="stack tight">
                    {todays && (
                      <button className="btn wide" onClick={() => begin(todays.id)}>
                        Start {todays.name}
                      </button>
                    )}
                    <div className="chips">
                      {s.routines
                        .filter((r) => r.id !== todays?.id)
                        .map((r) => (
                          <button key={r.id} className="chip" onClick={() => begin(r.id)}>
                            {r.name}
                          </button>
                        ))}
                      <button className="chip" onClick={() => begin(null)}>
                        Open session
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="block">
                <div className="block-head">
                  <span className="label">Weekly split</span>
                </div>
                <div className="rows">
                  {DAYS_LONG.map((d, i) => (
                    <label key={d} className="row" style={{ minHeight: 56, padding: '6px 0' }}>
                      <span className="row-main">
                        <span className="row-title" style={i === weekdayIndex(today()) ? undefined : { color: 'var(--ink-2)', fontWeight: 500 }}>
                          {d}
                        </span>
                      </span>
                      <select
                        className="select"
                        style={{ width: '56%', height: 42, fontSize: 15 }}
                        value={s.week[i] ?? ''}
                        aria-label={`${d} session`}
                        onChange={(e) =>
                          update((dr) => {
                            dr.week[i] = e.target.value || null;
                          })
                        }
                      >
                        <option value="">Rest</option>
                        {s.routines.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>

              <section className="block">
                <div className="block-head">
                  <span className="label">Training days</span>
                  <button className="link" onClick={newDay}>
                    <Icon name="plus" /> New day
                  </button>
                </div>
                <div className="rows">
                  {s.routines.map((r) => (
                    <button key={r.id} className="row" onClick={() => setEditing(r.id)}>
                      <span className="row-main">
                        <span className="row-title">{r.name}</span>
                        <span className="row-sub">
                          {r.exercises.length
                            ? r.exercises.map((e) => exerciseById(s, e.exerciseId).name).join(', ')
                            : 'No exercises yet'}
                        </span>
                      </span>
                      <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                        <path d="M9.5 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {view === 'history' &&
        (history.length === 0 ? (
          <div className="empty">
            <strong>Nothing logged</strong>
            Finished sessions show up here with every set you did.
          </div>
        ) : (
          <div className="rows">
            {history.map((w) => (
              <button key={w.id} className="row" onClick={() => setDetail(w.id)}>
                <span className="row-main">
                  <span className="row-title">{w.name}</span>
                  <span className="row-sub">
                    {fmtDay(w.date)} · {fmtDuration((w.finishedAt ?? w.startedAt) - w.startedAt)} · {w.exercises.length} exercises
                  </span>
                </span>
                <span className="row-end">
                  {w.exercises.reduce((n, e) => n + e.sets.length, 0)}
                  <small>sets</small>
                </span>
              </button>
            ))}
          </div>
        ))}

      {editing && routineById(s, editing) && <RoutineEditor id={editing} onClose={() => setEditing(null)} />}
      {detail && history.find((w) => w.id === detail) && (
        <WorkoutDetail workout={history.find((w) => w.id === detail)!} onClose={() => setDetail(null)} />
      )}
    </>
  );
}

function RoutineEditor({ id, onClose }: { id: ID; onClose: () => void }) {
  const s = useApp();
  const routine = routineById(s, id)!;
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const edit = (fn: (r: NonNullable<ReturnType<typeof routineById>>) => void) =>
    update((d) => {
      const r = d.routines.find((x) => x.id === id);
      if (r) fn(r);
    });

  if (picking) {
    return (
      <ExercisePicker
        onClose={() => setPicking(false)}
        onPick={(exerciseId) => {
          edit((r) => {
            r.exercises.push({ exerciseId, sets: 3, reps: '8-12' });
          });
          setPicking(false);
        }}
      />
    );
  }

  return (
    <Sheet title="Edit training day" onClose={onClose} full foot={<button className="btn wide" onClick={onClose}>Done</button>}>
      <div className="stack">
        <TextField label="Name" value={routine.name} onChange={(v) => edit((r) => void (r.name = v))} placeholder="e.g. Push" />

        <div>
          <div className="block-head" style={{ marginBottom: 4 }}>
            <span className="label">Exercises</span>
            <span className="mono">sets × reps</span>
          </div>
          {routine.exercises.length === 0 && <p className="hint">No exercises yet. Add the lifts you do on this day.</p>}
          <div className="rows">
            {routine.exercises.map((re, i) => (
              <div key={i} className="row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4 }}>
                  <span className="row-title" style={{ flex: 1 }}>
                    {exerciseById(s, re.exerciseId).name}
                  </span>
                  <button
                    className="icon-btn"
                    disabled={i === 0}
                    aria-label="Move up"
                    onClick={() => edit((r) => void r.exercises.splice(i - 1, 0, r.exercises.splice(i, 1)[0]))}
                  >
                    <Icon name="up" />
                  </button>
                  <button
                    className="icon-btn"
                    disabled={i === routine.exercises.length - 1}
                    aria-label="Move down"
                    onClick={() => edit((r) => void r.exercises.splice(i + 1, 0, r.exercises.splice(i, 1)[0]))}
                  >
                    <Icon name="down" />
                  </button>
                  <button className="icon-btn" aria-label={`Remove ${exerciseById(s, re.exerciseId).name}`} onClick={() => edit((r) => void r.exercises.splice(i, 1))}>
                    <Icon name="trash" />
                  </button>
                </div>
                <div className="grid-2" style={{ width: '100%' }}>
                  <NumField
                    integer
                    unit="sets"
                    value={re.sets}
                    placeholder="Sets"
                    onChange={(v) => edit((r) => void (r.exercises[i].sets = Math.min(12, Math.max(1, Math.round(v ?? 1)))))}
                  />
                  <span className="input-unit" style={{ display: 'block' }}>
                    <input
                      className="input"
                      value={re.reps}
                      aria-label="Target reps"
                      placeholder="8-12"
                      onChange={(e) => edit((r) => void (r.exercises[i].reps = e.target.value.slice(0, 12)))}
                    />
                    <span>reps</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn ghost wide" style={{ marginTop: 14 }} onClick={() => setPicking(true)}>
            <Icon name="plus" /> Add exercise
          </button>
        </div>

        {confirmDelete ? (
          <div className="stack tight">
            <p className="hint">Delete “{routine.name}”? Sessions you already logged stay in your history.</p>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  update((d) => {
                    d.routines = d.routines.filter((r) => r.id !== id);
                    d.week = d.week.map((w) => (w === id ? null : w));
                  });
                  onClose();
                }}
              >
                Delete day
              </button>
            </div>
          </div>
        ) : (
          <button className="btn quiet" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" /> Delete this day
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function WorkoutDetail({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const s = useApp();
  const units = s.settings.units;
  const [confirm, setConfirm] = useState(false);
  const volume = workout.exercises.reduce(
    (v, e) => v + e.sets.reduce((a, x) => a + (x.weight ?? 0) * (x.reps ?? 0), 0),
    0,
  );
  return (
    <Sheet title={fmtDay(workout.date)} onClose={onClose} full>
      <div className="stack">
        <div>
          <h3 className="food-title">{workout.name}</h3>
          <p className="session-meta" style={{ marginBottom: 0 }}>
            {fmtDuration((workout.finishedAt ?? workout.startedAt) - workout.startedAt)} ·{' '}
            {workout.exercises.reduce((n, e) => n + e.sets.length, 0)} sets ·{' '}
            {Math.round(kgToDisplay(volume, units)).toLocaleString('en-US')} {units} lifted
          </p>
        </div>
        {workout.exercises.map((e, i) => (
          <div key={i}>
            <div className="label" style={{ marginBottom: 8, color: 'var(--ink)' }}>
              {exerciseById(s, e.exerciseId).name}
            </div>
            <div className="rows">
              {e.sets.map((x, j) => (
                <div key={j} className="row" style={{ minHeight: 40, padding: '8px 0' }}>
                  <span className="mono" style={{ width: 28 }}>
                    {j + 1}
                  </span>
                  <span className="row-main" style={{ fontWeight: 600 }}>
                    {x.weight != null ? `${fmtWeight(x.weight, units)} ${units}` : 'Bodyweight'} × {x.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {confirm ? (
          <div className="btn-row">
            <button className="btn ghost" onClick={() => setConfirm(false)}>
              Keep it
            </button>
            <button
              className="btn danger"
              onClick={() => {
                deleteWorkout(workout.id);
                onClose();
              }}
            >
              Delete session
            </button>
          </div>
        ) : (
          <button className="btn quiet" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={() => setConfirm(true)}>
            <Icon name="trash" /> Delete this session
          </button>
        )}
      </div>
    </Sheet>
  );
}
