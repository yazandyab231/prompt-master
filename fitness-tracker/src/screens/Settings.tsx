import { useEffect, useRef, useState } from 'react';
import type { Reminder, ThemeChoice } from '../lib/types';
import { defaultState, replaceState, uid, update, useApp, setTargets } from '../lib/store';
import { applyBackup, exportData, readBackup, type BackupPreview } from '../lib/backup';
import { alreadyPassedToday, clockDate, REMINDER_PRESETS } from '../lib/reminders';
import { disablePush, enablePush, getPushState, notificationsSupported, syncPush, type PushState } from '../lib/push';
import { DAYS_SHORT, today } from '../lib/date';
import { kcalFromMacros } from '../lib/units';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { TargetsSheet } from './Today';
import { NumField, TextField, toast } from '../ui/bits';

const THEMES: { id: ThemeChoice; name: string; bg: string; ink: string; accent: string }[] = [
  { id: 'clean', name: 'Clean', bg: '#f6f7f9', ink: '#16191f', accent: '#2453d6' },
  { id: 'auto', name: 'Auto', bg: 'linear-gradient(135deg, #f6f7f9 50%, #16171a 50%)', ink: '#6b7280', accent: '#2453d6' },
  { id: 'iron', name: 'Dark', bg: '#16171a', ink: '#eceef2', accent: '#8fb0ff' },
  { id: 'ember', name: 'Ember', bg: '#100d0b', ink: '#f1e9e0', accent: '#ff5a2b' },
  { id: 'tide', name: 'Tide', bg: '#081018', ink: '#e4edf5', accent: '#3ee0cf' },
  { id: 'chalk', name: 'Chalk', bg: '#f2efe9', ink: '#151515', accent: '#1f3bff' },
  { id: 'clay', name: 'Clay', bg: '#ece2d5', ink: '#2a1f17', accent: '#b23f1c' },
];

export function Settings() {
  const s = useApp();
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [erase, setErase] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const t = s.settings.targets;
  const implied = Math.round(kcalFromMacros(t.p, t.c, t.f));

  // Keep the push service in step with the reminder list.
  const remindersKey = JSON.stringify(s.reminders);
  useEffect(() => {
    const id = setTimeout(() => void syncPush(s.reminders).catch(() => undefined), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindersKey]);

  const [capNote, setCapNote] = useState<string | null>(null);
  /** An emptied field keeps the old target (a target of 0 makes no sense); far-off values are capped and said so. */
  const setTarget = (k: keyof typeof t, v: number | null) => {
    if (v == null || v <= 0) return;
    const max = k === 'kcal' ? 20000 : 2000;
    setCapNote(v > max ? `The most this field takes is ${max.toLocaleString('en-US')}.` : null);
    setTargets({ ...s.settings.targets, [k]: Math.min(v, max) });
    if (!s.settings.targetsReviewed) update((d) => void (d.settings.targetsReviewed = true));
  };
  const [targetsOpen, setTargetsOpen] = useState(false);

  return (
    <>
      <header className="masthead">
        <h1 className="display">Setup</h1>
      </header>

      <section className="block">
        <div className="block-head">
          <span className="label">Theme</span>
        </div>
        <div className="themes" role="group" aria-label="Theme">
          {THEMES.map((th) => (
            <button
              key={th.id}
              className="theme-card"
              style={{ background: th.bg, color: th.ink }}
              aria-pressed={s.settings.theme === th.id}
              onClick={() =>
                update((d) => {
                  d.settings.theme = th.id;
                  d.settings.themeChosen = true;
                })
              }
            >
              <span className="sw" style={{ background: th.accent }} />
              <span className="bar" style={{ background: th.ink }} />
              <span className="bar" style={{ background: th.ink }} />
              <b>{th.name}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <span className="label">Units</span>
        </div>
        <div className="seg" role="group" aria-label="Weight units">
          <button aria-pressed={s.settings.units === 'kg'} onClick={() => update((d) => void (d.settings.units = 'kg'))}>
            Kilograms
          </button>
          <button aria-pressed={s.settings.units === 'lb'} onClick={() => update((d) => void (d.settings.units = 'lb'))}>
            Pounds
          </button>
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <span className="label">Daily targets</span>
          {s.settings.targetsReviewed && (
            <button className="link" onClick={() => setTargetsOpen(true)}>
              Recalculate
            </button>
          )}
        </div>
        {!s.settings.targetsReviewed ? (
          <button className="btn wide" onClick={() => setTargetsOpen(true)}>
            Answer 5 questions to set your targets
          </button>
        ) : (
        <>
        <div className="grid-2">
          <NumField label="Energy" unit="kcal" value={t.kcal} onChange={(v) => setTarget('kcal', v)} dp={0} />
          <NumField label="Protein" unit="g" value={t.p} onChange={(v) => setTarget('p', v)} dp={0} />
          <NumField label="Carbs" unit="g" value={t.c} onChange={(v) => setTarget('c', v)} dp={0} />
          <NumField label="Fat" unit="g" value={t.f} onChange={(v) => setTarget('f', v)} dp={0} />
        </div>
        {capNote && <p className="error" style={{ marginTop: 10 }}>{capNote}</p>}
        <p className="hint" style={{ marginTop: 10 }}>
          {Math.abs(implied - t.kcal) > 60 &&
            `Your macros add up to ${implied.toLocaleString('en-US')} kcal, not ${t.kcal.toLocaleString('en-US')}. `}
          {Math.abs(implied - t.kcal) > 60 && (
            <button className="link accent" style={{ padding: 0 }} onClick={() => setTarget('kcal', implied)}>
              Use {implied.toLocaleString('en-US')}
            </button>
          )}
        </p>
        </>
        )}
      </section>

      <section className="block">
        <div className="block-head">
          <h2 className="label">When your day starts</h2>
        </div>
        <select
          className="select"
          aria-label="When your day starts"
          value={s.settings.dayStart}
          onChange={(e) => update((d) => void (d.settings.dayStart = Number(e.target.value)))}
        >
          <option value={0}>Midnight (default)</option>
          {[1, 2, 3, 4, 5, 6].map((h) => (
            <option key={h} value={h}>
              {`0${h}:00`}
            </option>
          ))}
        </select>
        <p className="hint" style={{ marginTop: 8 }}>For night shifts or late meals: food logged before this time counts for the day before.</p>
      </section>

      <section className="block">
        <div className="block-head">
          <span className="label">Reminders</span>
          <button
            className="link"
            onClick={() => setEditing({ id: '', kind: 'custom', title: '', time: '18:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true })}
          >
            <Icon name="plus" /> New
          </button>
        </div>
        <PushPanel reminders={s.reminders} />
        {s.reminders.length === 0 ? (
          <div className="chips" style={{ marginTop: 14 }}>
            {REMINDER_PRESETS.map((p) => (
              <button
                key={p.kind}
                className="chip"
                onClick={() =>
                  update((d) => {
                    const id = uid();
                    d.reminders.push({ id, enabled: true, ...p });
                    if (alreadyPassedToday(p.time)) d.reminderSeen[id] = clockDate();
                  })
                }
              >
                + {p.title} · {p.time}
              </button>
            ))}
          </div>
        ) : (
          <div className="rows" style={{ marginTop: 14 }}>
            {[...s.reminders].sort((a, b) => a.time.localeCompare(b.time)).map((r) => (
              <div key={r.id} className="row">
                <button className="row-main" style={{ textAlign: 'left' }} onClick={() => setEditing(r)}>
                  <span className="row-title" style={{ display: 'block' }}>
                    {r.title}
                  </span>
                  <span className="row-sub" style={{ display: 'block' }}>
                    {r.time} · {r.days.length === 7 ? 'every day' : r.days.map((d) => DAYS_SHORT[d]).join(' ')}
                  </span>
                </button>
                <button
                  className="switch"
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`${r.title} reminder`}
                  onClick={() =>
                    update((d) => {
                      const x = d.reminders.find((y) => y.id === r.id);
                      if (x) x.enabled = !x.enabled;
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="block">
        <div className="block-head">
          <span className="label">Your data</span>
        </div>
        <p className="hint" style={{ marginBottom: 14 }}>
          Saved on this phone only. {s.settings.lastExport ? `Last backup: ${s.settings.lastExport}.` : 'No backup yet.'}
        </p>
        <div className="btn-row">
          <button
            className="btn ghost"
            onClick={() => {
              exportData();
              update((d) => void (d.settings.lastExport = today()));
            }}
          >
            Export backup
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
        </div>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          aria-label="Backup file to import"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              setPending(await readBackup(file));
              setImportError(null);
            } catch (err: any) {
              setPending(null);
              setImportError(err?.message ?? 'Import failed.');
            }
          }}
        />
        {importError && (
          <p className="error" role="alert" style={{ marginTop: 10 }}>
            {importError}
          </p>
        )}
        {pending ? (
          <div className="note" style={{ margin: '12px 0 14px' }} role="status">
            <b>Replace everything with this backup?</b>
            <br />
            It holds {pending.state.workouts.length} sessions, {pending.state.entries.length} food entries and {pending.state.bodyWeights.length}{' '}
            weigh-ins{pending.exportedAt ? `, exported ${pending.exportedAt.slice(0, 10)}` : ''}. What is in the app now will be overwritten.
            {pending.dropped > 0 && (
              <>
                {' '}
                <b>
                  {pending.dropped} {pending.dropped === 1 ? 'item' : 'items'} in the file could not be read and will be left out.
                </b>
              </>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={() => {
                  applyBackup(pending);
                  setPending(null);
                  toast('Backup imported');
                }}
              >
                Replace my data
              </button>
            </div>
          </div>
        ) : null}
        {erase ? (
          <div className="stack tight">
            <p className="error">This deletes every workout, food entry, weigh-in and setting on this device. It cannot be undone.</p>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setErase(false)}>
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  replaceState({ ...defaultState(), settings: { ...defaultState().settings, theme: s.settings.theme, units: s.settings.units } });
                  setErase(false);
                  toast('All data erased');
                }}
              >
                Erase everything
              </button>
            </div>
          </div>
        ) : (
          <button className="btn quiet" style={{ color: 'var(--danger)', marginLeft: -10 }} onClick={() => setErase(true)}>
            <Icon name="trash" /> Erase all data
          </button>
        )}
      </section>

      {editing && <ReminderSheet reminder={editing} onClose={() => setEditing(null)} />}
      {targetsOpen && <TargetsSheet onClose={() => setTargetsOpen(false)} />}
    </>
  );
}

/** Says plainly which kind of reminder delivery this device has right now. */
function PushPanel({ reminders }: { reminders: Reminder[] }) {
  const [state, setState] = useState<PushState | null>(null);
  const [permission, setPermission] = useState(notificationsSupported() ? Notification.permission : 'denied');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => getPushState().then(setState);
  useEffect(() => {
    void refresh();
  }, []);
  if (!state) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'That did not work.');
    }
    setBusy(false);
    if (notificationsSupported()) setPermission(Notification.permission);
    void refresh();
  };

  const allowWhileOpen = notificationsSupported() && permission === 'default' && (
    <button
      className="btn ghost small"
      style={{ marginTop: 10 }}
      onClick={() => run(async () => void (await Notification.requestPermission()))}
    >
      Allow notifications
    </button>
  );

  return (
    <div className="note">
      {state === 'on' && (
        <>
          <b>Push is on.</b> Reminders arrive on this device even when the app is closed.
          <br />
          <button className="btn ghost small" style={{ marginTop: 10 }} disabled={busy} onClick={() => run(disablePush)}>
            Turn push off
          </button>
        </>
      )}
      {state === 'off' && (
        <>
          <b>Push is available but off.</b> Turn it on to get reminders when the app is closed. Only your reminder times are sent to the push service.
          <br />
          <button className="btn small" style={{ marginTop: 10 }} disabled={busy} onClick={() => run(() => enablePush(reminders))}>
            Turn push on
          </button>
        </>
      )}
      {state === 'not-configured' && (
        <>
          <b>Push is not connected yet.</b> This copy of the app has no push service behind it, so reminders show as a banner on Today
          {permission === 'granted' ? ' and as a notification' : ''}, but only while the app is open. They will not arrive when it is closed.
          {allowWhileOpen && <br />}
          {allowWhileOpen}
        </>
      )}
      {state === 'needs-install' && (
        <>
          <b>Add Logbook to your home screen first.</b> On iPhone and iPad, notifications only work for installed web apps: tap Share, then “Add to Home
          Screen”, and open it from there. Until then reminders show as a banner on Today while the app is open.
        </>
      )}
      {state === 'denied' && (
        <>
          <b>Notifications are blocked</b> for this site in your browser settings. Allow them there to get reminders; until then they show as a banner on
          Today while the app is open.
        </>
      )}
      {state === 'unsupported' && (
        <>
          <b>This browser cannot receive push.</b> Reminders show as a banner on Today while the app is open.
        </>
      )}
      {error && (
        <p className="error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}

function ReminderSheet({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
  const [r, setR] = useState(reminder);
  const isNew = !reminder.id;
  const valid = r.title.trim() !== '' && /^\d{2}:\d{2}$/.test(r.time) && r.days.length > 0;
  const save = () => {
    if (!valid) return;
    update((d) => {
      const clean = { ...r, title: r.title.trim(), days: [...r.days].sort() };
      if (isNew) {
        const id = uid();
        d.reminders.push({ ...clean, id });
        // A new reminder whose time has already passed today waits until next time instead of going off now.
        if (alreadyPassedToday(clean.time)) d.reminderSeen[id] = clockDate();
      } else {
        const i = d.reminders.findIndex((x) => x.id === r.id);
        const old = d.reminders[i];
        if (i >= 0) d.reminders[i] = clean;
        // Only a new time or new days can make it due again today; a rename does not.
        if (old && (old.time !== clean.time || old.days.join() !== clean.days.join())) {
          if (alreadyPassedToday(clean.time)) d.reminderSeen[r.id] = clockDate();
          else delete d.reminderSeen[r.id];
        }
      }
    });
    onClose();
  };
  return (
    <Sheet
      title={isNew ? 'New reminder' : 'Edit reminder'}
      onClose={onClose}
      foot={
        <div className="btn-row">
          {!isNew && (
            <button
              className="btn danger"
              onClick={() => {
                update((d) => {
                  d.reminders = d.reminders.filter((x) => x.id !== r.id);
                });
                onClose();
              }}
            >
              Delete
            </button>
          )}
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
        <TextField label="What to remind you" value={r.title} onChange={(v) => setR({ ...r, title: v })} placeholder="e.g. Time to train" autoFocus={isNew} maxLength={50} />
        <label className="field">
          <span className="label">Time</span>
          <input className="input" type="time" value={r.time} onChange={(e) => setR({ ...r, time: e.target.value })} />
        </label>
        <div>
          <div className="label" style={{ marginBottom: 7 }}>
            Days
          </div>
          <div className="days" role="group" aria-label="Days">
            {DAYS_SHORT.map((d, i) => (
              <button
                type="button"
                key={d}
                aria-pressed={r.days.includes(i)}
                aria-label={d}
                onClick={() => setR({ ...r, days: r.days.includes(i) ? r.days.filter((x) => x !== i) : [...r.days, i] })}
              >
                {d[0]}
              </button>
            ))}
          </div>
          {r.days.length === 0 && <p className="error" style={{ marginTop: 8 }}>Pick at least one day.</p>}
        </div>
        <button className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Sheet>
  );
}
