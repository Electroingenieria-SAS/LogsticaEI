var CACHE_VERSION = "ei-trazabilidad-v11-drive-evidencias-todos-modulos";
var APP_SHELL = ["./","./index.html","./styles.css","./app.js","./firebase-config.js","./manifest.json","./corte-control/index.html","./assets/logo-electroingenieria.jpeg","./assets/app-icon.svg"];
function sameOrigin(request){try{return new URL(request.url).origin===self.location.origin;}catch(e){return false;}}
function isHtml(request){return request.mode==="navigate"||(request.headers.get("accept")||"").indexOf("text/html")>=0;}
function isCore(url){return /\/(index\.html|app\.js|styles\.css|firebase-config\.js|manifest\.json)$/.test(url.pathname);}
function cachePut(req,res){if(!res||res.status!==200||res.type==="opaque")return Promise.resolve(res);return caches.open(CACHE_VERSION).then(function(c){return c.put(req,res.clone()).then(function(){return res;});}).catch(function(){return res;});}
function networkFirst(req){return fetch(req,{cache:"no-store"}).then(function(res){return cachePut(req,res);}).catch(function(){return caches.match(req).then(function(c){return c||(isHtml(req)?caches.match("./index.html"):undefined);});});}
function cacheFirst(req){return caches.match(req).then(function(cached){if(cached){fetch(req).then(function(res){cachePut(req,res);}).catch(function(){});return cached;}return fetch(req).then(function(res){return cachePut(req,res);});});}
self.addEventListener("install",function(e){self.skipWaiting();e.waitUntil(caches.open(CACHE_VERSION).then(function(c){return c.addAll(APP_SHELL);}));});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){if(k!==CACHE_VERSION&&k.indexOf("ei-trazabilidad")===0)return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener("message",function(e){if(e.data&&e.data.type==="SKIP_WAITING")self.skipWaiting();if(e.data&&e.data.type==="CLEAR_CACHE")e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}));});
self.addEventListener("fetch",function(e){var req=e.request;if(req.method!=="GET"||!sameOrigin(req))return;var url=new URL(req.url);if(isHtml(req)||isCore(url)){e.respondWith(networkFirst(req));return;}e.respondWith(cacheFirst(req));});
