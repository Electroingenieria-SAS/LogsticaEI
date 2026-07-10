// V220 service worker: limpieza total y red sin caché
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) { return caches.delete(key); }));
    }).then(function() { return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request, {cache: 'no-store'}));
});
