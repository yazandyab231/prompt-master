import { useState } from 'react';
import type { Nav } from '../App';
import type { Reminder } from '../lib/types';
import {
  activeWorkout, finishedWorkouts, routineById, routineForDate, setBodyWeight, setTargets, startWorkout, targetsFor, update, useApp,
} from '../lib/store';
import { addDays, DAYS_LONG, DAYS_SHORT, fmtDay, fmtDuration, fmtRelative, fromISO, startOfWeek, today } from '../lib/date';
import { displayToKg, fmtWeight, kgToDisplay, num, plural, sum } from '../lib/units';
import { weeklyChange } from '../lib/trend';
import { suggestTargets, type Profile } from '../lib/targets';
import { Icon } from '../ui/Icon';
import { MacroRails, NumField, toast } from '../ui/bits';
import { Sheet } from '../ui/Sheet';

/** Short label for the week strip that never cuts an emoji in half and keeps "Full body A/B" apart. */
const abbreviate = (name: string) => {
  const chars = (s: string) => Array.from(s);
  const words = name.trim().split(/\s+/);
  if (words.length > 1 && chars(words[words.length - 1]).length <= 2) {
    return `${chars(words[0]).slice(0, 4).join('')} ${words[words.length - 1]}`;
  }
  return chars(name).slice(0, 5).join('');
};

export function Today({
  nav,
  due,
  onDismiss,
}: {
  nav: Nav;
  due: Reminder[];
  onDismiss: (ids: string[]) => void;
}) {
  const s = useApp();
  const t = today();
  const units = s.settings.units;
  const routine = routineForDate(s, t);
  const active = activeWorkout(s);
  const done = finishedWorkouts(s);
  const doneToday = done.filter((w) => w.date === t);
  const weekStart = startOfWeek(t);
  const [weighOpen, setWeighOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [allBanners, setAllBanners] = useState(false);

  const eaten = sum(s.entries.filter((e) => e.date === t).map((e) => e.macros));
  const targets = targetsFor(s, t);
  const left = Math.round(targets.kcal - eaten.kcal);

  const latest = s.bodyWeights[s.bodyWeights.length - 1];
  const trend = latest ? weeklyChange(s.bodyWeights, t) : null;

  const lastOfRoutine = routine ? done.find((w) => w.routineId === routine.id) : undefined;
  const staleHours = active ? (Date.now() - Math.max(active.lastAt ?? active.startedAt, active.startedAt)) / 3600_000 : 0;
  const shownBanners = allBanners ? due : due.slice(0, 2);

  return (
    <>
      <header className="masthead">
        <div>
          <span className="label">Logbook</span>
          <h1 className="display">{fmtDay(t)}</h1>
        </div>
      </header>

      {due.length > 0 && (
        <div className="banners">
          {shownBanners.map((r) => (
            <div className="banner" key={r.id}>
              <Icon name="bell" />
              <span className="t">
                {r.title}
                <span className="mono">{r.time}</span>
              </span>
              <button className="icon-btn" onClick={() => onDismiss([r.id])} aria-label={`Dismiss reminder: ${r.title}`}>
                <Icon name="x" />
              </button>
            </div>
          ))}
          {due.length > 2 && (
            <div className="banner-more">
              {!allBanners && (
                <button className="link" onClick={() => setAllBanners(true)}>
                  {due.length - 2} more
                </button>
              )}
              <button className="link" onClick={() => onDismiss(due.map((r) => r.id))}>
                Dismiss all
              </button>
            </div>
          )}
        </div>
      )}

      {!s.settings.targetsReviewed && (
        <div className="note" style={{ marginBottom: 16 }}>
          <b>Set your own targets.</b> The 2,400 kcal / 160 g protein shown below are placeholders, not yours.{' '}
          <span style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn small" onClick={() => setTargetsOpen(true)}>
              Work them out
            </button>
            <button className="btn ghost small" onClick={() => update((d) => void (d.settings.targetsReviewed = true))}>
              Keep these
            </button>
          </span>
        </div>
      )}

      <ul className="week" aria-label="This week">
        {DAYS_SHORT.map((d, i) => {
          const iso = addDays(weekStart, i);
          const r = routineById(s, s.week[i]);
          const doneThatDay = done.find((w) => w.date === iso);
          const label = doneThatDay?.name ?? r?.name;
          const spoken = `${DAYS_LONG[i]} ${fromISO(iso).getDate()}${iso === t ? ', today' : ''}: ${label ?? 'rest'}${doneThatDay ? ', done' : ''}`;
          return (
            <li key={d} className={'week-day' + (iso === t ? ' is-today' : '') + (doneThatDay ? ' is-done' : '')} aria-label={spoken}>
              <div className="d" aria-hidden="true">{d}</div>
              <div className="n" aria-hidden="true">{fromISO(iso).getDate()}</div>
              <div className="t" aria-hidden="true">{label ? abbreviate(label) : '·'}</div>
            </li>
          );
        })}
      </ul>

      <section className="block">
        <div className="block-head">
          <h2 className="label">{active ? 'Session in progress' : doneToday.length ? 'Session logged' : "Today's session"}</h2>
          <button className="link" onClick={() => nav.go('train')}>
            Split <Icon name="right" />
          </button>
        </div>
        {active ? (
          <>
            <h3 className="display session-name">{active.name}</h3>
            {staleHours > 6 ? (
              <p className="session-meta">
                Started {fmtDay(active.date)} and untouched for {Math.round(staleHours)} h. Finish it (it is saved with its real end time) or discard it.
              </p>
            ) : (
              <p className="session-meta">
                Started {fmtDuration(Date.now() - active.startedAt)} ago · {plural(active.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0), 'set')} done
              </p>
            )}
            <button className="btn wide" onClick={() => nav.openWorkout()}>
              {staleHours > 6 ? 'Open session' : 'Resume session'}
            </button>
          </>
        ) : doneToday.length ? (
          <>
            <h3 className="display session-name">{doneToday[0].name}</h3>
            <p className="session-meta">
              {fmtDuration((doneToday[0].finishedAt ?? 0) - doneToday[0].startedAt)} · {plural(doneToday[0].exercises.reduce((n, e) => n + e.sets.length, 0), 'set')} · done
              {doneToday.length > 1 ? ` · +${plural(doneToday.length - 1, 'more session')}` : ''}
            </p>
            <button className="btn ghost wide" onClick={() => nav.go('train')}>
              Start another session
            </button>
          </>
        ) : routine ? (
          <>
            <h3 className="display session-name">{routine.name}</h3>
            <p className="session-meta">
              {plural(routine.exercises.length, 'exercise')}
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
            <h3 className="display session-name">No plan yet</h3>
            <p className="session-meta">Plan your training week once (which days, which exercises), or just log what you do today.</p>
            <div className="stack tight">
              <button className="btn wide" onClick={() => nav.go('train')}>
                Plan my training week
              </button>
              <button
                className="btn ghost wide"
                onClick={() => {
                  startWorkout(null);
                  nav.openWorkout();
                }}
              >
                Just log a workout
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="display session-name">Rest day</h3>
            <p className="session-meta">Nothing planned today. Train anyway if you want to.</p>
            <button className="btn ghost wide" onClick={() => nav.go('train')}>
              Pick a session
            </button>
          </>
        )}
      </section>

      <section className="block">
        <div className="block-head">
          <h2 className="label">Fuel</h2>
          <button className="link" onClick={() => nav.addFood(t)}>
            <Icon name="plus" /> Log food
          </button>
        </div>
        <div className="fuel-hero">
          <div className={'display big' + (left < 0 ? ' over' : '')}>{Math.abs(left).toLocaleString('en-US')}</div>
          <div className="cap">
            <span className="label">{left >= 0 ? 'kcal left' : 'kcal over target'}</span>
            <span className="mono">
              {Math.round(eaten.kcal).toLocaleString('en-US')} of {Math.round(targets.kcal).toLocaleString('en-US')}
            </span>
          </div>
        </div>
        <MacroRails eaten={eaten} targets={targets} />
      </section>

      <section className="block">
        <div className="block-head">
          <h2 className="label">Body weight</h2>
          <button className="link" onClick={() => setWeighOpen(true)}>
            <Icon name="plus" /> Log weight
          </button>
        </div>
        {latest ? (
          <div className="stat-line">
            <div className="display stat-big">
              {fmtWeight(latest.kg, units, 1)}
              <small>
                {units} · {fmtRelative(latest.date).toLowerCase()}
              </small>
            </div>
            <div className="mono" style={{ textAlign: 'right', paddingBottom: 6 }}>
              {trend ? (
                <>
                  7-day average {fmtWeight(trend.now, units, 1)}
                  <br />
                  {trend.change != null
                    ? `${trend.change > 0 ? '+' : ''}${num(kgToDisplay(trend.change, units), 1)} ${units} vs the week before`
                    : 'log a week more to see the trend'}
                </>
              ) : (
                'no weigh-in in the last 7 days'
              )}
            </div>
          </div>
        ) : (
          <p className="hint">No weigh-ins yet. Weigh in a few times a week; the weekly average is what matters, not single days.</p>
        )}
      </section>

      {weighOpen && <WeighSheet date={t} onClose={() => setWeighOpen(false)} />}
      {targetsOpen && <TargetsSheet onClose={() => setTargetsOpen(false)} />}
    </>
  );
}

/** First-run helper: estimate targets from a few facts, then let the person adjust them. */
export function TargetsSheet({ onClose }: { onClose: () => void }) {
  const s = useApp();
  const units = s.settings.units;
  const lastKg = s.bodyWeights[s.bodyWeights.length - 1]?.kg;
  const [p, setP] = useState<Partial<Profile>>({ activity: 1.375, goal: 'maintain', weightKg: lastKg });
  const ready = p.sex && p.age && p.heightCm && p.weightKg && p.age >= 14 && p.age <= 100 && p.heightCm > 120 && p.heightCm < 230;
  const result = ready ? suggestTargets(p as Profile) : null;
  const opt = <K extends keyof Profile>(k: K, v: Profile[K], label: string) => (
    <button type="button" aria-pressed={p[k] === v} onClick={() => setP({ ...p, [k]: v })}>
      {label}
    </button>
  );
  return (
    <Sheet
      title="Your daily targets"
      onClose={onClose}
      full
      foot={
        <button
          className="btn wide"
          disabled={!result}
          onClick={() => {
            setTargets(result!);
            update((d) => void (d.settings.targetsReviewed = true));
            toast('Targets set. Fine-tune them any time in Setup.');
            onClose();
          }}
        >
          Use these targets
        </button>
      }
    >
      <div className="stack">
        <p className="hint">
          A starting point from a standard formula (Mifflin-St Jeor). Watch your weekly average for 2-3 weeks and adjust by about 100-200 kcal. If you
          are pregnant, under 18, or managing a medical condition, check targets with a doctor or dietitian.
        </p>
        <div>
          <div className="label" style={{ marginBottom: 7 }}>Sex (for the formula)</div>
          <div className="seg" role="group" aria-label="Sex">
            {opt('sex', 'female', 'Female')}
            {opt('sex', 'male', 'Male')}
          </div>
        </div>
        <div className="grid-2">
          <NumField label="Age" unit="yrs" integer value={p.age ?? null} onChange={(v) => setP({ ...p, age: v ?? undefined })} maxLength={3} />
          <NumField label="Height" unit="cm" value={p.heightCm ?? null} onChange={(v) => setP({ ...p, heightCm: v ?? undefined })} maxLength={5} />
        </div>
        <NumField
          label="Weight"
          unit={units}
          value={p.weightKg != null ? Number(num(kgToDisplay(p.weightKg, units), 1)) : null}
          onChange={(v) => setP({ ...p, weightKg: v == null ? undefined : displayToKg(v, units) })}
          maxLength={6}
        />
        <div>
          <div className="label" style={{ marginBottom: 7 }}>How active</div>
          <div className="seg stacked" role="group" aria-label="Activity">
            {opt('activity', 1.2, 'Desk, little')}
            {opt('activity', 1.375, '1-3 workouts')}
            {opt('activity', 1.55, '4-5 workouts')}
            {opt('activity', 1.725, 'Daily / manual job')}
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 7 }}>Goal</div>
          <div className="seg" role="group" aria-label="Goal">
            {opt('goal', 'lose', 'Lose fat')}
            {opt('goal', 'maintain', 'Maintain')}
            {opt('goal', 'gain', 'Build')}
          </div>
        </div>
        {result ? (
          <div className="macro-strip" aria-label={`${result.kcal} kcal, ${result.p} g protein, ${result.c} g carbs, ${result.f} g fat`}>
            <div className="macro-cell">
              <div className="v">{result.kcal.toLocaleString('en-US')}</div>
              <div className="k">kcal</div>
            </div>
            <div className="macro-cell">
              <div className="v">{result.p}</div>
              <div className="k"><i style={{ background: 'var(--protein)' }} />protein g</div>
            </div>
            <div className="macro-cell">
              <div className="v">{result.c}</div>
              <div className="k"><i style={{ background: 'var(--carbs)' }} />carbs g</div>
            </div>
            <div className="macro-cell">
              <div className="v">{result.f}</div>
              <div className="k"><i style={{ background: 'var(--fat)' }} />fat g</div>
            </div>
          </div>
        ) : (
          <p className="hint">Fill in all of the above to see your numbers.</p>
        )}
      </div>
    </Sheet>
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
  // Allow a date already stored ahead of today (after flying west); refuse any other future date.
  const future = day > today() && day !== original?.date;
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
