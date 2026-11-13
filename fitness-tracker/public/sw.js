/* Logbook service worker: offline cache + push notifications. */
const CACHE = 'logbook-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: try the network first so updates arrive, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only a good page may become the offline shell (never a 404 or error page).
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/', { ignoreVary: true }).then((r) => r || Response.error())),
    );
    return;
  }

  // Everything else (hashed assets, fonts, the OCR engine): cache first, fill the cache on a miss.
  // ignoreVary: a file cached by the precache step must also answer the page's own request for it,
  // even when the server sends a Vary header and the two requests differ (e.g. module scripts).
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// The page tells us which files it loaded. Cache any we are missing, and drop hashed assets
// from older builds that the current page no longer uses.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'precache' || !Array.isArray(data.urls)) return;
  const wanted = data.urls.filter((u) => typeof u === 'string' && u.startsWith(self.location.origin));
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        wanted.map(async (url) => {
          if (await cache.match(url, { ignoreVary: true })) return;
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res.ok) await cache.put(url, res);
          } catch (e) {
            /* offline or blocked: it will be cached on a later visit */
          }
        }),
      );
      const keep = new Set(wanted);
      for (const req of await cache.keys()) {
        if (new URL(req.url).pathname.startsWith('/assets/') && !keep.has(req.url)) await cache.delete(req);
      }
    }),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: event.data ? event.data.text() : 'Logbook' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Logbook', {
      body: data.body || '',
      tag: data.tag || 'logbook',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) if ('focus' in client) return client.focus();
      return self.clients.openWindow('/');
    }),
  );
});
