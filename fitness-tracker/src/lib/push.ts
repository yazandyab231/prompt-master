import type { Reminder } from './types';

const PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() || '';

export type PushState =
  | 'unsupported' // this browser cannot do push at all
  | 'needs-install' // iPhone/iPad: only works once added to the home screen
  | 'not-configured' // the site was built without a push service
  | 'denied' // notifications blocked in browser settings
  | 'off'
  | 'on';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

export const notificationsSupported = () => typeof Notification !== 'undefined';

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function getPushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !notificationsSupported()) return 'unsupported';
  if (!PUBLIC_KEY) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

const b64ToBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

const payload = (sub: PushSubscription, reminders: Reminder[]) => ({
  subscription: sub.toJSON(),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  reminders: reminders.filter((r) => r.enabled).map((r) => ({ id: r.id, title: r.title, time: r.time, days: r.days })),
});

async function send(method: 'POST' | 'DELETE', body: unknown) {
  const res = await fetch('/api/push/sync', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`The push service answered ${res.status}.`);
}

export async function enablePush(reminders: Reminder[]) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed.');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(PUBLIC_KEY) }));
  await send('POST', payload(sub, reminders));
}

export async function disablePush() {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await send('DELETE', { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe();
}

/** Push the current reminder list to the server, if this device is subscribed. */
export async function syncPush(reminders: Reminder[]) {
  if (!PUBLIC_KEY) return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await send('POST', payload(sub, reminders));
}

/** Show a notification from the open app (used when real push is not connected). */
export async function notifyLocal(title: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const reg = await registration();
  try {
    if (reg) await reg.showNotification(title, { tag, icon: '/icon-192.png' });
    else new Notification(title, { tag, icon: '/icon-192.png' });
  } catch {
    /* some browsers only allow notifications through a service worker */
  }
}
