const CACHE_NAME = 'calendar-mvp-v3';
const ASSETS = ['./','./index.html','./styles.css','./script.js','./manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))));
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(()=>caches.match('./index.html')));
  } else {
    event.respondWith(caches.match(req).then(c => c || fetch(req).then(res => { const clone=res.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(req, clone)); return res; })));
  }
});
