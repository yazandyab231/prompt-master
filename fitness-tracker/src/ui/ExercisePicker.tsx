import { useMemo, useState } from 'react';
import { allExercises, uid, update, useApp } from '../lib/store';
import { EXERCISE_GROUPS } from '../lib/exercises';
import type { ID } from '../lib/types';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

export function ExercisePicker({ onPick, onClose }: { onPick: (id: ID) => void; onClose: () => void }) {
  const s = useApp();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('Other');
  const query = q.trim().toLowerCase();
  const list = useMemo(() => {
    const all = allExercises(s);
    return query ? all.filter((e) => e.name.toLowerCase().includes(query)) : all;
  }, [s, query]);
  const exact = list.some((e) => e.name.toLowerCase() === query);

  const create = () => {
    const id = 'c-' + uid();
    update((d) => {
      d.exercises.unshift({ id, name: q.trim(), group, custom: true });
    });
    onPick(id);
  };

  return (
    <Sheet title="Add exercise" onClose={onClose} full>
      <div className="stack">
        <input
          className="input"
          placeholder="Search or type a new exercise"
          aria-label="Search exercises"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
        {query && !exact && (
          <div className="stack tight">
            <div className="grid-2">
              <select className="select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Muscle group">
                {EXERCISE_GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <button className="btn ghost" onClick={create}>
                <Icon name="plus" /> Create
              </button>
            </div>
            <p className="hint">“{q.trim()}” is not in the list. Create it as your own exercise.</p>
          </div>
        )}
        {EXERCISE_GROUPS.map((g) => {
          const items = list.filter((e) => e.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <div className="label" style={{ marginBottom: 8 }}>
                {g}
              </div>
              <div className="rows">
                {items.map((e) => (
                  <button key={e.id} className="row" style={{ minHeight: 50 }} onClick={() => onPick(e.id)}>
                    <span className="row-main">
                      <span className="row-title">{e.name}</span>
                    </span>
                    {e.custom && <span className="mono">yours</span>}
                    <Icon name="plus" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
