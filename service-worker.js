const CACHE_NAME = 'audiocall-cache-v2';
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
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});