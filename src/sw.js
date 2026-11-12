/* Bizvora service worker: offline app shell. Bump VERSION on every release. */
const VERSION = 'bizvora-v8';
const SHELL = ['/app', '/app.html', '/css/styles.css', '/js/engine.js', '/js/example.js', '/js/ui-core.js', '/js/store.js', '/js/views.js', '/js/report.js', '/js/account.js', '/js/payments.js', '/js/admin.js', '/js/reportpro.js', '/js/main.js', '/vendor/firebase-app-compat.js', '/vendor/firebase-auth-compat.js', '/vendor/firebase-firestore-compat.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/vendor/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(hit => hit || caches.match('/app.html'))));
});
