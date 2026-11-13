import { useCallback, useEffect, useRef, useState } from 'react';
import { activeWorkout, update, useApp } from './lib/store';
import { dueReminders } from './lib/reminders';
import { getPushState, notifyLocal, syncPush } from './lib/push';
import { today } from './lib/date';
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
  openWorkout: () => void;
  addFood: (date: string) => void;
}

export function App() {
  const s = useApp();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [workoutOpen, setWorkoutOpen] = useState(false);
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
    openWorkout: () => setWorkoutOpen(true),
    addFood: (date) => setAddFoodDate(date),
  };

  // While the app is open, raise a system notification for each newly due reminder.
  // If real push is connected the server already sends it, so we stay quiet here.
  const due = dueReminders(s.reminders, s.reminderSeen);
  const announced = useRef(new Set<string>());
  useEffect(() => {
    const fresh = due.filter((r) => !announced.current.has(r.id + today()));
    if (!fresh.length) return;
    fresh.forEach((r) => announced.current.add(r.id + today()));
    void getPushState().then((state) => {
      if (state !== 'on') fresh.forEach((r) => void notifyLocal(r.title, r.id));
    });
  }, [due]);

  const active = activeWorkout(s);
  const dismiss = (id: string) =>
    update((d) => {
      d.reminderSeen[id] = today();
    });

  return (
    <>
      <div className="app">
        <main className="screen">
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
      {workoutOpen && active && <WorkoutLogger workout={active} onClose={() => setWorkoutOpen(false)} />}
      {addFoodDate && <AddFood date={addFoodDate} onClose={() => setAddFoodDate(null)} />}
      <Toast />
    </>
  );
}
