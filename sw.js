// sw.js
const CACHE_NAME = 'locked-in-calendar-v3-fixed2-full-b3-20250814';
const ASSETS = ['./','./index.html','./styles.css','./script.js','./manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Always try network first for navigations, fall back to cached index
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const rc = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, rc));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For other requests: cache-first, then network, then cache the fresh copy
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const rc = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, rc));
          return res;
        })
    )
  );
});
