const CACHE_NAME='control-corte-redireccion-v4';
self.addEventListener('install',function(e){self.skipWaiting();e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}));});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('fetch',function(e){return;});
