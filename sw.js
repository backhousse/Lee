const CACHE_NAME='locked-in-calendar-v3-fixed2-full';
const ASSETS=['./','./index.html','./styles.css','./script.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))) });
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(res=>{const rc=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(req,rc)); return res}).catch(()=>caches.match('./index.html')));
  } else {
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{const rc=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(req,rc)); return res;})));
  }
});