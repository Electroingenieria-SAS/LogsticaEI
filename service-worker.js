var CACHE_VERSION = "ei-trazabilidad-v192-disabled";
self.addEventListener("install",function(event){
  self.skipWaiting();
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){return caches.delete(k);}));
  }));
});
self.addEventListener("activate",function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){return caches.delete(k);}));
    }).then(function(){
      return self.registration.unregister();
    }).then(function(){
      return self.clients.claim();
    })
  );
});
self.addEventListener("fetch",function(event){
  event.respondWith(fetch(event.request,{cache:"no-store"}));
});
