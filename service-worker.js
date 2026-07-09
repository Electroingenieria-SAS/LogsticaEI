var CACHE_VERSION = "ei-trazabilidad-v181-mobile-corte-real-anticache";
self.addEventListener("install",function(event){
  self.skipWaiting();
  event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}));
});
self.addEventListener("activate",function(event){
  event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));
});
self.addEventListener("message",function(event){
  if(event.data && event.data.type==="SKIP_WAITING")self.skipWaiting();
  if(event.data && event.data.type==="CLEAR_CACHE")event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}));
});
self.addEventListener("fetch",function(event){
  var request=event.request;
  if(request.method!=="GET")return;
  event.respondWith(fetch(request,{cache:"no-store"}).catch(function(){
    if(request.mode==="navigate" || ((request.headers.get("accept")||"").indexOf("text/html")>=0)){
      return fetch("./index.html?offline="+Date.now(),{cache:"no-store"}).catch(function(){return new Response("Sin conexión. Actualice cuando tenga internet.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});});
    }
    return new Response("",{status:504,statusText:"Offline"});
  }));
});
