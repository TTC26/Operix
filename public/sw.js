// Operix service worker — enables installable PWA + offline fallback.
// Strategy: NETWORK-FIRST for same-origin GET requests, so a new deploy always
// takes effect immediately (no stale-code trap). Cache is only a fallback when
// offline. Cross-origin requests (Firebase Auth/Firestore, Google Fonts, CDNs)
// are never intercepted, so login and data sync are untouched.
const CACHE = 'operix-v1';

self.addEventListener('install', (event) => {
  // Activate this SW immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  // Only handle our own origin — leave Firebase / fonts / CDNs alone.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      // Cache a copy for offline use.
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      // Offline — serve from cache if we have it.
      const cached = await caches.match(req);
      if (cached) return cached;
      // For navigations, fall back to the app shell.
      if (req.mode === 'navigate') {
        const shell = await caches.match('/index.html') || await caches.match('/');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
