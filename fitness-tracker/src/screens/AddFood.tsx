import { useEffect, useMemo, useRef, useState } from 'react';
import type { Food, FoodSource, ID } from '../lib/types';
import { allFoods, logFood, recentFoods, saveFood, update, useApp, getState, replaceState } from '../lib/store';
import { searchFoods } from '../lib/foods';
import { lookupBarcode } from '../lib/off';
import { parseNutritionText, readLabelText } from '../lib/label';
import { fmtRelative } from '../lib/date';
import { kcalFromMacros, num, scale } from '../lib/units';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Scanner } from '../ui/Scanner';
import { MacroStrip, NumField, TextField, toast } from '../ui/bits';

type Mode = 'search' | 'barcode' | 'label' | 'quick';

interface Draft {
  id?: ID;
  name: string;
  brand?: string;
  kcal: number | null;
  p: number | null;
  c: number | null;
  f: number | null;
  servingG: number | null;
  liquid?: boolean;
  source: FoodSource;
  barcode?: string;
  /** Shown above the form, e.g. what the label scan could and could not read. */
  note?: string;
}

const emptyDraft = (over: Partial<Draft> = {}): Draft => ({
  name: '', kcal: null, p: null, c: null, f: null, servingG: null, source: 'custom', ...over,
});

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'barcode', label: 'Barcode', icon: 'barcode' },
  { id: 'label', label: 'Label', icon: 'camera' },
  { id: 'quick', label: 'Quick', icon: 'bolt' },
];

export function AddFood({ date, onClose }: { date: string; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('search');
  const [food, setFood] = useState<Food | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  // A barcode that had no usable data, carried into the label scan so the result is saved against it.
  const [carry, setCarry] = useState<{ barcode?: string; name?: string }>({});

  if (draft) {
    return (
      <Sheet title={draft.id ? 'Edit food' : draft.source === 'label' ? 'Check the label values' : 'New food'} onClose={onClose} onBack={() => setDraft(null)} full>
        <FoodForm
          draft={draft}
          onSaved={(saved) => {
            setDraft(null);
            setCarry({});
            setFood(saved);
          }}
          onDeleted={() => {
            setDraft(null);
            setFood(null);
          }}
        />
      </Sheet>
    );
  }

  if (food) {
    return (
      <Sheet title={`Add to ${fmtRelative(date).toLowerCase()}`} onClose={onClose} onBack={() => setFood(null)} full>
        <Amount
          food={food}
          date={date}
          onDone={onClose}
          onEdit={() =>
            setDraft({
              id: food.source === 'builtin' ? undefined : food.id,
              name: food.source === 'builtin' ? `${food.name} (my version)` : food.name,
              brand: food.brand, source: food.source === 'builtin' ? 'custom' : food.source, barcode: food.barcode, liquid: food.liquid,
              kcal: food.per100.kcal, p: food.per100.p, c: food.per100.c, f: food.per100.f, servingG: food.servingG ?? null,
            })
          }
        />
      </Sheet>
    );
  }

  return (
    <Sheet title={`Log food · ${fmtRelative(date)}`} onClose={onClose} full>
      <div className="stack">
        <div className="seg stacked" role="group" aria-label="How to add">
          {MODES.map((m) => (
            <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              <Icon name={m.icon} />
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'search' && <Search onPick={setFood} onCreate={(name) => setDraft(emptyDraft({ name }))} />}
        {mode === 'barcode' && (
          <Barcode
            onFood={setFood}
            onReview={setDraft}
            onManual={(barcode, name) => setDraft(emptyDraft({ barcode, name: name ?? '', source: 'barcode' }))}
            onLabel={(barcode, name) => {
              setCarry({ barcode, name });
              setMode('label');
            }}
          />
        )}
        {mode === 'label' && (
          <Label
            carry={carry}
            onDraft={setDraft}
            onManual={() => setDraft(emptyDraft({ barcode: carry.barcode, name: carry.name ?? '' }))}
          />
        )}
        {mode === 'quick' && <Quick date={date} onDone={onClose} />}
      </div>
    </Sheet>
  );
}

/* ---------- search ---------- */

function Search({ onPick, onCreate }: { onPick: (f: Food) => void; onCreate: (name: string) => void }) {
  const s = useApp();
  const [q, setQ] = useState('');
  const query = q.trim();
  const allResults = useMemo(() => (query ? searchFoods(allFoods(s), query) : []), [s, query]);
  const results = allResults.slice(0, 40);
  const recent = useMemo(() => recentFoods(s), [s]);

  const list = (title: string, foods: Food[]) =>
    foods.length > 0 && (
      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          {title}
        </div>
        <div className="rows">
          {foods.map((f) => (
            <button key={f.id} className="row" onClick={() => onPick(f)}>
              <span className="row-main">
                <span className="row-title">{f.name}</span>
                <span className="row-sub">
                  {f.brand ? f.brand + ' · ' : ''}P {num(f.per100.p, 1)} · C {num(f.per100.c, 1)} · F {num(f.per100.f, 1)} per 100 g
                </span>
              </span>
              <span className="row-end">
                {Math.round(f.per100.kcal)}
                <small>kcal</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <>
      <input
        className="input"
        placeholder="Search foods, e.g. rice"
        aria-label="Search foods"
        dir="auto"
        value={q}
        autoFocus
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
      />
      {query ? (
        <>
          {list(allResults.length > results.length ? `Top ${results.length} of ${allResults.length} matches` : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`, results)}
          {results.length === 0 && <p className="hint">No match for “{query}”.</p>}
          <button className="btn ghost wide" onClick={() => onCreate(query)}>
            <Icon name="plus" /> Create “{query.length > 18 ? query.slice(0, 18) + '…' : query}”
          </button>
        </>
      ) : (
        <>
          {list('Recent', recent)}
          {list('My foods', s.foods.filter((f) => !recent.some((r) => r.id === f.id)).slice(0, 30))}
          <button className="btn ghost wide" onClick={() => onCreate('')}>
            <Icon name="plus" /> Create a food
          </button>
        </>
      )}
    </>
  );
}

/* ---------- amount ---------- */

function Amount({ food, date, onDone, onEdit }: { food: Food; date: string; onDone: () => void; onEdit: () => void }) {
  const unit = food.liquid ? 'ml' : 'g';
  const [grams, setGrams] = useState<number | null>(food.servingG ?? 100);
  const macros = scale(food.per100, grams ?? 0);
  const presets = [50, 100, 150, 200, 250];
  const valid = grams != null && grams > 0 && grams <= 5000;
  const add = () => {
    if (!valid) return;
    logFood({ date, name: food.name, grams: grams!, macros, foodId: food.id });
    toast(`${food.name} added`);
    onDone();
  };
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <div>
        <h3 className="food-title">{food.name}</h3>
        <p className="session-meta" style={{ marginBottom: 0 }}>
          {food.brand ? food.brand + ' · ' : ''}
          {Math.round(food.per100.kcal)} kcal · P {num(food.per100.p, 1)} · C {num(food.per100.c, 1)} · F {num(food.per100.f, 1)} per 100 g
        </p>
      </div>
      <NumField label="Amount" unit={unit} value={grams} onChange={setGrams} autoFocus dp={0} maxLength={5} />
      {grams != null && grams > 5000 && <p className="error">Enter 5,000 {unit} or less.</p>}
      <div className="chips">
        {food.servingG && !presets.includes(food.servingG) && (
          <button type="button" className="chip" aria-pressed={grams === food.servingG} onClick={() => setGrams(food.servingG!)}>
            1 serving · {num(food.servingG, 0)} {unit}
          </button>
        )}
        {presets.map((g) => (
          <button type="button" key={g} className="chip" aria-pressed={grams === g} onClick={() => setGrams(g)}>
            {g} {unit}
          </button>
        ))}
      </div>
      <MacroStrip m={macros} />
      <button className="btn wide" disabled={!valid}>
        Add to log
      </button>
      {(
        <button type="button" className="btn quiet" style={{ alignSelf: 'flex-start' }} onClick={onEdit}>
          <Icon name="edit" /> {food.source === 'builtin' ? 'Make my own version of this food' : "Edit this food's values"}
        </button>
      )}
    </form>
  );
}

/* ---------- create / review ---------- */

function FoodForm({ draft, onSaved, onDeleted }: { draft: Draft; onSaved: (f: Food) => void; onDeleted: () => void }) {
  const [d, setD] = useState(draft);
  /** Labels print values per 100 g or per serving; let people type whichever their label shows. */
  const [basis, setBasis] = useState<'100' | 'serving'>('100');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const unit = d.liquid ? 'ml' : 'g';
  const k = basis === 'serving' && d.servingG ? 100 / d.servingG : 1;
  const per = (v: number | null) => (v == null ? null : Math.round(v * k * 10) / 10);
  const macrosKnown = d.p != null && d.c != null && d.f != null;
  const implied = macrosKnown ? kcalFromMacros(d.p!, d.c!, d.f!) : null;
  const kcal = d.kcal ?? (implied != null ? Math.round(implied) : null);
  const tooLow = d.kcal != null && implied != null && implied - d.kcal > Math.max(25, implied * 0.25);
  const tooHigh = d.kcal != null && implied != null && d.kcal - implied > Math.max(25, d.kcal * 0.25);
  const totalPer100 = macrosKnown ? (d.p! + d.c! + d.f!) * k : 0;
  const impossible = macrosKnown && basis === '100' && totalPer100 > 100.5;
  const needServing = basis === 'serving' && !(d.servingG && d.servingG > 0);
  const valid = d.name.trim() !== '' && macrosKnown && kcal != null && !impossible && !needServing;

  const build = (asNew: boolean) => ({
    id: asNew ? undefined : d.id,
    name: d.name.trim(),
    brand: d.brand,
    per100: { kcal: Math.round(kcal! * k), p: per(d.p)!, c: per(d.c)!, f: per(d.f)! },
    servingG: d.servingG && d.servingG > 0 ? d.servingG : undefined,
    liquid: d.liquid || undefined,
    source: d.source,
    barcode: asNew ? undefined : d.barcode,
  });

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSaved(saveFood(build(false)));
      }}
    >
      {d.note && (
        <p className="note" role="status">
          {d.note}
        </p>
      )}
      <TextField label="Name" value={d.name} onChange={(v) => set('name', v)} placeholder="e.g. Protein yogurt" autoFocus={!d.name} />
      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          Values on the label are
        </div>
        <div className="seg" role="group" aria-label="Values are per">
          <button type="button" aria-pressed={basis === '100'} onClick={() => setBasis('100')}>
            Per 100 {unit}
          </button>
          <button type="button" aria-pressed={basis === 'serving'} onClick={() => setBasis('serving')}>
            Per serving
          </button>
        </div>
      </div>
      <NumField
        label={basis === 'serving' ? 'Serving size' : 'Serving size (optional)'}
        unit={unit}
        value={d.servingG}
        onChange={(v) => set('servingG', v)}
        dp={0}
      />
      <div className="grid-2">
        <NumField label="Energy" unit="kcal" value={d.kcal} onChange={(v) => set('kcal', v)} dp={0} placeholder={implied != null ? String(Math.round(implied)) : ''} />
        <NumField label="Protein" unit="g" value={d.p} onChange={(v) => set('p', v)} />
        <NumField label="Carbs" unit="g" value={d.c} onChange={(v) => set('c', v)} />
        <NumField label="Fat" unit="g" value={d.f} onChange={(v) => set('f', v)} />
      </div>
      <label className="check">
        <input type="checkbox" checked={!!d.liquid} onChange={(e) => set('liquid', e.target.checked)} />
        <span>It is a drink (measure in ml)</span>
      </label>
      {basis === 'serving' && d.servingG && macrosKnown && kcal != null && (
        <p className="hint">
          Saved per 100 {unit}: {Math.round(kcal * k)} kcal · P {per(d.p)} · C {per(d.c)} · F {per(d.f)}.
        </p>
      )}
      {needServing && <p className="hint">Enter the serving size.</p>}
      {d.kcal == null && implied != null && (
        <p className="hint">{Math.round(implied)} kcal, from the macros.</p>
      )}
      {impossible && <p className="error">Protein, carbs and fat add up to more than 100 g per 100 g. One of them is wrong.</p>}
      {tooLow && !impossible && (
        <p className="error">
          These don't add up: the macros imply about {Math.round(implied!)} kcal, more than the {Math.round(d.kcal!)} entered. Check the numbers
          against the package. You can still save.
        </p>
      )}
      {tooHigh && !impossible && (
        <p className="hint">
          The energy is higher than the macros explain (about {Math.round(implied!)} kcal). That is normal for alcoholic drinks and some
          high-fibre foods; otherwise check the numbers.
        </p>
      )}
      {!valid && !impossible && !needServing && (
        <p className="hint">
          To save, fill in: {[d.name.trim() === '' && 'a name', d.p == null && 'protein', d.c == null && 'carbs', d.f == null && 'fat'].filter(Boolean).join(', ')}.
        </p>
      )}
      <button className="btn wide" disabled={!valid}>
        {d.id ? 'Save changes' : 'Save food'}
      </button>
      {d.id && (
        <button type="button" className="btn ghost wide" disabled={!valid} onClick={() => onSaved(saveFood({ ...build(true), name: `${d.name.trim()} (copy)`.slice(0, 60) }))}>
          Save as a new food
        </button>
      )}
      {d.id && (
        <button
          type="button"
          className="btn quiet"
          style={{ alignSelf: 'flex-start', color: 'var(--danger)' }}
          onClick={() => {
            const before = getState();
            update((s) => {
              s.foods = s.foods.filter((f) => f.id !== d.id);
            });
            toast('Food deleted. Entries already logged are kept.', { label: 'Undo', run: () => replaceState(before) });
            onDeleted();
          }}
        >
          <Icon name="trash" /> Delete this food
        </button>
      )}
    </form>
  );
}

/* ---------- barcode ---------- */

type BarcodeStatus =
  | { kind: 'scan' }
  | { kind: 'looking'; code: string }
  | { kind: 'missing'; code: string; name?: string; reason?: string }
  | { kind: 'error'; code: string; message: string };

function Barcode(props: {
  onFood: (f: Food) => void;
  onReview: (d: Draft) => void;
  onManual: (barcode: string, name?: string) => void;
  onLabel: (barcode: string, name?: string) => void;
}) {
  const s = useApp();
  const [status, setStatus] = useState<BarcodeStatus>({ kind: 'scan' });
  const [typed, setTyped] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const lookup = async (code: string) => {
    const known = s.foods.find((f) => f.barcode === code);
    if (known) return props.onFood(known);
    setStatus({ kind: 'looking', code });
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const res = await lookupBarcode(code, abort.current.signal);
      if (res.status === 'found') props.onFood(saveFood(res.food));
      else if (res.status === 'review') {
        const f = res.food;
        props.onReview({
          name: f.name, brand: f.brand, barcode: f.barcode, source: 'barcode',
          kcal: f.per100.kcal, p: f.per100.p, c: f.per100.c, f: f.per100.f, servingG: f.servingG ?? null, note: res.reason,
        });
      } else setStatus({ kind: 'missing', code, name: res.status === 'incomplete' ? res.name : undefined, reason: res.status === 'incomplete' ? res.reason : undefined });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setStatus({
        kind: 'error',
        code,
        message: navigator.onLine
          ? 'The food database could not be reached. Try again in a moment.'
          : 'You are offline, and barcode lookups need a connection.',
      });
    }
  };

  if (status.kind === 'scan') {
    return (
      <>
        <Scanner onCode={lookup} />

        <form
          className="grid-2"
          style={{ gridTemplateColumns: '1fr auto' }}
          onSubmit={(e) => {
            e.preventDefault();
            const code = typed.replace(/\D/g, '');
            if (code.length >= 8) void lookup(code);
          }}
        >
          <input
            className="input"
            inputMode="numeric"
            placeholder="Or type the barcode number"
            aria-label="Barcode number"
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 14))}
          />
          <button className="btn ghost" disabled={typed.length < 8}>
            Look up
          </button>
        </form>
      </>
    );
  }

  return (
    <div className="stack">
      <div>
        <div className="label">Barcode</div>
        <div className="display" style={{ fontSize: 34, marginTop: 6 }}>
          {status.code}
        </div>
      </div>
      {status.kind === 'looking' && (
        <p className="hint" role="status">
          Looking it up…
        </p>
      )}
      {status.kind === 'missing' && (
        <>
          <p className="hint" role="status">
            {status.reason ?? 'This product is not in the database.'}{' '}
            Read the values off the package instead. They will be saved against this barcode, so the next scan finds it.
          </p>
          <button className="btn wide" onClick={() => props.onLabel(status.code, status.name)}>
            <Icon name="camera" /> Scan the nutrition label
          </button>
          <button className="btn ghost wide" onClick={() => props.onManual(status.code, status.name)}>
            Type the values in
          </button>
        </>
      )}
      {status.kind === 'error' && (
        <>
          <p className="error" role="alert">
            {status.message}
          </p>
          <button className="btn wide" onClick={() => lookup(status.code)}>
            Try again
          </button>
          <button className="btn ghost wide" onClick={() => props.onManual(status.code)}>
            Type the values in
          </button>
        </>
      )}
      <button className="btn quiet" style={{ alignSelf: 'flex-start' }} onClick={() => setStatus({ kind: 'scan' })}>
        <Icon name="left" /> Scan another
      </button>
    </div>
  );
}

/* ---------- nutrition label (on-device OCR) ---------- */

function Label(props: {
  carry: { barcode?: string; name?: string };
  onDraft: (d: Draft) => void;
  onManual: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<'download' | 'read'>('download');
  const cancel = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    setProgress(0);
    setStage('download');
    setPreview(URL.createObjectURL(file));
    cancel.current = new AbortController();
    try {
      const text = await readLabelText(
        file,
        (st, p) => {
          if (!alive.current) return;
          setStage(st);
          setProgress(p);
        },
        cancel.current.signal,
      );
      if (!alive.current) return;
      const r = parseNutritionText(text);
      if (r.found === 0) {
        setError('No nutrition values could be read from that photo. Fill the frame with the table, keep it flat and sharp, and avoid glare. Or type the values in.');
        return;
      }
      // Energy worked out from the macros was not read off the label, so it does not count as found.
      const missing = (['kcal', 'p', 'c', 'f'] as const).filter((k) => r.per100[k] == null || (k === 'kcal' && r.energyFromMacros));
      const names = { kcal: 'energy', p: 'protein', c: 'carbs', f: 'fat' };
      const unconverted = r.basis === 'serving' && !r.servingG;
      props.onDraft({
        name: props.carry.name ?? '',
        barcode: props.carry.barcode,
        source: 'label',
        kcal: r.per100.kcal,
        p: r.per100.p,
        c: r.per100.c,
        f: r.per100.f,
        servingG: r.servingG,
        note:
          (missing.length
            ? `Found ${4 - missing.length} of 4 values; could not find ${missing.map((k) => names[k]).join(', ')}${r.energyFromMacros ? ' (energy was worked out from the macros)' : ''}. `
            : 'Found all four values. ') +
          (r.adjusted.length
            ? `${r.adjusted.map((k) => names[k]).join(' and ')} looked misread, so ${r.adjusted.length > 1 ? 'they were' : 'it was'} corrected to agree with the energy figure. `
            : '') +
          (unconverted
            ? 'The label is per serving and the serving weight could not be read, so these are per serving, not per 100 g: correct them before saving. '
            : r.basis === 'serving'
              ? `The label is per ${num(r.servingG!, 0)} g serving; values were converted to per 100 g. `
              : '') +
          'Text reading makes mistakes: check every number against the package before saving.',
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (alive.current) setError('The text reader could not start. Check your connection the first time you use it, then try again, or type the values in.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <>
      {preview && <img className="photo" src={preview} alt="Photo of the nutrition label" />}
      {busy ? (
        <div className="stack tight" role="status">
          <div className="progress">
            <i style={{ width: Math.max(4, Math.round(progress * 100)) + '%' }} />
          </div>
          <p className="hint">
            {stage === 'download'
              ? 'Getting the text reader ready. The first time, it downloads about 7 MB (later it works offline), which can take a minute or more on a slow connection.'
              : `Reading the label on this device… ${Math.round(progress * 100)}%`}
          </p>
          <div className="btn-row">
            <button
              className="btn ghost"
              onClick={() => {
                cancel.current?.abort();
                setBusy(false);
              }}
            >
              Cancel
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                cancel.current?.abort();
                setBusy(false);
                props.onManual();
              }}
            >
              Type it in
            </button>
          </div>
        </div>
      ) : (
        <>
          {!preview && <p className="hint">Take a photo of the nutrition table. You check the numbers before saving.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <label className="btn wide">
            <Icon name="camera" /> {preview ? 'Retake photo' : 'Take a photo'}
            <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => read(e.target.files?.[0])} />
          </label>
          <label className="btn ghost wide">
            Choose from photos
            <input className="sr-only" type="file" accept="image/*" data-testid="label-file" onChange={(e) => read(e.target.files?.[0])} />
          </label>
          <button className="btn quiet" style={{ alignSelf: 'flex-start' }} onClick={props.onManual}>
            Type the values in instead
          </button>
        </>
      )}
    </>
  );
}

/* ---------- quick add ---------- */

function Quick({ date, onDone }: { date: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | null>(null);
  const [p, setP] = useState<number | null>(null);
  const [c, setC] = useState<number | null>(null);
  const [f, setF] = useState<number | null>(null);
  const implied = kcalFromMacros(p ?? 0, c ?? 0, f ?? 0);
  const total = kcal ?? Math.round(implied);
  // 0 kcal is allowed for a named entry (diet drinks, black coffee); an unnamed empty entry is not.
  const valid = (total > 0 || name.trim() !== '') && total <= 20000 && (p ?? 0) <= 2000 && (c ?? 0) <= 2000 && (f ?? 0) <= 2000;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        logFood({ date, name: name.trim() || 'Quick add', grams: null, macros: { kcal: total, p: p ?? 0, c: c ?? 0, f: f ?? 0 } });
        toast('Added');
        onDone();
      }}
    >

      <TextField label="Name (optional)" value={name} onChange={setName} placeholder="e.g. Lunch out" />
      <div className="grid-2">
        <NumField label="Energy" unit="kcal" value={kcal} onChange={setKcal} dp={0} placeholder={implied > 0 ? String(Math.round(implied)) : ''} />
        <NumField label="Protein" unit="g" value={p} onChange={setP} />
        <NumField label="Carbs" unit="g" value={c} onChange={setC} />
        <NumField label="Fat" unit="g" value={f} onChange={setF} />
      </div>
      {kcal == null && implied > 0 && <p className="hint">{Math.round(implied)} kcal, from the macros.</p>}
      {total > 20000 && <p className="error">That is more than 20,000 kcal. Check the numbers.</p>}
      <button className="btn wide" disabled={!valid}>
        Add to log
      </button>
    </form>
  );
}
