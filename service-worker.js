const CACHE_NAME = 'audiocall-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/call.html',
  '/profile.html',
  '/style.css',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // CRITICAL FIX: Only intercept local requests. 
  // Let the browser handle Firebase and external images normally.
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
      return; 
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});