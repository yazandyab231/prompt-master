import { useState } from 'react';
import type { Nav } from '../App';
import type { Reminder } from '../lib/types';
import {
  activeWorkout, finishedWorkouts, routineById, routineForDate, setBodyWeight, startWorkout, useApp,
} from '../lib/store';
import { addDays, DAYS_SHORT, fmtDay, fmtDuration, fmtRelative, fromISO, startOfWeek, today } from '../lib/date';
import { displayToKg, fmtWeight, kgToDisplay, num, sum } from '../lib/units';
import { Icon } from '../ui/Icon';
import { MacroRails, NumField, toast } from '../ui/bits';
import { Sheet } from '../ui/Sheet';

export function Today({ nav, due, onDismiss }: { nav: Nav; due: Reminder[]; onDismiss: (id: string) => void }) {
  const s = useApp();
  const t = today();
  const routine = routineForDate(s, t);
  const active = activeWorkout(s);
  const done = finishedWorkouts(s);
  const doneToday = done.find((w) => w.date === t);
  const weekStart = startOfWeek(t);
  const [weighOpen, setWeighOpen] = useState(false);

  const eaten = sum(s.entries.filter((e) => e.date === t).map((e) => e.macros));
  const targets = s.settings.targets;
  const left = Math.round(targets.kcal - eaten.kcal);

  const latest = s.bodyWeights[s.bodyWeights.length - 1];
  const weekAgo = latest
    ? [...s.bodyWeights].reverse().find((b) => b.date <= addDays(latest.date, -6))
    : undefined;
  const delta = latest && weekAgo ? kgToDisplay(latest.kg - weekAgo.kg, s.settings.units) : null;

  const lastOfRoutine = routine ? done.find((w) => w.routineId === routine.id) : undefined;

  return (
    <>
      <header className="masthead">
        <div>
          <span className="label">Logbook</span>
          <h1 className="display">{fmtDay(t)}</h1>
        </div>
      </header>

      {due.map((r) => (
        <div className="banner" key={r.id} role="status">
          <Icon name="bell" />
          <span className="t">
            {r.title} <span className="mono">{r.time}</span>
          </span>
          <button className="icon-btn" onClick={() => onDismiss(r.id)} aria-label={`Dismiss reminder: ${r.title}`}>
            <Icon name="x" />
          </button>
        </div>
      ))}

      <div className="week" aria-label="This week">
        {DAYS_SHORT.map((d, i) => {
          const iso = addDays(weekStart, i);
          const r = routineById(s, s.week[i]);
          const doneThatDay = done.find((w) => w.date === iso);
          const wasDone = !!doneThatDay;
          return (
            <div key={d} className={'week-day' + (iso === t ? ' is-today' : '') + (wasDone ? ' is-done' : '')}>
              <div className="d">{d}</div>
              <div className="n">{fromISO(iso).getDate()}</div>
              <div className="t">{(doneThatDay?.name ?? r?.name ?? '·').slice(0, 5)}</div>
            </div>
          );
        })}
      </div>

      <section className="block">
        <div className="block-head">
          <span className="label">{active ? 'Session in progress' : doneToday ? 'Session logged' : "Today's session"}</span>
          <button className="link" onClick={() => nav.go('train')}>
            Split <Icon name="right" />
          </button>
        </div>
        {active ? (
          <>
            <h2 className="display session-name">{active.name}</h2>
            <p className="session-meta">
              Started {fmtDuration(Date.now() - active.startedAt)} ago ·{' '}
              {active.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0)} sets done
            </p>
            <button className="btn wide" onClick={nav.openWorkout}>
              Resume session
            </button>
          </>
        ) : doneToday ? (
          <>
            <h2 className="display session-name">{doneToday.name}</h2>
            <p className="session-meta">
              {fmtDuration((doneToday.finishedAt ?? 0) - doneToday.startedAt)} ·{' '}
              {doneToday.exercises.reduce((n, e) => n + e.sets.length, 0)} sets · done
            </p>
            <button
              className="btn ghost wide"
              onClick={() => {
                startWorkout(null);
                nav.openWorkout();
              }}
            >
              Start another session
            </button>
          </>
        ) : routine ? (
          <>
            <h2 className="display session-name">{routine.name}</h2>
            <p className="session-meta">
              {routine.exercises.length} exercises
              {lastOfRoutine ? ` · last done ${lastOfRoutine.date === addDays(t, -1) ? 'yesterday' : fmtDay(lastOfRoutine.date)}` : ' · first time'}
            </p>
            <button
              className="btn wide"
              onClick={() => {
                startWorkout(routine);
                nav.openWorkout();
              }}
            >
              Start session
            </button>
          </>
        ) : s.routines.length === 0 ? (
          <>
            <h2 className="display session-name">No split yet</h2>
            <p className="session-meta">Set your training days once, then log against them.</p>
            <button className="btn wide" onClick={() => nav.go('train')}>
              Set up my split
            </button>
          </>
        ) : (
          <>
            <h2 className="display session-name">Rest day</h2>
            <p className="session-meta">Nothing scheduled. Train anyway if you want to.</p>
            <button className="btn ghost wide" onClick={() => nav.go('train')}>
              Pick a session
            </button>
          </>
        )}
      </section>

      <section className="block">
        <div className="block-head">
          <span className="label">Fuel</span>
          <button className="link" onClick={() => nav.addFood(t)}>
            <Icon name="plus" /> Log food
          </button>
        </div>
        <div className="fuel-hero">
          <div className="display big">{Math.abs(left).toLocaleString('en-US')}</div>
          <div className="cap">
            <span className="label">{left >= 0 ? 'kcal left' : 'kcal over'}</span>
            <span className="mono">
              {Math.round(eaten.kcal).toLocaleString('en-US')} of {Math.round(targets.kcal).toLocaleString('en-US')}
            </span>
          </div>
        </div>
        <MacroRails eaten={eaten} targets={targets} />
      </section>

      <section className="block">
        <div className="block-head">
          <span className="label">Body weight</span>
          <button className="link" onClick={() => setWeighOpen(true)}>
            <Icon name="plus" /> Log weight
          </button>
        </div>
        {latest ? (
          <div className="stat-line">
            <div className="display stat-big">
              {fmtWeight(latest.kg, s.settings.units)}
              <small>{s.settings.units}</small>
            </div>
            <div className="mono" style={{ textAlign: 'right', paddingBottom: 6 }}>
              {fmtRelative(latest.date)}
              <br />
              {delta != null ? `${delta > 0 ? '+' : ''}${num(delta, 1)} ${s.settings.units} vs a week before` : 'no earlier entry to compare'}
            </div>
          </div>
        ) : (
          <p className="hint">No weigh-ins yet. Log one to start the trend line.</p>
        )}
      </section>

      {weighOpen && <WeighSheet date={t} onClose={() => setWeighOpen(false)} />}
    </>
  );
}

export function WeighSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const s = useApp();
  const units = s.settings.units;
  const shown = (kg: number) => Number(num(kgToDisplay(kg, units), 1));
  /** The weigh-in this sheet was opened on, if there was one: saving edits or moves it. */
  const original = s.bodyWeights.find((b) => b.date === date);
  const previous = s.bodyWeights[s.bodyWeights.length - 1];
  const [day, setDay] = useState(date);
  const [value, setValue] = useState<number | null>(original ? shown(original.kg) : null);
  const [dirty, setDirty] = useState(false);
  const onDay = s.bodyWeights.find((b) => b.date === day);
  const clash = onDay && day !== original?.date ? onDay : null;
  const future = day > today();
  const valid = value != null && value > 0 && value < 1000 && !future;

  const save = () => {
    if (!valid) return;
    // Untouched number: keep the stored value exactly, so re-saving never drifts through rounding.
    const kg = !dirty && original ? original.kg : displayToKg(value!, units);
    if (original && day !== original.date) setBodyWeight(original.date, null); // moved to another day
    setBodyWeight(day, kg);
    toast('Weight logged');
    onClose();
  };
  return (
    <Sheet
      title={original ? 'Edit weigh-in' : 'Log body weight'}
      onClose={onClose}
      foot={
        <button className="btn wide" disabled={!valid} onClick={save}>
          Save weight
        </button>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <NumField
          label="Weight"
          unit={units}
          value={value}
          onChange={(v) => {
            setValue(v);
            setDirty(true);
          }}
          autoFocus
          placeholder={previous ? fmtWeight(previous.kg, units) : units === 'kg' ? '80.0' : '176.0'}
        />
        <label className="field">
          <span className="label">Date</span>
          <input className="input" type="date" value={day} max={today()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        {future && <p className="error">That date is in the future. Pick today or earlier.</p>}
        {clash && !future && (
          <p className="hint">
            {fmtDay(day)} already has a weigh-in of {fmtWeight(clash.kg, units)} {units}. Saving replaces it.
          </p>
        )}
        {original && day !== original.date && !future && <p className="hint">This moves the weigh-in from {fmtDay(original.date)}.</p>}
        <button className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Sheet>
  );
}
