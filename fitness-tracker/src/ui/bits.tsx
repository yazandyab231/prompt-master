import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Macros } from '../lib/types';
import { cleanDecimal, num, parseNum } from '../lib/units';

/** A numeric text field that keeps what the user typed while reporting a parsed number. */
export function NumField(props: {
  label?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  placeholder?: string;
  autoFocus?: boolean;
  integer?: boolean;
  dp?: number;
  id?: string;
  maxLength?: number;
}) {
  const fmt = (v: number | null) => (v == null ? '' : num(v, props.dp ?? 1));
  const [text, setText] = useState(fmt(props.value));
  const focused = useRef(false);
  useEffect(() => {
    // Follow outside changes (a preset chip, a unit switch), but never rewrite the text under the
    // cursor: clearing a field must leave it empty, not snap to "0".
    if (!focused.current && parseNum(text) !== props.value) setText(fmt(props.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  const input = (
    <input
      id={props.id}
      className="input"
      inputMode={props.integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      autoFocus={props.autoFocus}
      placeholder={props.placeholder}
      value={text}
      aria-label={props.label ? undefined : props.placeholder}
      maxLength={props.maxLength ?? 8}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        focused.current = false;
        setText(fmt(props.value));
      }}
      onChange={(e) => {
        const t = cleanDecimal(e.target.value);
        setText(t);
        props.onChange(parseNum(t));
      }}
    />
  );
  const body = props.unit ? (
    <span className="input-unit" style={{ display: 'block' }}>
      {input}
      <span>{props.unit}</span>
    </span>
  ) : (
    input
  );
  if (!props.label) return body;
  return (
    <label className="field">
      <span className="label">{props.label}</span>
      {body}
    </label>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="field">
      <span className="label">{props.label}</span>
      <input
        className="input"
        type={props.type ?? 'text'}
        value={props.value}
        placeholder={props.placeholder}
        autoFocus={props.autoFocus}
        autoComplete="off"
        maxLength={props.maxLength ?? 60}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

const MACRO_ROWS = [
  { key: 'p', name: 'Protein', color: 'var(--protein)' },
  { key: 'c', name: 'Carbs', color: 'var(--carbs)' },
  { key: 'f', name: 'Fat', color: 'var(--fat)' },
] as const;

/** Protein / carbs / fat against their targets. Values are text; colour only marks identity. */
export function MacroRails({ eaten, targets }: { eaten: Macros; targets: Macros }) {
  return (
    <div className="rails">
      {MACRO_ROWS.map((m) => {
        const v = eaten[m.key];
        const t = targets[m.key];
        const pct = t > 0 ? Math.min(100, (v / t) * 100) : 0;
        return (
          <div key={m.key}>
            <div className="rail-top">
              <span className="rail-name">
                <i style={{ background: m.color }} />
                {m.name}
              </span>
              <span className="rail-val">
                <b>{Math.round(v)}</b> / {Math.round(t)} g
              </span>
            </div>
            <div className="rail-track" role="img" aria-label={`${m.name}: ${Math.round(v)} of ${Math.round(t)} grams`}>
              <div className="rail-fill" style={{ width: pct + '%', background: m.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Four-up readout of calories and macros for a single food or entry. */
export function MacroStrip({ m }: { m: Macros }) {
  return (
    <div className="macro-strip">
      <div className="macro-cell">
        <div className="v">{Math.round(m.kcal)}</div>
        <div className="k">kcal</div>
      </div>
      {MACRO_ROWS.map((r) => (
        <div className="macro-cell" key={r.key}>
          <div className="v">{num(m[r.key], 1)}</div>
          <div className="k">
            <i style={{ background: r.color }} />
            {r.name.toLowerCase()} g
          </div>
        </div>
      ))}
    </div>
  );
}

export const macroLine = (m: Macros) =>
  `${Math.round(m.kcal)} kcal · P ${num(m.p, 0)} · C ${num(m.c, 0)} · F ${num(m.f, 0)}`;

/* ---------- toast ---------- */

let toastMsg: string | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const toastSubs = new Set<() => void>();
export function toast(msg: string) {
  toastMsg = msg;
  toastSubs.forEach((f) => f());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMsg = null;
    toastSubs.forEach((f) => f());
  }, 2600);
}
export function Toast() {
  const msg = useSyncExternalStore(
    (f) => {
      toastSubs.add(f);
      return () => toastSubs.delete(f);
    },
    () => toastMsg,
  );
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

/** Re-render every `ms` (used for clocks and due-reminder checks). */
export function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
