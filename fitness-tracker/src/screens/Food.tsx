import { useState } from 'react';
import type { Nav } from '../App';
import type { FoodEntry } from '../lib/types';
import { allFoods, update, useApp } from '../lib/store';
import { addDays, fmtRelative, fmtTime, today } from '../lib/date';
import { num, scale, sum } from '../lib/units';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { MacroRails, MacroStrip, NumField, macroLine } from '../ui/bits';

export function Food({ nav }: { nav: Nav }) {
  const s = useApp();
  const [date, setDate] = useState(today());
  const [editing, setEditing] = useState<string | null>(null);
  const entries = s.entries.filter((e) => e.date === date).sort((a, b) => a.time - b.time);
  const eaten = sum(entries.map((e) => e.macros));
  const targets = s.settings.targets;
  const left = Math.round(targets.kcal - eaten.kcal);
  const entry = entries.find((e) => e.id === editing);

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
          <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} aria-label="Next day">
            <Icon name="right" />
          </button>
        </div>
      </header>

      <section className="block">
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
          <span className="label">Logged{entries.length ? ` · ${entries.length}` : ''}</span>
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
            {entries.map((e) => (
              <button key={e.id} className="row" onClick={() => setEditing(e.id)}>
                <span className="row-main">
                  <span className="row-title">{e.name}</span>
                  <span className="row-sub">
                    {fmtTime(e.time)} · {e.grams != null ? `${num(e.grams, 0)} g · ` : ''}P {num(e.macros.p, 0)} · C {num(e.macros.c, 0)} · F {num(e.macros.f, 0)}
                  </span>
                </span>
                <span className="row-end">
                  {Math.round(e.macros.kcal)}
                  <small>kcal</small>
                </span>
              </button>
            ))}
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
  const [grams, setGrams] = useState<number | null>(entry.grams);
  // Rescale from the food if we still have it, otherwise from the entry's own snapshot.
  const per100 =
    food?.per100 ??
    (entry.grams
      ? { kcal: (entry.macros.kcal / entry.grams) * 100, p: (entry.macros.p / entry.grams) * 100, c: (entry.macros.c / entry.grams) * 100, f: (entry.macros.f / entry.grams) * 100 }
      : null);
  const macros = per100 && grams != null ? scale(per100, grams) : entry.macros;
  const canScale = per100 != null && entry.grams != null;
  const remove = () => {
    update((d) => {
      d.entries = d.entries.filter((e) => e.id !== entry.id);
    });
    onClose();
  };
  const valid = grams != null && grams > 0 && grams <= 5000;
  const save = () => {
    if (!canScale || !valid) return;
    update((d) => {
      const e = d.entries.find((x) => x.id === entry.id);
      if (e) {
        e.grams = grams!;
        e.macros = macros;
      }
    });
    onClose();
  };
  return (
    <Sheet
      title="Edit entry"
      onClose={onClose}
      foot={
        <div className="btn-row">
          <button className="btn danger" onClick={remove}>
            Delete
          </button>
          {canScale && (
            <button className="btn" disabled={!valid} onClick={save}>
              Save
            </button>
          )}
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
        {canScale ? (
          <NumField label="Amount" unit="g" value={grams} onChange={setGrams} dp={0} maxLength={5} />
        ) : (
          <p className="hint">Quick-add entry: {macroLine(entry.macros)}. Delete it and log again to change the numbers.</p>
        )}
        {canScale && grams != null && grams > 5000 && <p className="error">Enter 5,000 g or less.</p>}
        <MacroStrip m={macros} />
        <button className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Sheet>
  );
}
