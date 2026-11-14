import { useMemo, useState } from 'react';
import { allExercises, uid, update, useApp } from '../lib/store';
import { EXERCISE_GROUPS } from '../lib/exercises';
import type { Exercise, ID } from '../lib/types';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { TextField, toast } from './bits';

/** Compare names ignoring case, extra spaces and punctuation, so "Bench  Press." matches "Bench Press". */
export const nameKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Every typed word must start a word of the name: "run" finds "Running", not "Crunch". */
const matches = (name: string, query: string) => {
  const words = nameKey(name).split(' ');
  return nameKey(query)
    .split(' ')
    .filter(Boolean)
    .every((q) => words.some((w) => w.startsWith(q)));
};

/** The tab last used, so the picker reopens where you were (e.g. on Triceps mid-workout). */
let lastTab = 'Chest';

export function ExercisePicker({ onPick, onClose }: { onPick: (id: ID) => void; onClose: () => void }) {
  const s = useApp();
  const [q, setQ] = useState('');
  const [tab, setTabState] = useState(lastTab);
  const setTab = (t: string) => {
    lastTab = t;
    setTabState(t);
  };
  const [group, setGroup] = useState(lastTab === 'Other' ? 'Other' : lastTab);
  const [managing, setManaging] = useState<Exercise | null>(null);
  const query = q.trim();
  const list = useMemo(() => {
    const all = allExercises(s);
    return query ? all.filter((e) => matches(e.name, query)) : all;
  }, [s, query]);
  const duplicate = query ? allExercises(s).find((e) => nameKey(e.name) === nameKey(query)) : undefined;

  const create = () => {
    const id = 'c-' + uid();
    update((d) => {
      d.exercises.unshift({ id, name: query.replace(/\s+/g, ' '), group, custom: true });
    });
    onPick(id);
  };

  if (managing) return <ManageExercise exercise={managing} onClose={() => setManaging(null)} />;

  return (
    <Sheet title="Add exercise" onClose={onClose} full>
      <div className="stack">
        <input
          className="input"
          placeholder="Search or type a new exercise"
          aria-label="Search exercises"
          value={q}
          maxLength={40}
          dir="auto"
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
        {query && !duplicate && nameKey(query) !== '' && (
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
            <p className="hint">“{query}” is not in the list. Create it as your own exercise.</p>
          </div>
        )}
        {!query && (
          <div className="tabs" role="tablist" aria-label="Muscle group">
            {EXERCISE_GROUPS.filter((g) => g !== 'Other' || allExercises(s).some((e) => e.group === 'Other')).map((g) => (
              <button key={g} role="tab" aria-selected={tab === g} className="tab-chip" onClick={() => setTab(g)}>
                {g}
              </button>
            ))}
          </div>
        )}
        {(query ? EXERCISE_GROUPS : [tab]).map((g) => {
          const items = list.filter((e) => e.group === g);
          if (!items.length) return query ? null : <p key={g} className="hint">Nothing here yet.</p>;
          return (
            <div key={g} role={query ? undefined : 'tabpanel'}>
              {query && (
                <h3 className="label" style={{ marginBottom: 8 }}>
                  {g}
                </h3>
              )}
              <div className="rows">
                {items.map((e) => (
                  <div key={e.id} className="row" style={{ minHeight: 50, padding: 0 }}>
                    <button className="row-btn" style={{ minHeight: 50 }} onClick={() => onPick(e.id)} aria-label={`Add ${e.name}`}>
                      <span className="row-main">
                        <span className="row-title">{e.name}</span>
                      </span>
                      <Icon name="plus" />
                    </button>
                    {e.custom && (
                      <button className="icon-btn" onClick={() => setManaging(e)} aria-label={`Rename or delete ${e.name}`}>
                        <Icon name="edit" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Rename, regroup or delete one of your own exercises. History keeps working either way. */
function ManageExercise({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const s = useApp();
  const [name, setName] = useState(exercise.name);
  const [group, setGroup] = useState(exercise.group);
  const [confirm, setConfirm] = useState(false);
  const clash = allExercises(s).find((e) => e.id !== exercise.id && nameKey(e.name) === nameKey(name));
  const used = s.workouts.some((w) => w.exercises.some((e) => e.exerciseId === exercise.id)) || s.routines.some((r) => r.exercises.some((e) => e.exerciseId === exercise.id));
  const valid = nameKey(name) !== '' && !clash;
  return (
    <Sheet
      title="Your exercise"
      onClose={onClose}
      onBack={onClose}
      foot={
        <button
          className="btn wide"
          disabled={!valid}
          onClick={() => {
            update((d) => {
              const x = d.exercises.find((e) => e.id === exercise.id);
              if (x) {
                x.name = name.trim().replace(/\s+/g, ' ');
                x.group = group;
              }
            });
            toast('Exercise updated');
            onClose();
          }}
        >
          Save
        </button>
      }
    >
      <div className="stack">
        <TextField label="Name" value={name} onChange={setName} maxLength={40} />
        {clash && <p className="error">“{clash.name}” already exists.</p>}
        <label className="field">
          <span className="label">Muscle group</span>
          <select className="select" value={group} onChange={(e) => setGroup(e.target.value)}>
            {EXERCISE_GROUPS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        {used && <p className="hint">Renaming changes the name everywhere, including past sessions.</p>}
        {confirm ? (
          <div className="stack tight">
            <p className="error">
              Delete “{exercise.name}”?{used ? ' It is removed from your training days; past sessions keep their sets but show it as a deleted exercise.' : ''}
            </p>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setConfirm(false)}>
                Keep it
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  update((d) => {
                    d.exercises = d.exercises.filter((e) => e.id !== exercise.id);
                    for (const r of d.routines) r.exercises = r.exercises.filter((e) => e.exerciseId !== exercise.id);
                  });
                  onClose();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button className="btn quiet" style={{ alignSelf: 'flex-start', color: 'var(--danger)', marginLeft: -10 }} onClick={() => setConfirm(true)}>
            <Icon name="trash" /> Delete this exercise
          </button>
        )}
      </div>
    </Sheet>
  );
}
