const CACHE='joyfeednews-v5';
const ASSETS=['/','/index.html','/styles.css','/app.js','/manifest.webmanifest','/assets/logo.svg','/about.html','/reader.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE?caches.delete(k):null))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(ASSETS.includes(u.pathname)){e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));}
});
