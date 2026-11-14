import { useCallback, useEffect, useRef, useState } from 'react';
import { activeWorkout, getState, update, useApp, useStorageBroken } from './lib/store';
import { clockDate, dueReminders } from './lib/reminders';
import { getPushState, notifyLocal, syncPush } from './lib/push';
import { Icon } from './ui/Icon';
import { Toast, useTick } from './ui/bits';
import { Today } from './screens/Today';
import { Train } from './screens/Train';
import { WorkoutLogger } from './screens/Workout';
import { Food } from './screens/Food';
import { AddFood } from './screens/AddFood';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';

export type Tab = 'today' | 'train' | 'food' | 'progress' | 'settings';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'train', label: 'Train', icon: 'train' },
  { id: 'food', label: 'Food', icon: 'food' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'settings', label: 'Setup', icon: 'settings' },
];
const tabFromHash = (): Tab => {
  const h = location.hash.replace('#/', '') as Tab;
  return TABS.some((t) => t.id === h) ? h : 'today';
};

export interface Nav {
  go: (tab: Tab) => void;
  /** Open the logger: the session in progress, or a given (finished) session to edit. */
  openWorkout: (id?: string) => void;
  addFood: (date: string) => void;
}

export function App() {
  const s = useApp();
  const storageBroken = useStorageBroken();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [addFoodDate, setAddFoodDate] = useState<string | null>(null);
  useTick(30_000);

  useEffect(() => {
    void syncPush(s.reminders).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((t: Tab) => {
    location.hash = '#/' + t;
    setTab(t);
    window.scrollTo(0, 0);
  }, []);
  const nav: Nav = {
    go,
    // Read the store now, not the render-time snapshot: the session may have been created a moment ago.
    openWorkout: (id) => setWorkoutId(id ?? activeWorkout(getState())?.id ?? null),
    addFood: (date) => setAddFoodDate(date),
  };

  // While the app is open, raise a system notification for each newly due reminder.
  // If real push is connected the server already sends it, so we stay quiet here.
  const due = dueReminders(s.reminders, s.reminderSeen);
  const announced = useRef(new Set<string>());
  useEffect(() => {
    const fresh = due.filter((r) => !announced.current.has(r.id + clockDate()));
    if (!fresh.length) return;
    fresh.forEach((r) => announced.current.add(r.id + clockDate()));
    void getPushState().then((state) => {
      if (state !== 'on') fresh.forEach((r) => void notifyLocal(r.title, r.id));
    });
  }, [due]);

  const openWorkout = workoutId ? s.workouts.find((w) => w.id === workoutId) ?? null : null;
  const dismiss = (ids: string[]) =>
    update((d) => {
      for (const id of ids) d.reminderSeen[id] = clockDate();
    });

  return (
    <>
      <div className="app">
        <main className="screen">
          {storageBroken && (
            <div className="note" role="alert" style={{ margin: '0 0 16px', borderLeftColor: 'var(--danger)' }}>
              <b>This browser is not saving your data.</b> Private browsing or blocked site data stops the app from storing anything, so it
              disappears when you close or reload. Use a normal window, or export a backup from Setup before closing.
            </div>
          )}
          {tab === 'today' && <Today nav={nav} due={due} onDismiss={dismiss} />}
          {tab === 'train' && <Train nav={nav} />}
          {tab === 'food' && <Food nav={nav} />}
          {tab === 'progress' && <Progress />}
          {tab === 'settings' && <Settings />}
        </main>
      </div>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </nav>
      {openWorkout && <WorkoutLogger workout={openWorkout} onClose={() => setWorkoutId(null)} />}
      {addFoodDate && <AddFood date={addFoodDate} onClose={() => setAddFoodDate(null)} />}
      <Toast />
    </>
  );
}
