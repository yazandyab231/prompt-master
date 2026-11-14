import { useEffect, useRef, useState } from 'react';
import type { Nav } from '../App';
import type { FoodEntry, Macros } from '../lib/types';
import { allFoods, getState, replaceState, targetsFor, update, useApp } from '../lib/store';
import { addDays, fmtRelative, fmtTime, today } from '../lib/date';
import { num, scale, sum } from '../lib/units';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { MacroRails, MacroStrip, NumField, toast, useTick } from '../ui/bits';

export function Food({ nav }: { nav: Nav }) {
  const s = useApp();
  const t = today();
  const [date, setDate] = useState(t);
  const [editing, setEditing] = useState<string | null>(null);
  useTick(60_000);

  // If the screen was showing "today" and the day rolls over while it is open, follow the new day.
  const shownToday = useRef(t);
  useEffect(() => {
    if (shownToday.current !== t) {
      if (date === shownToday.current) setDate(t);
      shownToday.current = t;
    }
  }, [t, date]);

  const entries = s.entries.filter((e) => e.date === date).sort((a, b) => a.time - b.time);
  const eaten = sum(entries.map((e) => e.macros));
  const targets = targetsFor(s, date);
  const left = Math.round(targets.kcal - eaten.kcal);
  const entry = entries.find((e) => e.id === editing);
  // Entries can sit "ahead" of today after flying west; let the arrows reach them.
  const lastDate = s.entries.reduce((m, e) => (e.date > m ? e.date : m), t);

  return (
    <>
      <header className="masthead">
        <div>
          <span className="label">Macros</span>
          <h1 className="display">{fmtRelative(date)}</h1>
        </div>
        <div style={{ display: 'flex' }}>
          <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            <Icon name="left" />
          </button>
          <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={date >= lastDate} aria-label="Next day">
            <Icon name="right" />
          </button>
        </div>
      </header>

      {date !== t && (
        <div className="note" style={{ marginBottom: 14 }}>
          You are looking at <b>{fmtRelative(date).toLowerCase()}</b>. Food you log here goes on that day.{' '}
          <button className="link accent" style={{ padding: 0 }} onClick={() => setDate(t)}>
            Back to today
          </button>
        </div>
      )}

      <section className="block">
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
          <h2 className="label">Logged{entries.length ? ` · ${entries.length}` : ''}</h2>
        </div>
        <button className="btn wide" onClick={() => nav.addFood(date)}>
          <Icon name="plus" /> Log food
        </button>
        {entries.length === 0 ? (
          <div className="empty">
            <strong>Nothing logged</strong>
            Search a food, scan a barcode, or read the nutrition table off a package.
          </div>
        ) : (
          <div className="rows" style={{ marginTop: 16 }}>
            {entries.map((e) => {
              const unit = e.foodId && allFoods(s).find((f) => f.id === e.foodId)?.liquid ? 'ml' : 'g';
              return (
                <button key={e.id} className="row" onClick={() => setEditing(e.id)}>
                  <span className="row-main">
                    <span className="row-title">{e.name}</span>
                    <span className="row-sub">
                      {fmtTime(e.time)} · {e.grams != null ? `${num(e.grams, 0)} ${unit} · ` : ''}P {num(e.macros.p, 0)} · C {num(e.macros.c, 0)} · F{' '}
                      {num(e.macros.f, 0)}
                    </span>
                  </span>
                  <span className="row-end">
                    {Math.round(e.macros.kcal)}
                    <small>kcal</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {entry && <EntrySheet entry={entry} onClose={() => setEditing(null)} />}
    </>
  );
}

function EntrySheet({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const s = useApp();
  const food = entry.foodId ? allFoods(s).find((f) => f.id === entry.foodId) : undefined;
  const unit = food?.liquid ? 'ml' : 'g';
  const quick = entry.grams == null;
  const [grams, setGrams] = useState<number | null>(entry.grams);
  const [day, setDay] = useState(entry.date);
  const [q, setQ] = useState<Macros>(entry.macros);
  // Always rescale from what was logged, never from the food's current values: editing a food
  // later must not rewrite what you already ate.
  const per100 = entry.grams
    ? {
        kcal: (entry.macros.kcal / entry.grams) * 100,
        p: (entry.macros.p / entry.grams) * 100,
        c: (entry.macros.c / entry.grams) * 100,
        f: (entry.macros.f / entry.grams) * 100,
      }
    : null;
  const macros = quick ? q : per100 && grams != null ? scale(per100, grams) : entry.macros;
  const valid = quick ? q.kcal >= 0 && q.kcal <= 20000 : grams != null && grams > 0 && grams <= 5000;

  const remove = () => {
    const before = getState();
    update((d) => {
      d.entries = d.entries.filter((e) => e.id !== entry.id);
    });
    toast(`${entry.name} deleted`, { label: 'Undo', run: () => replaceState(before) });
    onClose();
  };
  const save = () => {
    if (!valid) return;
    update((d) => {
      const e = d.entries.find((x) => x.id === entry.id);
      if (!e) return;
      if (!quick) e.grams = grams!;
      e.macros = macros;
      e.date = day;
    });
    onClose();
  };
  const setQuick = (k: keyof Macros, v: number | null) => setQ({ ...q, [k]: Math.min(v ?? 0, k === 'kcal' ? 20000 : 2000) });

  return (
    <Sheet
      title="Edit entry"
      onClose={onClose}
      foot={
        <div className="btn-row">
          <button className="btn danger" onClick={remove}>
            Delete
          </button>
          <button className="btn" disabled={!valid} onClick={save}>
            Save
          </button>
        </div>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h3 className="food-title">{entry.name}</h3>
        {quick ? (
          <div className="grid-2">
            <NumField label="Energy" unit="kcal" value={q.kcal} onChange={(v) => setQuick('kcal', v)} dp={0} />
            <NumField label="Protein" unit="g" value={q.p} onChange={(v) => setQuick('p', v)} />
            <NumField label="Carbs" unit="g" value={q.c} onChange={(v) => setQuick('c', v)} />
            <NumField label="Fat" unit="g" value={q.f} onChange={(v) => setQuick('f', v)} />
          </div>
        ) : (
          <>
            <NumField label="Amount" unit={unit} value={grams} onChange={setGrams} dp={0} maxLength={5} />
            {grams != null && grams > 5000 && <p className="error">Enter 5,000 {unit} or less.</p>}
          </>
        )}
        <label className="field">
          <span className="label">Day</span>
          <input className="input" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        <MacroStrip m={macros} />
        {food && food.source !== 'builtin' && (
          <p className="hint">Changing this entry does not change the saved food, and editing the food later does not change this entry.</p>
        )}
        <button className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Sheet>
  );
}
