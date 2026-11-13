// Stores one push subscription and its reminder times. Nothing else about the user
// ever reaches this server: workouts, food and body weight stay on their device.
import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { sanitizeRecord, type PushRecord } from '../../server/due';

const keyFor = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex');

export default async (req: Request) => {
  const store = getStore('push-subscriptions');
  let body: any;
  try {
    const text = await req.text();
    if (text.length > 20_000) return new Response('Too large', { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  if (req.method === 'DELETE') {
    if (typeof body?.endpoint !== 'string') return new Response('Missing endpoint', { status: 400 });
    await store.delete(keyFor(body.endpoint));
    return Response.json({ ok: true });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const clean = sanitizeRecord(body);
  if (!clean) return new Response('Invalid subscription', { status: 400 });
  const key = keyFor(clean.subscription.endpoint);
  const previous = (await store.get(key, { type: 'json' })) as PushRecord | null;
  const record: PushRecord = { ...clean, sent: previous?.sent ?? {} };
  await store.setJSON(key, record);
  return Response.json({ ok: true, reminders: record.reminders.length });
};

export const config: Config = { path: '/api/push/sync' };
