(function(){
'use strict';
var VERSION='V209';
var FLOW=['compras','recepcion_pedidos','alistamiento','corte_cable','facturacion','caja','cliente_punto','cliente_recoge','despacho_local','despacho_nacional','cierre_despacho_nacional'];
var PROCESS={compras:'Compras / liberación PVE',recepcion_pedidos:'Recepción de pedidos',alistamiento:'Alistamiento',corte_cable:'Corte de cable',facturacion:'Facturación',caja:'Caja/Cartera',cliente_punto:'Entrega cliente en punto',cliente_recoge:'Cliente recoge',despacho_local:'Despacho local',despacho_nacional:'Despacho nacional',cierre_despacho_nacional:'Cierre despacho nacional'};
var ROLE={compras:'Compras',compra:'Compras',area_compras:'Compras',ventas:'Ventas',asesor:'Ventas',asesor_ventas:'Ventas',vendedor:'Ventas',aux_logistica:'Auxiliar logística',auxiliar_corte:'Auxiliar corte',coordinador_logistico:'Logística/despacho',lider_logistico:'Logística/despacho',jefe_logistica:'Jefe logística',gerencia:'Gerencia',caja:'Caja',cartera:'Cartera',admin:'Admin',super_admin:'Super Admin'};
var app={db:null,auth:null,user:null,cases:[],events:[],reports:[],eventsByCase:{},metrics:null,loadedAll:false,loading:false,fromCache:false};
var $=function(id){return document.getElementById(id);};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms||0);});}
function status(msg,kind){var el=$('status');if(!el)return;el.className='notice '+(kind||'ok');el.innerHTML=msg;}
function loading(on,msg){app.loading=!!on;var l=$('loading');if(l)l.className='loading'+(on?' show':'');var p=$('progress');if(p)p.textContent=msg||'';}
function clean(v){return String(v==null?'':v).trim();}
function lower(v){return clean(v).toLowerCase();}
function normKey(v){return lower(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
function script(url,timeout){return new Promise(function(resolve,reject){var s=document.createElement('script'),done=false,t=setTimeout(function(){if(done)return;done=true;try{s.remove();}catch(e){}reject(new Error('Timeout cargando '+url));},timeout||16000);s.src=url;s.async=false;s.defer=false;s.crossOrigin='anonymous';s.referrerPolicy='no-referrer';s.onload=function(){if(done)return;done=true;clearTimeout(t);resolve(url);};s.onerror=function(){if(done)return;done=true;clearTimeout(t);reject(new Error('No cargó '+url));};document.head.appendChild(s);});}
function inheritFirebaseFromOpener(){try{var w=window.opener;if(w&&!w.closed&&w.firebase&&w.firebase.auth&&w.firebase.firestore){window.firebase=w.firebase;if(!window.firebaseConfig&&w.firebaseConfig)window.firebaseConfig=w.firebaseConfig;app.sdkSource='app_principal';return true;}}catch(e){}return false;}
async function loadOne(list,check,label){if(check&&check())return true;var errors=[];for(var i=0;i<list.length;i++){try{status('Cargando '+(label||'librería')+' · fuente '+(i+1)+'/'+list.length,'ok');await script(list[i],17000);if(!check||check()){app.sdkSource=list[i];return true;}errors.push('La ruta cargó pero no dejó disponible '+(label||'librería')+': '+list[i]);}catch(e){errors.push(e.message||String(e));await sleep(150);}}throw new Error((label||'Librería')+' no cargó. Fuentes probadas: '+list.join(' | ')+'. Último error: '+(errors[errors.length-1]||'sin detalle'));}
async function loadFirebaseConfig(){if(window.firebaseConfig)return true;var urls=['./firebase-config.js?v='+Date.now(),'./public/firebase-config.js?v='+Date.now()];var last;for(var i=0;i<urls.length;i++){try{await script(urls[i],9000);if(window.firebaseConfig)return true;}catch(e){last=e;}}throw new Error('firebase-config.js no creó window.firebaseConfig. '+(last?last.message:''));}
async function initFirebase(){
  status('Cargando Firebase del tablero VSM '+VERSION+'...','ok');
  var v='10.12.5';
  inheritFirebaseFromOpener();
  if(!(window.firebase&&window.firebase.initializeApp&&window.firebase.auth&&window.firebase.firestore)){
    await loadOne(['https://www.gstatic.com/firebasejs/'+v+'/firebase-app-compat.js','https://unpkg.com/firebase@'+v+'/firebase-app-compat.js','https://cdn.jsdelivr.net/npm/firebase@'+v+'/compat/firebase-app.js'],function(){return !!(window.firebase&&window.firebase.initializeApp);},'Firebase App');
    await loadOne(['https://www.gstatic.com/firebasejs/'+v+'/firebase-auth-compat.js','https://unpkg.com/firebase@'+v+'/firebase-auth-compat.js','https://cdn.jsdelivr.net/npm/firebase@'+v+'/compat/firebase-auth.js'],function(){return !!(window.firebase&&window.firebase.auth);},'Firebase Auth');
    await loadOne(['https://www.gstatic.com/firebasejs/'+v+'/firebase-firestore-compat.js','https://unpkg.com/firebase@'+v+'/firebase-firestore-compat.js','https://cdn.jsdelivr.net/npm/firebase@'+v+'/compat/firebase-firestore.js'],function(){return !!(window.firebase&&window.firebase.firestore);},'Firebase Firestore');
  }
  await loadFirebaseConfig();
  var fb=window.firebase;if(!fb||!fb.initializeApp||!fb.auth||!fb.firestore)throw new Error('Firebase no quedó disponible después de cargar el SDK. Revise red, DNS o bloqueo del navegador.');
  if(!fb.apps.length)fb.initializeApp(window.firebaseConfig);
  app.auth=fb.auth();app.db=fb.firestore();
  if(app.sdkSource!=='app_principal'){try{app.db.settings({ignoreUndefinedProperties:true,merge:true});}catch(e){try{app.db.settings({ignoreUndefinedProperties:true});}catch(_e){}}}
  app.user=await new Promise(function(resolve){var done=false;var unsub=app.auth.onAuthStateChanged(function(u){if(done)return;done=true;try{unsub&&unsub();}catch(e){}resolve(u||null);});setTimeout(function(){if(done)return;done=true;resolve(app.auth.currentUser||null);},5000);});
  if(!app.user)status('No hay sesión activa. Abre primero la app principal e inicia sesión; luego vuelve a este tablero.','bad');
  else{var vsmUserName=app.user.displayName||'Usuario autenticado';status('Firebase conectado desde '+esc(app.sdkSource||'SDK')+'. Usuario: '+esc(vsmUserName)+'. Tablero aislado de la operación.','ok');}
}
function toDate(v){
  if(v===null||v===undefined||v==='')return null;
  try{
    if(v instanceof Date)return isNaN(v.getTime())?null:v;
    if(v.toDate){var td=v.toDate();return td&&!isNaN(td.getTime())?td:null;}
    if(typeof v==='object'&&(v.seconds||v._seconds)){var sec=Number(v.seconds||v._seconds),ns=Number(v.nanoseconds||v._nanoseconds||0);var ds=new Date(sec*1000+Math.floor(ns/1e6));return isNaN(ds.getTime())?null:ds;}
    if(typeof v==='number'){if(!isFinite(v)||v<=0)return null;var dn=new Date(v<10000000000?v*1000:v);return isNaN(dn.getTime())?null:dn;}
    if(typeof v==='string'){
      var s=v.trim();if(!s)return null;
      s=s.replace(/\u00a0/g,' ').replace(/a\.\s*m\.|a\.m\.|am/ig,'AM').replace(/p\.\s*m\.|p\.m\.|pm/ig,'PM').replace(/,/g,' ');
      var d=new Date(s);if(!isNaN(d.getTime()))return d;
      var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
      if(m){var yy=Number(m[3]);if(yy<100)yy+=2000;var hh=Number(m[4]||0),mi=Number(m[5]||0),ss=Number(m[6]||0),ap=(m[7]||'').toUpperCase();if(ap==='PM'&&hh<12)hh+=12;if(ap==='AM'&&hh===12)hh=0;d=new Date(yy,Number(m[2])-1,Number(m[1]),hh,mi,ss);return isNaN(d.getTime())?null:d;}
      m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
      if(m){var hh2=Number(m[4]||0),ap2=(m[7]||'').toUpperCase();if(ap2==='PM'&&hh2<12)hh2+=12;if(ap2==='AM'&&hh2===12)hh2=0;d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),hh2,Number(m[5]||0),Number(m[6]||0));return isNaN(d.getTime())?null:d;}
    }
  }catch(e){}
  return null;
}
function tms(v){var d=toDate(v);return d?d.getTime():NaN;}
function nowMs(){return Date.now();}
function num(v){if(v===null||v===undefined||v==='')return 0;if(typeof v==='string'){var s=v.trim();if(/^\d{1,4}:\d{2}:\d{2}$/.test(s)){var p=s.split(':').map(Number);return ((p[0]*3600)+(p[1]*60)+p[2])*1000;}if(/h|hora|min|seg/i.test(s)){var total=0,m;while((m=/(\d+(?:[\.,]\d+)?)\s*(h|hora|horas|min|seg|s)/ig.exec(s))){var n=Number(String(m[1]).replace(',','.'));if(/h|hora/i.test(m[2]))total+=n*3600000;else if(/min/i.test(m[2]))total+=n*60000;else total+=n*1000;}return total;}v=Number(s.replace(/\./g,'').replace(',','.'));}else v=Number(v);return isFinite(v)&&v>0?v:0;}
function durMs(a,b){var x=tms(a),y=tms(b);if(!isFinite(x)||!isFinite(y)||y<x)return 0;return y-x;}
function fmt(msv){msv=Math.max(0,num(msv));var s=Math.floor(msv/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');}
function hours(msv){var h=Math.max(0,num(msv))/3600000;return h.toFixed(h<10?2:1);}
function timeUnit(msv){
  var ms=Math.max(0,num(msv)),min=ms/60000,h=ms/3600000;
  if(h>=1)return h.toFixed(h<10?2:1)+' h hábiles';
  if(min>=1)return Math.round(min)+' min hábiles';
  return '0 min';
}
function pct(part,total){
  part=Number(part)||0;total=Number(total)||0;
  if(!isFinite(part)||!isFinite(total)||total<=0)return 0;
  return Math.max(0,Math.min(100,Math.round((part/total)*100)));
}
function productivityState(m){
  m=m||{};
  var total=Math.max(1,num(m.leadTotal||m.va||0)+num(m.wait||0)+num(m.dead||0));
  var ratio=pct(m.va||0,total),non=Math.max(0,100-ratio),cls='warning',label='Ocupación por mejorar',text='El VSM muestra más espera o NVA que ocupación efectiva.';
  if(ratio>=70){cls='success';label='Ocupación saludable';text='La mayor parte del tiempo hábil está concentrada en trabajo efectivo.';}
  else if(ratio>=45){cls='info';label='Ocupación media';text='Hay equilibrio parcial entre ocupación, espera y NVA.';}
  return {ratio:ratio,non:non,cls:cls,label:label,text:text};
}
function workDate(v){try{if(!v)return null;if(v instanceof Date)return isNaN(v.getTime())?null:v;if(v.toDate&&typeof v.toDate==="function"){var d1=v.toDate();return d1&&isNaN(d1.getTime())?null:d1;}if(typeof v==="object"&&(v.seconds||v._seconds))return new Date(Number(v.seconds||v._seconds)*1000);var d=new Date(v);return isNaN(d.getTime())?null:d;}catch(e){return null;}}
var EI_NON_WORKING_DATES_2026={"2026-01-01":1,"2026-01-03":1,"2026-01-04":1,"2026-01-10":1,"2026-01-11":1,"2026-01-12":1,"2026-01-17":1,"2026-01-18":1,"2026-01-24":1,"2026-01-25":1,"2026-01-31":1,"2026-02-01":1,"2026-02-07":1,"2026-02-08":1,"2026-02-14":1,"2026-02-15":1,"2026-02-21":1,"2026-02-22":1,"2026-02-28":1,"2026-03-01":1,"2026-03-07":1,"2026-03-08":1,"2026-03-14":1,"2026-03-15":1,"2026-03-21":1,"2026-03-22":1,"2026-03-23":1,"2026-03-28":1,"2026-03-29":1,"2026-04-02":1,"2026-04-03":1,"2026-04-04":1,"2026-04-05":1,"2026-04-11":1,"2026-04-12":1,"2026-04-18":1,"2026-04-19":1,"2026-04-25":1,"2026-04-26":1,"2026-05-01":1,"2026-05-02":1,"2026-05-03":1,"2026-05-09":1,"2026-05-10":1,"2026-05-16":1,"2026-05-17":1,"2026-05-18":1,"2026-05-23":1,"2026-05-24":1,"2026-05-30":1,"2026-05-31":1,"2026-06-06":1,"2026-06-07":1,"2026-06-08":1,"2026-06-13":1,"2026-06-14":1,"2026-06-15":1,"2026-06-20":1,"2026-06-21":1,"2026-06-27":1,"2026-06-28":1,"2026-06-29":1,"2026-07-04":1,"2026-07-05":1,"2026-07-11":1,"2026-07-12":1,"2026-07-13":1,"2026-07-18":1,"2026-07-19":1,"2026-07-20":1,"2026-07-25":1,"2026-07-26":1,"2026-08-01":1,"2026-08-02":1,"2026-08-07":1,"2026-08-08":1,"2026-08-09":1,"2026-08-15":1,"2026-08-16":1,"2026-08-17":1,"2026-08-22":1,"2026-08-23":1,"2026-08-29":1,"2026-08-30":1,"2026-09-05":1,"2026-09-06":1,"2026-09-12":1,"2026-09-13":1,"2026-09-19":1,"2026-09-20":1,"2026-09-26":1,"2026-09-27":1,"2026-10-03":1,"2026-10-04":1,"2026-10-10":1,"2026-10-11":1,"2026-10-12":1,"2026-10-17":1,"2026-10-18":1,"2026-10-24":1,"2026-10-25":1,"2026-10-31":1,"2026-11-01":1,"2026-11-02":1,"2026-11-07":1,"2026-11-08":1,"2026-11-14":1,"2026-11-15":1,"2026-11-16":1,"2026-11-21":1,"2026-11-22":1,"2026-11-28":1,"2026-11-29":1,"2026-12-05":1,"2026-12-06":1,"2026-12-08":1,"2026-12-12":1,"2026-12-13":1,"2026-12-19":1,"2026-12-20":1,"2026-12-25":1,"2026-12-26":1,"2026-12-27":1};
function isoLocalDay(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function isWorkingCalendarDay(d){
  if(!d||isNaN(d.getTime()))return false;
  var key=isoLocalDay(d);
  if(EI_NON_WORKING_DATES_2026[key])return false;
  var dow=d.getDay();
  if(dow===0||dow===6)return false;
  return true;
}
function workingMsBetween(start,end){
  var a=workDate(start),b=workDate(end);
  if(!a)return 0;
  if(!b)b=new Date();
  if(b<a)return 0;
  var total=0,day=new Date(a);
  day.setHours(0,0,0,0);
  var guard=0;
  while(day<=b&&guard<3700){
    if(isWorkingCalendarDay(day)){
      var y=day.getFullYear(),m=day.getMonth(),d=day.getDate();
      [[new Date(y,m,d,7,0,0,0),new Date(y,m,d,12,0,0,0)],[new Date(y,m,d,13,40,0,0),new Date(y,m,d,17,30,0,0)]].forEach(function(w){
        var s=Math.max(a.getTime(),w[0].getTime()),e=Math.min(b.getTime(),w[1].getTime());
        if(e>s)total+=e-s;
      });
    }
    day.setDate(day.getDate()+1);
    guard++;
  }
  return Math.max(0,total);
}
function workingMsSince(v){return workingMsBetween(v,new Date());}

function timeSplitHtml(va,wait,dead){
  var total=Math.max(1,num(va)+num(wait)+num(dead));
  return '<div class="time-tags"><span class="time-tag va"><b>Ocupación</b>'+timeUnit(va)+' · '+pct(va,total)+'%</span><span class="time-tag wait"><b>Espera/bloqueo</b>'+timeUnit(wait)+' · '+pct(wait,total)+'%</span><span class="time-tag dead"><b>NVA</b>'+timeUnit(dead)+' · '+pct(dead,total)+'%</span></div>';
}
function productivityHtml(m){
  var s=productivityState(m);
  return '<article class="card lt-analysis '+s.cls+'"><div><h2>'+esc(s.label)+'</h2><p>'+esc(s.text)+'</p></div><div class="lt-grid"><div><span>Ocupación / VA</span><strong>'+s.ratio+'%</strong></div><div><span>Espera + NVA</span><strong>'+s.non+'%</strong></div><div><span>LT hábil</span><strong>'+timeUnit(m.leadDayAvg)+'/día</strong></div><div><span>Unidad</span><strong>h / min</strong></div></div>'+timeSplitHtml(m.va,m.wait,m.dead)+'</article>';
}
function dateTxt(v){var d=toDate(v);return d?d.toLocaleString('es-CO'):'';}
function isoDay(v){var d=toDate(v);return d?d.toISOString().slice(0,10):'';}
function processTitle(p){return PROCESS[p]||p||'Sin proceso';}
function roleTitle(r){var k=normKey(r);return ROLE[k]||r||'';}
function purchase(c){return c.purchaseOrder||c.ordenCompra||c.oc||c.orderNumber||'';}
function advisor(c){return c.salesAdvisor||c.createdByName||c.advisorName||c.vendedor||'';}
function isPveCase(c){var txt=lower([c.orderKind,c.tipoPedido,c.type,c.reference,c.caseNumber,c.pedido,purchase(c),c.pveNumber,c.purchaseOrder,c.orderNumber,c.currentProcess,c.purchaseStatus].join(' '));return c.isPve===true||c.pve===true||/^pve[\-_\s]?/i.test(clean(c.reference||c.caseNumber||c.pedido||''))||/^pve[\-_\s]?/i.test(clean(purchase(c)))||/pve/.test(txt);}
function vsmTypeLabel(){var v=($('fOrderType')&&$('fOrderType').value)||'normal';if(v==='pve')return 'VSM PVE';if(v==='normal')return 'VSM normal';return 'VSM general';}
function calendarDaysBetween(start,end){var a=new Date(start),b=new Date(end);if(isNaN(a.getTime())||isNaN(b.getTime())||b<a)return 1;a.setHours(0,0,0,0);b.setHours(0,0,0,0);return Math.max(1,Math.round((b-a)/86400000)+1);}
function perDay(ms,daysCount){return Math.max(0,num(ms))/Math.max(1,Number(daysCount)||1);} 
function metricGroup(rows){rows=rows||[];var n=rows.length,lead=0,va=0,wait=0,dead=0,raw=0;rows.forEach(function(r){lead+=r.leadPerDay||0;va+=r.vaPerDay||0;wait+=r.waitPerDay||0;dead+=r.deadPerDay||0;raw+=r.lead||0;});return {count:n,leadDayAvg:n?lead/n:0,vaDayAvg:n?va/n:0,waitDayAvg:n?wait/n:0,deadDayAvg:n?dead/n:0,rawLeadAvg:n?raw/n:0};}
function isCancelledVsm(c){return !!(c&&(c.cancelledAt||c.excludeFromVsm===true||/cancelad|anulad/i.test(String(c.status||'')+' '+String(c.cancelStatusLabel||'')+' '+String(c.cancellationTypeLabel||''))));}
function cancelTypeOf(c){var raw=String((c&& (c.cancellationTypeLabel||c.cancelStatusLabel||c.cancellationType||c.cancelStatus||c.status))||'').toLowerCase();return /anulad/.test(raw)?'Pedido anulado':'Pedido cancelado';}
function cancellationDateMs(c){return tms(c&& (c.cancelledAt||c.cancellationAt||c.closedAt||c.updatedAt||c.createdAt));}
function cancellationProcessKey(c){var p=(c&&(c.cancelledProcess||c.cancellationProcess||c.cancelProcess||c.cancelledAtProcess||c.currentProcess))||'';return PROCESS[p]?p:(c&&c.currentProcess&&PROCESS[c.currentProcess]?c.currentProcess:'');}
function cancellationUser(c){return (c&&(c.cancelledByName||c.cancellationByName||c.closedByName||c.updatedByName||''))||'';}
function cancellationEvidenceUrl(c){var e=(c&&c.cancellationEvidence)||{};return e.url||e.driveUrl||e.webViewLink||c.cancellationSupportUrl||c.cancelSupportUrl||'';}
function cancellationRow(c){var p=cancellationProcessKey(c);return {c:c,pedido:refOf(c),oc:purchase(c),cliente:c.client||'',asesor:advisor(c),tipo:cancelTypeOf(c),proceso:p,procesoTxt:p?processTitle(p):'Sin proceso trazado',fecha:cancellationDateMs(c),usuario:cancellationUser(c),motivo:c.cancellationReason||c.cancellationDetail||c.cancelReason||c.cancelDetail||'',soporte:cancellationEvidenceUrl(c),estado:c.status||c.cancelStatusLabel||c.cancellationTypeLabel||''};}
function countBy(rows,fn){var map={};(rows||[]).forEach(function(r){var k=fn(r)||'Sin dato';map[k]=(map[k]||0)+1;});return Object.keys(map).map(function(k){return {label:k,count:map[k]};}).sort(function(a,b){return b.count-a.count||a.label.localeCompare(b.label);});}
function isClosed(c){return !!(c.closedAt||c.completedAt||c.finishedAt||c.deliveredAt||/cerrad|finaliz|entregad|cancelad|anulad/i.test(String(c.status||'')));}
function pushDate(out,v){var n=tms(v);if(isFinite(n)&&n>946684800000&&n<4102444800000)out.push(n);}
function minMs(arr){arr=(arr||[]).filter(isFinite).sort(function(a,b){return a-b;});return arr.length?arr[0]:NaN;}
function maxMs(arr){arr=(arr||[]).filter(isFinite).sort(function(a,b){return b-a;});return arr.length?arr[0]:NaN;}
function idOf(c){return String(c.id||c.caseId||'');}
function refOf(c){return String(c.reference||c.caseNumber||c.pedido||c.id||'');}
function buildEventBuckets(){app.eventsByCase={};(app.events||[]).forEach(function(e){var keys=[e.caseId,e.caseReference,e.reference,e.sourceId,e.caseNumber].map(function(x){return String(x||'');}).filter(Boolean);keys.forEach(function(k){app.eventsByCase[k]=app.eventsByCase[k]||[];app.eventsByCase[k].push(e);});});}
function caseEvents(c){var a=(app.eventsByCase[idOf(c)]||[]),b=(app.eventsByCase[refOf(c)]||[]);var seen={},out=[];a.concat(b).forEach(function(e){var k=e.id||[e.timestamp,e.createdAt,e.type,e.detail].join('|');if(!seen[k]){seen[k]=1;out.push(e);}});return out;}
function eventProcess(e,c){var p=e.process||e.currentProcess||e.sourceProcess||e.returnProcess||e.targetProcess||'';if(PROCESS[p])return p;var txt=lower([e.processName,e.detail,e.type,e.reason,e.status].join(' '));for(var i=0;i<FLOW.length;i++){if(txt.indexOf(lower(PROCESS[FLOW[i]]))>=0||txt.indexOf(FLOW[i])>=0)return FLOW[i];}return c.currentProcess||'';}
function eventKind(e){var txt=lower([e.type,e.traceType,e.status,e.detail,e.reason].join(' '));if(/espera|requer|bloque|pendiente|pago|retenid|devolucion|no_entrega/.test(txt))return 'wait';if(/asignad|entrada|cola|dead|recibido|enviado/.test(txt))return 'dead';if(/inicio|trabajo|valor|proceso|acept|conforme|registr|finaliz|cierre|liber/.test(txt))return 'active';return 'dead';}
function collectDatesDeep(c){var out=[],count=0;function add(v){pushDate(out,v);}function scan(o,depth){if(!o||depth>5||count>1800)return;if(Array.isArray(o)){for(var i=0;i<Math.min(o.length,220);i++)scan(o[i],depth+1);return;}if(typeof o!=='object')return;Object.keys(o).forEach(function(k){if(count>1800)return;count++;var v=o[k];if(/(At|Date|fecha|timestamp|time|hora|started|finished|closed|completed|updated|created|released|confirmed|inicio|fin|cierre)/i.test(k))add(v);if(v&&typeof v==='object'&&!(v.toDate||v.seconds||v._seconds))scan(v,depth+1);});}scan(c,0);caseEvents(c).forEach(function(e){scan(e,0);});return out;}
function caseStartMs(c){var vals=[];[c.createdAt,c.created_at,c.requestedAt,c.timestamp,c.caseCreatedAt,c.orderCreatedAt,(c.documentFlow||{}).salesRegisteredAt,(c.documentFlow||{}).createdAt].forEach(function(v){pushDate(vals,v);});var m=minMs(vals);var u=tms(c.updatedAt);if(!isFinite(m)&&isFinite(u))m=u;return isFinite(m)?m:NaN;}
function caseEndMs(c,start){var vals=[];if(isClosed(c)){[c.closedAt,c.completedAt,c.finishedAt,c.deliveredAt,c.closureAt,c.updatedAt].forEach(function(v){pushDate(vals,v);});var m=maxMs(vals);if(isFinite(m)&&m>=start)return m;}
  var u=tms(c.updatedAt||c.lastUpdatedAt||c.modifiedAt);if(isFinite(u)&&u>=start)return u;return start;}
function allTraceEvents(c){var out=[];function pick(o,keys){for(var i=0;i<keys.length;i++){var v=o&&o[keys[i]];if(clean(v))return v;}return '';}function add(x){var ms=tms(x.at);if(!isFinite(ms))return;x.ms=ms;out.push(x);}
  (c.stateHistory||[]).forEach(function(h){add({at:h.timestamp||h.createdAt||h.updatedAt||h.at||h.fecha_hora_inicio_estado,process:h.process||h.currentProcess||c.currentProcess,kind:eventKind(h),user:pick(h,['responsibleName','responsableName','userName','byName','createdByName','actorName','name','email']),role:pick(h,['responsibleRole','responsableRole','userRole','createdByRole','role']),uid:pick(h,['responsibleUid','responsableUid','userUid','uid','createdByUid','byUid']),email:pick(h,['responsibleEmail','responsableEmail','userEmail','email','createdByEmail']),detail:h.detail||h.reason||h.type||'',raw:h});});
  (c.flowTrace||[]).forEach(function(h){add({at:h.timestamp||h.createdAt||h.updatedAt||h.at||h.fecha_hora_inicio_estado,process:h.process||h.currentProcess||c.currentProcess,kind:eventKind(h),user:pick(h,['responsibleName','responsableName','userName','byName','createdByName','actorName','name','email']),role:pick(h,['responsibleRole','responsableRole','userRole','createdByRole','role']),uid:pick(h,['responsibleUid','responsableUid','userUid','uid','createdByUid','byUid']),email:pick(h,['responsibleEmail','responsableEmail','userEmail','email','createdByEmail']),detail:h.detail||h.reason||h.type||'',raw:h});});
  caseEvents(c).forEach(function(e){add({at:e.timestamp||e.createdAt||e.updatedAt||e.at,process:eventProcess(e,c),kind:eventKind(e),user:pick(e,['userName','responsibleName','responsableName','createdByName','byName','actorName','displayName','name','email']),role:pick(e,['createdByRole','sourceRole','responsibleRole','responsableRole','userRole','role']),uid:pick(e,['uid','userUid','createdByUid','responsibleUid','responsableUid','byUid']),email:pick(e,['email','userEmail','createdByEmail','responsibleEmail','responsableEmail']),detail:e.detail||e.reason||e.type||'',raw:e});});
  return out.sort(function(a,b){return a.ms-b.ms;});
}
function reqStart(r){return r.createdAt||r.sentAt||r.openedAt||r.timestamp||r.at;}
function reqEnd(r,end){return r.answeredAt||r.resolvedAt||r.closedAt||r.completedAt||r.updatedAt||end;}
function reqProcess(r,c){return r.source||r.sourceProcess||r.process||r.returnProcess||r.targetProcess||c.currentProcess||'';}
function reqRows(c,endMs){var rows=[];function addRow(proc,s,e,tipo,user,detalle){if(!isFinite(s))return;if(!isFinite(e)||e<s)e=endMs;rows.push({pedido:refOf(c),proceso:processTitle(proc),process:proc,desde:s,hasta:e,dur:Math.max(0,e-s),tipo:tipo,usuario:user||'',detalle:detalle||''});}
  (c.requirements||[]).forEach(function(r){addRow(reqProcess(r,c),tms(reqStart(r)),tms(reqEnd(r,endMs)),'Requerimiento',r.sentByName||r.answeredByName||r.createdByName||'',(r.reason||'')+(r.detail?' · '+r.detail:'')+(r.answer?' · Rta: '+r.answer:''));});
  if(c.openRequirement){var r=c.openRequirement;addRow(reqProcess(r,c),tms(reqStart(r)||c.waitStartedAt),endMs,'Requerimiento abierto',r.sentByName||'',r.detail||r.reason||'');}
  if(c.waitStartedAt)addRow(c.currentProcess,tms(c.waitStartedAt),endMs,'Espera abierta',c.assignedName||'',c.waitReason||c.waitDetail||c.status||'');
  if(c.salesHold&&(c.salesHold.startedAt||c.salesHold.createdAt)){var sh=c.salesHold;addRow('caja',tms(sh.startedAt||sh.createdAt),tms(sh.releasedAt||sh.closedAt)||endMs,'Espera pago/separación',sh.releasedByName||sh.createdByName||'',sh.detail||sh.status||sh.reason||'');}
  if(c.separationRequest&&(c.separationRequest.waitingPaymentStartedAt||c.separationRequest.createdAt)){var sr=c.separationRequest;addRow('caja',tms(sr.waitingPaymentStartedAt||sr.createdAt),tms(sr.paymentConfirmedAt||sr.releasedAt)||endMs,'Espera pago/separación',sr.paymentConfirmedByName||sr.createdByName||'',sr.paymentConfirmationDetail||sr.detail||'');}
  return rows;
}
function processStatsList(c){var out={},ps=c.processStats||{};Object.keys(ps).forEach(function(p){if(PROCESS[p])out[p]=1;});if(c.currentProcess&&PROCESS[c.currentProcess])out[c.currentProcess]=1;allTraceEvents(c).forEach(function(e){if(PROCESS[e.process])out[e.process]=1;});(c.requirements||[]).forEach(function(r){var p=reqProcess(r,c);if(PROCESS[p])out[p]=1;});if((c.cutRequests||[]).length)out.corte_cable=1;if(!Object.keys(out).length)out[c.currentProcess&&PROCESS[c.currentProcess]?c.currentProcess:'recepcion_pedidos']=1;return Object.keys(out);}
function processMetric(c,p,startMs,endMs){var st=(c.processStats||{})[p]||{};var active=num(st.activeMs||st.valueMs||st.workMs),wait=num(st.waitMs||st.holdMs),dead=num(st.deadMs||st.nvaMs||st.queueMs);var explicit=active+wait+dead;
  var pEvents=allTraceEvents(c).filter(function(e){return e.process===p;});var dates=[];[st.startedAt,st.enteredAt,st.createdAt,st.activeStartedAt,st.waitStartedAt,st.deadStartedAt].forEach(function(v){pushDate(dates,v);});pEvents.forEach(function(e){dates.push(e.ms);});if(c.currentProcess===p)[c.activeStartedAt,c.waitStartedAt,c.deadStartedAt,c.updatedAt].forEach(function(v){pushDate(dates,v);});
  var ps=minMs(dates), pe=maxMs([st.completedAt,st.finishedAt,st.closedAt,st.updatedAt]);if(!isFinite(pe)&&pEvents.length)pe=maxMs(pEvents.map(function(e){return e.ms;}));if(c.currentProcess===p&&!isClosed(c))pe=endMs;
  var timeline=0,tlActive=0,tlWait=0,tlDead=0;if(pEvents.length){for(var i=0;i<pEvents.length;i++){var a=pEvents[i].ms,b=(i<pEvents.length-1?pEvents[i+1].ms:pe);if(!isFinite(b)||b<a)b=a;var d=workingMsBetween(a,b);if(d>0&&d<1000*60*60*24*45){timeline+=d;if(pEvents[i].kind==='wait')tlWait+=d;else if(pEvents[i].kind==='active')tlActive+=d;else tlDead+=d;}}}
  if(!active&&tlActive)active=tlActive;if(!wait&&tlWait)wait=tlWait;if(!dead&&tlDead)dead=tlDead;
  if(c.currentProcess===p){if(c.activeStartedAt)active+=workingMsSince(c.activeStartedAt);if(c.waitStartedAt)wait+=workingMsSince(c.waitStartedAt);if(c.deadStartedAt)dead+=workingMsSince(c.deadStartedAt);}
  var req=0;reqRows(c,endMs).forEach(function(r){if(r.process===p||r.proceso===processTitle(p))req+=r.dur;});if(req>wait)wait=req;
  var elapsed=(isFinite(ps)&&isFinite(pe)&&pe>=ps)?workingMsBetween(ps,pe):0;if(!elapsed)elapsed=Math.max(timeline,active+wait+dead);
  if(!elapsed&&c.currentProcess===p)elapsed=workingMsBetween(startMs,endMs);
  if(!elapsed&&p==='corte_cable'&&(c.cutRequests||[]).length){(c.cutRequests||[]).forEach(function(x){var d=num(x.durationMs)||workingMsBetween(x.startedAt||x.takenAt,x.finishedAt||x.completedAt||x.registeredAt);elapsed+=d;active+=d;});}
  if(elapsed>0 && active+wait+dead>elapsed){var scalePm=elapsed/(active+wait+dead);active=active*scalePm;wait=wait*scalePm;dead=Math.max(0,elapsed-active-wait);}
  if(elapsed>0 && active+wait+dead<elapsed)dead+=elapsed-active-wait-dead;
  if(!elapsed)return null;return {process:p,label:processTitle(p),active:active,wait:wait,dead:dead,total:elapsed,req:req,start:isFinite(ps)?ps:null,finish:isFinite(pe)?pe:null,wip:c.currentProcess===p&&!isClosed(c)};
}
function emailFromText(v){var m=String(v||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);return m?m[0].toLowerCase():'';}
function titleName(v){return clean(v).toLowerCase().replace(/\b([a-záéíóúñü])/g,function(a){return a.toUpperCase();});}
function stripUserNoise(v){return clean(v).replace(/<[^>]+>/g,' ').replace(/[()\[\]{}]/g,' ').replace(/\s+/g,' ').trim();}
function personCanonical(raw,role){raw=raw||{};var uid=clean(raw.uid||raw.userUid||raw.id||'');var email=emailFromText(raw.email||raw.userEmail||raw.name||raw.user||'');var name=stripUserNoise(raw.name||raw.user||raw.userName||raw.displayName||raw.email||'');if(email&&name.toLowerCase().indexOf(email)>=0)name=name.replace(email,'').trim();name=name.replace(/\b(usuario|user|sin responsable|sin asignar|pendiente|n\/a|na)\b/ig,' ').replace(/\s+/g,' ').trim();if(!name&&email)name=email.split('@')[0].replace(/[._-]+/g,' ');if(!name&&!email&&!uid)return null;var key=uid?('uid:'+uid):(email?('mail:'+email):('name:'+normKey(name)));return {key:key,name:titleName(name||email||uid),email:email,uid:uid,role:role||raw.role||'',synthetic:false,source:raw.source||'traza'};}
function syntheticPerson(){return {key:'synthetic:sin_responsable_trazado',name:'Sin responsable trazado',email:'',uid:'',role:'No trazado',synthetic:true,source:'sin_traza'};}
function addPerson(map,raw,role){var p=personCanonical(raw,role);if(!p)return;var old=map[p.key];if(!old){map[p.key]=p;return;}if((p.name||'').length>(old.name||'').length)old.name=p.name;if(!old.email&&p.email)old.email=p.email;if(!old.uid&&p.uid)old.uid=p.uid;if(!old.role&&p.role)old.role=p.role;}
function consolidateSimilarUsers(rows){
  function rowName(r){return clean(r.user||r.name||'');}
  function rowNameKey(r){return normKey(rowName(r));}
  function firstToken(k){return (k||'').split('_').filter(Boolean)[0]||'';}
  function samePerson(a,b){
    if(a.synthetic||b.synthetic)return !!(a.synthetic&&b.synthetic);
    if(a.email&&b.email&&lower(a.email)===lower(b.email))return true;
    if(a.uid&&b.uid&&String(a.uid)===String(b.uid))return true;
    var ak=rowNameKey(a),bk=rowNameKey(b);if(!ak||!bk)return false;
    if(ak===bk)return true;
    var at=ak.split('_').filter(Boolean),bt=bk.split('_').filter(Boolean);
    if(firstToken(ak)&&firstToken(ak)===firstToken(bk)){
      if(at.length===1||bt.length===1)return true;
      var common=at.filter(function(x){return bt.indexOf(x)>=0;}).length;
      if(common>=Math.min(at.length,bt.length)&&Math.min(at.length,bt.length)>=2)return true;
    }
    return false;
  }
  function merge(a,b){
    if(String(b.user||'').length>String(a.user||'').length)a.user=b.user;
    if(!a.email&&b.email)a.email=b.email;if(!a.uid&&b.uid)a.uid=b.uid;if(!a.role&&b.role)a.role=b.role;
    a.open+=b.open||0;a.closed+=b.closed||0;a.active+=b.active||0;a.wait+=b.wait||0;a.dead+=b.dead||0;a.total+=b.total||0;a.req+=b.req||0;a.cuts+=b.cuts||0;
    a.cases=a.cases||{};Object.keys(b.cases||{}).forEach(function(k){a.cases[k]=1;});
    a.processes=a.processes||{};Object.keys(b.processes||{}).forEach(function(k){a.processes[k]=(a.processes[k]||0)+(b.processes[k]||0);});
    a.sources=a.sources||{};Object.keys(b.sources||{}).forEach(function(k){a.sources[k]=1;});
    a.aliases=a.aliases||{};if(rowName(b))a.aliases[rowName(b)]=1;if(b.email)a.aliases[b.email]=1;if(b.uid)a.aliases[b.uid]=1;
    return a;
  }
  var out=[];rows.forEach(function(r){var found=null;for(var i=0;i<out.length;i++){if(samePerson(out[i],r)){found=out[i];break;}}if(found)merge(found,r);else{r.aliases={};if(rowName(r))r.aliases[rowName(r)]=1;if(r.email)r.aliases[r.email]=1;if(r.uid)r.aliases[r.uid]=1;out.push(r);}});
  out.forEach(function(r){r.count=Object.keys(r.cases||{}).length||r.count||0;r.avg=r.count?r.total/r.count:0;r.eff=pct(r.active,r.total);r.waitPct=pct(r.wait,r.total);r.deadPct=pct(r.dead,r.total);r.productivity=r.active?+(r.closed/(r.active/3600000)).toFixed(3):0;r.processList=Object.keys(r.processes||{}).map(function(p){return processTitle(p);}).sort().join(', ');var aliasCount=Math.max(0,Object.keys(r.aliases||{}).length-1);r.traceQuality=r.synthetic?'Sin responsable trazado':((r.email||r.uid)?'Alta: usuario trazado':'Nombre trazado')+(aliasCount?' · '+aliasCount+' alias consolidado(s)':'');});
  return out;
}
function personsForProcess(c,p){var map={};
  var st=(c.processStats||{})[p]||{};(st.responsibles||[]).forEach(function(r){addPerson(map,{name:r.name||r.userName||r.email,email:r.email,uid:r.uid||r.userUid,role:r.role,source:'processStats'},r.role);});
  ['responsibleName','responsableName','userName','byName','createdByName','finishedByName','registeredByName','takenByName'].forEach(function(k){if(clean(st[k]))addPerson(map,{name:st[k],email:st[k.replace('Name','Email')]||'',uid:st[k.replace('Name','Uid')]||'',role:st.role||st.userRole,source:'processStats'},st.role||st.userRole);});
  allTraceEvents(c).filter(function(e){return e.process===p;}).forEach(function(e){addPerson(map,{name:e.user,email:e.email,uid:e.uid,role:e.role,source:'traza'},e.role);});
  if(c.currentProcess===p)addPerson(map,{name:c.assignedName,email:c.assignedEmail,uid:c.assignedTo||c.assignedUid,role:c.assignedRole,source:'asignacion_actual'},c.assignedRole);
  if(p==='corte_cable')(c.cutRequests||[]).forEach(function(x){addPerson(map,{name:x.takenByName||x.finishedByName||x.registeredByName,email:x.takenByEmail||x.finishedByEmail||x.registeredByEmail,uid:x.takenByUid||x.finishedBy||x.registeredBy,role:'auxiliar_corte',source:'corte'},'auxiliar_corte');});
  if(p==='recepcion_pedidos')addPerson(map,{name:c.receptionByName||c.receivedByName,email:c.receptionByEmail||'',uid:c.receptionByUid||'',role:'coordinador_logistico',source:'recepcion'},'coordinador_logistico');
  if(p==='alistamiento'){(c.assignedUsers||[]).forEach(function(u){addPerson(map,{name:u.name||u.userName||u.email,email:u.email,uid:u.uid||u.userUid,role:'aux_logistica',source:'asignacion_alistamiento'},'aux_logistica');});}
  var out=Object.keys(map).map(function(k){return map[k];});return out.length?out:[syntheticPerson()];}

function reportHiddenFromVsm(r){return !!(r && (r.hiddenFromMain===true || r.mergedIntoReportId || r.status==="MIGRADO_AL_HILO" || r.status==="CERRADO_MIGRADO"));}
function reportCaseTokens(r){
  var vals=[r&&r.sourceId,r&&r.caseId,r&&r.sourceCaseId,r&&r.caseUid,r&&r.sourceReference,r&&r.caseReference,r&&r.reference,r&&r.pedido,r&&r.orderNumber].map(function(x){return clean(x);}).filter(Boolean);
  return vals.map(normKey).filter(Boolean);
}
function reportMatchesCase(r,c){
  var rt=reportCaseTokens(r);if(!rt.length||!c)return false;
  var cv=[idOf(c),refOf(c),c.reference,c.caseNumber,c.pedido,c.orderNumber,purchase(c)].map(function(x){return normKey(x);}).filter(Boolean);
  return cv.some(function(x){return rt.indexOf(x)>=0;});
}
function reportThreadRows(r){
  var rows=[];
  function add(x,initial){
    if(!x)return;
    var t=tms(x.createdAt||x.at||x.timestamp||x.updatedAt);
    if(!isFinite(t))return;
    rows.push({at:t,comment:x.comment||x.detail||x.description||'',user:x.userName||x.createdByName||x.managedByName||'',status:x.status||'',initial:!!initial});
  }
  add({createdAt:r.createdAt,comment:r.detail||r.description,userName:r.createdByName,status:r.status},true);
  (r.noveltyThread||[]).forEach(function(x){add(x,!!x.isInitialNovelty);});
  (r.managementComments||[]).forEach(function(x){add(x,false);});
  return rows.sort(function(a,b){return a.at-b.at;});
}
function firstReportResponseAt(r){
  var created=tms(r.createdAt||r.updatedAt), candidates=[];
  (r.managementComments||[]).forEach(function(x){var t=tms(x.createdAt||x.at||x.timestamp);if(isFinite(t)&&(!isFinite(created)||t>created))candidates.push(t);});
  (r.noveltyThread||[]).forEach(function(x){var t=tms(x.createdAt||x.at||x.timestamp);if(isFinite(t)&&(!x.isInitialNovelty)&&(!isFinite(created)||t>created))candidates.push(t);});
  [r.salesResponseAt,r.managedAt,r.closedAt,r.finalizedAt].forEach(function(v){var t=tms(v);if(isFinite(t)&&(!isFinite(created)||t>created))candidates.push(t);});
  if(!candidates.length)return null;
  return Math.min.apply(null,candidates);
}
function reportResponseMetric(r){
  var created=tms(r.createdAt||r.updatedAt), first=firstReportResponseAt(r), closed=tms(r.closedAt||r.finalizedAt), now=nowMs();
  var responseEnd=isFinite(first)?first:now;
  var closeEnd=isFinite(closed)?closed:null;
  var thread=reportThreadRows(r);
  var updates=Math.max(thread.length,(r.managementComments||[]).length+(r.noveltyThread||[]).length);
  return {report:r,id:r.id,title:r.title||r.category||r.sourceModule||'Novedad',reference:r.sourceReference||r.sourceId||'',status:r.status||'',severity:r.severity||'',created:created,firstResponse:first,responseMs:isFinite(created)?workingMsBetween(created,responseEnd):0,closeMs:(isFinite(created)&&closeEnd)?workingMsBetween(created,closeEnd):0,pending:!first,updates:updates,thread:thread};
}
function reportMetricsForCase(c){
  return (app.reports||[]).filter(function(r){return !reportHiddenFromVsm(r)&&reportMatchesCase(r,c);}).map(reportResponseMetric);
}
function caseMetric(c){var start=caseStartMs(c);var missingStart=!isFinite(start);if(missingStart)start=tms(c.updatedAt)||nowMs();var end=caseEndMs(c,start);if(!isFinite(end)||end<start)end=start;var waitRows=reqRows(c,end),pRows=[],va=0,wait=0,dead=0,req=waitRows.filter(function(r){return /requer/i.test(r.tipo);}).reduce(function(s,r){return s+r.dur;},0),bottle={label:'',total:0};
  processStatsList(c).forEach(function(p){var pm=processMetric(c,p,start,end);if(!pm)return;pRows.push(pm);va+=pm.active;wait+=pm.wait;dead+=pm.dead;if(pm.total>bottle.total)bottle={label:pm.label,total:pm.total};});
  var explicitTotal=0;Object.keys(c.processStats||{}).forEach(function(k){var st=(c.processStats||{})[k]||{};explicitTotal+=num(st.activeMs)+num(st.waitMs)+num(st.deadMs);});
  var pTotal=pRows.reduce(function(s,r){return s+r.total;},0),extraWait=waitRows.reduce(function(s,r){return s+r.dur;},0);if(extraWait>wait)wait=extraWait;
  var baseLead=workingMsBetween(start,end),lead=baseLead;
  if(lead>0 && va+wait+dead>lead){var scaleCase=lead/(va+wait+dead);va=va*scaleCase;wait=wait*scaleCase;dead=Math.max(0,lead-va-wait);}
  if(lead>0&&va+wait+dead<lead)dead+=lead-va-wait-dead;
  if(va>lead)va=lead;if(wait>Math.max(0,lead-va))wait=Math.max(0,lead-va);if(dead>Math.max(0,lead-va-wait))dead=Math.max(0,lead-va-wait);
  if(!pRows.length&&lead>0){var cp=c.currentProcess&&PROCESS[c.currentProcess]?c.currentProcess:'recepcion_pedidos';var pm2={process:cp,label:processTitle(cp),active:0,wait:0,dead:lead,total:lead,req:0,start:start,finish:end,wip:!isClosed(c)};pRows.push(pm2);dead=lead;bottle={label:pm2.label,total:pm2.total};}
  var orderDays=calendarDaysBetween(start,end),orderType=isPveCase(c)?'PVE':'NORMAL';
  var reportRows=reportMetricsForCase(c),reportResponse=reportRows.reduce(function(s,r){return s+r.responseMs;},0),reportPending=reportRows.filter(function(r){return r.pending;}).length;
  return {c:c,start:start,end:end,lead:lead,va:va,wait:wait,req:req,dead:dead,closed:isClosed(c),pRows:pRows,waitRows:waitRows,reportRows:reportRows,reportResponse:reportResponse,reportPending:reportPending,bottleneck:bottle,missingStart:missingStart,orderDays:orderDays,orderType:orderType,leadPerDay:perDay(lead,orderDays),vaPerDay:perDay(va,orderDays),waitPerDay:perDay(wait,orderDays),deadPerDay:perDay(dead,orderDays),reportResponsePerDay:perDay(reportResponse,orderDays)};
}
async function compute(cases,cancelledCases){loading(true,'Calculando métricas VSM reales por lotes...');buildEventBuckets();var reconciliation=vsmReconciliation(cases,cancelledCases);var rows=[],byP={},byU={},byUP={},waitRows=[],cutRows=[],reportRows=[],incomplete=0;for(var i=0;i<cases.length;i++){var cm=caseMetric(cases[i]);rows.push(cm);if(cm.missingStart)incomplete++;cm.waitRows.forEach(function(w){waitRows.push(w);});cm.reportRows.forEach(function(r){reportRows.push(Object.assign({pedido:refOf(cases[i]),cliente:cases[i].client||""},r));});cm.pRows.forEach(function(p){var a=byP[p.process]||(byP[p.process]={process:p.process,label:p.label,cases:0,wip:0,active:0,wait:0,dead:0,total:0,req:0,cuts:0,doneCuts:0});a.cases++;if(p.wip)a.wip++;a.active+=p.active;a.wait+=p.wait;a.dead+=p.dead;a.total+=p.total;a.req+=p.req;if(p.process==='corte_cable'){a.cuts+=(cases[i].cutRequests||[]).length;a.doneCuts+=(cases[i].cutRequests||[]).filter(function(x){return x.status==='FINALIZADO'||x.registeredAt||x.noCutNeeded||x.measureComplete||x.medidaCompleta;}).length;}var people=personsForProcess(cases[i],p.process);var real=people.filter(function(x){return !x.synthetic;});var use=real.length?real:people,div=Math.max(1,use.length);use.forEach(function(person){var u=byU[person.key]||(byU[person.key]={key:person.key,user:person.name,email:person.email||'',uid:person.uid||'',role:person.role,synthetic:!!person.synthetic,cases:{},open:0,closed:0,active:0,wait:0,dead:0,total:0,req:0,cuts:0,processes:{},sources:{}});if((person.name||'').length>(u.user||'').length)u.user=person.name;if(!u.email&&person.email)u.email=person.email;if(!u.uid&&person.uid)u.uid=person.uid;if(!u.role&&person.role)u.role=person.role;u.sources[person.source||'traza']=1;u.processes[p.process]=(u.processes[p.process]||0)+p.total/div;if(!u.cases[idOf(cases[i])]){u.cases[idOf(cases[i])]=1;if(isClosed(cases[i]))u.closed++;else u.open++;}u.active+=p.active/div;u.wait+=p.wait/div;u.dead+=p.dead/div;u.total+=p.total/div;u.req+=p.req/div;if(p.process==='corte_cable')u.cuts+=(cases[i].cutRequests||[]).length/div;var uk=person.key+'|'+p.process,up=byUP[uk]||(byUP[uk]={key:person.key,user:person.name,email:person.email||'',uid:person.uid||'',role:person.role,synthetic:!!person.synthetic,process:p.process,label:p.label,cases:{},open:0,closed:0,active:0,wait:0,dead:0,total:0,req:0,cuts:0});if((person.name||'').length>(up.user||'').length)up.user=person.name;if(!up.cases[idOf(cases[i])]){up.cases[idOf(cases[i])]=1;if(isClosed(cases[i]))up.closed++;else up.open++;}up.active+=p.active/div;up.wait+=p.wait/div;up.dead+=p.dead/div;up.total+=p.total/div;up.req+=p.req/div;if(p.process==='corte_cable')up.cuts+=(cases[i].cutRequests||[]).length/div;});});(cases[i].cutRequests||[]).forEach(function(x){var ini=tms(x.startedAt||x.takenAt||x.createdAt),fin=tms(x.finishedAt||x.completedAt||x.registeredAt||x.measureCompleteAt||x.noCutNeededAt);cutRows.push({pedido:refOf(cases[i]),cliente:cases[i].client||'',corte:x.code||x.id||'',referencia:x.referencia||x.descripcion||'',metros:x.metrosSolicitados||x.metrajeFinal||'',estado:x.status||'',responsable:x.takenByName||x.finishedByName||x.registeredByName||'',inicio:ini,fin:fin,duracion:num(x.durationMs)||((isFinite(ini)&&isFinite(fin))?Math.max(0,fin-ini):0),modo:x.noCutNeeded||x.siesaExportStatus==='NO_APLICA_NO_NECESITA_CORTE'?'No necesita corte':(x.measureComplete||x.medidaCompleta||x.siesaExportStatus==='NO_APLICA_MEDIDA_COMPLETA'?'Medida completa':'Corte físico'),siesa:x.siesaBatchId||x.siesaExportStatus||''});});if(i%25===0){loading(true,(i+1)+' / '+cases.length);await sleep(0);}}
  var processRows=Object.keys(byP).map(function(k){var r=byP[k];r.avg=r.cases?r.total/r.cases:0;r.eff=pct(r.active,r.total);r.waitPct=pct(r.wait,r.total);r.deadPct=pct(r.dead,r.total);return r;}).sort(function(a,b){return b.avg-a.avg;});
  var userRows=consolidateSimilarUsers(Object.keys(byU).map(function(k){var r=byU[k];r.count=Object.keys(r.cases).length;r.avg=r.count?r.total/r.count:0;r.eff=pct(r.active,r.total);r.waitPct=pct(r.wait,r.total);r.deadPct=pct(r.dead,r.total);r.productivity=r.active?+(r.closed/(r.active/3600000)).toFixed(3):0;r.processList=Object.keys(r.processes).map(function(p){return processTitle(p);}).sort().join(', ');r.traceQuality=r.synthetic?'Sin responsable trazado':(r.email||r.uid?'Alta: usuario trazado':'Nombre trazado');return r;})).sort(function(a,b){return b.total-a.total;});
  var userProcessRows=Object.keys(byUP).map(function(k){var r=byUP[k];r.count=Object.keys(r.cases).length;r.avg=r.count?r.total/r.count:0;r.eff=pct(r.active,r.total);r.waitPct=pct(r.wait,r.total);r.deadPct=pct(r.dead,r.total);return r;}).sort(function(a,b){return b.avg-a.avg;});
  var leadTotal=rows.reduce(function(s,r){return s+r.lead;},0),va=rows.reduce(function(s,r){return s+r.va;},0),wait=rows.reduce(function(s,r){return s+r.wait;},0),dead=rows.reduce(function(s,r){return s+r.dead;},0),closed=rows.filter(function(r){return r.closed;}).length,wip=rows.length-closed,bottleneck=processRows[0]||null;
  var sortedLead=rows.map(function(r){return r.lead;}).sort(function(a,b){return a-b;});function perc(p){if(!sortedLead.length)return 0;var idx=Math.min(sortedLead.length-1,Math.max(0,Math.ceil((p/100)*sortedLead.length)-1));return sortedLead[idx];}
  var startMin=minMs(rows.map(function(r){return r.start;})),endMax=maxMs(rows.map(function(r){return r.end;})),periodDays=(isFinite(startMin)&&isFinite(endMax)&&endMax>startMin)?Math.max(1,(endMax-startMin)/86400000):1;
  var reqCases={};waitRows.forEach(function(w){if(/requer/i.test(w.tipo))reqCases[w.pedido]=1;});var totalCuts=cutRows.length,doneCuts=cutRows.filter(function(x){return /final|medida completa|no necesita/i.test([x.estado,x.modo].join(' '));}).length;var cancelRows=(cancelledCases||[]).map(cancellationRow).sort(function(a,b){return (b.fecha||0)-(a.fecha||0);});var cancelByType=countBy(cancelRows,function(r){return r.tipo;});var cancelByProcess=countBy(cancelRows,function(r){return r.procesoTxt;});var cancelByAdvisor=countBy(cancelRows,function(r){return r.asesor||'Sin asesor trazado';});var cancelados=cancelRows.filter(function(r){return /cancelad/i.test(r.tipo);}).length;var anulados=cancelRows.filter(function(r){return /anulad/i.test(r.tipo);}).length;var leadDayTotal=rows.reduce(function(s,r){return s+(r.leadPerDay||0);},0),vaDayTotal=rows.reduce(function(s,r){return s+(r.vaPerDay||0);},0),waitDayTotal=rows.reduce(function(s,r){return s+(r.waitPerDay||0);},0),deadDayTotal=rows.reduce(function(s,r){return s+(r.deadPerDay||0);},0);var normalGroup=metricGroup(rows.filter(function(r){return r.orderType==='NORMAL';})),pveGroup=metricGroup(rows.filter(function(r){return r.orderType==='PVE';}));var reportResponseTotal=reportRows.reduce(function(s,r){return s+r.responseMs;},0),reportAnswered=reportRows.filter(function(r){return !r.pending;}).length,reportPending=reportRows.filter(function(r){return r.pending;}).length,reportResponseAvg=reportRows.length?reportResponseTotal/reportRows.length:0;
  app.metrics={loadedTotal:reconciliation.loaded,filterBase:reconciliation.base,notTraced:reconciliation.notTraced,excludedKpi:reconciliation.excluded,notTracedRows:reconciliation.notTracedRows,cases:rows.length,closed:closed,wip:wip,leadAvg:rows.length?leadTotal/rows.length:0,leadP50:perc(50),leadP90:perc(90),leadDayAvg:rows.length?leadDayTotal/rows.length:0,vaDayAvg:rows.length?vaDayTotal/rows.length:0,waitDayAvg:rows.length?waitDayTotal/rows.length:0,deadDayAvg:rows.length?deadDayTotal/rows.length:0,throughput:+(closed/periodDays).toFixed(2),eff:pct(va,leadTotal),waitPct:pct(wait,leadTotal),deadPct:pct(dead,leadTotal),caseRows:rows.sort(function(a,b){return b.leadPerDay-a.leadPerDay||b.lead-a.lead;}),processRows:processRows,userRows:userRows,userProcessRows:userProcessRows,waitRows:waitRows.sort(function(a,b){return b.dur-a.dur;}),reportRows:reportRows.sort(function(a,b){return b.responseMs-a.responseMs;}),reportResponseTotal:reportResponseTotal,reportResponseAvg:reportResponseAvg,reportAnswered:reportAnswered,reportPending:reportPending,reportCount:reportRows.length,cutRows:cutRows,bottleneck:bottleneck,leadTotal:leadTotal,va:va,wait:wait,dead:dead,incomplete:incomplete,reqCount:waitRows.filter(function(w){return /requer/i.test(w.tipo);}).length,reqRate:pct(Object.keys(reqCases).length,rows.length),waitAvg:rows.length?wait/rows.length:0,vaAvg:rows.length?va/rows.length:0,waitCount:waitRows.length,totalCuts:totalCuts,doneCuts:doneCuts,cancelRows:cancelRows,cancelTotal:cancelRows.length,cancelados:cancelados,anulados:anulados,cancelByType:cancelByType,cancelByProcess:cancelByProcess,cancelByAdvisor:cancelByAdvisor,normalGroup:normalGroup,pveGroup:pveGroup,vsmType:vsmTypeLabel()};loading(false);}
function table(headers,rows){return '<thead><tr>'+headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody>';}
function bar(p){p=Math.max(0,Math.min(100,Number(p)||0));return '<div class="bar"><i style="width:'+p+'%"></i></div>';}
function chartRows(rows,valueFn,labelFn,metaFn,maxValue){rows=rows||[];var max=maxValue||rows.reduce(function(m,r){return Math.max(m,valueFn(r)||0);},0)||1;return rows.map(function(r){var v=valueFn(r)||0;return '<div class="chart-row"><b title="'+esc(labelFn(r))+'">'+esc(labelFn(r))+'</b><div class="chart-track"><i style="width:'+Math.min(100,(v/max)*100)+'%"></i></div><span>'+esc(metaFn(r))+'</span></div>';}).join('')||'<p class="muted">Sin datos reales suficientes.</p>';}
function stackTime(m){var total=Math.max(1,m.leadTotal||0),va=pct(m.va,total),wait=pct(m.wait,total),dead=pct(m.dead,total);return '<div class="stack"><i class="va" style="width:'+va+'%"></i><i class="wait" style="width:'+wait+'%"></i><i class="dead" style="width:'+dead+'%"></i></div><div class="legend"><span><i class="dot va"></i>VA '+va+'%</span><span><i class="dot wait"></i>Espera '+wait+'%</span><span><i class="dot dead"></i>NVA '+dead+'%</span></div>';}
function renderPowerCharts(){
  var m=app.metrics;if(!m)return;
  var users=m.userRows.filter(function(r){return !r.synthetic;});
  var wipRows=m.processRows.filter(function(r){return r.wip>0;}).sort(function(a,b){return b.wip-a.wip;});
  var waitTop=m.waitRows.slice(0,8);
  var pc=$('powerCharts');
  if(pc)pc.innerHTML=''+
    '<article class="power-card"><h3>Composición de tiempo</h3>'+stackTime(m)+'<div class="subgrid" style="margin-top:12px"><div class="mini-kpi"><span>Ocupación</span><strong>'+timeUnit(m.va)+'</strong></div><div class="mini-kpi"><span>Espera/bloqueo</span><strong>'+timeUnit(m.wait)+'</strong></div><div class="mini-kpi"><span>NVA</span><strong>'+timeUnit(m.dead)+'</strong></div><div class="mini-kpi"><span>LT total</span><strong>'+timeUnit(m.leadTotal)+'</strong></div></div></article>'+
    '<article class="power-card"><h3>Cancelados / anulados</h3><div class="subgrid"><div class="mini-kpi"><span>Excluidos</span><strong>'+m.cancelTotal+'</strong></div><div class="mini-kpi"><span>Cancelados</span><strong>'+m.cancelados+'</strong></div><div class="mini-kpi"><span>Anulados</span><strong>'+m.anulados+'</strong></div><div class="mini-kpi"><span>Con soporte</span><strong>'+m.cancelRows.filter(function(r){return !!r.soporte;}).length+'</strong></div></div><h4>Por proceso</h4>'+chartRows(m.cancelByProcess.slice(0,6),function(r){return r.count;},function(r){return r.label;},function(r){return r.count+' pedido(s)';})+'</article>'+
    '<article class="power-card"><h3>LT por proceso</h3>'+chartRows(m.processRows.slice(0,8),function(r){return r.avg;},function(r){return r.label;},function(r){return timeUnit(r.avg);})+'</article>'+
    '<article class="power-card"><h3>Ocupación por usuario</h3>'+chartRows(users.slice(0,8),function(r){return r.active;},function(r){return r.user;},function(r){return timeUnit(r.active)+' · '+r.count+' casos';})+'</article>'+
    '<article class="power-card"><h3>WIP por proceso</h3>'+chartRows(wipRows.slice(0,8),function(r){return r.wip;},function(r){return r.label;},function(r){return r.wip+' abiertos';})+'</article>'+
    '<article class="power-card"><h3>Mayores esperas</h3>'+chartRows(waitTop,function(r){return r.dur;},function(r){return r.proceso+' · '+r.tipo;},function(r){return timeUnit(r.dur);})+'</article>'+
    '<article class="power-card"><h3>Pedidos con mayor LT</h3>'+chartRows(m.caseRows.slice(0,8),function(r){return r.lead;},function(r){return refOf(r.c)+' · '+(r.c.client||'');},function(r){return timeUnit(r.lead);})+'</article>';
  var dk=$('deepKpis');
  if(dk)dk.innerHTML=''+
    '<article class="card kpi"><span>Tasa requerimientos</span><strong>'+m.reqRate+'%</strong><small>Pedidos con bloqueo.</small></article>'+
    '<article class="card kpi"><span>Espera prom.</span><strong>'+timeUnit(m.waitAvg)+'</strong><small>Por pedido.</small></article>'+
    '<article class="card kpi"><span>Ocupación prom.</span><strong>'+timeUnit(m.vaAvg)+'</strong><small>Por pedido.</small></article>'+
    '<article class="card kpi"><span>Cortes resueltos</span><strong>'+m.doneCuts+'/'+m.totalCuts+'</strong><small>Finalizados o no aplica.</small></article>'+
    '<article class="card kpi"><span>Excluidos</span><strong>'+m.cancelTotal+'</strong><small>Cancelados/anulados.</small></article>'+
    '<article class="card kpi"><span>Usuarios activos</span><strong>'+users.length+'</strong><small>Con trazabilidad.</small></article>'+
    '<article class="card kpi"><span>QA datos</span><strong>'+(m.incomplete?'Revisar':'OK')+'</strong><small>'+m.incomplete+' sin fecha base.</small></article>';
}
function kpiCard(title,value,meaning,formula){return '<article class="card kpi"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(meaning)+'</small>'+(formula?'<em class="tag">'+esc(formula)+'</em>':'')+'</article>';}
function renderSummary(){
  var m=app.metrics;if(!m)return;
  var split='<section class="grid grid-2 vsm-split" style="margin-top:10px">'
    +'<article class="card"><h3>VSM normal</h3><p class="muted">Pedidos estándar sin PVE.</p><div class="subgrid"><div class="mini-kpi"><span>Pedidos</span><strong>'+m.normalGroup.count+'</strong></div><div class="mini-kpi"><span>LT hábil/día</span><strong>'+timeUnit(m.normalGroup.leadDayAvg)+'</strong></div><div class="mini-kpi"><span>Ocupación/día</span><strong>'+timeUnit(m.normalGroup.vaDayAvg)+'</strong></div><div class="mini-kpi"><span>Espera+NVA/día</span><strong>'+timeUnit(m.normalGroup.waitDayAvg+m.normalGroup.deadDayAvg)+'</strong></div></div></article>'
    +'<article class="card"><h3>VSM PVE</h3><p class="muted">Pedido especial con paso por Compras.</p><div class="subgrid"><div class="mini-kpi"><span>Pedidos</span><strong>'+m.pveGroup.count+'</strong></div><div class="mini-kpi"><span>LT hábil/día</span><strong>'+timeUnit(m.pveGroup.leadDayAvg)+'</strong></div><div class="mini-kpi"><span>Ocupación/día</span><strong>'+timeUnit(m.pveGroup.vaDayAvg)+'</strong></div><div class="mini-kpi"><span>Espera+NVA/día</span><strong>'+timeUnit(m.pveGroup.waitDayAvg+m.pveGroup.deadDayAvg)+'</strong></div></div></article>'
    +'</section>';
  $('summary').innerHTML=[
    ['Tipo VSM',m.vsmType,'Filtro activo.','General / Normal / PVE'],['Base cargada',m.loadedTotal||0,'Pedidos leídos desde Firestore.','Base'],['Trazados VSM',m.cases,'Pedidos operativos incluidos.','LT'],['Cancelados/anulados',m.cancelTotal||0,'Trazados aparte sin dañar LT.','Control'],['No trazados',m.notTraced||0,'Revisar clasificación o datos.','QA'],
    ['LT hábil/día',timeUnit(m.leadDayAvg),'Lead Time normalizado.','h o min'],
    ['LT total prom.',timeUnit(m.leadAvg),'Demora punta a punta.','h o min'],
    ['Ocupación/día',timeUnit(m.vaDayAvg),'Tiempo tramitando.','VA'],
    ['Espera/día',timeUnit(m.waitDayAvg),'Bloqueos y requerimientos.','Espera'],
    ['NVA/día',timeUnit(m.deadDayAvg),'Tiempo muerto/no clasificado.','NVA'],
    ['% Ocupación',m.eff+'%','Valor sobre LT.','VA/LT'],
    ['% Espera',m.waitPct+'%','Espera sobre LT.','Espera/LT'],
    ['% NVA',m.deadPct+'%','NVA sobre LT.','NVA/LT'],
    ['Throughput',m.throughput,'Cerrados por día.','Pedidos/día'],
    ['WIP',m.wip,'Pedidos abiertos.','En proceso'],
    ['Requerimientos',m.reqCount,'Bloqueos trazados.','Eventos'],
    ['Novedades',m.reportCount||0,'Reportes vinculados a pedidos.','Hilos'],['Resp. novedad',timeUnit(m.reportResponseAvg||0),'Tiempo hábil hasta primera respuesta.','h hábiles'],['Pend. respuesta',m.reportPending||0,'Novedades sin respuesta trazada.','Pendientes'],['Calidad datos',m.incomplete?'Revisar '+m.incomplete:'OK',m.incomplete?'Falta fecha base.':'Fechas válidas.','QA']
  ].map(function(c){return kpiCard(c[0],c[1],c[2],c[3]);}).join('')+'<section class="vsm-reconcile"><strong>Conciliación:</strong> base cargada '+(m.loadedTotal||0)+' · filtro principal '+(m.filterBase||0)+' · trazados VSM '+m.cases+' · cancelados/anulados '+(m.cancelTotal||0)+' · excluidos KPI '+(m.excludedKpi||0)+' · no trazados '+(m.notTraced||0)+'</section>'+split;
  var b=m.bottleneck;
  $('bottleneck').innerHTML=b?'<p><strong>'+esc(b.label)+'</strong></p><p>Mayor demora promedio: '+timeUnit(b.avg)+' por caso.</p>'+bar(100)+'<p class="muted">Casos: '+b.cases+' · WIP: '+b.wip+' · Ocupación: '+b.eff+'% · Espera: '+b.waitPct+'%</p>':'<p class="muted">Sin datos suficientes.</p>';
  var qb=$('quickBars');
  if(qb)qb.innerHTML='<article class="card"><h3>Top procesos por demora</h3>'+m.processRows.slice(0,6).map(function(r){return '<p><strong>'+esc(r.label)+'</strong><span class="muted"> · '+timeUnit(r.avg)+' prom. · Ocupación '+r.eff+'%</span></p>'+bar(Math.min(100,(r.avg/(m.processRows[0]?m.processRows[0].avg:1))*100));}).join('')+'</article><article class="card"><h3>Pedidos con mayor LT hábil/día</h3>'+m.caseRows.slice(0,6).map(function(r){return '<p><strong>'+esc(refOf(r.c))+'</strong><span class="muted"> · '+esc(r.orderType)+' · '+timeUnit(r.leadPerDay)+'/día · '+r.orderDays+' día(s)</span></p>'+bar(Math.min(100,(r.leadPerDay/(m.caseRows[0]?m.caseRows[0].leadPerDay:1))*100));}).join('')+'</article>';
  var la=$('ltProductivityAnalysis');if(la)la.innerHTML=productivityHtml(m);
  renderPowerCharts();
}

function qaBadge(r){
  if(r.missingStart)return '<span class="badge bad">Revisar fecha</span>';
  if(r.notTraced)return '<span class="badge warn">QA</span>';
  return '<span class="badge ok">OK</span>';
}
function vsmCard(r){
  var c=r.c||{},resp=r.reportRows&&r.reportRows.length?'<strong>'+timeUnit(r.reportResponse)+'</strong><small>'+r.reportRows.length+' novedad(es) · '+r.reportPending+' pend.</small>':'<strong>Sin novedad</strong><small>Sin reporte asociado</small>';
  var stateBadge=isClosed(c)?'<span class="badge ok">Cerrado</span>':(isCancelledVsm(c)?'<span class="badge bad">Cancelado</span>':'<span class="badge warn">Abierto</span>');
  return '<article class="vsm-order-card">'
    +'<div class="vsm-order-head"><div class="vsm-order-title"><strong>'+esc(refOf(c))+'</strong><small>'+esc(c.client||'Sin cliente')+' · OC '+esc(purchase(c)||'N/A')+'</small></div><div class="vsm-badges"><span class="badge dark">'+esc(r.orderType||'GENERAL')+'</span>'+stateBadge+qaBadge(r)+'</div></div>'
    +'<div class="vsm-order-metrics">'
      +'<div class="vsm-metric"><span>LT hábil/día</span><strong>'+timeUnit(r.leadPerDay)+'</strong><small>'+r.orderDays+' día(s)</small></div>'
      +'<div class="vsm-metric"><span>LT total</span><strong>'+timeUnit(r.lead)+'</strong><small>'+fmt(r.lead)+'</small></div>'
      +'<div class="vsm-metric"><span>Ocupación</span><strong>'+pct(r.va,r.lead)+'%</strong><small>'+timeUnit(r.va)+'</small></div>'
    +'</div>'
    +timeSplitHtml(r.va,r.wait,r.dead)
    +'<div class="vsm-card-foot"><div><strong>Proceso actual</strong>'+esc(processTitle(c.currentProcess))+'<br><span class="muted">'+esc(c.status||'Sin estado')+'</span></div><div><strong>Respuesta novedades</strong>'+resp+'</div><div><strong>Cuello de botella</strong>'+esc((r.bottleneck&&r.bottleneck.label)||'Sin cuello trazado')+'</div><div><strong>Asesor / responsable</strong>'+esc(advisor(c)||c.assignedName||'Sin responsable trazado')+'</div></div>'
  +'</article>';
}
function principalVsmHtml(rows){
  if(!rows.length)return '<section class="vsm-empty"><strong>Sin pedidos para mostrar.</strong><br>Revise filtros, rango de fechas o cargue histórico.</section>';
  return '<section class="vsm-main-grid">'+rows.map(vsmCard).join('')+'</section>';
}
function resetVsmFilters(){
  ['fFrom','fTo','fProcess','fStatus','fUser','fSearch'].forEach(function(id){if($(id))$(id).value='';});
  if($('fOrderType'))$('fOrderType').value='';
  if($('fView'))$('fView').value='principal';
  refresh().catch(function(e){loading(false);status('Error limpiando filtros: '+esc(e.message||e),'bad');});
}
function renderTable(){
  var view=$('fView').value,m=app.metrics;if(!m)return;var html='',title='',count=0;
  if(view==='procesos'){
    title='Lead time por proceso';count=m.processRows.length;html=table(['Macroproceso','Casos','WIP','LT prom.','Total','Ocupación','Espera','NVA','% VA','% Espera','% NVA','Req. h','Cortes'],m.processRows.map(function(r){return '<tr><td>'+esc(r.label)+'</td><td>'+r.cases+'</td><td>'+r.wip+'</td><td>'+fmt(r.avg)+'</td><td>'+timeUnit(r.total)+'</td><td>'+timeUnit(r.active)+'</td><td>'+timeUnit(r.wait)+'</td><td>'+timeUnit(r.dead)+'</td><td>'+r.eff+'%</td><td>'+r.waitPct+'%</td><td>'+r.deadPct+'%</td><td>'+timeUnit(r.req)+'</td><td>'+r.doneCuts+'/'+r.cuts+'</td></tr>';}));
  }else if(view==='usuarios'){
    title='Productividad por usuario';count=m.userRows.length;html=table(['Usuario','Rol','Casos','Abiertos','Cerrados','LT prom.','Total','Ocupación','Espera','NVA','% VA','% Espera','Productividad','Procesos trazados'],m.userRows.map(function(r){return '<tr><td><strong>'+esc(r.user)+'</strong></td><td>'+esc(roleTitle(r.role))+'</td><td>'+r.count+'</td><td>'+r.open+'</td><td>'+r.closed+'</td><td>'+fmt(r.avg)+'</td><td>'+timeUnit(r.total)+'</td><td>'+timeUnit(r.active)+'</td><td>'+timeUnit(r.wait)+'</td><td>'+timeUnit(r.dead)+'</td><td>'+r.eff+'%</td><td>'+r.waitPct+'%</td><td>'+r.productivity+'</td><td>'+esc(r.processList||'')+'</td></tr>';}));
  }else if(view==='usuario_proceso'){
    title='Detalle usuario por proceso';count=m.userProcessRows.length;html=table(['Usuario','Rol','Proceso','Casos','Abiertos','Cerrados','LT prom.','Total','Ocupación','Espera','NVA','% VA','% Espera','Req. h','Cortes'],m.userProcessRows.map(function(r){return '<tr><td>'+esc(r.user)+'</td><td>'+esc(roleTitle(r.role))+'</td><td>'+esc(r.label)+'</td><td>'+r.count+'</td><td>'+r.open+'</td><td>'+r.closed+'</td><td>'+fmt(r.avg)+'</td><td>'+timeUnit(r.total)+'</td><td>'+timeUnit(r.active)+'</td><td>'+timeUnit(r.wait)+'</td><td>'+timeUnit(r.dead)+'</td><td>'+r.eff+'%</td><td>'+r.waitPct+'%</td><td>'+timeUnit(r.req)+'</td><td>'+Math.round(r.cuts)+'</td></tr>';}));
  }else if(view==='cancelados'){
    title='Pedidos cancelados / anulados';count=m.cancelRows.length;html=table(['Pedido','OC','Cliente','Asesor','Tipo','Proceso donde se canceló','Fecha cancelación','Usuario','Motivo','PDF soporte'],m.cancelRows.map(function(r){return '<tr><td><strong>'+esc(r.pedido)+'</strong></td><td>'+esc(r.oc)+'</td><td>'+esc(r.cliente)+'</td><td>'+esc(r.asesor)+'</td><td><span class="pill">'+esc(r.tipo)+'</span></td><td>'+esc(r.procesoTxt)+'</td><td>'+esc(dateTxt(r.fecha))+'</td><td>'+esc(r.usuario||'')+'</td><td>'+esc(r.motivo||'')+'</td><td>'+(r.soporte?'<a href="'+esc(r.soporte)+'" target="_blank" rel="noopener">Abrir PDF</a>':'Sin soporte trazado')+'</td></tr>';}));
  }else if(view==='not_traced'){
    title='Pedidos no trazados / revisión de conciliación';count=m.notTracedRows.length;html=table(['Pedido','Cliente','Estado','Proceso','Motivo'],m.notTracedRows.map(function(r){return '<tr><td><strong>'+esc(r.pedido||'')+'</strong></td><td>'+esc(r.cliente||'')+'</td><td>'+esc(r.estado||'')+'</td><td>'+esc(r.proceso||'')+'</td><td>'+esc(r.motivo||'')+'</td></tr>';}));
  }else if(view==='novedades'){
    title='Tiempo de respuesta de novedades y reportes';count=m.reportRows.length;html=table(['Pedido','Cliente','Novedad / reporte','Referencia','Estado','Criticidad','Actualizaciones','Primera respuesta','Tiempo respuesta','Cierre','Etiqueta VSM'],m.reportRows.slice(0,700).map(function(r){return '<tr><td><strong>'+esc(r.pedido||'')+'</strong></td><td>'+esc(r.cliente||'')+'</td><td>'+esc(r.title||'')+'</td><td>'+esc(r.reference||'')+'</td><td><span class="pill">'+esc(r.status||'')+'</span></td><td>'+esc(r.severity||'')+'</td><td>'+r.updates+'</td><td>'+(r.pending?'Pendiente':dateTxt(r.firstResponse))+'</td><td><strong>'+timeUnit(r.responseMs)+'</strong></td><td>'+(r.closeMs?timeUnit(r.closeMs):'—')+'</td><td>'+(r.pending?'Sin respuesta trazada':'Respondida')+'</td></tr>';}));
  }else if(view==='pedidos'){
    title='Demora exacta por pedido';var rows=m.caseRows.slice(0,700);count=m.caseRows.length;html=table(['Tipo','Pedido','OC','Cliente','Proceso','Estado','LT hábil/día','LT total','Días','Lectura de tiempo','Resp. novedades','% Ocupación','Cuello','QA'],rows.map(function(r){var c=r.c;return '<tr><td><span class="pill">'+esc(r.orderType)+'</span></td><td><strong>'+esc(refOf(c))+'</strong></td><td>'+esc(purchase(c))+'</td><td>'+esc(c.client||'')+'</td><td>'+esc(processTitle(c.currentProcess))+'</td><td><span class="pill">'+esc(c.status||'')+'</span></td><td><strong>'+timeUnit(r.leadPerDay)+'</strong><br><small class="muted">por día</small></td><td>'+timeUnit(r.lead)+'<br><small class="muted">'+fmt(r.lead)+'</small></td><td>'+r.orderDays+'</td><td>'+timeSplitHtml(r.va,r.wait,r.dead)+'</td><td>'+(r.reportRows.length?'<strong>'+timeUnit(r.reportResponse)+'</strong><br><small class="muted">'+r.reportRows.length+' novedad(es) · '+r.reportPending+' pend.</small>':'—')+'</td><td>'+pct(r.va,r.lead)+'%</td><td>'+esc(r.bottleneck.label||'')+'</td><td>'+(r.missingStart?'Revisar fecha':'OK')+'</td></tr>';}));
  }else{
    title='Principal VSM · lectura ejecutiva por pedido';var rows=m.caseRows;count=rows.length;html=principalVsmHtml(rows);
  }
  $('tableTitle').textContent=title;
  $('rowCount').textContent=count+' fila(s) · base cargada '+((m&&m.loadedTotal)||0)+' · trazados VSM '+((m&&m.cases)||0)+' · cancelados/anulados '+((m&&m.cancelTotal)||0)+' · no trazados '+((m&&m.notTraced)||0);
  $('mainTable').innerHTML=html;
}
async function refresh(){var cases=filterCases(),cancelled=filterCancelledCases();await compute(cases,cancelled);renderSummary();renderTable();$('btnExport').disabled=!(cases.length||cancelled.length);}
function fillFilters(){var p=$('fProcess');p.innerHTML='<option value="">Todos</option>'+FLOW.map(function(k){return '<option value="'+k+'">'+esc(PROCESS[k])+'</option>';}).join('');var users={};app.cases.forEach(function(c){processStatsList(c).forEach(function(pr){personsForProcess(c,pr).forEach(function(person){if(person.synthetic)return;users[person.key]=person;});});});var u=$('fUser');u.innerHTML='<option value="">Todos</option>'+Object.keys(users).sort(function(a,b){return users[a].name.localeCompare(users[b].name);}).map(function(k){return '<option value="'+esc(k)+'">'+esc(users[k].name)+'</option>';}).join('');}

function caseMatchesBaseFilters(c,includeStatus){
  var from=$('fFrom').value,to=$('fTo').value,proc=$('fProcess').value,stat=$('fStatus').value,orderType=($('fOrderType')&&$('fOrderType').value)||'',q=lower($('fSearch').value),user=$('fUser').value;
  if(orderType==='pve'&&!isPveCase(c))return false;
  if(orderType==='normal'&&isPveCase(c))return false;
  var day=isoDay((isCancelledVsm(c)?(cancellationDateMs(c)||caseStartMs(c)||c.updatedAt):(caseStartMs(c)||c.updatedAt)));
  if(from&&day&&day<from)return false;
  if(to&&day&&day>to)return false;
  if(proc){
    var cp=cancellationProcessKey(c);
    var has=(cp===proc)||(c.currentProcess===proc)||(c.processStats&&c.processStats[proc])||allTraceEvents(c).some(function(e){return e.process===proc;})||((proc==='corte_cable')&&(c.cutRequests||[]).length);
    if(!has)return false;
  }
  if(includeStatus){
    if(stat==='cancelled'&&!isCancelledVsm(c))return false;
    if(stat==='open'&&(isClosed(c)||isCancelledVsm(c)))return false;
    if(stat==='closed'&&(!isClosed(c)||isCancelledVsm(c)))return false;
    if(stat==='wait'&&!((c.requirements||[]).length||c.openRequirement||c.waitStartedAt||c.salesHold||c.separationRequest))return false;
  }
  var txt=lower([refOf(c),idOf(c),purchase(c),c.client,advisor(c),c.assignedName,c.status,c.cancelStatusLabel,c.cancellationTypeLabel,c.cancellationReason,c.cancellationDetail,processTitle(c.currentProcess),processTitle(cancellationProcessKey(c))].join(' '));
  if(q&&txt.indexOf(q)<0)return false;
  if(user){
    var hit=processStatsList(c).some(function(pr){return personsForProcess(c,pr).some(function(person){return person.key===user;});});
    if(!hit)return false;
  }
  return true;
}
function vsmReconciliation(included,cancelled){
  var base=(app.cases||[]).filter(function(c){return caseMatchesBaseFilters(c,false);});
  var excluded=base.filter(function(c){return c.excludeFromKpi||c.excludeFromVsm;});
  var cancelledIds={};(cancelled||[]).forEach(function(c){cancelledIds[idOf(c)]=1;});
  var includedIds={};(included||[]).forEach(function(c){includedIds[idOf(c)]=1;});
  var notTraced=base.filter(function(c){var id=idOf(c);return !includedIds[id]&&!cancelledIds[id]&&!(c.excludeFromKpi||c.excludeFromVsm);});
  return {loaded:(app.cases||[]).length,base:base.length,included:(included||[]).length,cancelled:(cancelled||[]).length,excluded:excluded.length,notTraced:notTraced.length,notTracedRows:notTraced.slice(0,80).map(function(c){return {pedido:refOf(c),cliente:c.client||'',estado:c.status||'',proceso:processTitle(c.currentProcess),motivo:'No clasificado por filtros/estado o datos incompletos'};})};
}
function filterCases(){
  var stat=$('fStatus').value;
  if(stat==='cancelled')return [];
  return app.cases.filter(function(c){
    if(c.excludeFromKpi||c.excludeFromVsm||isCancelledVsm(c))return false;
    return caseMatchesBaseFilters(c,true);
  });
}
function filterCancelledCases(){
  return app.cases.filter(function(c){
    if(!isCancelledVsm(c))return false;
    return caseMatchesBaseFilters(c,true);
  });
}
async function getSnap(q,timeoutMs){return await Promise.race([q.get(),new Promise(function(_,rej){setTimeout(function(){rej(new Error('Timeout leyendo Firebase'));},timeoutMs||14000);})]);}
async function mergeDocsFromQuery(out,seen,q,label,limitMax){try{var snap=await getSnap(q.limit(limitMax||500),16000);snap.forEach(function(doc){if(!seen[doc.id]){var d=doc.data()||{};d.id=d.id||doc.id;out.push(d);seen[doc.id]=1;}});return snap.size;}catch(e){console.warn('VSM query omitida '+label,e);return 0;}}
async function loadEvents(limit){if(!app.db)return;var out=[],seen={},lim=limit||1600;async function merge(q,label){try{var snap=await getSnap(q.limit(lim),14000);snap.forEach(function(doc){if(!seen[doc.id]){var d=doc.data()||{};d.id=d.id||doc.id;out.push(d);seen[doc.id]=1;}});}catch(e){console.warn('No se pudieron leer eventos '+label,e);}}
  await merge(app.db.collection('case_events').orderBy('timestamp','desc'),'timestamp');await merge(app.db.collection('case_events').orderBy('createdAt','desc'),'createdAt');if(!out.length)await merge(app.db.collection('case_events'),'sin orden');app.events=out;buildEventBuckets();}
async function loadReports(limit){
  if(!app.db)return;
  var out=[],seen={},lim=limit||1000;
  async function merge(q,label){
    try{
      var snap=await getSnap(q.limit(lim),14000);
      snap.forEach(function(doc){if(!seen[doc.id]){var d=doc.data()||{};d.id=d.id||doc.id;out.push(d);seen[doc.id]=1;}});
    }catch(e){console.warn('No se pudieron leer reportes/novedades '+label,e);}
  }
  await merge(app.db.collection('reportes_novedad').orderBy('updatedAt','desc'),'updatedAt');
  await merge(app.db.collection('reportes_novedad').orderBy('createdAt','desc'),'createdAt');
  if(!out.length)await merge(app.db.collection('reportes_novedad'),'sin orden');
  app.reports=out;
}
async function loadCases(all){if(!app.db)return;loading(true,'Leyendo Firebase sin bloquear...');var limit=Number($('fLimit').value||600);var batch=all?Math.max(500,limit):limit;var out=all?app.cases.slice():[],seen={};out.forEach(function(c){seen[idOf(c)]=1;});await loadEvents(all?3500:1600);await loadReports(all?1600:1000);
  await mergeDocsFromQuery(out,seen,app.db.collection('cases').orderBy('updatedAt','desc'),'updatedAt',batch);
  await sleep(0);loading(true,'Cargados '+out.length+' pedidos · complementando fechas de creación...');
  await mergeDocsFromQuery(out,seen,app.db.collection('cases').orderBy('createdAt','desc'),'createdAt',Math.min(batch,900));
  if(all){await sleep(0);loading(true,'Cargando histórico adicional sin orden...');await mergeDocsFromQuery(out,seen,app.db.collection('cases'),'sin orden',2000);}else if(out.length<50){await mergeDocsFromQuery(out,seen,app.db.collection('cases'),'sin orden mínimo',300);}
  app.cases=out;app.loadedAll=!!all;fillFilters();status('Datos reales cargados desde Firebase: '+out.length+' pedido(s) y '+app.events.length+' evento(s) y '+(app.reports||[]).length+' novedad(es). '+VERSION+' calcula Lead Time con conciliación completa: base cargada, trazados VSM, cancelados/anulados, excluidos y no trazados.','ok');await refresh();}
function xls(v){return esc(v).replace(/\n/g,' ');}function row(cells){return '<tr>'+cells.map(function(c){return '<td>'+xls(c)+'</td>';}).join('')+'</tr>';}
async function appendRows(parts,items,mapper,chunk){for(var i=0;i<items.length;i++){parts.push(mapper(items[i],i));if(i%chunk===0){loading(true,'Exportando '+i+' / '+items.length);await sleep(0);}}}
async function exportExcel(){if(!app.metrics)await refresh();var m=app.metrics,parts=[];loading(true,'Preparando Excel VSM completo...');parts.push('<html><head><meta charset="utf-8"><style>body{font-family:Century Gothic,Arial}table{border-collapse:collapse;margin-bottom:24px}th,td{border:1px solid #cbd5e1;padding:6px;font-size:12px}th{background:#061b46;color:#fff}.n{mso-number-format:"0.00"}</style></head><body>');parts.push('<h1>Dashboard VSM ERP · '+VERSION+' · Normalizado por día y separado Normal/PVE</h1><p>Exportado: '+xls(new Date().toLocaleString('es-CO'))+'</p><h2>Fórmulas y criterios</h2><table><tr><th>Indicador</th><th>Fórmula / lectura</th></tr>'+row(['Lead Time pedido','Fin real o corte del análisis - inicio real del pedido. Si faltan campos, se respalda con trazas/eventos y updatedAt.'])+row(['Lead Time normalizado por día','Lead Time acumulado del pedido dividido entre los días calendario que abarca el pedido. Sirve para leer horas reales por pedido/día.'])+row(['VSM normal / PVE','Los PVE se separan porque pasan por Compras y tienen una carga distinta; los demás pedidos se miden como flujo normal.'])+row(['Lead Time proceso','Tiempo transcurrido en cada macroproceso desde processStats + trazas + eventos + estado actual.'])+row(['VA','Tiempo activo registrado o inferido por eventos de trabajo / conformidad / cierre.'])+row(['Espera','Tiempos de espera por proceso + bloqueos + requerimientos + pago/separación.'])+row(['Requerimientos','Desde creación del requerimiento hasta respuesta/cierre o corte.'])+row(['NVA / tiempo muerto','Lead Time - VA - Espera, sin negativos.'])+row(['Eficiencia','VA / Lead Time.'])+row(['Cancelados/anulados','No se incluyen en Lead Time ni productividad. Se reportan en control independiente por tipo, proceso, asesor y soporte.'])+'</table>');
  parts.push('<h2>Resumen ejecutivo</h2><table><tr><th>Pedidos</th><th>Cerrados</th><th>WIP</th><th>Tipo VSM</th><th>LT hábil/día</th><th>Lead Time promedio total</th><th>P50 LT</th><th>P90 LT</th><th>Throughput cerrado/día</th><th>% VA</th><th>% Espera</th><th>% NVA</th><th>Requerimientos</th><th>Cancelados/anulados excluidos</th><th>Cuello principal</th><th>Datos incompletos</th></tr>'+row([m.cases,m.closed,m.wip,m.vsmType,fmt(m.leadDayAvg),fmt(m.leadAvg),fmt(m.leadP50),fmt(m.leadP90),m.throughput,m.eff+'%',m.waitPct+'%',m.deadPct+'%',m.reqCount,m.cancelTotal,m.bottleneck?m.bottleneck.label:'',m.incomplete])+'</table>');
  parts.push('<h2>VSM por proceso</h2><table><tr><th>Macroproceso</th><th>Casos</th><th>WIP</th><th>LT promedio</th><th>Horas total</th><th>VA h</th><th>Espera h</th><th>NVA h</th><th>Eficiencia</th><th>Req. h</th><th>Cortes</th></tr>');await appendRows(parts,m.processRows,function(r){return row([r.label,r.cases,r.wip,fmt(r.avg),timeUnit(r.total),timeUnit(r.active),timeUnit(r.wait),timeUnit(r.dead),r.eff+'%',timeUnit(r.req),r.doneCuts+'/'+r.cuts]);},30);parts.push('</table>');
  parts.push('<h2>Demora exacta por pedido</h2><table><tr><th>Tipo</th><th>Pedido</th><th>OC</th><th>Cliente</th><th>Asesor</th><th>Proceso actual</th><th>Estado</th><th>Inicio</th><th>Fin/corte</th><th>LT hábil h/día</th><th>Lead Time total</th><th>Horas LT total</th><th>Días pedido</th><th>VA h/día</th><th>Espera h/día</th><th>NVA h/día</th><th>VA h total</th><th>Espera h total</th><th>Req. h</th><th>NVA h total</th><th>Eficiencia</th><th>Cuello pedido</th><th>Calidad dato</th></tr>');await appendRows(parts,m.caseRows,function(r){var c=r.c;return row([r.orderType,refOf(c),purchase(c),c.client||'',advisor(c),processTitle(c.currentProcess),c.status||'',dateTxt(r.start),r.closed?dateTxt(r.end):'Abierto · '+dateTxt(r.end),hours(r.leadPerDay),fmt(r.lead),hours(r.lead),r.orderDays,hours(r.vaPerDay),hours(r.waitPerDay),hours(r.deadPerDay),hours(r.va),timeUnit(r.wait),timeUnit(r.req),timeUnit(r.dead),pct(r.va,r.lead)+'%',r.bottleneck.label||'',r.missingStart?'Sin fecha base clara':'OK']);},25);parts.push('</table>');
  parts.push('<h2>Productividad por usuario</h2><table><tr><th>Usuario</th><th>Rol</th><th>Casos</th><th>Abiertos</th><th>Cerrados</th><th>LT prom.</th><th>Horas total</th><th>VA h</th><th>Espera h</th><th>NVA h</th><th>% VA</th><th>% Espera</th><th>Cerrados/h VA</th><th>Procesos trazados</th></tr>');await appendRows(parts,m.userRows,function(r){return row([r.user,roleTitle(r.role),r.count,r.open,r.closed,fmt(r.avg),timeUnit(r.total),timeUnit(r.active),timeUnit(r.wait),timeUnit(r.dead),r.eff+'%',r.waitPct+'%',r.productivity,r.processList||'']);},35);parts.push('</table>');parts.push('<h2>Detalle usuario por proceso</h2><table><tr><th>Usuario</th><th>Rol</th><th>Proceso</th><th>Casos</th><th>Abiertos</th><th>Cerrados</th><th>LT prom.</th><th>Horas total</th><th>VA h</th><th>Espera h</th><th>NVA h</th><th>% VA</th><th>% Espera</th><th>Req. h</th><th>Cortes</th></tr>');await appendRows(parts,m.userProcessRows,function(r){return row([r.user,roleTitle(r.role),r.label,r.count,r.open,r.closed,fmt(r.avg),timeUnit(r.total),timeUnit(r.active),timeUnit(r.wait),timeUnit(r.dead),r.eff+'%',r.waitPct+'%',timeUnit(r.req),Math.round(r.cuts)]);},35);parts.push('</table>');
  parts.push('<h2>Esperas, bloqueos y requerimientos</h2><table><tr><th>Pedido</th><th>Proceso</th><th>Desde</th><th>Hasta</th><th>Duración</th><th>Horas</th><th>Tipo</th><th>Usuario</th><th>Detalle</th></tr>');await appendRows(parts,m.waitRows,function(w){return row([w.pedido,w.proceso,dateTxt(w.desde),dateTxt(w.hasta),fmt(w.dur),hours(w.dur),w.tipo,w.usuario,w.detalle]);},35);parts.push('</table>');
  parts.push('<h2>Pedidos cancelados / anulados · control excluido del VSM operativo</h2><table><tr><th>Tipo</th><th>Pedido</th><th>OC</th><th>Cliente</th><th>Asesor</th><th>Tipo</th><th>Proceso donde se canceló</th><th>Fecha cancelación</th><th>Usuario</th><th>Motivo</th><th>PDF soporte</th></tr>');await appendRows(parts,m.cancelRows,function(r){return row([r.pedido,r.oc,r.cliente,r.asesor,r.tipo,r.procesoTxt,dateTxt(r.fecha),r.usuario,r.motivo,r.soporte?'Sí':'No']);},35);parts.push('</table>');
  parts.push('<h2>Cortes</h2><table><tr><th>Pedido</th><th>Cliente</th><th>Corte</th><th>Referencia</th><th>Metros</th><th>Estado</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>Horas</th><th>Modo</th><th>SIESA</th></tr>');await appendRows(parts,m.cutRows,function(x){return row([x.pedido,x.cliente,x.corte,x.referencia,x.metros,x.estado,x.responsable,dateTxt(x.inicio),dateTxt(x.fin),fmt(x.duracion),hours(x.duracion),x.modo,x.siesa]);},40);parts.push('</table></body></html>');
  var blob=new Blob(['\ufeff'].concat(parts),{type:'application/vnd.ms-excel;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='VSM_ERP_Normalizado_PVE_v209_'+new Date().toISOString().slice(0,10)+'.xls';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);loading(false);status('Excel VSM '+VERSION+' generado correctamente con '+m.cases+' pedido(s).','ok');}
function bind(){['fFrom','fTo','fProcess','fStatus','fOrderType','fUser','fView'].forEach(function(id){$(id).addEventListener('change',function(){refresh().catch(function(e){loading(false);status('Error recalculando: '+esc(e.message||e),'bad');});});});$('fSearch').addEventListener('input',function(){clearTimeout(window.__vsmSearch);window.__vsmSearch=setTimeout(function(){refresh().catch(function(e){loading(false);status('Error filtrando: '+esc(e.message||e),'bad');});},250);});$('btnLoad').onclick=function(){loadCases(false).catch(function(e){loading(false);status('Error cargando datos: '+esc(e.message||e),'bad');});};$('btnLoadAll').onclick=function(){loadCases(true).catch(function(e){loading(false);status('Error cargando histórico: '+esc(e.message||e),'bad');});};$('btnExport').onclick=function(){exportExcel().catch(function(e){loading(false);status('Error exportando Excel: '+esc(e.message||e),'bad');});};if($('btnReset'))$('btnReset').onclick=resetVsmFilters;}
(async function(){try{bind();await initFirebase();$('fFrom').value='';$('fTo').value='';await loadCases(false);if(/[?&]export=1/.test(location.search))setTimeout(function(){$('btnExport').click();},900);}catch(e){loading(false);status('Error inicializando VSM: '+esc(e.message||e),'bad');}})();
})();
