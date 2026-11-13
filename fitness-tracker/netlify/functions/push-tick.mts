// Runs every minute: sends any reminder whose time has just passed in its owner's time zone.
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { sendNotification, setVapidDetails } from 'web-push';
import { dueNow, localParts, type PushRecord } from '../../server/due';

export default async () => {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('push-tick: VAPID keys are not set; nothing sent');
    return;
  }
  setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const store = getStore('push-subscriptions');
  const now = Date.now();
  const { blobs } = await store.list();
  for (const { key } of blobs) {
    const record = (await store.get(key, { type: 'json' })) as PushRecord | null;
    if (!record) continue;
    const due = dueNow(record, now);
    if (!due.length) continue;
    const today = localParts(now, record.tz).date;
    let gone = false;
    for (const r of due) {
      try {
        await sendNotification(
          record.subscription,
          JSON.stringify({ title: r.title, body: r.body ?? '', tag: r.id }),
          { TTL: 60 * 60 },
        );
        record.sent[r.id] = today;
      } catch (err: any) {
        // 404/410 mean the browser dropped this subscription: forget it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          gone = true;
          break;
        }
        console.error('push-tick: send failed', err?.statusCode ?? err);
      }
    }
    if (gone) {
      await store.delete(key);
      continue;
    }
    // Write back only what we changed. Re-read first, so a reminder edit that arrived while we
    // were sending is not overwritten with the list we started from.
    const latest = ((await store.get(key, { type: 'json' })) as PushRecord | null) ?? record;
    await store.setJSON(key, { ...latest, sent: { ...latest.sent, ...record.sent } });
  }
};

export const config: Config = { schedule: '* * * * *' };
