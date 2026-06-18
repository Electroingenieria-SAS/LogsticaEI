var CACHE_VERSION = "ei-trazabilidad-v98-separacion-ventas-minimal-fix";
var APP_SHELL = ["./","./index.html","./styles.css","./app.js","./firebase-config.js","./manifest.json","./assets/logo-electroingenieria.jpeg","./assets/app-icon.svg","./assets/sounds/universfield-new-notification-051-494246.mp3","./assets/sounds/te-llego-un-requerimiento.mp3","./assets/sounds/te-llego-un-reporte.mp3","./assets/sounds/tu-pedido-lleva-mas.mp3","./assets/sounds/tienes-un-nuevo-pedido.mp3","./assets/sounds/han-cerrado-tu-pedido.mp3","./assets/sounds/haz-cerrado-el-caso.mp3","./assets/sounds/haz-creado-un-requerimiento.mp3","./assets/sounds/haz-creado-pedido.mp3","./assets/sounds/novedad-creada.mp3","./assets/sounds/chequeo.mp3","./assets/feedback/art-spinning-sticker.gif","./assets/feedback/hands-up-ok-gauss.gif","./assets/stamps/facturado.png","./assets/stamps/entregado.png"];
function sameOrigin(request){try{return new URL(request.url).origin===self.location.origin;}catch(e){return false;}}
function isHtml(request){return request.mode==="navigate" || ((request.headers.get("accept")||"").indexOf("text/html")>=0);}
function isCore(url){return /\/(index\.html|app\.js|styles\.css|firebase-config\.js|manifest\.json)$/.test(url.pathname);}
function safeCachePut(cache,request,response){
  if(!response || response.status!==200 || response.type==="opaque")return Promise.resolve(response);
  return cache.put(request,response.clone()).then(function(){return response;}).catch(function(){return response;});
}
function networkFirst(request){
  return caches.open(CACHE_VERSION).then(function(cache){
    return fetch(request,{cache:"no-store"}).then(function(response){return safeCachePut(cache,request,response);}).catch(function(){
      return cache.match(request).then(function(cached){
        if(cached)return cached;
        if(isHtml(request))return cache.match("./index.html").then(function(home){return home || new Response("Aplicación sin conexión",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});});
        return new Response("",{status:504,statusText:"Offline"});
      });
    });
  });
}
function cacheFirst(request){
  return caches.open(CACHE_VERSION).then(function(cache){
    return cache.match(request).then(function(cached){
      if(cached){fetch(request).then(function(response){return safeCachePut(cache,request,response);}).catch(function(){});return cached;}
      return fetch(request).then(function(response){return safeCachePut(cache,request,response);}).catch(function(){return new Response("",{status:504,statusText:"Offline"});});
    });
  });
}
self.addEventListener("install",function(event){
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_VERSION).then(function(cache){
    return Promise.all(APP_SHELL.map(function(url){return fetch(url,{cache:"reload"}).then(function(response){return safeCachePut(cache,url,response);}).catch(function(){return null;});}));
  }));
});
self.addEventListener("activate",function(event){
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(key){if(key!==CACHE_VERSION && key.indexOf("ei-trazabilidad")===0)return caches.delete(key);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener("message",function(event){
  if(event.data && event.data.type==="SKIP_WAITING")self.skipWaiting();
  if(event.data && event.data.type==="CLEAR_CACHE")event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(key){return caches.delete(key);}));}));
});
self.addEventListener("fetch",function(event){
  var request=event.request;
  if(request.method!=="GET" || !sameOrigin(request))return;
  var url=new URL(request.url);
  if(isHtml(request) || isCore(url)){event.respondWith(networkFirst(request));return;}
  event.respondWith(cacheFirst(request));
});
