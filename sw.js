const CACHE = 'joyfeednews-v1';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js',
  '/manifest.webmanifest', '/assets/logo.svg', '/about.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/.netlify/functions/happy-news')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else if (ASSETS.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
  }
});
