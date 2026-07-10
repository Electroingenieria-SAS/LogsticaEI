(function(){
'use strict';
var VERSION='V234';
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
function v231IdentityText(x){
  x=x||{};
  return lower([
    x.role,x.rawRole,x.userRole,x.createdByRole,x.responsibleRole,x.responsableRole,
    x.name,x.user,x.userName,x.displayName,x.createdByName,x.byName,x.actorName,
    x.email,x.userEmail,x.createdByEmail,x.responsibleEmail,x.responsableEmail,
    x.uid,x.userUid,x.createdByUid,x.responsibleUid,x.responsableUid
  ].join(" "));
}
function v231IsExcludedSuperAdmin(x){
  var t=v231IdentityText(x);
  var role=normKey((x&&(
    x.role||x.rawRole||x.userRole||x.createdByRole||
    x.responsibleRole||x.responsableRole
  ))||"");
  if(role==="super_admin"||role==="super_administrador"||role==="superadministrador")return true;
  if(/(^|[\s_-])super[\s_-]*admin(?:istrador)?($|[\s_-])/.test(t))return true;
  if(t.indexOf("juanespereztobon.1204@gmail.com")>=0)return true;
  if(t.indexOf("juanespereztobon")>=0)return true;
  if(t.indexOf("juan esteban perez")>=0||t.indexOf("juan esteban pérez")>=0)return true;
  return false;
}
function v231ProcessStatsExcluded(st){
  st=st||{};
  var actors=[];
  (st.responsibles||[]).forEach(function(r){actors.push(r||{});});
  [
    ["responsibleName","responsibleEmail","responsibleUid"],
    ["responsableName","responsableEmail","responsableUid"],
    ["userName","userEmail","userUid"],
    ["createdByName","createdByEmail","createdByUid"],
    ["finishedByName","finishedByEmail","finishedBy"],
    ["registeredByName","registeredByEmail","registeredBy"],
    ["takenByName","takenByEmail","takenByUid"]
  ].forEach(function(keys){
    if(clean(st[keys[0]])||clean(st[keys[1]])||clean(st[keys[2]])){
      actors.push({
        name:st[keys[0]],email:st[keys[1]],uid:st[keys[2]],
        role:st.role||st.userRole||st.responsibleRole||st.createdByRole
      });
    }
  });
  return actors.length>0&&actors.every(v231IsExcludedSuperAdmin);
}
function v231OperationalUpdatedAt(c){
  c=c||{};
  var updater={
    name:c.updatedByName||c.modifiedByName,
    email:c.updatedByEmail||c.modifiedByEmail,
    uid:c.updatedBy||c.updatedByUid||c.modifiedBy||c.modifiedByUid,
    role:c.updatedByRole||c.modifiedByRole
  };
  var updated=tms(c.updatedAt||c.lastUpdatedAt||c.modifiedAt);
  if(isFinite(updated)&&!v231IsExcludedSuperAdmin(updater))return updated;
  var traces=allTraceEvents(c).map(function(e){return e.ms;}).filter(isFinite);
  return traces.length?Math.max.apply(Math,traces):NaN;
}
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
  var u=v231OperationalUpdatedAt(c);if(isFinite(u)&&u>=start)return u;return start;}
function allTraceEvents(c){var out=[];function pick(o,keys){for(var i=0;i<keys.length;i++){var v=o&&o[keys[i]];if(clean(v))return v;}return '';}function add(x){var ms=tms(x.at);if(!isFinite(ms))return;x.ms=ms;out.push(x);}
  (c.stateHistory||[]).forEach(function(h){add({at:h.timestamp||h.createdAt||h.updatedAt||h.at||h.fecha_hora_inicio_estado,process:h.process||h.currentProcess||c.currentProcess,kind:eventKind(h),user:pick(h,['responsibleName','responsableName','userName','byName','createdByName','actorName','name','email']),role:pick(h,['responsibleRole','responsableRole','userRole','createdByRole','role']),uid:pick(h,['responsibleUid','responsableUid','userUid','uid','createdByUid','byUid']),email:pick(h,['responsibleEmail','responsableEmail','userEmail','email','createdByEmail']),detail:h.detail||h.reason||h.type||'',raw:h});});
  (c.flowTrace||[]).forEach(function(h){add({at:h.timestamp||h.createdAt||h.updatedAt||h.at||h.fecha_hora_inicio_estado,process:h.process||h.currentProcess||c.currentProcess,kind:eventKind(h),user:pick(h,['responsibleName','responsableName','userName','byName','createdByName','actorName','name','email']),role:pick(h,['responsibleRole','responsableRole','userRole','createdByRole','role']),uid:pick(h,['responsibleUid','responsableUid','userUid','uid','createdByUid','byUid']),email:pick(h,['responsibleEmail','responsableEmail','userEmail','email','createdByEmail']),detail:h.detail||h.reason||h.type||'',raw:h});});
  caseEvents(c).forEach(function(e){add({at:e.timestamp||e.createdAt||e.updatedAt||e.at,process:eventProcess(e,c),kind:eventKind(e),user:pick(e,['userName','responsibleName','responsableName','createdByName','byName','actorName','displayName','name','email']),role:pick(e,['createdByRole','sourceRole','responsibleRole','responsableRole','userRole','role']),uid:pick(e,['uid','userUid','createdByUid','responsibleUid','responsableUid','byUid']),email:pick(e,['email','userEmail','createdByEmail','responsibleEmail','responsableEmail']),detail:e.detail||e.reason||e.type||'',raw:e});});
  return out.filter(function(e){return !v231IsExcludedSuperAdmin(e);}).sort(function(a,b){return a.ms-b.ms;});
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
function processMetric(c,p,startMs,endMs){var st=(c.processStats||{})[p]||{};var active=num(st.activeMs||st.valueMs||st.workMs),wait=num(st.waitMs||st.holdMs),dead=num(st.deadMs||st.nvaMs||st.queueMs);if(v231ProcessStatsExcluded(st))active=0;var explicit=active+wait+dead;
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
  var out=Object.keys(map).map(function(k){return map[k];}).filter(function(person){return !v231IsExcludedSuperAdmin(person);});return out.length?out:[syntheticPerson()];}

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
  var created=tms(r.createdAt||r.updatedAt),candidates=[];
  (r.managementComments||[]).forEach(function(x){
    if(v231IsExcludedSuperAdmin(x))return;
    var t=tms(x.createdAt||x.at||x.timestamp);
    if(isFinite(t)&&(!isFinite(created)||t>created))candidates.push(t);
  });
  (r.noveltyThread||[]).forEach(function(x){
    if(x.isInitialNovelty||v231IsExcludedSuperAdmin(x))return;
    var t=tms(x.createdAt||x.at||x.timestamp);
    if(isFinite(t)&&(!isFinite(created)||t>created))candidates.push(t);
  });
  [
    {at:r.salesResponseAt,name:r.salesRespondedByName,email:r.salesRespondedByEmail,uid:r.salesRespondedBy,role:r.salesRespondedByRole},
    {at:r.managedAt,name:r.managedByName,email:r.managedByEmail,uid:r.managedBy,role:r.managedByRole},
    {at:r.closedAt,name:r.closedByName,email:r.closedByEmail,uid:r.closedBy,role:r.closedByRole},
    {at:r.finalizedAt,name:r.finalizedByName,email:r.finalizedByEmail,uid:r.finalizedBy,role:r.finalizedByRole}
  ].forEach(function(x){
    if(v231IsExcludedSuperAdmin(x))return;
    var t=tms(x.at);
    if(isFinite(t)&&(!isFinite(created)||t>created))candidates.push(t);
  });
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
  return (app.reports||[]).filter(function(r){return !v231IsExcludedSuperAdmin(r)&&!reportHiddenFromVsm(r)&&reportMatchesCase(r,c);}).map(reportResponseMetric);
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
async function computeBase(cases,cancelledCases){loading(true,'Calculando métricas VSM reales por lotes...');buildEventBuckets();var reconciliation=vsmReconciliation(cases,cancelledCases);var rows=[],byP={},byU={},byUP={},waitRows=[],cutRows=[],reportRows=[],incomplete=0;for(var i=0;i<cases.length;i++){var cm=caseMetric(cases[i]);rows.push(cm);if(cm.missingStart)incomplete++;cm.waitRows.forEach(function(w){waitRows.push(w);});cm.reportRows.forEach(function(r){reportRows.push(Object.assign({pedido:refOf(cases[i]),cliente:cases[i].client||""},r));});cm.pRows.forEach(function(p){var a=byP[p.process]||(byP[p.process]={process:p.process,label:p.label,cases:0,wip:0,active:0,wait:0,dead:0,total:0,req:0,cuts:0,doneCuts:0});a.cases++;if(p.wip)a.wip++;a.active+=p.active;a.wait+=p.wait;a.dead+=p.dead;a.total+=p.total;a.req+=p.req;if(p.process==='corte_cable'){a.cuts+=(cases[i].cutRequests||[]).length;a.doneCuts+=(cases[i].cutRequests||[]).filter(function(x){return x.status==='FINALIZADO'||x.registeredAt||x.noCutNeeded||x.measureComplete||x.medidaCompleta;}).length;}var people=personsForProcess(cases[i],p.process);var real=people.filter(function(x){return !x.synthetic;});var use=real.length?real:people,div=Math.max(1,use.length);use.forEach(function(person){var u=byU[person.key]||(byU[person.key]={key:person.key,user:person.name,email:person.email||'',uid:person.uid||'',role:person.role,synthetic:!!person.synthetic,cases:{},open:0,closed:0,active:0,wait:0,dead:0,total:0,req:0,cuts:0,processes:{},sources:{}});if((person.name||'').length>(u.user||'').length)u.user=person.name;if(!u.email&&person.email)u.email=person.email;if(!u.uid&&person.uid)u.uid=person.uid;if(!u.role&&person.role)u.role=person.role;u.sources[person.source||'traza']=1;u.processes[p.process]=(u.processes[p.process]||0)+p.total/div;if(!u.cases[idOf(cases[i])]){u.cases[idOf(cases[i])]=1;if(isClosed(cases[i]))u.closed++;else u.open++;}u.active+=p.active/div;u.wait+=p.wait/div;u.dead+=p.dead/div;u.total+=p.total/div;u.req+=p.req/div;if(p.process==='corte_cable')u.cuts+=(cases[i].cutRequests||[]).length/div;var uk=person.key+'|'+p.process,up=byUP[uk]||(byUP[uk]={key:person.key,user:person.name,email:person.email||'',uid:person.uid||'',role:person.role,synthetic:!!person.synthetic,process:p.process,label:p.label,cases:{},open:0,closed:0,active:0,wait:0,dead:0,total:0,req:0,cuts:0});if((person.name||'').length>(up.user||'').length)up.user=person.name;if(!up.cases[idOf(cases[i])]){up.cases[idOf(cases[i])]=1;if(isClosed(cases[i]))up.closed++;else up.open++;}up.active+=p.active/div;up.wait+=p.wait/div;up.dead+=p.dead/div;up.total+=p.total/div;up.req+=p.req/div;if(p.process==='corte_cable')up.cuts+=(cases[i].cutRequests||[]).length/div;});});(cases[i].cutRequests||[]).forEach(function(x){var ini=tms(x.startedAt||x.takenAt||x.createdAt),fin=tms(x.finishedAt||x.completedAt||x.registeredAt||x.measureCompleteAt||x.noCutNeededAt);cutRows.push({pedido:refOf(cases[i]),cliente:cases[i].client||'',corte:x.code||x.id||'',referencia:x.referencia||x.descripcion||'',metros:x.metrosSolicitados||x.metrajeFinal||'',estado:x.status||'',responsable:x.takenByName||x.finishedByName||x.registeredByName||'',inicio:ini,fin:fin,duracion:num(x.durationMs)||((isFinite(ini)&&isFinite(fin))?Math.max(0,fin-ini):0),modo:x.noCutNeeded||x.siesaExportStatus==='NO_APLICA_NO_NECESITA_CORTE'?'No necesita corte':(x.measureComplete||x.medidaCompleta||x.siesaExportStatus==='NO_APLICA_MEDIDA_COMPLETA'?'Medida completa':'Corte físico'),siesa:x.siesaBatchId||x.siesaExportStatus||''});});if(i%25===0){loading(true,(i+1)+' / '+cases.length);await sleep(0);}}
  var processRows=Object.keys(byP).map(function(k){var r=byP[k];r.avg=r.cases?r.total/r.cases:0;r.eff=pct(r.active,r.total);r.waitPct=pct(r.wait,r.total);r.deadPct=pct(r.dead,r.total);return r;}).sort(function(a,b){return b.avg-a.avg;});
  var userRows=consolidateSimilarUsers(Object.keys(byU).map(function(k){var r=byU[k];r.count=Object.keys(r.cases).length;r.avg=r.count?r.total/r.count:0;r.eff=pct(r.active,r.total);r.waitPct=pct(r.wait,r.total);r.deadPct=pct(r.dead,r.total);r.productivity=r.active?+(r.closed/(r.active/3600000)).toFixed(3):0;r.processList=Object.keys(r.processes).map(function(p){return processTitle(p);}).sort().join(', ');r.traceQuality=r.synthetic?'Sin responsable trazado':(r.email||r.uid?'Alta: usuario trazado':'Nombre trazado');return r;})).filter(function(r){return !v231IsExcludedSuperAdmin(r);}).sort(function(a,b){return b.total-a.total;});
  var userProcessRows=Object.keys(byUP).map(function(k){var r=byUP[k];r.count=Object.keys(r.cases).length;r.avg=r.count?r.total/r.count:0;r.eff=pct(r.active,r.total);r.waitPct=pct(r.wait,r.total);r.deadPct=pct(r.dead,r.total);return r;}).filter(function(r){return !v231IsExcludedSuperAdmin(r);}).sort(function(a,b){return b.avg-a.avg;});
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
    ['% tiempo de espera acumulado',m.deadPct+'%','NVA sobre LT.','NVA/LT'],
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
function resetVsmFiltersBase(){
  ['fFrom','fTo','fProcess','fStatus','fUser','fSearch'].forEach(function(id){if($(id))$(id).value='';});
  if($('fOrderType'))$('fOrderType').value='';
  if($('fView'))$('fView').value='principal';
  refresh().catch(function(e){loading(false);status('Error limpiando filtros: '+esc(e.message||e),'bad');});
}
function renderTable(){
  var view=$('fView').value,m=app.metrics;if(!m)return;var html='',title='',count=0;
  if(view==='procesos'){
    title='Lead time por proceso';count=m.processRows.length;html=table(['Macroproceso','Casos','WIP','LT prom.','Total','Ocupación','Espera','NVA','% VA','% Espera','% tiempo de espera acumulado','Req. h','Cortes'],m.processRows.map(function(r){return '<tr><td>'+esc(r.label)+'</td><td>'+r.cases+'</td><td>'+r.wip+'</td><td>'+fmt(r.avg)+'</td><td>'+timeUnit(r.total)+'</td><td>'+timeUnit(r.active)+'</td><td>'+timeUnit(r.wait)+'</td><td>'+timeUnit(r.dead)+'</td><td>'+r.eff+'%</td><td>'+r.waitPct+'%</td><td>'+r.deadPct+'%</td><td>'+timeUnit(r.req)+'</td><td>'+r.doneCuts+'/'+r.cuts+'</td></tr>';}));
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
function fillFiltersBase(){var p=$('fProcess');p.innerHTML='<option value="">Todos</option>'+FLOW.map(function(k){return '<option value="'+k+'">'+esc(PROCESS[k])+'</option>';}).join('');var users={};app.cases.forEach(function(c){processStatsList(c).forEach(function(pr){personsForProcess(c,pr).forEach(function(person){if(person.synthetic)return;users[person.key]=person;});});});var u=$('fUser');u.innerHTML='<option value="">Todos</option>'+Object.keys(users).sort(function(a,b){return users[a].name.localeCompare(users[b].name);}).map(function(k){return '<option value="'+esc(k)+'">'+esc(users[k].name)+'</option>';}).join('');}

function caseMatchesBaseFiltersBase(c,includeStatus){
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
async function exportExcel(){if(!app.metrics)await refresh();var m=app.metrics,parts=[];loading(true,'Preparando Excel VSM completo...');parts.push('<html><head><meta charset="utf-8"><style>body{font-family:Century Gothic,Arial}table{border-collapse:collapse;margin-bottom:24px}th,td{border:1px solid #cbd5e1;padding:6px;font-size:12px}th{background:#061b46;color:#fff}.n{mso-number-format:"0.00"}</style></head><body>');parts.push('<h1>Dashboard VSM ERP · '+VERSION+' · Normalizado por día y separado Normal/PVE</h1><p>Exportado: '+xls(new Date().toLocaleString('es-CO'))+'</p><h2>Fórmulas y criterios</h2><table><tr><th>Indicador</th><th>Fórmula / lectura</th></tr>'+row(['Lead Time pedido','Fin real o corte del análisis - inicio real del pedido. Si faltan campos, se respalda con trazas/eventos y updatedAt.'])+row(['Lead Time normalizado por día','Lead Time acumulado del pedido dividido entre los días calendario que abarca el pedido. Sirve para leer horas reales por pedido/día.'])+row(['VSM normal / PVE','Los PVE se separan porque pasan por Compras y tienen una carga distinta; los demás pedidos se miden como flujo normal.'])+row(['Lead Time proceso','Tiempo transcurrido en cada macroproceso desde processStats + trazas + eventos + estado actual.'])+row(['VA','Tiempo activo registrado o inferido por eventos de trabajo / conformidad / cierre.'])+row(['Espera','Tiempos de espera por proceso + bloqueos + requerimientos + pago/separación.'])+row(['Requerimientos','Desde creación del requerimiento hasta respuesta/cierre o corte.'])+row(['Tiempo residual del proceso','Lead Time - trabajo directo - espera explícita, sin negativos.'])+row(['Eficiencia','VA / Lead Time.'])+row(['Cancelados/anulados','No se incluyen en Lead Time ni productividad. Se reportan en control independiente por tipo, proceso, asesor y soporte.'])+'</table>');
  parts.push('<h2>Resumen ejecutivo</h2><table><tr><th>Pedidos</th><th>Cerrados</th><th>WIP</th><th>Tipo VSM</th><th>LT hábil/día</th><th>Lead Time promedio total</th><th>P50 LT</th><th>P90 LT</th><th>Throughput cerrado/día</th><th>% VA</th><th>% Espera</th><th>% tiempo de espera acumulado</th><th>Requerimientos</th><th>Cancelados/anulados excluidos</th><th>Cuello principal</th><th>Datos incompletos</th></tr>'+row([m.cases,m.closed,m.wip,m.vsmType,fmt(m.leadDayAvg),fmt(m.leadAvg),fmt(m.leadP50),fmt(m.leadP90),m.throughput,m.eff+'%',m.waitPct+'%',m.deadPct+'%',m.reqCount,m.cancelTotal,m.bottleneck?m.bottleneck.label:'',m.incomplete])+'</table>');
  parts.push('<h2>VSM por proceso</h2><table><tr><th>Macroproceso</th><th>Casos</th><th>WIP</th><th>LT promedio</th><th>Horas total</th><th>VA h</th><th>Espera h</th><th>Tiempo residual del proceso h</th><th>Eficiencia</th><th>Req. h</th><th>Cortes</th></tr>');await appendRows(parts,m.processRows,function(r){return row([r.label,r.cases,r.wip,fmt(r.avg),timeUnit(r.total),timeUnit(r.active),timeUnit(r.wait),timeUnit(r.dead),r.eff+'%',timeUnit(r.req),r.doneCuts+'/'+r.cuts]);},30);parts.push('</table>');

  parts.push('<h2>Cobertura</h2><table><tr><th>Indicador</th><th>Cantidad</th></tr>'+row(['Total cargado',m.totalLoaded])+row(['Dentro del filtro',m.filteredTotal])+row(['Trazados VSM',m.cases])+row(['No trazados',m.notTraced])+row(['Cancelados/anulados',m.cancelTotal])+row(['Excluidos KPI',m.excludedKpi])+'</table>');
  parts.push('<h2>Resumen por área</h2><table><tr><th>Área</th><th>Casos</th><th>Intervenciones</th><th>WIP/abiertas</th><th>Cerrados</th><th>LT promedio</th><th>Trabajo</th><th>Bloqueo</th><th>No explicado</th><th>Cumplimiento</th><th>Confiabilidad</th><th>No entregas</th><th>Actores</th></tr>');
  await appendRows(parts,m.areaRows||[],function(r){return row([r.label,r.cases,r.area==='ventas'?(r.interventions||0):'',r.wip,r.closed,hours(r.avg),hours(r.work),hours(r.block),hours(r.unexplained),r.compliance+'%',r.reliability+'%',Number(r.noDeliveries||0),r.workers]);},25);
  parts.push('</table>');
  parts.push('<h2>Productividad por actor</h2><table><tr><th>Actor</th><th>Rol</th><th>Casos</th><th>WIP</th><th>Cerrados</th><th>Trabajo directo</th><th>Promedio directo</th><th>Cumplimiento</th><th>Productividad de cierre</th><th>Carga directa</th><th>Procesos</th></tr>');
  await appendRows(parts,m.actorRows||[],function(r){return row([r.user,roleTitle(r.role),r.count,r.open,r.closed,hours(r.active),hours(r.directPerCase),r.compliance+'%',r.productivity+'%',r.directLoadPct+'%',r.processList||'']);},25);
  parts.push('</table>');


  parts.push('<h2>Tiempos especiales de espera</h2><table><tr><th>Alcance</th><th>Espera en novedades</th><th>Espera en reproceso</th><th>Espera en no entregas</th><th>Novedades abiertas</th><th>Reprocesos abiertos</th><th>No entregas abiertas</th></tr>'+row([m.specialWait.scope.label,hours(m.specialWait.novelty),hours(m.specialWait.rework),hours(m.specialWait.noDelivery),m.specialWait.noveltyOpen,m.specialWait.reworkOpen,m.specialWait.noDeliveryOpen])+'</table>');
  parts.push('<h2>Trazabilidad de tiempos de espera</h2><table><tr><th>Pedido</th><th>Categoría</th><th>Área</th><th>Proceso</th><th>Inicio</th><th>Fin/corte</th><th>Duración</th><th>Abierto</th><th>Origen</th><th>Detalle</th></tr>');
  await appendRows(parts,m.specialWait.all||[],function(x){return row([x.pedido,x.category,v225AreaLabel(x.area),processTitle(x.process),dateTxt(x.start),dateTxt(x.end),hours(x.duration),x.open?'Sí':'No',x.source,x.detail]);},25);
  parts.push('</table>');
  parts.push('<h2>Demora exacta por pedido</h2><table><tr><th>Tipo</th><th>Pedido</th><th>OC</th><th>Cliente</th><th>Asesor</th><th>Proceso actual</th><th>Estado</th><th>Inicio</th><th>Fin/corte</th><th>LT hábil h/día</th><th>Lead Time total</th><th>Horas LT total</th><th>Días pedido</th><th>VA h/día</th><th>Espera h/día</th><th>Tiempo residual del proceso h/día</th><th>VA h total</th><th>Espera h total</th><th>Req. h</th><th>Tiempo residual del proceso h total</th><th>Eficiencia</th><th>Cuello pedido</th><th>Calidad dato</th></tr>');await appendRows(parts,m.caseRows,function(r){var c=r.c;return row([r.orderType,refOf(c),purchase(c),c.client||'',advisor(c),processTitle(c.currentProcess),c.status||'',dateTxt(r.start),r.closed?dateTxt(r.end):'Abierto · '+dateTxt(r.end),hours(r.leadPerDay),fmt(r.lead),hours(r.lead),r.orderDays,hours(r.vaPerDay),hours(r.waitPerDay),hours(r.deadPerDay),hours(r.va),timeUnit(r.wait),timeUnit(r.req),timeUnit(r.dead),pct(r.va,r.lead)+'%',r.bottleneck.label||'',r.missingStart?'Sin fecha base clara':'OK']);},25);parts.push('</table>');
  parts.push('<h2>Productividad por usuario</h2><table><tr><th>Usuario</th><th>Rol</th><th>Casos</th><th>Abiertos</th><th>Cerrados</th><th>LT prom.</th><th>Horas total</th><th>VA h</th><th>Espera h</th><th>Tiempo residual del proceso h</th><th>% VA</th><th>% Espera</th><th>Cerrados/h VA</th><th>Procesos trazados</th></tr>');await appendRows(parts,m.userRows,function(r){return row([r.user,roleTitle(r.role),r.count,r.open,r.closed,fmt(r.avg),timeUnit(r.total),timeUnit(r.active),timeUnit(r.wait),timeUnit(r.dead),r.eff+'%',r.waitPct+'%',r.productivity,r.processList||'']);},35);parts.push('</table>');parts.push('<h2>Detalle usuario por proceso</h2><table><tr><th>Usuario</th><th>Rol</th><th>Proceso</th><th>Casos</th><th>Abiertos</th><th>Cerrados</th><th>LT prom.</th><th>Horas total</th><th>VA h</th><th>Espera h</th><th>Tiempo residual del proceso h</th><th>% VA</th><th>% Espera</th><th>Req. h</th><th>Cortes</th></tr>');await appendRows(parts,m.userProcessRows,function(r){return row([r.user,roleTitle(r.role),r.label,r.count,r.open,r.closed,fmt(r.avg),timeUnit(r.total),timeUnit(r.active),timeUnit(r.wait),timeUnit(r.dead),r.eff+'%',r.waitPct+'%',timeUnit(r.req),Math.round(r.cuts)]);},35);parts.push('</table>');
  parts.push('<h2>Esperas, bloqueos y requerimientos</h2><table><tr><th>Pedido</th><th>Proceso</th><th>Desde</th><th>Hasta</th><th>Duración</th><th>Horas</th><th>Tipo</th><th>Usuario</th><th>Detalle</th></tr>');await appendRows(parts,m.waitRows,function(w){return row([w.pedido,w.proceso,dateTxt(w.desde),dateTxt(w.hasta),fmt(w.dur),hours(w.dur),w.tipo,w.usuario,w.detalle]);},35);parts.push('</table>');
  parts.push('<h2>Pedidos cancelados / anulados · control excluido del VSM operativo</h2><table><tr><th>Tipo</th><th>Pedido</th><th>OC</th><th>Cliente</th><th>Asesor</th><th>Tipo</th><th>Proceso donde se canceló</th><th>Fecha cancelación</th><th>Usuario</th><th>Motivo</th><th>PDF soporte</th></tr>');await appendRows(parts,m.cancelRows,function(r){return row([r.pedido,r.oc,r.cliente,r.asesor,r.tipo,r.procesoTxt,dateTxt(r.fecha),r.usuario,r.motivo,r.soporte?'Sí':'No']);},35);parts.push('</table>');
  parts.push('<h2>Cortes</h2><table><tr><th>Pedido</th><th>Cliente</th><th>Corte</th><th>Referencia</th><th>Metros</th><th>Estado</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>Horas</th><th>Modo</th><th>SIESA</th></tr>');await appendRows(parts,m.cutRows,function(x){return row([x.pedido,x.cliente,x.corte,x.referencia,x.metros,x.estado,x.responsable,dateTxt(x.inicio),dateTxt(x.fin),fmt(x.duracion),hours(x.duracion),x.modo,x.siesa]);},40);parts.push('</table></body></html>');
  var blob=new Blob(['\ufeff'].concat(parts),{type:'application/vnd.ms-excel;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='VSM_Centro_Operativo_V234_'+new Date().toISOString().slice(0,10)+'.xls';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);loading(false);status('Excel VSM '+VERSION+' generado correctamente con '+m.cases+' pedido(s).','ok');}

/* ============================================================
   V222 · Centro operativo VSM
============================================================ */
var V222_SLA_HOURS={
  compras:16,
  recepcion_pedidos:4,
  alistamiento:4,
  corte_cable:4,
  facturacion:2,
  caja:4,
  cliente_punto:2,
  cliente_recoge:8,
  despacho_local:8,
  despacho_nacional:16,
  cierre_despacho_nacional:4
};
var V222_NEXT_ACTION={
  compras:"Liberar compra o confirmar disponibilidad",
  recepcion_pedidos:"Validar soporte y enviar a alistamiento",
  alistamiento:"Completar picking, evidencias y liberar",
  corte_cable:"Iniciar, finalizar o registrar el corte",
  facturacion:"Emitir factura y anexar soporte",
  caja:"Validar pago o liberar retención",
  cliente_punto:"Confirmar entrega en punto",
  cliente_recoge:"Confirmar recogida del cliente",
  despacho_local:"Programar y confirmar entrega local",
  despacho_nacional:"Cargar guía y entregar a transportadora",
  cierre_despacho_nacional:"Cerrar entrega con evidencia"
};

function v222MsHours(h){return Math.max(0,Number(h)||0)*3600000;}
function v222Hours(ms){return (Math.max(0,Number(ms)||0)/3600000).toFixed((Number(ms)||0)<36000000?2:1)+" h";}
function v222Percentile(values,p){
  values=(values||[]).filter(function(v){return isFinite(v)&&v>=0;}).sort(function(a,b){return a-b;});
  if(!values.length)return 0;
  var idx=Math.min(values.length-1,Math.max(0,Math.ceil((p/100)*values.length)-1));
  return values[idx];
}
function v222Average(values){
  values=(values||[]).filter(function(v){return isFinite(v)&&v>=0;});
  return values.length?values.reduce(function(s,v){return s+v;},0)/values.length:0;
}
function v222ProcessMetricFromCase(cm,process){
  return (cm&&cm.pRows||[]).filter(function(p){return p.process===process;})[0]||null;
}
function v222CurrentProcessAge(c){
  var start=caseStartMs(c);
  if(!isFinite(start))start=tms(c.updatedAt)||nowMs();
  var end=caseEndMs(c,start);
  var p=c.currentProcess&&PROCESS[c.currentProcess]?c.currentProcess:"recepcion_pedidos";
  var pm=processMetric(c,p,start,end);
  return pm?pm.total:workingMsBetween(c.updatedAt||start,nowMs());
}
function v222Blocker(c){
  if(c.openRequirement)return c.openRequirement.reason||c.openRequirement.detail||"Requerimiento abierto";
  if(c.salesHold)return c.salesHold.reason||c.salesHold.status||"Retención financiera";
  if(c.separationRequest&&c.separationRequest.active!==false)return c.separationRequest.reason||c.separationRequest.status||"Pago pendiente";
  if(c.waitStartedAt)return "Pedido en espera";
  var cuts=(c.cutRequests||[]).filter(function(x){return !(x.status==="FINALIZADO"||x.registeredAt||x.noCutNeeded||x.measureComplete||x.medidaCompleta);});
  if(cuts.length)return cuts.length+" corte(s) pendiente(s)";
  return "Sin bloqueo explícito";
}
function v222Responsible(c){
  return c.assignedName||c.assignedEmail||advisor(c)||"Sin responsable trazado";
}
function v222SlaHoursForProcess(p){
  var custom=Number(($("fThreshold")&&$("fThreshold").value)||0);
  var selected=($("fProcess")&&$("fProcess").value)||"";
  if(custom>0 && (!selected||selected===p))return custom;
  return V222_SLA_HOURS[p]||8;
}
function v222ClosedDay(cm){
  if(!cm||!cm.closed)return "";
  var d=toDate(cm.end);
  return d?isoLocalDay(d):"";
}
function v222CountBy(rows,keyFn){
  var out={};
  (rows||[]).forEach(function(r){var k=keyFn(r);if(k)out[k]=(out[k]||0)+1;});
  return out;
}
function v222FilterSummary(){
  var parts=[];
  if($("fFrom").value||$("fTo").value)parts.push("Fecha "+($("fFrom").value||"inicio")+" a "+($("fTo").value||"hoy"));
  if($("fOrderType").value)parts.push($("fOrderType").value==="pve"?"PVE":"Normal");
  if($("fProcess").value)parts.push(processTitle($("fProcess").value));
  if($("fStatus").value)parts.push($("fStatus").options[$("fStatus").selectedIndex].text);
  if($("fSla").value)parts.push($("fSla").value==="late"?"Fuera de meta":"Dentro de meta");
  if($("fUser").value)parts.push($("fUser").options[$("fUser").selectedIndex].text);
  if(clean($("fSearch").value))parts.push('Búsqueda "'+clean($("fSearch").value)+'"');
  $("filterSummary").textContent=parts.length?parts.join(" · "):"Vista general sin filtros restrictivos.";
}

async function computeV225Base(cases,cancelledCases){
  await computeBase(cases,cancelledCases);
  var m=app.metrics;if(!m)return;

  var durations={},completedDurations={},wipRows=[],pickingRows=[],alerts=[];
  FLOW.forEach(function(p){durations[p]=[];completedDurations[p]=[];});

  m.caseRows.forEach(function(cm){
    (cm.pRows||[]).forEach(function(pm){
      durations[pm.process]=durations[pm.process]||[];
      durations[pm.process].push(pm.total);
      if(!pm.wip){
        completedDurations[pm.process]=completedDurations[pm.process]||[];
        completedDurations[pm.process].push(pm.total);
      }
      if(pm.process==="alistamiento"){
        pickingRows.push({
          pedido:refOf(cm.c),
          oc:purchase(cm.c),
          cliente:cm.c.client||"",
          responsable:v222Responsible(cm.c),
          estado:cm.c.status||"",
          total:pm.total,
          active:pm.active,
          wait:pm.wait,
          dead:pm.dead,
          inicio:pm.start,
          fin:pm.finish,
          cerrado:!pm.wip,
          slaHours:v222SlaHoursForProcess("alistamiento"),
          late:pm.total>v222MsHours(v222SlaHoursForProcess("alistamiento"))
        });
      }
    });

    if(!cm.closed){
      var p=cm.c.currentProcess&&PROCESS[cm.c.currentProcess]?cm.c.currentProcess:"recepcion_pedidos";
      var pm=v222ProcessMetricFromCase(cm,p);
      var age=pm?pm.total:v222CurrentProcessAge(cm.c);
      var sla=v222SlaHoursForProcess(p),late=age>v222MsHours(sla);
      var row={
        c:cm.c,pedido:refOf(cm.c),oc:purchase(cm.c),cliente:cm.c.client||"",
        process:p,processLabel:processTitle(p),responsable:v222Responsible(cm.c),
        age:age,slaHours:sla,late:late,blocker:v222Blocker(cm.c),
        next:V222_NEXT_ACTION[p]||"Revisar siguiente acción",
        lead:cm.lead,wait:cm.wait,va:cm.va,dead:cm.dead
      };
      wipRows.push(row);
      if(late){
        alerts.push({severity:"bad",pedido:row.pedido,proceso:row.processLabel,detalle:"Fuera de meta por "+v222Hours(age-v222MsHours(sla)),accion:row.next,age:age});
      }else if(row.blocker!=="Sin bloqueo explícito"){
        alerts.push({severity:"warn",pedido:row.pedido,proceso:row.processLabel,detalle:row.blocker,accion:row.next,age:age});
      }
    }

    if(cm.missingStart){
      alerts.push({severity:"warn",pedido:refOf(cm.c),proceso:processTitle(cm.c.currentProcess),detalle:"Fecha inicial incompleta",accion:"Corregir trazabilidad del pedido",age:0});
    }
  });

  m.waitRows.filter(function(w){return w.dur>v222MsHours(4);}).slice(0,30).forEach(function(w){
    alerts.push({severity:"warn",pedido:w.pedido,proceso:w.proceso,detalle:w.tipo+" · "+v222Hours(w.dur),accion:"Resolver bloqueo o requerimiento",age:w.dur});
  });

  var procMap={};
  m.processRows.forEach(function(r){procMap[r.process]=r;});
  FLOW.forEach(function(p){
    var r=procMap[p];
    if(!r){
      r={process:p,label:processTitle(p),cases:0,wip:0,active:0,wait:0,dead:0,total:0,req:0,cuts:0,doneCuts:0,avg:0,eff:0,waitPct:0,deadPct:0};
      m.processRows.push(r);procMap[p]=r;
    }
    var all=durations[p]||[],done=completedDurations[p]||all;
    r.p50=v222Percentile(done,50);
    r.p90=v222Percentile(done,90);
    r.min=done.length?Math.min.apply(Math,done):0;
    r.max=done.length?Math.max.apply(Math,done):0;
    r.slaHours=v222SlaHoursForProcess(p);
    r.slaCount=done.length;
    r.slaOk=done.filter(function(v){return v<=v222MsHours(r.slaHours);}).length;
    r.slaPct=done.length?Math.round((r.slaOk/done.length)*100):0;
    var pw=wipRows.filter(function(x){return x.process===p;});
    r.wip=pw.length;
    r.wipLate=pw.filter(function(x){return x.late;}).length;
    r.wipAgeAvg=v222Average(pw.map(function(x){return x.age;}));
    r.wipAgeMax=pw.length?Math.max.apply(Math,pw.map(function(x){return x.age;})):0;
    r.flowIndex=FLOW.indexOf(p);
  });
  m.processRows.sort(function(a,b){return a.flowIndex-b.flowIndex;});

  m.wipRows=wipRows.sort(function(a,b){return Number(b.late)-Number(a.late)||b.age-a.age;});
  m.lateWip=m.wipRows.filter(function(x){return x.late;}).length;
  m.pickingRows=pickingRows.sort(function(a,b){return b.total-a.total;});
  m.pickingAvg=v222Average(pickingRows.map(function(x){return x.total;}));
  m.pickingP50=v222Percentile(pickingRows.map(function(x){return x.total;}),50);
  m.pickingP90=v222Percentile(pickingRows.map(function(x){return x.total;}),90);
  m.pickingLate=pickingRows.filter(function(x){return x.late;}).length;

  var physicalCuts=m.cutRows.filter(function(x){return x.modo==="Corte físico"&&x.duracion>0;});
  m.physicalCutAvg=v222Average(physicalCuts.map(function(x){return x.duracion;}));
  m.physicalCutP50=v222Percentile(physicalCuts.map(function(x){return x.duracion;}),50);
  m.physicalCutP90=v222Percentile(physicalCuts.map(function(x){return x.duracion;}),90);
  m.physicalCuts=physicalCuts.length;

  var closedSeries=v222CountBy(m.caseRows.filter(function(r){return r.closed;}).map(function(r){return {day:v222ClosedDay(r)};}),function(x){return x.day;});
  m.throughputSeries=Object.keys(closedSeries).sort().slice(-20).map(function(day){return {day:day,count:closedSeries[day]};});

  var buckets={"0–2 h":0,"2–4 h":0,"4–8 h":0,"> 8 h":0};
  m.wipRows.forEach(function(r){
    var h=r.age/3600000;
    if(h<=2)buckets["0–2 h"]++;
    else if(h<=4)buckets["2–4 h"]++;
    else if(h<=8)buckets["4–8 h"]++;
    else buckets["> 8 h"]++;
  });
  m.wipBuckets=Object.keys(buckets).map(function(k){return {label:k,count:buckets[k]};});
  m.alertRows=alerts.sort(function(a,b){return (a.severity==="bad"?0:1)-(b.severity==="bad"?0:1)||b.age-a.age;}).slice(0,80);
  m.dataQualityPct=m.cases?Math.max(0,Math.round(((m.cases-m.incomplete)/m.cases)*100)):100;
}

function v222Kpi(title,value,detail,kind,tag){
  return '<article class="card kpi '+(kind||'')+'"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small>'+(tag?'<em class="tag">'+esc(tag)+'</em>':'')+'</article>';
}
function v222Focus(process,title,mainLabel){
  var m=app.metrics,r=(m.processRows||[]).filter(function(x){return x.process===process;})[0]||{};
  return '<article class="card focus-card"><h3>'+esc(title)+'</h3><div class="focus-main">'+esc(mainLabel||v222Hours(r.avg||0))+'</div>'+
    '<small class="muted">Promedio en horas laborales</small>'+
    '<div class="focus-row"><div><span>P50</span><strong>'+v222Hours(r.p50||0)+'</strong></div><div><span>P90</span><strong>'+v222Hours(r.p90||0)+'</strong></div><div><span>WIP</span><strong>'+Number(r.wip||0)+'</strong></div></div></article>';
}
function renderSummaryV225Base(){
  var m=app.metrics;if(!m)return;
  $("summary").innerHTML=
    v222Kpi("WIP actual",m.wip,m.lateWip+" fuera de meta",m.lateWip?"bad":"ok","Pedidos abiertos")+
    v222Kpi("Cerrados",m.closed,"Pedidos completados en el filtro","ok","Throughput "+m.throughput+"/día")+
    v222Kpi("Lead Time promedio",v222Hours(m.leadAvg),"Tiempo laboral total por pedido","","P50 "+v222Hours(m.leadP50))+
    v222Kpi("Tiempo de picking",v222Hours(m.pickingAvg),m.pickingRows.length+" pedidos con alistamiento",m.pickingLate?"warn":"ok","P90 "+v222Hours(m.pickingP90))+
    v222Kpi("Corte físico promedio",v222Hours(m.physicalCutAvg),m.physicalCuts+" cortes físicos","","P90 "+v222Hours(m.physicalCutP90))+
    v222Kpi("Espera promedio",v222Hours(m.waitAvg),"Bloqueos, requerimientos y pausas",m.waitPct>35?"bad":"warn",m.waitPct+"% del LT")+
    v222Kpi("Eficiencia VA",m.eff+"%","Tiempo efectivo frente al Lead Time",m.eff>=60?"ok":(m.eff>=40?"warn":"bad"),"NVA "+m.deadPct+"%")+
    v222Kpi("Calidad de trazabilidad",m.dataQualityPct+"%",m.incomplete+" pedido(s) requieren revisión",m.incomplete?"warn":"ok","Base "+m.cases);

  $("operationalFocus").innerHTML=
    v222Focus("alistamiento","Picking / alistamiento",v222Hours(m.pickingAvg))+
    v222Focus("corte_cable","Corte de cable",v222Hours(((m.processRows||[]).filter(function(x){return x.process==="corte_cable";})[0]||{}).avg||0))+
    v222Focus("recepcion_pedidos","Recepción de pedidos")+
    v222Focus("facturacion","Facturación");

  var bottle=m.bottleneck||{};
  $("bottleneck").innerHTML=bottle.label
    ? '<strong>'+esc(bottle.label)+'</strong><p class="muted">Promedio: '+v222Hours(bottle.avg||0)+' · WIP: '+Number(bottle.wip||0)+' · Espera: '+Number(bottle.waitPct||0)+'%</p>'
    : '<span class="muted">Sin datos suficientes.</span>';

  $("quickBars").innerHTML='<article class="chart-card"><h3>Composición total del tiempo</h3>'+stackTime(m)+'</article>';
  $("ltProductivityAnalysis").innerHTML='<div class="filter-summary"><strong>'+esc(m.vsmType)+'</strong> · '+m.cases+' pedidos analizados · '+m.cancelTotal+' cancelados/anulados excluidos · '+m.notTraced+' no trazados.</div>';
  $("deepKpis").innerHTML=
    v222Kpi("Requerimientos",m.reqCount,m.reqRate+"% de pedidos con requerimiento",m.reqRate>25?"warn":"")+
    v222Kpi("Novedades pendientes",m.reportPending,m.reportCount+" novedades/reportes analizados",m.reportPending?"warn":"ok")+
    v222Kpi("Cortes registrados",m.doneCuts+" / "+m.totalCuts,"Cumplimiento del módulo de Corte",m.totalCuts&&m.doneCuts<m.totalCuts?"warn":"ok");
  v222FilterSummary();
  renderProcessFlow();
  renderPowerCharts();
  renderAlerts();
}
function renderProcessFlowV225Base(){
  var m=app.metrics;if(!m)return;
  $("processFlow").innerHTML=(m.processRows||[]).map(function(r){
    var late=r.wipLate>0,compliance=r.slaCount?r.slaPct:0;
    return '<article class="process-card '+(late?'late':'')+'">'+
      '<div class="process-title"><h3>'+esc(r.label)+'</h3><b>Meta '+r.slaHours+' h</b></div>'+
      '<div class="process-main"><div><span>Promedio laboral</span><strong>'+v222Hours(r.avg||0)+'</strong></div><div><span>WIP</span><strong>'+Number(r.wip||0)+'</strong></div></div>'+
      '<div class="process-stats"><div><span>P50</span><b>'+v222Hours(r.p50||0)+'</b></div><div><span>P90</span><b>'+v222Hours(r.p90||0)+'</b></div><div><span>Atrasados</span><b>'+Number(r.wipLate||0)+'</b></div></div>'+
      '<div class="progress"><i style="width:'+Math.max(0,Math.min(100,compliance))+'%"></i></div>'+
      '<small class="muted">Cumplimiento: '+compliance+'% · '+Number(r.cases||0)+' caso(s)</small>'+
    '</article>';
  }).join('');
}
function v222ChartRows(rows,valueFn,labelFn,metaFn,classFn){
  rows=rows||[];var max=rows.reduce(function(a,r){return Math.max(a,Number(valueFn(r))||0);},0)||1;
  return rows.map(function(r){
    var v=Number(valueFn(r))||0;
    return '<div class="chart-row"><b title="'+esc(labelFn(r))+'">'+esc(labelFn(r))+'</b><div class="chart-track"><i class="'+(classFn?classFn(r):'')+'" style="width:'+Math.max(2,Math.min(100,(v/max)*100))+'%"></i></div><span>'+esc(metaFn(r))+'</span></div>';
  }).join('')||'<p class="muted">Sin datos suficientes.</p>';
}
function renderPowerChartsV225Base(){
  var m=app.metrics;if(!m)return;
  var proc=(m.processRows||[]).filter(function(r){return r.cases||r.wip;});
  var wip=proc.slice().sort(function(a,b){return b.wip-a.wip;});
  var throughput=m.throughputSeries||[];
  $("powerCharts").innerHTML=
    '<article class="chart-card"><h3>Tiempo promedio por proceso</h3>'+v222ChartRows(proc,function(r){return r.avg;},function(r){return r.label;},function(r){return v222Hours(r.avg);})+'</article>'+
    '<article class="chart-card"><h3>WIP por proceso</h3>'+v222ChartRows(wip,function(r){return r.wip;},function(r){return r.label;},function(r){return r.wip+" · "+r.wipLate+" atras.";},function(r){return r.wipLate?"bad":"ok";})+'</article>'+
    '<article class="chart-card"><h3>Cumplimiento de meta</h3>'+v222ChartRows(proc,function(r){return r.slaPct;},function(r){return r.label;},function(r){return r.slaPct+"%";},function(r){return r.slaPct>=80?"ok":(r.slaPct>=60?"warn":"bad");})+'</article>'+
    '<article class="chart-card"><h3>Throughput diario</h3>'+v222ChartRows(throughput,function(r){return r.count;},function(r){return r.day;},function(r){return r.count+" cierre(s)";},function(){return "ok";})+'</article>'+
    '<article class="chart-card"><h3>Antigüedad del WIP</h3>'+v222ChartRows(m.wipBuckets,function(r){return r.count;},function(r){return r.label;},function(r){return r.count+" pedido(s)";},function(r){return r.label==="> 8 h"?"bad":(r.label==="4–8 h"?"warn":"ok");})+'</article>'+
    '<article class="chart-card"><h3>Distribución VA / espera / NVA</h3>'+stackTime(m)+'<div class="legend"><span><i class="dot va"></i>VA '+m.eff+'%</span><span><i class="dot wait"></i>Espera '+m.waitPct+'%</span><span><i class="dot dead"></i>NVA '+m.deadPct+'%</span></div></article>';
}
function renderAlertsV225Base(){
  var m=app.metrics;if(!m)return;
  var rows=(m.alertRows||[]).slice(0,30);
  $("alertsBoard").innerHTML=rows.length
    ? '<div class="alert-list">'+rows.map(function(a){
        return '<div class="alert-item '+a.severity+'"><div><strong>'+esc(a.pedido||"Sin pedido")+'</strong><small>'+esc(a.proceso||"")+'</small></div><div><strong>'+esc(a.detalle||"")+'</strong><small>'+esc(a.accion||"")+'</small></div><span class="badge '+a.severity+'">'+(a.severity==="bad"?"Prioridad alta":"Revisar")+'</span></div>';
      }).join('')+'</div>'
    : '<p class="muted">No hay alertas operativas con los filtros actuales.</p>';
}
function v222StatusBadge(late){
  return late?'<span class="badge bad">Fuera de meta</span>':'<span class="badge ok">Dentro de meta</span>';
}
function v222Table(headers,rows){
  return '<div class="table-wrap"><table>'+table(headers,rows)+'</table></div>';
}
function renderTableV225Base(){
  var m=app.metrics;if(!m)return;
  var view=$("fView").value,title="",count=0,html="";
  if(view==="procesos"){
    title="Rendimiento por proceso";count=m.processRows.length;
    html=v222Table(["Proceso","Casos","WIP","Atrasados","Promedio h","P50 h","P90 h","Meta h","Cumplimiento","Espera","NVA"],m.processRows.map(function(r){
      return '<tr><td><strong>'+esc(r.label)+'</strong></td><td>'+r.cases+'</td><td>'+r.wip+'</td><td>'+r.wipLate+'</td><td>'+v222Hours(r.avg)+'</td><td>'+v222Hours(r.p50)+'</td><td>'+v222Hours(r.p90)+'</td><td>'+r.slaHours+'</td><td>'+r.slaPct+'%</td><td>'+r.waitPct+'%</td><td>'+r.deadPct+'%</td></tr>';
    }));
  }else if(view==="picking"){
    title="Picking / alistamiento";count=m.pickingRows.length;
    html=v222Table(["Pedido","OC","Cliente","Responsable","Estado","Inicio","Fin","Tiempo picking","Ocupación","Espera","NVA","Meta"],m.pickingRows.slice(0,800).map(function(r){
      return '<tr><td><strong>'+esc(r.pedido)+'</strong></td><td>'+esc(r.oc)+'</td><td>'+esc(r.cliente)+'</td><td>'+esc(r.responsable)+'</td><td>'+esc(r.estado)+'</td><td>'+esc(dateTxt(r.inicio))+'</td><td>'+esc(r.cerrado?dateTxt(r.fin):"En curso")+'</td><td><strong>'+v222Hours(r.total)+'</strong></td><td>'+v222Hours(r.active)+'</td><td>'+v222Hours(r.wait)+'</td><td>'+v222Hours(r.dead)+'</td><td>'+v222StatusBadge(r.late)+'</td></tr>';
    }));
  }else if(view==="cortes"){
    title="Detalle de cortes";count=m.cutRows.length;
    html=v222Table(["Pedido","Cliente","Corte","Referencia","Metros","Estado","Responsable","Inicio","Fin","Duración","Modo","SIESA"],m.cutRows.slice(0,1000).map(function(x){
      return '<tr><td><strong>'+esc(x.pedido)+'</strong></td><td>'+esc(x.cliente)+'</td><td>'+esc(x.corte)+'</td><td>'+esc(x.referencia)+'</td><td>'+esc(x.metros)+'</td><td>'+esc(x.estado)+'</td><td>'+esc(x.responsable)+'</td><td>'+esc(dateTxt(x.inicio))+'</td><td>'+esc(dateTxt(x.fin))+'</td><td><strong>'+v222Hours(x.duracion)+'</strong></td><td>'+esc(x.modo)+'</td><td>'+esc(x.siesa)+'</td></tr>';
    }));
  }else if(view==="usuarios"){
    title="Productividad por usuario";count=m.userRows.length;
    html=v222Table(["Usuario","Rol","Casos","Abiertos","Cerrados","Promedio","Ocupación","Espera","NVA","% VA","Procesos"],m.userRows.map(function(r){
      return '<tr><td><strong>'+esc(r.user)+'</strong></td><td>'+esc(roleTitle(r.role))+'</td><td>'+r.count+'</td><td>'+r.open+'</td><td>'+r.closed+'</td><td>'+v222Hours(r.avg)+'</td><td>'+v222Hours(r.active)+'</td><td>'+v222Hours(r.wait)+'</td><td>'+v222Hours(r.dead)+'</td><td>'+r.eff+'%</td><td>'+esc(r.processList||"")+'</td></tr>';
    }));
  }else if(view==="usuario_proceso"){
    title="Usuario por proceso";count=m.userProcessRows.length;
    html=v222Table(["Usuario","Rol","Proceso","Casos","Abiertos","Cerrados","Promedio","Ocupación","Espera","NVA","% VA"],m.userProcessRows.map(function(r){
      return '<tr><td><strong>'+esc(r.user)+'</strong></td><td>'+esc(roleTitle(r.role))+'</td><td>'+esc(r.label)+'</td><td>'+r.count+'</td><td>'+r.open+'</td><td>'+r.closed+'</td><td>'+v222Hours(r.avg)+'</td><td>'+v222Hours(r.active)+'</td><td>'+v222Hours(r.wait)+'</td><td>'+v222Hours(r.dead)+'</td><td>'+r.eff+'%</td></tr>';
    }));
  }else if(view==="pedidos"){
    title="Todos los pedidos";count=m.caseRows.length;
    html=v222Table(["Tipo","Pedido","OC","Cliente","Proceso actual","Estado","LT laboral","Ocupación","Espera","NVA","Eficiencia","Cuello","QA"],m.caseRows.slice(0,900).map(function(r){
      var c=r.c;
      return '<tr><td><span class="pill">'+esc(r.orderType)+'</span></td><td><strong>'+esc(refOf(c))+'</strong></td><td>'+esc(purchase(c))+'</td><td>'+esc(c.client||"")+'</td><td>'+esc(processTitle(c.currentProcess))+'</td><td>'+esc(c.status||"")+'</td><td><strong>'+v222Hours(r.lead)+'</strong></td><td>'+v222Hours(r.va)+'</td><td>'+v222Hours(r.wait)+'</td><td>'+v222Hours(r.dead)+'</td><td>'+pct(r.va,r.lead)+'%</td><td>'+esc(r.bottleneck.label||"")+'</td><td>'+(r.missingStart?'<span class="badge warn">Revisar</span>':'<span class="badge ok">OK</span>')+'</td></tr>';
    }));
  }else if(view==="novedades"){
    title="Novedades y reportes";count=m.reportRows.length;
    html=v222Table(["Pedido","Cliente","Novedad","Estado","Criticidad","Actualizaciones","Primera respuesta","Tiempo respuesta","Tiempo cierre"],m.reportRows.slice(0,800).map(function(r){
      return '<tr><td><strong>'+esc(r.pedido||"")+'</strong></td><td>'+esc(r.cliente||"")+'</td><td>'+esc(r.title||"")+'</td><td>'+esc(r.status||"")+'</td><td>'+esc(r.severity||"")+'</td><td>'+r.updates+'</td><td>'+(r.pending?'<span class="badge warn">Pendiente</span>':esc(dateTxt(r.firstResponse)))+'</td><td><strong>'+v222Hours(r.responseMs)+'</strong></td><td>'+v222Hours(r.closeMs)+'</td></tr>';
    }));
  }else if(view==="cancelados"){
    title="Cancelados y anulados";count=m.cancelRows.length;
    html=v222Table(["Pedido","OC","Cliente","Asesor","Tipo","Proceso","Fecha","Usuario","Motivo","Soporte"],m.cancelRows.map(function(r){
      return '<tr><td><strong>'+esc(r.pedido)+'</strong></td><td>'+esc(r.oc)+'</td><td>'+esc(r.cliente)+'</td><td>'+esc(r.asesor)+'</td><td>'+esc(r.tipo)+'</td><td>'+esc(r.procesoTxt)+'</td><td>'+esc(dateTxt(r.fecha))+'</td><td>'+esc(r.usuario)+'</td><td>'+esc(r.motivo)+'</td><td>'+(r.soporte?'<a href="'+esc(r.soporte)+'" target="_blank" rel="noopener">Abrir</a>':'—')+'</td></tr>';
    }));
  }else if(view==="not_traced"){
    title="No trazados / QA";count=m.notTracedRows.length;
    html=v222Table(["Pedido","Cliente","Estado","Proceso","Motivo"],m.notTracedRows.map(function(r){
      return '<tr><td><strong>'+esc(r.pedido||"")+'</strong></td><td>'+esc(r.cliente||"")+'</td><td>'+esc(r.estado||"")+'</td><td>'+esc(r.proceso||"")+'</td><td>'+esc(r.motivo||"")+'</td></tr>';
    }));
  }else{
    var rows=view==="wip"?m.wipRows:m.wipRows;
    title=view==="wip"?"WIP y atrasos":"Centro operativo · pedidos en curso";count=rows.length;
    html=v222Table(["Pedido","OC","Cliente","Proceso","Responsable","Tiempo en proceso","Meta","Cumplimiento","Bloqueo","Próxima acción","LT total"],rows.slice(0,900).map(function(r){
      return '<tr><td><strong>'+esc(r.pedido)+'</strong></td><td>'+esc(r.oc)+'</td><td>'+esc(r.cliente)+'</td><td>'+esc(r.processLabel)+'</td><td>'+esc(r.responsable)+'</td><td><strong>'+v222Hours(r.age)+'</strong></td><td>'+r.slaHours+' h</td><td>'+v222StatusBadge(r.late)+'</td><td>'+esc(r.blocker)+'</td><td>'+esc(r.next)+'</td><td>'+v222Hours(r.lead)+'</td></tr>';
    }));
  }
  $("tableTitle").textContent=title;
  $("rowCount").textContent=count+" fila(s) · "+m.cases+" pedidos analizados";
  $("mainTable").innerHTML=html;
}
function resetVsmFiltersV225Base(){
  resetVsmFiltersBase();
  $("fSla").value="";
  $("fThreshold").value="8";
  $("fView").value="principal";
  document.querySelectorAll("[data-range]").forEach(function(b){b.classList.remove("active");});
  v222FilterSummary();
}
function caseMatchesBaseFiltersV225Base(c,includeStatus){
  if(!caseMatchesBaseFiltersBase(c,includeStatus))return false;
  var slaFilter=$("fSla").value;
  if(!slaFilter||isCancelledVsm(c)||isClosed(c))return true;
  var age=v222CurrentProcessAge(c);
  var p=c.currentProcess&&PROCESS[c.currentProcess]?c.currentProcess:"recepcion_pedidos";
  var late=age>v222MsHours(v222SlaHoursForProcess(p));
  return slaFilter==="late"?late:!late;
}
function fillFiltersV225Base(){
  fillFiltersBase();
  var p=$("fProcess");
  if(p&&!p.getAttribute("data-v222")){
    p.setAttribute("data-v222","1");
    p.addEventListener("change",function(){
      var key=p.value;
      if(key&&V222_SLA_HOURS[key])$("fThreshold").value=V222_SLA_HOURS[key];
    });
  }
}
function v222SetRange(mode){
  var today=new Date(),from=null,to=new Date(today);
  if(mode==="today")from=new Date(today);
  else if(mode==="7"){from=new Date(today);from.setDate(from.getDate()-6);}
  else if(mode==="30"){from=new Date(today);from.setDate(from.getDate()-29);}
  else if(mode==="month")from=new Date(today.getFullYear(),today.getMonth(),1);
  else if(mode==="all"){from=null;to=null;}
  if(from)$("fFrom").value=isoLocalDay(from);else $("fFrom").value="";
  if(to)$("fTo").value=isoLocalDay(to);else $("fTo").value="";
  document.querySelectorAll("[data-range]").forEach(function(b){b.classList.toggle("active",b.getAttribute("data-range")===mode);});
  refresh().catch(function(e){loading(false);status("Error filtrando: "+esc(e.message||e),"bad");});
}
function bindV225Base(){
  bindBase();
  ["fSla","fThreshold"].forEach(function(id){
    $(id).addEventListener("change",function(){refresh().catch(function(e){loading(false);status("Error recalculando: "+esc(e.message||e),"bad");});});
  });
  document.querySelectorAll("[data-range]").forEach(function(btn){
    btn.addEventListener("click",function(){v222SetRange(btn.getAttribute("data-range"));});
  });
  $("btnApply").onclick=function(){refresh().catch(function(e){loading(false);status("Error aplicando filtros: "+esc(e.message||e),"bad");});};
  $("btnOnlyWip").onclick=function(){
    $("fStatus").value="open";$("fSla").value="";$("fView").value="wip";
    refresh().catch(function(e){loading(false);status("Error filtrando WIP: "+esc(e.message||e),"bad");});
  };
  $("btnDelayed").onclick=function(){
    $("fStatus").value="open";$("fSla").value="late";$("fView").value="wip";
    refresh().catch(function(e){loading(false);status("Error filtrando atrasados: "+esc(e.message||e),"bad");});
  };
}


/* ============================================================
   V225 · V222 MEJORADO: TOTAL, ÁREAS, ACTORES Y CONFIABILIDAD
============================================================ */
var V225_AREA_DEF={
  ventas:{label:"Ventas",processes:[]},
  compras:{label:"Compras",processes:["compras"]},
  logistica:{label:"Logística",processes:["recepcion_pedidos","alistamiento","corte_cable"]},
  facturacion:{label:"Facturación",processes:["facturacion"]},
  cartera:{label:"Cartera / Caja",processes:["caja"]},
  despacho:{label:"Despacho",processes:["cliente_punto","cliente_recoge","despacho_local","despacho_nacional","cierre_despacho_nacional"]}
};
var V225_AREA_ORDER=["ventas","compras","logistica","facturacion","cartera","despacho"];
var V225_PROCESS_AREA={
  compras:"compras",recepcion_pedidos:"logistica",alistamiento:"logistica",corte_cable:"logistica",
  facturacion:"facturacion",caja:"cartera",cliente_punto:"despacho",cliente_recoge:"despacho",
  despacho_local:"despacho",despacho_nacional:"despacho",cierre_despacho_nacional:"despacho"
};

function v225AreaLabel(a){return (V225_AREA_DEF[a]&&V225_AREA_DEF[a].label)||a||"Sin área";}
function v225AreaForProcess(p){return V225_PROCESS_AREA[p]||"";}
function v225Mean(v){v=(v||[]).filter(function(x){return isFinite(x)&&x>=0;});return v.length?v.reduce(function(s,x){return s+x;},0)/v.length:0;}
function v226PeriodWindow(m){
  m=m||{};
  var from=$("fFrom")&&$("fFrom").value;
  var to=$("fTo")&&$("fTo").value;
  var starts=(m.caseRows||[]).map(function(r){return Number(r.start);}).filter(isFinite);
  var ends=(m.caseRows||[]).map(function(r){return Number(r.end);}).filter(isFinite);
  var start=from?new Date(from+"T07:00:00").getTime():(starts.length?Math.min.apply(Math,starts):NaN);
  var end=to?new Date(to+"T17:30:00").getTime():(ends.length?Math.max.apply(Math,ends):nowMs());
  if(!isFinite(start))start=nowMs()-(30*86400000);
  if(!isFinite(end)||end<=start)end=nowMs();
  var hours=workingMsBetween(start,end)/3600000;
  if(!isFinite(hours)||hours<=0)hours=1;
  return {
    start:start,
    end:end,
    hours:hours,
    days:Math.max(1,hours/(8+(50/60)))
  };
}
function v225Median(v){return v222Percentile(v,50);}
function v225Time(ms){return v222Hours(ms);}
function v225Pct(a,b){return b>0?Math.round((a/b)*100):0;}
function v225Status(value,good,warn){
  if(value>=good)return {cls:"ok",label:"Adecuado"};
  if(value>=warn)return {cls:"warn",label:"Atención"};
  return {cls:"bad",label:"Crítico"};
}
function v225AreaTouches(c,area){
  if(!area)return true;
  if(area==="ventas")return !!(c.salesAdvisor||c.createdBy||c.createdByName||c.createdByEmail);
  var def=V225_AREA_DEF[area]||{processes:[]},ps=c.processStats||{};
  return def.processes.some(function(p){return c.currentProcess===p||!!ps[p]||(p==="corte_cable"&&(c.cutRequests||[]).length>0);});
}
function v225CountRework(c){
  var txt=lower(JSON.stringify([c.history||[],c.flowTrace||[],c.requirements||[],c.openRequirement||{},c.status||""]));
  var hits=0;
  ["devuelto","devolucion","reproceso","retrabajo","corregir","rechazado","no conforme","pendiente correccion"].forEach(function(k){
    if(txt.indexOf(k)>=0)hits++;
  });
  return hits;
}
function v225ReliabilityForCase(cm){
  var c=cm.c,score=100,issues=[];
  if(cm.missingStart){score-=20;issues.push("sin fecha inicial");}
  if(!(c.updatedAt||c.closedAt||c.completedAt)){score-=10;issues.push("sin actualización final");}
  if(!c.currentProcess){score-=15;issues.push("sin proceso");}
  if(!c.status){score-=10;issues.push("sin estado");}
  if(!c.assignedRole&&!c.assignedName){score-=10;issues.push("sin responsable");}
  if((c.cutRequests||[]).length && !(c.cutRequests||[]).every(function(x){return x.status||x.registeredAt||x.noCutNeeded||x.medidaCompleta;})){score-=10;issues.push("corte incompleto");}
  var rework=v225CountRework(c);if(rework){score-=Math.min(20,rework*5);issues.push("reproceso/devolución");}
  return {score:Math.max(0,score),issues:issues,rework:rework};
}
function v225BuildAreaRows(m){
  return V225_AREA_ORDER.map(function(area){
    var def=V225_AREA_DEF[area],caseRows=(m.caseRows||[]).filter(function(cm){
      return area==="ventas" || (cm.pRows||[]).some(function(p){return def.processes.indexOf(p.process)>=0;});
    });
    if(!caseRows.length)return null;
    var procRows=(m.processRows||[]).filter(function(r){return def.processes.indexOf(r.process)>=0;});
    var cases=caseRows.length,wip=caseRows.filter(function(cm){return !cm.closed&&v225AreaForProcess(cm.c.currentProcess)===area;}).length;
    var closed=caseRows.filter(function(cm){return cm.closed;}).length;
    var total=procRows.reduce(function(s,r){return s+(r.total||0);},0);
    var active=procRows.reduce(function(s,r){return s+(r.active||0);},0);
    var wait=procRows.reduce(function(s,r){return s+(r.wait||0);},0);
    var residual=Math.max(0,total-active-wait);
    var avg=cases?total/cases:0,work=cases?active/cases:0,block=cases?wait/cases:0;
    var unexplained=cases?residual/cases:0;
    var complianceDen=procRows.reduce(function(s,r){return s+(r.slaCount||0);},0);
    var complianceNum=procRows.reduce(function(s,r){return s+(r.slaOk||0);},0);
    var compliance=complianceDen?v225Pct(complianceNum,complianceDen):0;
    var rework=caseRows.reduce(function(s,cm){return s+v225CountRework(cm.c);},0);
    var reliabilities=caseRows.map(v225ReliabilityForCase);
    var reliability=Math.round(v225Mean(reliabilities.map(function(x){return x.score;})));
    var workers={};
    caseRows.forEach(function(cm){
      if(area==="ventas"){
        var adv=advisor(cm.c);if(adv)workers[normKey(adv)]=1;
      }else{
        (cm.pRows||[]).filter(function(p){return def.processes.indexOf(p.process)>=0;}).forEach(function(p){
          personsForProcess(cm.c,p.process).forEach(function(x){if(!x.synthetic)workers[x.key]=1;});
        });
      }
    });
    var workerCount=Object.keys(workers).length;
    var period=v226PeriodWindow(m);
    var utilization=period.hours&&workerCount?active/(period.hours*3600000*workerCount):0;
    return {
      area:area,label:v225AreaLabel(area),cases:cases,wip:wip,closed:closed,avg:avg,work:work,block:block,
      unexplained:unexplained,compliance:compliance,rework:rework,reliability:reliability,
      workers:workerCount,utilization:utilization,utilizationPct:Math.round(utilization*100)
    };
  }).filter(Boolean);
}
function v225BuildActorRows(m){
  var caseReliability={};
  (m.caseRows||[]).forEach(function(cm){caseReliability[idOf(cm.c)]=v225ReliabilityForCase(cm);});
  return (m.userRows||[]).filter(function(r){return !r.synthetic&&!v231IsExcludedSuperAdmin(r);}).map(function(r){
    var related=(m.userProcessRows||[]).filter(function(x){return x.key.indexOf(normKey(r.user)+"|")===0||x.user===r.user;});
    var processCompliance=related.length?Math.round(v225Mean(related.map(function(x){
      var pr=(m.processRows||[]).filter(function(p){return p.process===x.process;})[0];
      return pr?pr.slaPct:0;
    }))):0;
    var directPerCase=r.count?r.active/r.count:0;
    var handled=Math.max(1,r.count);
    var period=v226PeriodWindow(m);
    var directLoad=period.hours?r.active/(period.hours*3600000):0;
    var status=v225Status(processCompliance,85,65);
    return Object.assign({},r,{
      directPerCase:directPerCase,
      directLoadPct:Math.round(directLoad*100),
      compliance:processCompliance,
      status:status,
      productivity:r.count?Math.round((r.closed/handled)*100):0
    });
  }).sort(function(a,b){return b.active-a.active||b.count-a.count;});
}
function v225BuildReliability(m){
  var rows=(m.caseRows||[]).map(function(cm){var r=v225ReliabilityForCase(cm);r.cm=cm;return r;});
  var avg=Math.round(v225Mean(rows.map(function(x){return x.score;})));
  var high=rows.filter(function(x){return x.score>=90;}).length;
  var medium=rows.filter(function(x){return x.score>=70&&x.score<90;}).length;
  var low=rows.filter(function(x){return x.score<70;}).length;
  var rework=rows.reduce(function(s,x){return s+x.rework;},0);
  var completeResponsible=rows.filter(function(x){var c=x.cm.c;return !!(c.assignedName||c.assignedRole);}).length;
  var completeProcess=rows.filter(function(x){return !!x.cm.c.currentProcess;}).length;
  var completeStatus=rows.filter(function(x){return !!x.cm.c.status;}).length;
  return {
    avg:avg,high:high,medium:medium,low:low,rework:rework,
    responsiblePct:v225Pct(completeResponsible,rows.length),
    processPct:v225Pct(completeProcess,rows.length),
    statusPct:v225Pct(completeStatus,rows.length)
  };
}
function v225CoverageCard(title,value,detail){
  return '<article class="coverage-card"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></article>';
}
function v225Kpi(title,value,detail,kind,tag){return v222Kpi(title,value,detail,kind,tag);}
function v225TotalLoaded(){
  return (app.cases||[]).length;
}
async function computeV227Base(cases,cancelledCases){
  await computeV225Base(cases,cancelledCases);
  var m=app.metrics;if(!m)return;
  m.areaRows=v225BuildAreaRows(m);
  m.actorRows=v225BuildActorRows(m);
  m.reliability=v225BuildReliability(m);
  m.totalLoaded=v225TotalLoaded();
  m.filteredTotal=(app.cases||[]).filter(function(c){return caseMatchesBaseFilters(c,false);}).length;
  m.reworkTotal=m.reliability.rework;
  m.trueUnexplainedTotal=Math.max(0,(m.dead||0)-Math.min(m.dead||0,(m.wait||0)*0.25));
  m.trueUnexplainedAvg=m.cases?m.trueUnexplainedTotal/m.cases:0;
}
function renderCoverage(){
  var m=app.metrics;if(!m)return;
  $("coverageBand").innerHTML=
    v225CoverageCard("Total cargado",m.totalLoaded,"Todos los pedidos obtenidos desde Firestore.")+
    v225CoverageCard("Dentro del filtro",m.filteredTotal,"Pedidos que cumplen fechas, estado, área y búsqueda.")+
    v225CoverageCard("Trazados VSM",m.cases,"Pedidos con tiempos calculables.")+
    v225CoverageCard("No trazados / QA",m.notTraced,"Permanecen visibles para revisión.")+
    v225CoverageCard("Cancelados / anulados",m.cancelTotal,"Separados de los indicadores operativos.")+
    v225CoverageCard("Excluidos del KPI",m.excludedKpi,"No contaminan tiempos ni productividad.");
}
function renderSummaryV227Base(){
  var m=app.metrics;if(!m)return;
  $("summary").innerHTML=
    v225Kpi("Total de pedidos",String(m.totalLoaded),"Base completa cargada desde Firestore","ok","Filtrados "+m.filteredTotal)+
    v225Kpi("WIP actual",String(m.wip),m.lateWip+" fuera de meta",m.lateWip?"bad":"ok","Pedidos abiertos")+
    v225Kpi("Cerrados",String(m.closed),"Throughput "+m.throughput+" por día","ok","Filtro actual")+
    v225Kpi("Lead Time P50",v225Time(m.leadP50),"Mediana en horas laborales","","P90 "+v225Time(m.leadP90))+
    v225Kpi("Picking promedio",v225Time(m.pickingAvg),m.pickingRows.length+" pedidos con alistamiento",m.pickingLate?"warn":"ok","P90 "+v225Time(m.pickingP90))+
    v225Kpi("Corte físico",v225Time(m.physicalCutAvg),m.physicalCuts+" cortes físicos","","P90 "+v225Time(m.physicalCutP90))+
    v225Kpi("Trabajo directo promedio",v225Time(m.vaAvg),"Actividad registrada por pedido","ok",m.eff+"% del LT")+
    v225Kpi("Bloqueo explícito",v225Time(m.waitAvg),"Requerimientos, pagos y esperas documentadas",m.waitPct>30?"warn":"ok",m.waitPct+"% del LT")+
    v225Kpi("Tiempo de espera acumulado",v225Time(m.trueUnexplainedAvg),"Solo residuo sin marcas suficientes; no es improductividad",m.trueUnexplainedAvg>m.vaAvg?"warn":"ok","Revisar trazabilidad")+
    v225Kpi("Confiabilidad del proceso",m.reliability.avg+"%","Calidad promedio de estados, responsables y fechas",m.reliability.avg>=90?"ok":(m.reliability.avg>=70?"warn":"bad"),m.reliability.low+" casos críticos")+
    v225Kpi("No entregas",String(m.reworkTotal),"Casos con señales de corrección, devolución o no conformidad",m.reworkTotal?"warn":"ok","Filtro actual")+
    v225Kpi("Cumplimiento documental",m.reliability.responsiblePct+"%","Pedidos con responsable identificado",m.reliability.responsiblePct>=90?"ok":"warn","Proceso "+m.reliability.processPct+"%");

  $("operationalFocus").innerHTML=
    v222Focus("alistamiento","Picking / alistamiento",v225Time(m.pickingAvg))+
    v222Focus("corte_cable","Corte de cable",v225Time(((m.processRows||[]).filter(function(x){return x.process==="corte_cable";})[0]||{}).avg||0))+
    v222Focus("recepcion_pedidos","Recepción de pedidos")+
    v222Focus("facturacion","Facturación");

  var bottle=m.bottleneck||{};
  $("bottleneck").innerHTML=bottle.label
    ? '<strong>'+esc(bottle.label)+'</strong><p class="muted">Promedio '+v225Time(bottle.avg||0)+' · WIP '+Number(bottle.wip||0)+' · espera '+Number(bottle.waitPct||0)+'%.</p>'
    : '<span class="muted">Sin datos suficientes.</span>';

  $("quickBars").innerHTML='<article class="chart-card"><h3>Composición del Lead Time</h3>'+v225Stack(m)+'</article>';
  $("ltProductivityAnalysis").innerHTML='<div class="filter-summary"><strong>Lectura correcta:</strong> el tiempo que un pedido espera porque el actor atiende otro pedido no se clasifica automáticamente como tiempo muerto. La productividad por actor se mide con trabajo directo, cumplimiento, casos atendidos y calidad del registro.</div>';
  $("deepKpis").innerHTML=
    v225Kpi("Eficiencia de flujo",m.eff+"%","Trabajo directo / Lead Time observado",m.eff>=55?"ok":(m.eff>=35?"warn":"bad"),"No es productividad individual")+
    v225Kpi("Calidad de trazabilidad",m.dataQualityPct+"%",m.incomplete+" pedido(s) con datos incompletos",m.incomplete?"warn":"ok","Base "+m.cases)+
    v225Kpi("Novedades pendientes",m.reportPending+"",m.reportCount+" novedades analizadas",m.reportPending?"warn":"ok")+
    v225Kpi("Cortes registrados",m.doneCuts+" / "+m.totalCuts,"Finalizados, medida completa o no necesita corte",m.totalCuts&&m.doneCuts<m.totalCuts?"warn":"ok");

  v225FilterSummary();
  renderCoverage();
  renderAreaBoard();
  renderProcessFlow();
  renderActorBoard();
  renderPowerCharts();
  renderReliability();
  renderAlerts();
}
function v225Stack(m){
  var total=Math.max(1,m.leadTotal||0);
  var work=v225Pct(m.va,total),block=v225Pct(m.wait,total),unexplained=v225Pct(m.trueUnexplainedTotal,total);
  var contextual=Math.max(0,100-work-block-unexplained);
  return '<div class="stack"><i class="va" style="width:'+work+'%"></i><i class="wait" style="width:'+block+'%"></i><i class="dead" style="width:'+unexplained+'%"></i><i style="width:'+contextual+'%;background:#2563eb"></i></div>'+
    '<div class="legend"><span><i class="dot va"></i>Trabajo '+work+'%</span><span><i class="dot wait"></i>Bloqueo '+block+'%</span><span><i class="dot dead"></i>No explicado '+unexplained+'%</span><span><i class="dot" style="background:#2563eb"></i>Espera contextual '+contextual+'%</span></div>';
}
function v225FilterSummary(){
  var parts=[];
  if($("fFrom").value||$("fTo").value)parts.push("Fecha "+($("fFrom").value||"inicio")+" a "+($("fTo").value||"hoy"));
  if($("fArea").value)parts.push(v225AreaLabel($("fArea").value));
  if($("fOrderType").value)parts.push($("fOrderType").value==="pve"?"PVE":"Normal");
  if($("fProcess").value)parts.push(processTitle($("fProcess").value));
  if($("fStatus").value)parts.push($("fStatus").options[$("fStatus").selectedIndex].text);
  if($("fSla").value)parts.push($("fSla").value==="late"?"Fuera de meta":"Dentro de meta");
  if($("fUser").value)parts.push($("fUser").options[$("fUser").selectedIndex].text);
  if(clean($("fSearch").value))parts.push('Búsqueda "'+clean($("fSearch").value)+'"');
  $("filterSummary").textContent=(parts.length?parts.join(" · "):"Sin filtros restrictivos")+
    " · Total cargado: "+v225TotalLoaded()+" pedido(s).";
}
function renderAreaBoardV228Base(){
  var m=app.metrics;if(!m)return;
  $("areaBoard").innerHTML=(m.areaRows||[]).map(function(r){
    var status=v225Status(r.compliance,85,65);
    return '<article class="process-card '+(status.cls==="bad"?'late':'')+'">'+
      '<div class="process-title"><h3>'+esc(r.label)+'</h3><span class="status-chip '+status.cls+'">'+status.label+'</span></div>'+
      '<div class="process-main"><div><span>LT promedio</span><strong>'+v225Time(r.avg)+'</strong></div><div><span>Cumplimiento</span><strong>'+r.compliance+'%</strong></div></div>'+
      '<div class="process-stats"><div><span>Trabajo</span><b>'+v225Time(r.work)+'</b></div><div><span>Bloqueo</span><b>'+v225Time(r.block)+'</b></div><div><span>WIP</span><b>'+r.wip+'</b></div></div>'+
      '<div class="progress"><i style="width:'+Math.max(0,Math.min(100,r.compliance))+'%"></i></div>'+
      '<small class="metric-note">Casos '+r.cases+' · cerrados '+r.closed+' · actores '+r.workers+' · confiabilidad '+r.reliability+'% · reprocesos '+r.rework+'</small>'+
    '</article>';
  }).join("")||'<p class="muted">Sin datos suficientes por área.</p>';
}
function renderProcessFlow(){
  var m=app.metrics;if(!m)return;
  $("processFlow").innerHTML=(m.processRows||[]).map(function(r){
    var direct=r.cases?r.active/r.cases:0,block=r.cases?r.wait/r.cases:0,residual=r.cases?r.dead/r.cases:0;
    var status=v225Status(r.slaPct||0,85,65);
    return '<article class="process-card '+(r.wipLate?'late':'')+'">'+
      '<div class="process-title"><h3>'+esc(r.label)+'</h3><span class="status-chip '+status.cls+'">'+status.label+'</span></div>'+
      '<div class="process-main"><div><span>LT promedio</span><strong>'+v225Time(r.avg||0)+'</strong></div><div><span>Cumplimiento</span><strong>'+Number(r.slaPct||0)+'%</strong></div></div>'+
      '<div class="process-stats"><div><span>Trabajo directo</span><b>'+v225Time(direct)+'</b></div><div><span>Bloqueo</span><b>'+v225Time(block)+'</b></div><div><span>WIP / atraso</span><b>'+Number(r.wip||0)+' / '+Number(r.wipLate||0)+'</b></div></div>'+
      '<div class="progress"><i style="width:'+Math.max(0,Math.min(100,r.slaPct||0))+'%"></i></div>'+
      '<small class="metric-note">P50 '+v225Time(r.p50||0)+' · P90 '+v225Time(r.p90||0)+' · tiempo de espera acumulado '+v225Time(residual)+'</small>'+
    '</article>';
  }).join("");
}
function renderActorBoard(){
  var m=app.metrics;if(!m)return;
  $("actorBoard").innerHTML=(m.actorRows||[]).slice(0,12).map(function(r){
    var status=r.status||v225Status(r.compliance,85,65);
    return '<article class="process-card '+(status.cls==="bad"?'late':'')+'">'+
      '<div class="process-title"><h3>'+esc(r.user)+'</h3><span class="status-chip '+status.cls+'">'+status.label+'</span></div>'+
      '<div class="process-main"><div><span>Trabajo directo</span><strong>'+v225Time(r.active)+'</strong></div><div><span>Cumplimiento</span><strong>'+r.compliance+'%</strong></div></div>'+
      '<div class="process-stats"><div><span>Casos</span><b>'+r.count+'</b></div><div><span>WIP</span><b>'+r.open+'</b></div><div><span>Cerrados</span><b>'+r.closed+'</b></div></div>'+
      '<small class="metric-note">Promedio directo '+v225Time(r.directPerCase)+' · productividad de cierre '+r.productivity+'% · carga directa '+r.directLoadPct+'%</small>'+
    '</article>';
  }).join("")||'<p class="muted">No hay actores trazados con los filtros actuales.</p>';
}
function renderReliabilityV228Base(){
  var m=app.metrics;if(!m)return;var r=m.reliability;
  $("reliabilityBoard").innerHTML=
    '<article class="reliability-card"><h3>Confiabilidad general</h3><strong>'+r.avg+'%</strong><small>Calidad promedio de fechas, estados, responsables y proceso.</small></article>'+
    '<article class="reliability-card"><h3>Registros confiables</h3><strong>'+r.high+'</strong><small>Casos con confiabilidad igual o superior al 90%.</small></article>'+
    '<article class="reliability-card"><h3>Registros por revisar</h3><strong>'+r.medium+'</strong><small>Casos entre 70% y 89%.</small></article>'+
    '<article class="reliability-card"><h3>Registros críticos</h3><strong>'+r.low+'</strong><small>Casos por debajo de 70%.</small></article>'+
    '<article class="reliability-card"><h3>No entregas</h3><strong>'+r.rework+'</strong><small>Señales encontradas en historia, requerimientos o estados.</small></article>'+
    '<article class="reliability-card"><h3>Responsable identificado</h3><strong>'+r.responsiblePct+'%</strong><small>Pedidos con actor o rol responsable registrado.</small></article>';
}
function v225ChartRows(rows,valueFn,labelFn,metaFn,classFn){
  rows=rows||[];var max=rows.reduce(function(a,r){return Math.max(a,Number(valueFn(r))||0);},0)||1;
  return rows.map(function(r){
    var v=Number(valueFn(r))||0;
    return '<div class="chart-row"><b title="'+esc(labelFn(r))+'">'+esc(labelFn(r))+'</b><div class="chart-track"><i class="'+(classFn?classFn(r):'')+'" style="width:'+Math.max(2,Math.min(100,(v/max)*100))+'%"></i></div><span>'+esc(metaFn(r))+'</span></div>';
  }).join("")||'<p class="muted">Sin datos suficientes.</p>';
}
function renderPowerChartsV227Base(){
  var m=app.metrics;if(!m)return;
  var proc=(m.processRows||[]).filter(function(r){return r.cases||r.wip;});
  $("powerCharts").innerHTML=
    '<article class="chart-card"><h3>LT promedio por proceso</h3>'+v225ChartRows(proc,function(r){return r.avg;},function(r){return r.label;},function(r){return v225Time(r.avg);})+'</article>'+
    '<article class="chart-card"><h3>Cumplimiento por proceso</h3>'+v225ChartRows(proc,function(r){return r.slaPct;},function(r){return r.label;},function(r){return r.slaPct+"%";},function(r){return r.slaPct>=85?"ok":(r.slaPct>=65?"warn":"bad");})+'</article>'+
    '<article class="chart-card"><h3>WIP por proceso</h3>'+v225ChartRows(proc.slice().sort(function(a,b){return b.wip-a.wip;}),function(r){return r.wip;},function(r){return r.label;},function(r){return r.wip+" · "+r.wipLate+" atras.";},function(r){return r.wipLate?"bad":"ok";})+'</article>'+
    '<article class="chart-card"><h3>Confiabilidad por área</h3>'+v225ChartRows(m.areaRows,function(r){return r.reliability;},function(r){return r.label;},function(r){return r.reliability+"%";},function(r){return r.reliability>=90?"ok":(r.reliability>=70?"warn":"bad");})+'</article>'+
    '<article class="chart-card"><h3>Trabajo directo por actor</h3>'+v225ChartRows((m.actorRows||[]).slice(0,12),function(r){return r.active;},function(r){return r.user;},function(r){return v225Time(r.active)+" · "+r.count+" casos";},function(){return "ok";})+'</article>'+
    '<article class="chart-card"><h3>No entregas por área</h3>'+v225ChartRows(m.areaRows,function(r){return r.rework;},function(r){return r.label;},function(r){return r.rework+" señal(es)";},function(r){return r.rework?"warn":"ok";})+'</article>';
}
function renderAlerts(){renderAlertsV225Base();}
function caseMatchesBaseFilters(c,includeStatus){
  if(!caseMatchesBaseFiltersV225Base(c,includeStatus))return false;
  var area=$("fArea").value;
  return !area||v225AreaTouches(c,area);
}
function fillFilters(){fillFiltersV225Base();}
function resetVsmFilters(){
  resetVsmFiltersV225Base();
  $("fArea").value="";
  v225FilterSummary();
}
function renderTableV227Base(){
  var m=app.metrics;if(!m)return;
  var view=$("fView").value;
  if(view==="areas"){
    $("tableTitle").textContent="Resumen por área";
    $("rowCount").textContent=m.areaRows.length+" área(s) · total cargado "+m.totalLoaded;
    $("mainTable").innerHTML=v225Table(["Área","Casos","WIP","Cerrados","LT promedio","Trabajo directo","Bloqueo","No explicado","Cumplimiento","Confiabilidad","Reprocesos","Actores"],m.areaRows.map(function(r){
      return '<tr><td><strong>'+esc(r.label)+'</strong></td><td>'+r.cases+'</td><td>'+r.wip+'</td><td>'+r.closed+'</td><td>'+v225Time(r.avg)+'</td><td>'+v225Time(r.work)+'</td><td>'+v225Time(r.block)+'</td><td>'+v225Time(r.unexplained)+'</td><td>'+r.compliance+'%</td><td>'+r.reliability+'%</td><td>'+r.rework+'</td><td>'+r.workers+'</td></tr>';
    }));
    return;
  }
  if(view==="confiabilidad"){
    $("tableTitle").textContent="Confiabilidad y reprocesos";
    var rows=(m.caseRows||[]).map(function(cm){var r=v225ReliabilityForCase(cm);return {cm:cm,r:r};}).sort(function(a,b){return a.r.score-b.r.score;});
    $("rowCount").textContent=rows.length+" pedido(s) · total cargado "+m.totalLoaded;
    $("mainTable").innerHTML=v225Table(["Pedido","Cliente","Proceso","Estado","Responsable","Confiabilidad","Reprocesos","Hallazgos"],rows.map(function(x){
      var c=x.cm.c;
      return '<tr><td><strong>'+esc(refOf(c))+'</strong></td><td>'+esc(c.client||"")+'</td><td>'+esc(processTitle(c.currentProcess))+'</td><td>'+esc(c.status||"")+'</td><td>'+esc(c.assignedName||advisor(c)||"Sin responsable")+'</td><td>'+x.r.score+'%</td><td>'+x.r.rework+'</td><td>'+esc(x.r.issues.join(", ")||"Sin hallazgos")+'</td></tr>';
    }));
    return;
  }
  renderTableV225Base();
  $("rowCount").textContent=$("rowCount").textContent+" · total cargado "+m.totalLoaded;
}
function v225Table(headers,rows){return '<div class="table-wrap"><table>'+table(headers,rows)+'</table></div>';}
function bindV227Base(){
  bindV225Base();
  $("fArea").addEventListener("change",function(){refresh().catch(function(e){loading(false);status("Error filtrando por área: "+esc(e.message||e),"bad");});});
}


/* ============================================================
   V227 · TIEMPO DE ESPERA ACUMULADO Y TRAZABILIDAD
============================================================ */
function v227Scope(){
  var area=$("fArea")&&$("fArea").value;
  var process=$("fProcess")&&$("fProcess").value;
  var label="Todas las áreas";
  if(area)label=v225AreaLabel(area);
  if(process)label=(area?v225AreaLabel(area)+" · ":"")+processTitle(process);
  return {area:area||"",process:process||"",label:label};
}
function v227AreaForEventText(text){
  text=lower(text||"");
  if(/ventas|asesor|vendedor/.test(text))return "ventas";
  if(/compra|compras|pve/.test(text))return "compras";
  if(/factur/.test(text))return "facturacion";
  if(/caja|cartera|pago|financier/.test(text))return "cartera";
  if(/despacho|transportadora|guia|entrega|cliente recoge|cliente punto/.test(text))return "despacho";
  if(/recepcion|alistamiento|picking|corte|logistica/.test(text))return "logistica";
  return "";
}
function v227RequirementTimes(c){
  var now=nowMs(),rows=[],scope=v227Scope();
  var reqs=[];
  if(c.openRequirement)reqs.push(c.openRequirement);
  (c.requirements||[]).forEach(function(r){reqs.push(r);});
  reqs.forEach(function(r,idx){
    if(!r)return;
    var start=tms(r.sentAt)||tms(r.createdAt)||tms(r.openedAt)||tms(r.requestedAt);
    var end=tms(r.resolvedAt)||tms(r.closedAt)||tms(r.completedAt)||tms(r.respondedAt)||tms(r.updatedAt);
    var status=lower(r.status||"");
    if(!end && !/cerr|resuel|complet|final/.test(status))end=now;
    if(!isFinite(start)||!isFinite(end)||end<start)return;
    var text=[r.reason,r.detail,r.description,r.targetRole,r.sourceProcess,r.source,r.type,r.category].join(" ");
    var area=v227AreaForEventText(text)||v225AreaForProcess(r.sourceProcess)||v225AreaForProcess(c.currentProcess);
    if(scope.area&&area&&scope.area!==area)return;
    if(scope.process&&r.sourceProcess&&scope.process!==r.sourceProcess)return;
    rows.push({
      type:"Requerimiento",
      area:area||v225AreaForProcess(c.currentProcess)||"logistica",
      process:r.sourceProcess||c.currentProcess||"",
      duration:workingMsBetween(start,end),
      start:start,end:end,
      detail:r.reason||r.detail||r.description||"Requerimiento registrado",
      open:!/cerr|resuel|complet|final/.test(status)
    });
  });
  return rows;
}
function v227ReportTimes(c,m){
  var scope=v227Scope(),id=idOf(c);
  return (m.reportRows||[]).filter(function(r){
    var reportCase=String(r.caseId||r.sourceId||r.pedido||"");
    return reportCase===id||reportCase===refOf(c)||String(r.pedido||"")===refOf(c);
  }).map(function(r){
    var text=[r.title,r.category,r.sourceModule,r.status,r.severity].join(" ");
    var area=v227AreaForEventText(text)||v225AreaForProcess(c.currentProcess);
    if(scope.area&&area&&scope.area!==area)return null;
    var duration=Number(r.closeMs||r.responseMs||0);
    return {
      type:"Novedad",
      area:area||"logistica",
      process:c.currentProcess||"",
      duration:duration,
      detail:r.title||r.category||"Novedad registrada",
      open:!!r.pending
    };
  }).filter(function(x){return x&&x.duration>0;});
}
function v227ReworkTimes(c){
  var scope=v227Scope(),events=allTraceEvents(c),rows=[];
  var keys=/reproceso|retrabajo|devuelto|devolucion|no conforme|rechazado|corregir|correccion|retorno|regresar|reabrir/;
  for(var i=0;i<events.length;i++){
    var e=events[i],txt=lower([e.type,e.detail,e.process,e.role].join(" "));
    if(!keys.test(txt))continue;
    var end=i<events.length-1?events[i+1].ms:(tms(c.closedAt)||tms(c.updatedAt)||nowMs());
    if(!isFinite(e.ms)||!isFinite(end)||end<e.ms)continue;
    var area=v227AreaForEventText(txt)||v225AreaForProcess(e.process)||v225AreaForProcess(c.currentProcess);
    if(scope.area&&area&&scope.area!==area)continue;
    if(scope.process&&e.process&&scope.process!==e.process)continue;
    rows.push({
      type:/devuel|devolucion|retorno/.test(txt)?"Devolución":"Reproceso",
      area:area||"logistica",
      process:e.process||c.currentProcess||"",
      duration:workingMsBetween(e.ms,end),
      detail:e.detail||e.type||"Evento de reproceso",
      open:false
    });
  }
  return rows;
}
function v227ProcessWaitForCase(cm){
  var scope=v227Scope(),rows=(cm.pRows||[]);
  if(scope.process)rows=rows.filter(function(p){return p.process===scope.process;});
  else if(scope.area){
    var def=V225_AREA_DEF[scope.area]||{processes:[]};
    if(scope.area==="ventas")rows=[];
    else rows=rows.filter(function(p){return def.processes.indexOf(p.process)>=0;});
  }
  return rows.reduce(function(s,p){return s+(p.wait||0);},0);
}
function v227BuildWaiting(m){
  var details=[],processWait=0,requirement=0,novelty=0,rework=0,devolution=0;
  (m.caseRows||[]).forEach(function(cm){
    var c=cm.c;
    processWait+=v227ProcessWaitForCase(cm);
    v227RequirementTimes(c).forEach(function(x){requirement+=x.duration;details.push(Object.assign({pedido:refOf(c)},x));});
    v227ReportTimes(c,m).forEach(function(x){novelty+=x.duration;details.push(Object.assign({pedido:refOf(c)},x));});
    v227ReworkTimes(c).forEach(function(x){
      if(x.type==="Devolución")devolution+=x.duration;else rework+=x.duration;
      details.push(Object.assign({pedido:refOf(c)},x));
    });
  });

  // Evitar que la suma supere el tiempo disponible total de los pedidos.
  var raw=processWait+requirement+novelty+rework+devolution;
  var maxAvailable=Math.max(0,(m.leadTotal||0)-(m.va||0));
  var total=Math.min(raw,maxAvailable||raw);
  var scale=raw>0&&total<raw?total/raw:1;

  processWait*=scale;requirement*=scale;novelty*=scale;rework*=scale;devolution*=scale;
  details.forEach(function(x){x.duration*=scale;});
  details.sort(function(a,b){return b.duration-a.duration;});

  return {
    scope:v227Scope(),
    total:total,
    processWait:processWait,
    requirement:requirement,
    novelty:novelty,
    rework:rework,
    devolution:devolution,
    average:m.cases?total/m.cases:0,
    details:details,
    openRequirements:details.filter(function(x){return x.type==="Requerimiento"&&x.open;}).length,
    openNovelties:details.filter(function(x){return x.type==="Novedad"&&x.open;}).length
  };
}
async function computeV228Base(cases,cancelledCases){
  await computeV227Base(cases,cancelledCases);
  var m=app.metrics;if(!m)return;
  m.waiting=v227BuildWaiting(m);
  m.trueUnexplainedTotal=0;
  m.trueUnexplainedAvg=0;
}
function v227WaitCard(title,value,detail,kind,scope){
  return '<article class="wait-card '+(kind||'')+'"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small><em class="wait-scope">'+esc(scope)+'</em></article>';
}
function renderWaitBoardV228Base(){
  var m=app.metrics;if(!m||!m.waiting)return;
  var w=m.waiting,scope=w.scope.label;
  $("waitSectionTitle").textContent="Tiempo de espera acumulado · "+scope;
  $("waitSectionSubtitle").textContent="Suma de esperas de procesos, requerimientos, novedades, devoluciones y reprocesos para "+scope+".";
  $("waitBoard").innerHTML=
    v227WaitCard("Espera acumulada",v225Time(w.total),"Total laboral de todas las esperas trazadas.","warn",scope)+
    v227WaitCard("Espera de procesos",v225Time(w.processWait),"Estados de espera registrados dentro de los procesos.","info",scope)+
    v227WaitCard("Requerimientos",v225Time(w.requirement),w.openRequirements+" requerimiento(s) aún abierto(s).",w.openRequirements?"bad":"ok",scope)+
    v227WaitCard("Novedades",v225Time(w.novelty),w.openNovelties+" novedad(es) pendiente(s).",w.openNovelties?"warn":"ok",scope)+
    v227WaitCard("Reprocesos",v225Time(w.rework),"Tiempo originado por correcciones, rechazos o retrabajos.",w.rework?"warn":"ok",scope)+
    v227WaitCard("Devoluciones",v225Time(w.devolution),"Tiempo asociado a devoluciones, retornos o regresos de proceso.",w.devolution?"warn":"ok",scope);

  var components=[
    {label:"Espera de procesos",value:w.processWait,cls:"info"},
    {label:"Requerimientos",value:w.requirement,cls:"warn"},
    {label:"Novedades",value:w.novelty,cls:"warn"},
    {label:"Reprocesos",value:w.rework,cls:"bad"},
    {label:"Devoluciones",value:w.devolution,cls:"bad"}
  ];
  $("waitComposition").innerHTML=
    '<article class="chart-card"><h3>Composición del tiempo de espera · '+esc(scope)+'</h3>'+
      v225ChartRows(components,function(r){return r.value;},function(r){return r.label;},function(r){return v225Time(r.value);},function(r){return r.cls;})+
    '</article>'+
    '<article class="chart-card"><h3>Principales esperas trazadas</h3><div class="wait-detail-list">'+
      (w.details.slice(0,12).map(function(x){
        return '<div class="wait-detail-row"><div><strong>'+esc(x.pedido)+'</strong><small>'+esc(v225AreaLabel(x.area))+(x.process?' · '+esc(processTitle(x.process)):'')+'</small></div><div><strong>'+esc(x.type)+'</strong><small>'+esc(x.detail)+'</small></div><span class="badge '+(x.open?'bad':'warn')+'">'+v225Time(x.duration)+'</span></div>';
      }).join("")||'<p class="muted">No se encontraron esperas trazadas con los filtros actuales.</p>')+
    '</div></article>';
}
function renderSummaryV228Base(){
  renderSummaryV227Base();
  var m=app.metrics;if(!m||!m.waiting)return;
  var w=m.waiting;
  var cards=$("summary").innerHTML;
  cards=cards.replace(/<article class="card kpi [^"]*"><span>Tiempo de espera acumulado<\/span>[\s\S]*?<\/article>/,
    v225Kpi("Tiempo de espera acumulado",v225Time(w.average),"Promedio por pedido: procesos, requerimientos, novedades, reprocesos y devoluciones",w.total?"warn":"ok",w.scope.label)
  );
  $("summary").innerHTML=cards;
  renderWaitBoard();
}
function renderPowerChartsV228Base(){
  renderPowerChartsV227Base();
  var m=app.metrics;if(!m||!m.waiting)return;
  var w=m.waiting;
  $("quickBars").innerHTML='<article class="chart-card"><h3>Composición del Lead Time · '+esc(w.scope.label)+'</h3>'+v227LeadStack(m,w)+'</article>';
}
function v227LeadStack(m,w){
  var total=Math.max(1,m.leadTotal||0);
  var work=v225Pct(m.va,total),waiting=v225Pct(w.total,total);
  var other=Math.max(0,100-work-waiting);
  return '<div class="stack"><i class="va" style="width:'+work+'%"></i><i class="wait" style="width:'+waiting+'%"></i><i style="width:'+other+'%;background:#2563eb"></i></div>'+
    '<div class="legend"><span><i class="dot va"></i>Trabajo directo '+work+'%</span><span><i class="dot wait"></i>Espera acumulada '+waiting+'%</span><span><i class="dot" style="background:#2563eb"></i>Transferencia y ejecución contextual '+other+'%</span></div>';
}
function renderTableV228Base(){
  renderTableV227Base();
  var m=app.metrics;if(!m||!m.waiting)return;
  if($("fView").value==="confiabilidad"){
    $("rowCount").textContent=$("rowCount").textContent+" · espera acumulada "+v225Time(m.waiting.total)+" · "+m.waiting.scope.label;
  }
}
function bindV228Base(){
  bindV227Base();
  ["fArea","fProcess"].forEach(function(id){
    $(id).addEventListener("change",function(){
      setTimeout(function(){
        if(app.metrics&&app.metrics.waiting){
          renderWaitBoard();
          v225FilterSummary();
        }
      },0);
    });
  });
}


/* ============================================================
   V228 · TIEMPOS VERIFICADOS POR ETIQUETAS FIREBASE
============================================================ */
var V228_AREA_SLA={ventas:4,compras:16,logistica:4,facturacion:2,cartera:4,despacho:8};

function v229NormalizeRole(value){
  return normKey(value||"");
}
function v228Scope(){
  var area=$("fArea")&&$("fArea").value||"";
  var process=$("fProcess")&&$("fProcess").value||"";
  var label=area?v225AreaLabel(area):"Todas las áreas";
  if(process)label+=(area?" · ":"")+processTitle(process);
  return {area:area,process:process,label:label};
}
function v228NoDeliveryText(text){
  return /no[_\s-]?entrega|no[_\s-]?entregado|pedido no entregado|no recibió|devolucion_caja|refund_to_box/i.test(String(text||""));
}
function v228ReworkText(text){
  return /reproceso|retrabajo|correcci[oó]n|corregir|diferencia|no conforme|rechazad|devuelt[oa]|regres[oa]|retorno|reabrir|ajuste requerido/i.test(String(text||""));
}
function v228ClosedText(text){
  return /cerrad|resuelt|solucionad|complet|finaliz|entrega confirmada/i.test(String(text||""));
}
function v228AreaFromRoleOrProcess(role,process,text){
  role=v229NormalizeRole(role||"");
  if(process&&v225AreaForProcess(process))return v225AreaForProcess(process);
  if(role==="ventas"||role==="asesor_ventas")return "ventas";
  if(role==="compras"||role==="proyectos")return "compras";
  if(role==="facturacion")return "facturacion";
  if(role==="caja"||role==="cartera")return "cartera";
  if(/despacho|transportadora|entrega/.test(lower(text||"")))return "despacho";
  if(/recepcion|alistamiento|picking|corte|logistica/.test(lower(text||"")))return "logistica";
  return "";
}
function v228RecordInScope(x){
  var s=v228Scope();
  if(s.area&&x.area&&s.area!==x.area)return false;
  if(s.process&&x.process&&s.process!==x.process)return false;
  return true;
}
function v228ReqStart(r){
  return tms(r.sentAt)||tms(r.createdAt)||tms(r.openedAt)||tms(r.requestedAt);
}
function v228ReqEnd(r,open){
  var end=tms(r.answeredAt)||tms(r.resolvedAt)||tms(r.closedAt)||tms(r.completedAt)||tms(r.respondedAt);
  if(!isFinite(end)&&v228ClosedText(r.status))end=tms(r.updatedAt);
  if(!isFinite(end)&&open)end=nowMs();
  return end;
}
function v228RequirementList(c){
  var out=[],seen={};
  function add(r,source,forceOpen){
    if(!r)return;
    var start=v228ReqStart(r)||tms(c.waitStartedAt);
    var key=String(r.id||[start,r.reason,r.targetRole,r.source,r.returnProcess].join("|"));
    if(seen[key])return;
    seen[key]=1;
    var status=lower(r.status||"");
    var open=forceOpen===true||(!v228ClosedText(status)&&!tms(r.answeredAt)&&!tms(r.resolvedAt)&&!tms(r.closedAt));
    var end=v228ReqEnd(r,open);
    if(!isFinite(start)||!isFinite(end)||end<start)return;
    out.push({r:r,source:source,start:start,end:end,open:open});
  }
  (c.requirements||[]).forEach(function(r){add(r,"cases.requirements",false);});
  add(c.openRequirement,"cases.openRequirement",true);
  return out;
}
function v228RequirementClass(c,item){
  var r=item.r;
  var text=[r.source,r.type,r.category,r.reason,r.detail,r.description,r.status,r.targetRole,r.sourceProcess,r.returnProcess,c.requirementType].join(" ");
  if(v228NoDeliveryText(text)||r.source==="no_entrega"||c.requirementType==="no_entrega")return "no_delivery";
  var target=v229NormalizeRole(r.targetRole||"");
  var explicitReturn=!!(r.returnProcess||r.sourceProcess);
  if(target==="ventas"||v228ReworkText(text)||(explicitReturn&&target&&target!==v229NormalizeRole(r.sourceRole||"")))return "rework";
  return "novelty";
}
function v228SlaHours(area,process){
  if(process&&typeof v222SlaHoursForProcess==="function")return v222SlaHoursForProcess(process);
  return V228_AREA_SLA[area]||4;
}
function v228NoveltyRecords(c,m){
  var rows=[];
  reportMetricsForCase(c).forEach(function(metric){
    var r=metric.report||{};
    var text=[r.title,r.category,r.sourceModule,r.description,r.detail,r.status].join(" ");
    if(v228NoDeliveryText(text))return;
    var area=v228AreaFromRoleOrProcess(r.targetRole||r.assignedRole,r.sourceProcess||r.process,text)||v225AreaForProcess(c.currentProcess)||"logistica";
    var process=r.sourceProcess||r.process||c.currentProcess||"";
    var duration=Number(metric.responseMs||0);
    if(duration<=0)return;
    var row={
      category:"Novedad",pedido:refOf(c),area:area,process:process,duration:duration,
      start:metric.created,end:metric.firstResponse||nowMs(),open:!!metric.pending,
      detail:r.title||r.category||"Novedad registrada",
      source:"reportes_novedad.createdAt → primera respuesta"
    };
    if(v228RecordInScope(row))rows.push(row);
  });
  v228RequirementList(c).forEach(function(item){
    if(v228RequirementClass(c,item)!=="novelty")return;
    var r=item.r,text=[r.reason,r.detail,r.targetRole,r.sourceProcess].join(" ");
    var area=v228AreaFromRoleOrProcess(r.targetRole,r.sourceProcess,text)||v225AreaForProcess(c.currentProcess)||"logistica";
    var process=r.sourceProcess||r.returnProcess||c.currentProcess||"";
    var row={
      category:"Novedad",pedido:refOf(c),area:area,process:process,
      duration:workingMsBetween(item.start,item.end),start:item.start,end:item.end,open:item.open,
      detail:r.reason||r.detail||"Requerimiento operativo",
      source:item.source+" · sentAt → answeredAt/resolvedAt"
    };
    if(row.duration>0&&v228RecordInScope(row))rows.push(row);
  });
  return rows;
}
function v228ReworkRecords(c){
  var rows=[],reqStarts=[];
  v228RequirementList(c).forEach(function(item){
    if(v228RequirementClass(c,item)!=="rework")return;
    var r=item.r,text=[r.reason,r.detail,r.targetRole,r.sourceProcess,r.returnProcess].join(" ");
    var process=r.returnProcess||r.sourceProcess||c.currentProcess||"";
    var area=v228AreaFromRoleOrProcess(r.targetRole,process,text)||v225AreaForProcess(process)||"logistica";
    var elapsed=workingMsBetween(item.start,item.end);
    var sla=v228SlaHours(area,process);
    var excess=Math.max(0,elapsed-(sla*3600000));
    reqStarts.push(item.start);
    if(excess<=0)return;
    var row={
      category:"Reproceso",pedido:refOf(c),area:area,process:process,duration:excess,
      elapsed:elapsed,slaHours:sla,start:item.start,end:item.end,open:item.open,
      detail:r.reason||r.detail||"Pedido devuelto para corrección",
      source:item.source+" · exceso sobre meta de "+sla+" h"
    };
    if(v228RecordInScope(row))rows.push(row);
  });
  var events=allTraceEvents(c);
  for(var i=0;i<events.length;i++){
    var e=events[i],raw=e.raw||{};
    var text=[raw.type,raw.traceType,raw.detail,raw.reason,e.detail,raw.toProcess,raw.returnProcess].join(" ");
    if(v228NoDeliveryText(text)||!v228ReworkText(text))continue;
    if(reqStarts.some(function(s){return Math.abs(s-e.ms)<300000;}))continue;
    var process=raw.toProcess||raw.returnProcess||e.process||c.currentProcess||"";
    var area=v228AreaFromRoleOrProcess(raw.targetRole||e.role,process,text)||v225AreaForProcess(process)||"logistica";
    var end=NaN;
    for(var j=i+1;j<events.length;j++){
      var next=events[j];
      var nextText=[next.raw&&next.raw.type,next.detail,next.process].join(" ");
      if(next.ms>e.ms&&(next.process!==process||/transfer|liber|finaliz|cierre|resuelt/i.test(nextText))){end=next.ms;break;}
    }
    if(!isFinite(end))end=tms(c.closedAt)||tms(c.updatedAt)||nowMs();
    if(end<e.ms)continue;
    var elapsed=workingMsBetween(e.ms,end),sla=v228SlaHours(area,process);
    var excess=Math.max(0,elapsed-(sla*3600000));
    if(excess<=0)continue;
    var row={
      category:"Reproceso",pedido:refOf(c),area:area,process:process,duration:excess,
      elapsed:elapsed,slaHours:sla,start:e.ms,end:end,open:!isClosed(c),
      detail:e.detail||"Retorno a una etapa anterior",
      source:"case_events/stateHistory/flowTrace · exceso sobre meta de "+sla+" h"
    };
    if(v228RecordInScope(row))rows.push(row);
  }
  return rows;
}
function v228NoDeliveryCase(c){
  if(c.noDelivery===true||clean(c.noDeliveryStatus)||clean(c.requirementType)==="no_entrega")return true;
  if((c.noDeliveryReports||[]).length)return true;
  if((c.requirements||[]).some(function(r){return r.source==="no_entrega"||v228NoDeliveryText(JSON.stringify(r));}))return true;
  return caseEvents(c).some(function(e){return /^NO_DELIVERY_/.test(String(e.type||""));});
}
function v228NoDeliveryEnd(c,start,report){
  var candidates=[];
  [report&&report.closedAt,report&&report.resolvedAt,report&&report.completedAt].forEach(function(v){var x=tms(v);if(isFinite(x)&&x>=start)candidates.push(x);});
  var status=lower((report&&report.status)||c.noDeliveryStatus||c.status||"");
  (report&&report.history||[]).forEach(function(h){
    if(v228ClosedText([h.action,h.status,h.detail].join(" "))){var x=tms(h.at||h.timestamp||h.createdAt);if(isFinite(x)&&x>=start)candidates.push(x);}
  });
  (c.requirements||[]).filter(function(r){return r.source==="no_entrega"||v228NoDeliveryText(JSON.stringify(r));}).forEach(function(r){
    [r.answeredAt,r.resolvedAt,r.closedAt].forEach(function(v){var x=tms(v);if(isFinite(x)&&x>=start)candidates.push(x);});
  });
  caseEvents(c).forEach(function(e){
    if(e.type==="NO_DELIVERY_CLOSED"){var x=tms(e.timestamp||e.createdAt);if(isFinite(x)&&x>=start)candidates.push(x);}
  });
  if(v228ClosedText(status)){var x=tms(c.closedAt)||tms(c.updatedAt);if(isFinite(x)&&x>=start)candidates.push(x);}
  return candidates.length?Math.min.apply(Math,candidates):nowMs();
}
function v228NoDeliveryRecords(c){
  if(!v228NoDeliveryCase(c))return [];
  var rows=[],reports=c.noDeliveryReports||[];
  if(!reports.length)reports=[null];
  reports.forEach(function(rep){
    var starts=[];
    var first=tms(rep&&rep.createdAt);if(isFinite(first))starts.push(first);
    (c.requirements||[]).filter(function(r){return r.source==="no_entrega"||v228NoDeliveryText(JSON.stringify(r));}).forEach(function(r){
      var x=v228ReqStart(r);if(isFinite(x))starts.push(x);
    });
    caseEvents(c).forEach(function(e){
      if(e.type==="NO_DELIVERY_REQUIREMENT"){var x=tms(e.timestamp||e.createdAt);if(isFinite(x))starts.push(x);}
    });
    if(!starts.length){var x=tms(c.updatedAt)||tms(c.createdAt);if(isFinite(x))starts.push(x);}
    if(!starts.length)return;
    var start=Math.min.apply(Math,starts),end=v228NoDeliveryEnd(c,start,rep);
    var process=(rep&&rep.targetProcess)||c.currentProcess||"despacho_nacional";
    var area=(c.noDeliveryStatus==="DEVOLUCION_CAJA"||process==="caja")?"cartera":"despacho";
    var row={
      category:"No entrega",pedido:refOf(c),area:area,process:process,
      duration:workingMsBetween(start,end),start:start,end:end,
      open:!v228ClosedText((rep&&rep.status)||c.noDeliveryStatus||c.status||""),
      detail:(rep&&rep.detail)||"Pedido confirmado como no entregado",
      source:(rep?"cases.noDeliveryReports":"noDelivery/requirementType=no_entrega")+" · inicio → NO_DELIVERY_CLOSED/solución"
    };
    if(row.duration>0&&v228RecordInScope(row))rows.push(row);
  });
  return rows;
}
function v228BuildSpecialWait(m){
  var novelty=[],rework=[],noDelivery=[];
  (m.caseRows||[]).forEach(function(cm){
    novelty=novelty.concat(v228NoveltyRecords(cm.c,m));
    rework=rework.concat(v228ReworkRecords(cm.c));
    noDelivery=noDelivery.concat(v228NoDeliveryRecords(cm.c));
  });
  function sum(rows){return rows.reduce(function(s,x){return s+(x.duration||0);},0);}
  var all=novelty.concat(rework,noDelivery).sort(function(a,b){return b.duration-a.duration;});
  return {
    scope:v228Scope(),noveltyRows:novelty,reworkRows:rework,noDeliveryRows:noDelivery,all:all,
    novelty:sum(novelty),rework:sum(rework),noDelivery:sum(noDelivery),
    noveltyAverage:m.cases?sum(novelty)/m.cases:0,
    reworkAverage:m.cases?sum(rework)/m.cases:0,
    noDeliveryAverage:m.cases?sum(noDelivery)/m.cases:0,
    noveltyOpen:novelty.filter(function(x){return x.open;}).length,
    reworkOpen:rework.filter(function(x){return x.open;}).length,
    noDeliveryOpen:noDelivery.filter(function(x){return x.open;}).length
  };
}
function v228NoDeliveryAreaCount(m,area){
  var seen={};
  (m.specialWait.noDeliveryRows||[]).forEach(function(x){if(!area||x.area===area)seen[x.pedido]=1;});
  return Object.keys(seen).length;
}
async function compute(cases,cancelledCases){
  await computeV228Base(cases,cancelledCases);
  var m=app.metrics;if(!m)return;
  m.specialWait=v228BuildSpecialWait(m);
  m.noDeliveryCount=v228NoDeliveryAreaCount(m,"");
  (m.areaRows||[]).forEach(function(r){r.noDeliveries=v228NoDeliveryAreaCount(m,r.area);});
}
function v228WaitCard(title,value,detail,kind,scope,source){
  return '<article class="wait-card '+(kind||'')+'"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small><em class="wait-scope">'+esc(scope)+'</em><b class="wait-source">Fuente: '+esc(source)+'</b></article>';
}
function renderWaitBoard(){
  var m=app.metrics;if(!m||!m.specialWait)return;
  var w=m.specialWait,scope=w.scope.label;
  $("waitSectionTitle").textContent="Tiempos especiales de espera · "+scope;
  $("waitSectionSubtitle").textContent="Tres cálculos separados y excluyentes; cada uno usa etiquetas específicas de Firebase.";
  $("waitBoard").innerHTML=
    v228WaitCard("Espera en novedades",v225Time(w.novelty),"Creación hasta primera respuesta o resolución. "+w.noveltyOpen+" registro(s) abierto(s).",w.noveltyOpen?"warn":"ok",scope,"reportes_novedad.createdAt y cases.requirements.sentAt")+
    v228WaitCard("Espera en reproceso",v225Time(w.rework),"Solo el exceso sobre la meta cuando el pedido regresa a Ventas u otra etapa.",w.reworkOpen?"bad":(w.rework?"warn":"ok"),scope,"requirements.returnProcess/targetRole y eventos de retorno")+
    v228WaitCard("Espera en no entregas",v225Time(w.noDelivery),"Desde la confirmación de no entrega hasta solución o cierre. "+w.noDeliveryOpen+" caso(s) abierto(s).",w.noDeliveryOpen?"bad":(w.noDelivery?"warn":"ok"),scope,"noDeliveryReports, noDeliveryStatus, requirementType=no_entrega y NO_DELIVERY_*");

  var components=[
    {label:"Novedades",value:w.novelty,cls:"warn"},
    {label:"Reproceso fuera de meta",value:w.rework,cls:"bad"},
    {label:"No entregas",value:w.noDelivery,cls:"info"}
  ];
  $("waitComposition").innerHTML=
    '<article class="chart-card"><h3>Comparación de tiempos · '+esc(scope)+'</h3>'+
      v225ChartRows(components,function(r){return r.value;},function(r){return r.label;},function(r){return v225Time(r.value);},function(r){return r.cls;})+
      '<p class="metric-note">Los grupos son excluyentes: una no entrega no se vuelve a contabilizar como novedad o reproceso.</p></article>'+
    '<article class="chart-card"><h3>Origen de los tiempos calculados</h3><div class="wait-detail-list">'+
      (w.all.slice(0,15).map(function(x){
        return '<div class="wait-detail-row"><div><strong>'+esc(x.pedido)+'</strong><small>'+esc(v225AreaLabel(x.area))+(x.process?' · '+esc(processTitle(x.process)):'')+'</small></div><div><strong>'+esc(x.category)+'</strong><small>'+esc(x.detail)+'</small><small>'+esc(x.source)+'</small></div><span class="badge '+(x.open?'bad':'warn')+'">'+v225Time(x.duration)+'</span></div>';
      }).join("")||'<p class="muted">No existen registros trazables para los filtros seleccionados.</p>')+
    '</div></article>';
}
function renderSummary(){
  var m=app.metrics;if(!m)return;var w=m.specialWait;
  $("summary").innerHTML=
    v225Kpi("Total de pedidos",String(m.totalLoaded),"Base completa cargada desde Firestore","ok","Filtrados "+m.filteredTotal)+
    v225Kpi("WIP actual",String(m.wip),m.lateWip+" fuera de meta",m.lateWip?"bad":"ok","Pedidos abiertos")+
    v225Kpi("Cerrados",String(m.closed),"Throughput "+m.throughput+" por día","ok","Filtro actual")+
    v225Kpi("Lead Time P50",v225Time(m.leadP50),"Mediana en horas laborales","","P90 "+v225Time(m.leadP90))+
    v225Kpi("Picking promedio",v225Time(m.pickingAvg),m.pickingRows.length+" pedidos con alistamiento",m.pickingLate?"warn":"ok","P90 "+v225Time(m.pickingP90))+
    v225Kpi("Corte físico",v225Time(m.physicalCutAvg),m.physicalCuts+" cortes físicos","","P90 "+v225Time(m.physicalCutP90))+
    v225Kpi("Trabajo directo promedio",v225Time(m.vaAvg),"Actividad registrada por pedido","ok",m.eff+"% del LT")+
    v225Kpi("Bloqueo operativo",v225Time(m.waitAvg),"Esperas de proceso registradas; no equivale a improductividad",m.waitPct>30?"warn":"ok",m.waitPct+"% del LT")+
    v225Kpi("Espera en novedades",v225Time(w.noveltyAverage),"Promedio hasta primera respuesta o resolución",w.noveltyOpen?"warn":"ok",w.scope.label)+
    v225Kpi("Espera en reproceso",v225Time(w.reworkAverage),"Promedio del exceso sobre la meta",w.rework?"warn":"ok",w.scope.label)+
    v225Kpi("Espera en no entregas",v225Time(w.noDeliveryAverage),"Promedio desde no entrega hasta solución",w.noDeliveryOpen?"bad":"ok",w.scope.label)+
    v225Kpi("No entregas",String(m.noDeliveryCount),"Identificadas con etiquetas reales del flujo",m.noDeliveryCount?"warn":"ok","Filtro actual")+
    v225Kpi("Confiabilidad del proceso",m.reliability.avg+"%","Calidad de fechas, estados, responsables y procesos",m.reliability.avg>=90?"ok":(m.reliability.avg>=70?"warn":"bad"),m.reliability.low+" casos críticos")+
    v225Kpi("Cumplimiento documental",m.reliability.responsiblePct+"%","Pedidos con responsable identificado",m.reliability.responsiblePct>=90?"ok":"warn","Proceso "+m.reliability.processPct+"%");

  $("operationalFocus").innerHTML=
    v222Focus("alistamiento","Picking / alistamiento",v225Time(m.pickingAvg))+
    v222Focus("corte_cable","Corte de cable",v225Time(((m.processRows||[]).filter(function(x){return x.process==="corte_cable";})[0]||{}).avg||0))+
    v222Focus("recepcion_pedidos","Recepción de pedidos")+
    v222Focus("facturacion","Facturación");

  var bottle=m.bottleneck||{};
  $("bottleneck").innerHTML=bottle.label?'<strong>'+esc(bottle.label)+'</strong><p class="muted">Promedio '+v225Time(bottle.avg||0)+' · WIP '+Number(bottle.wip||0)+' · espera '+Number(bottle.waitPct||0)+'%.</p>':'<span class="muted">Sin datos suficientes.</span>';

  $("ltProductivityAnalysis").innerHTML='<div class="filter-summary"><strong>Interpretación:</strong> el Super Admin está excluido de tiempos, productividad, intervenciones y respuestas. Novedades, reprocesos y no entregas se calculan con etiquetas distintas. El reproceso solo cuenta el exceso sobre la meta; una no entrega no se duplica.</div>';
  $("deepKpis").innerHTML=
    v225Kpi("Eficiencia de flujo",m.eff+"%","Trabajo directo / Lead Time observado",m.eff>=55?"ok":(m.eff>=35?"warn":"bad"),"No es productividad individual")+
    v225Kpi("Calidad de trazabilidad",m.dataQualityPct+"%",m.incomplete+" pedido(s) con datos incompletos",m.incomplete?"warn":"ok","Base "+m.cases)+
    v225Kpi("Novedades pendientes",m.reportPending+"",m.reportCount+" novedades analizadas",m.reportPending?"warn":"ok")+
    v225Kpi("Cortes registrados",m.doneCuts+" / "+m.totalCuts,"Finalizados, medida completa o no necesita corte",m.totalCuts&&m.doneCuts<m.totalCuts?"warn":"ok");

  v225FilterSummary();renderCoverage();renderWaitBoard();renderAreaBoard();renderProcessFlow();renderActorBoard();renderPowerCharts();renderReliability();renderAlerts();
}
function renderReliability(){
  var m=app.metrics;if(!m)return;var r=m.reliability;
  $("reliabilityBoard").innerHTML=
    '<article class="reliability-card"><h3>Confiabilidad general</h3><strong>'+r.avg+'%</strong><small>Calidad promedio de fechas, estados, responsables y proceso.</small></article>'+
    '<article class="reliability-card"><h3>Registros confiables</h3><strong>'+r.high+'</strong><small>Casos con confiabilidad igual o superior al 90%.</small></article>'+
    '<article class="reliability-card"><h3>Registros por revisar</h3><strong>'+r.medium+'</strong><small>Casos entre 70% y 89%.</small></article>'+
    '<article class="reliability-card"><h3>Registros críticos</h3><strong>'+r.low+'</strong><small>Casos por debajo de 70%.</small></article>'+
    '<article class="reliability-card"><h3>No entregas</h3><strong>'+m.noDeliveryCount+'</strong><small>Identificadas con noDelivery, noDeliveryReports, requirementType=no_entrega o eventos NO_DELIVERY_*.</small></article>'+
    '<article class="reliability-card"><h3>Responsable identificado</h3><strong>'+r.responsiblePct+'%</strong><small>Pedidos con actor o rol responsable registrado.</small></article>';
}
function renderAreaBoard(){
  var m=app.metrics;if(!m)return;
  $("areaBoard").innerHTML=(m.areaRows||[]).map(function(r){
    var status=v225Status(r.compliance,85,65);
    return '<article class="process-card '+(status.cls==="bad"?'late':'')+'"><div class="process-title"><h3>'+esc(r.label)+'</h3><span class="status-chip '+status.cls+'">'+status.label+'</span></div><div class="process-main"><div><span>LT promedio</span><strong>'+v225Time(r.avg)+'</strong></div><div><span>Cumplimiento</span><strong>'+r.compliance+'%</strong></div></div><div class="process-stats"><div><span>Trabajo</span><b>'+v225Time(r.work)+'</b></div><div><span>Bloqueo</span><b>'+v225Time(r.block)+'</b></div><div><span>WIP</span><b>'+r.wip+'</b></div></div><div class="progress"><i style="width:'+Math.max(0,Math.min(100,r.compliance))+'%"></i></div><small class="metric-note">Casos '+r.cases+' · cerrados '+r.closed+' · actores '+r.workers+' · confiabilidad '+r.reliability+'% · no entregas '+Number(r.noDeliveries||0)+'</small></article>';
  }).join("")||'<p class="muted">Sin datos suficientes por área.</p>';
}
function renderPowerCharts(){
  var m=app.metrics;if(!m)return;var proc=(m.processRows||[]).filter(function(r){return r.cases||r.wip;});
  $("powerCharts").innerHTML=
    '<article class="chart-card"><h3>LT promedio por proceso</h3>'+v225ChartRows(proc,function(r){return r.avg;},function(r){return r.label;},function(r){return v225Time(r.avg);})+'</article>'+
    '<article class="chart-card"><h3>Cumplimiento por proceso</h3>'+v225ChartRows(proc,function(r){return r.slaPct;},function(r){return r.label;},function(r){return r.slaPct+"%";},function(r){return r.slaPct>=85?"ok":(r.slaPct>=65?"warn":"bad");})+'</article>'+
    '<article class="chart-card"><h3>WIP por proceso</h3>'+v225ChartRows(proc.slice().sort(function(a,b){return b.wip-a.wip;}),function(r){return r.wip;},function(r){return r.label;},function(r){return r.wip+" · "+r.wipLate+" atras.";},function(r){return r.wipLate?"bad":"ok";})+'</article>'+
    '<article class="chart-card"><h3>Confiabilidad por área</h3>'+v225ChartRows(m.areaRows,function(r){return r.reliability;},function(r){return r.label;},function(r){return r.reliability+"%";},function(r){return r.reliability>=90?"ok":(r.reliability>=70?"warn":"bad");})+'</article>'+
    '<article class="chart-card"><h3>Trabajo directo por actor</h3>'+v225ChartRows((m.actorRows||[]).slice(0,12),function(r){return r.active;},function(r){return r.user;},function(r){return v225Time(r.active)+" · "+r.count+" casos";},function(){return "ok";})+'</article>'+
    '<article class="chart-card"><h3>No entregas por área</h3>'+v225ChartRows(m.areaRows,function(r){return Number(r.noDeliveries||0);},function(r){return r.label;},function(r){return Number(r.noDeliveries||0)+" pedido(s)";},function(r){return r.noDeliveries?"warn":"ok";})+'</article>';

  var w=m.specialWait,total=Math.max(1,m.leadTotal||0),work=v225Pct(m.va,total),block=v225Pct(m.wait,total);
  var special=v225Pct(w.novelty+w.rework+w.noDelivery,total),rest=Math.max(0,100-work-block-special);
  $("quickBars").innerHTML='<article class="chart-card"><h3>Composición del Lead Time · '+esc(w.scope.label)+'</h3><div class="stack"><i class="va" style="width:'+work+'%"></i><i class="wait" style="width:'+block+'%"></i><i style="width:'+special+'%;background:#7c3aed"></i><i style="width:'+rest+'%;background:#2563eb"></i></div><div class="legend"><span><i class="dot va"></i>Trabajo directo '+work+'%</span><span><i class="dot wait"></i>Bloqueo operativo '+block+'%</span><span><i class="dot" style="background:#7c3aed"></i>Esperas especiales '+special+'%</span><span><i class="dot" style="background:#2563eb"></i>Transferencia/ejecución contextual '+rest+'%</span></div><p class="metric-note">Las esperas especiales son diagnósticas y excluyentes.</p></article>';
}
function renderTableV230Base(){
  var m=app.metrics;if(!m)return;var view=$("fView").value;
  if(view==="areas"){
    $("tableTitle").textContent="Resumen por área";$("rowCount").textContent=m.areaRows.length+" área(s) · total cargado "+m.totalLoaded;
    $("mainTable").innerHTML=v225Table(["Área","Casos","WIP","Cerrados","LT promedio","Trabajo directo","Bloqueo","Cumplimiento","Confiabilidad","No entregas","Actores"],m.areaRows.map(function(r){return '<tr><td><strong>'+esc(r.label)+'</strong></td><td>'+r.cases+'</td><td>'+r.wip+'</td><td>'+r.closed+'</td><td>'+v225Time(r.avg)+'</td><td>'+v225Time(r.work)+'</td><td>'+v225Time(r.block)+'</td><td>'+r.compliance+'%</td><td>'+r.reliability+'%</td><td>'+Number(r.noDeliveries||0)+'</td><td>'+r.workers+'</td></tr>';}));return;
  }
  if(view==="confiabilidad"){
    $("tableTitle").textContent="Confiabilidad del proceso";
    var rows=(m.caseRows||[]).map(function(cm){var r=v225ReliabilityForCase(cm);return {cm:cm,r:r};}).sort(function(a,b){return a.r.score-b.r.score;});
    $("rowCount").textContent=rows.length+" pedido(s) · total cargado "+m.totalLoaded;
    $("mainTable").innerHTML=v225Table(["Pedido","Cliente","Proceso","Estado","Responsable","Confiabilidad","No entrega","Hallazgos"],rows.map(function(x){var c=x.cm.c,noDelivery=v228NoDeliveryCase(c);var issues=(x.r.issues||[]).filter(function(i){return i!=="reproceso/devolución";});return '<tr><td><strong>'+esc(refOf(c))+'</strong></td><td>'+esc(c.client||"")+'</td><td>'+esc(processTitle(c.currentProcess))+'</td><td>'+esc(c.status||"")+'</td><td>'+esc(c.assignedName||advisor(c)||"Sin responsable")+'</td><td>'+x.r.score+'%</td><td>'+(noDelivery?'<span class="badge warn">Sí</span>':'<span class="badge ok">No</span>')+'</td><td>'+esc(issues.join(", ")||"Sin hallazgos")+'</td></tr>';}));return;
  }
  if(view==="esperas"){
    var rows=m.specialWait.all||[];
    $("tableTitle").textContent="Trazabilidad de tiempos de espera · "+m.specialWait.scope.label;$("rowCount").textContent=rows.length+" registro(s) · total cargado "+m.totalLoaded;
    $("mainTable").innerHTML=v225Table(["Pedido","Categoría","Área","Proceso","Inicio","Fin/corte","Duración calculada","Abierto","Origen del cálculo","Detalle"],rows.map(function(x){return '<tr><td><strong>'+esc(x.pedido)+'</strong></td><td>'+esc(x.category)+'</td><td>'+esc(v225AreaLabel(x.area))+'</td><td>'+esc(processTitle(x.process))+'</td><td>'+esc(dateTxt(x.start))+'</td><td>'+esc(dateTxt(x.end))+'</td><td><strong>'+v225Time(x.duration)+'</strong></td><td>'+(x.open?'<span class="badge bad">Sí</span>':'<span class="badge ok">No</span>')+'</td><td>'+esc(x.source)+'</td><td>'+esc(x.detail)+'</td></tr>';}));return;
  }
  renderTableV228Base();$("rowCount").textContent=$("rowCount").textContent+" · total cargado "+m.totalLoaded;
}
function bindV232Base(){bindV228Base();}


/* ============================================================
   V230 · LEAD TIME REAL DE VENTAS
   Ventas se calcula por intervenciones, no por processStats vacío.
============================================================ */
function v230RoleIsSales(value){
  var k=v229NormalizeRole(value||"");
  return k==="ventas"||k==="asesor"||k==="asesor_ventas"||k==="vendedor";
}
function v230ArrayHasSales(value){
  if(!Array.isArray(value))return false;
  return value.some(function(x){return v230RoleIsSales(x);});
}
function v230ObjectTargetsSales(o){
  if(!o)return false;
  if(v230RoleIsSales(o.targetRole)||v230RoleIsSales(o.assignedRole)||v230RoleIsSales(o.role))return true;
  if(v230ArrayHasSales(o.targetRoles)||v230ArrayHasSales(o.visibleRoles))return true;
  var txt=lower([
    o.targetRole,o.assignedRole,o.sourceRole,o.returnRole,o.title,o.category,
    o.detail,o.description,o.reason,o.type,o.status,o.sourceModule
  ].join(" "));
  return /(^|\s|_|-)ventas?(\s|_|-|$)|asesor(?: de)? ventas|vendedor/.test(txt);
}
function v230EpisodeKey(x){
  return [x.type,x.start,x.end,x.source].join("|");
}
function v230InitialSalesEpisode(cm){
  var c=cm.c,start=cm.start;
  if(!isFinite(start))return null;
  var nextStarts=(cm.pRows||[]).map(function(p){return p.start;})
    .filter(function(x){return isFinite(x)&&x>=start;})
    .sort(function(a,b){return a-b;});
  var end=nextStarts.length?nextStarts[0]:NaN;
  if(!isFinite(end)||end<=start){
    var salesRegistered=tms((c.documentFlow||{}).salesRegisteredAt);
    var updated=v231OperationalUpdatedAt(c);
    if(isFinite(salesRegistered)&&salesRegistered>start)end=salesRegistered;
    else if(isFinite(updated)&&updated>start&&c.currentProcess!=="ventas")end=updated;
  }
  if(!isFinite(end)||end<=start)return null;
  return {
    type:"Registro inicial",
    start:start,end:end,open:false,
    source:"cases.createdAt → primera entrada a un proceso operativo",
    detail:"Registro y liberación inicial del pedido por Ventas"
  };
}
function v230SalesRequirementEpisodes(c){
  return v228RequirementList(c).filter(function(item){
    var r=item.r||{};
    return v230ObjectTargetsSales(r)
      || v230RoleIsSales(r.targetRole)
      || v230RoleIsSales(r.returnRole)
      || /ventas|asesor|vendedor/.test(lower([r.reason,r.detail,r.description].join(" ")));
  }).map(function(item){
    var r=item.r||{};
    return {
      type:v228RequirementClass(c,item)==="rework"?"Retorno a Ventas":"Requerimiento a Ventas",
      start:item.start,end:item.end,open:item.open,
      source:item.source+" · sentAt/createdAt → answeredAt/resolvedAt",
      detail:r.reason||r.detail||r.description||"Intervención solicitada a Ventas"
    };
  });
}
function v230SalesReportEpisodes(c){
  return reportMetricsForCase(c).filter(function(metric){
    var r=metric.report||{};
    return v230ObjectTargetsSales(r)
      || v230RoleIsSales(r.targetRole)
      || v230ArrayHasSales(r.targetRoles)
      || /ventas|asesor|vendedor/.test(lower([r.title,r.category,r.detail,r.description].join(" ")));
  }).map(function(metric){
    var r=metric.report||{};
    return {
      type:"Novedad a Ventas",
      start:metric.created,
      end:metric.firstResponse||nowMs(),
      open:!!metric.pending,
      source:"reportes_novedad.createdAt → primera respuesta",
      detail:r.title||r.category||r.description||"Novedad dirigida a Ventas"
    };
  }).filter(function(x){return isFinite(x.start)&&isFinite(x.end)&&x.end>=x.start;});
}
function v230SalesEventEpisodes(c,existing){
  var events=caseEvents(c).filter(function(e){return !v231IsExcludedSuperAdmin(e);}).slice().sort(function(a,b){
    return (tms(a.timestamp||a.createdAt||a.updatedAt)||0)-(tms(b.timestamp||b.createdAt||b.updatedAt)||0);
  });
  var starts=(existing||[]).map(function(x){return x.start;});
  var rows=[];
  events.forEach(function(e,i){
    var at=tms(e.timestamp||e.createdAt||e.updatedAt);
    if(!isFinite(at))return;
    if(starts.some(function(s){return Math.abs(s-at)<300000;}))return;
    var txt=lower([e.type,e.detail,e.reason,e.status,e.targetRole,e.returnRole,e.targetProcess].join(" "));
    var target=v230ObjectTargetsSales(e)||/^RETURN_TO_SALES|REQUIREMENT_TO_SALES|SALES_REQUIREMENT/.test(String(e.type||""));
    if(!target&&!/devuelt.*ventas|regres.*ventas|enviad.*ventas|solicitud.*ventas/.test(txt))return;
    var end=NaN;
    for(var j=i+1;j<events.length;j++){
      var n=events[j],nAt=tms(n.timestamp||n.createdAt||n.updatedAt);
      if(!isFinite(nAt)||nAt<=at)continue;
      var nTxt=lower([n.type,n.detail,n.status,n.process,n.currentProcess].join(" "));
      if(/respond|resuelt|cerrad|liberad|transfer|enviad|retornad|continuar/.test(nTxt)
         || (n.process&&n.process!=="ventas")
         || (n.currentProcess&&n.currentProcess!=="ventas")){
        end=nAt;break;
      }
    }
    if(!isFinite(end))end=tms(c.updatedAt)||nowMs();
    if(end<=at)return;
    rows.push({
      type:"Retorno a Ventas",
      start:at,end:end,open:!isClosed(c),
      source:"case_events · evento dirigido a Ventas → siguiente respuesta/transferencia",
      detail:e.detail||e.reason||e.type||"Pedido regresado a Ventas"
    });
  });
  return rows;
}
function v230SalesDirectMs(c,episode){
  var trace=allTraceEvents(c).filter(function(e){
    if(e.ms<episode.start||e.ms>episode.end)return false;
    return v230RoleIsSales(e.role)
      || /ventas|asesor|vendedor/.test(lower([e.user,e.role,e.detail].join(" ")));
  }).sort(function(a,b){return a.ms-b.ms;});
  var direct=0;
  for(var i=0;i<trace.length;i++){
    var e=trace[i];
    if(e.kind!=="active")continue;
    var end=i<trace.length-1?Math.min(trace[i+1].ms,episode.end):episode.end;
    if(end>e.ms)direct+=workingMsBetween(e.ms,end);
  }
  return Math.min(workingMsBetween(episode.start,episode.end),direct);
}
function v230SalesEpisodes(cm){
  var c=cm.c,rows=[],seen={};
  function add(x){
    if(!x||!isFinite(x.start)||!isFinite(x.end)||x.end<=x.start)return;
    var key=v230EpisodeKey(x);
    if(seen[key])return;
    // Evitar duplicados cercanos de requirement/report/event.
    var duplicate=rows.some(function(r){
      return Math.abs(r.start-x.start)<300000
        && Math.abs(r.end-x.end)<300000;
    });
    if(duplicate)return;
    seen[key]=1;
    x.duration=workingMsBetween(x.start,x.end);
    if(x.duration<=0)return;
    x.direct=v230SalesDirectMs(c,x);
    x.wait=Math.max(0,x.duration-x.direct);
    x.slaHours=4;
    x.onTime=x.duration<=4*3600000;
    rows.push(x);
  }
  add(v230InitialSalesEpisode(cm));
  v230SalesRequirementEpisodes(c).forEach(add);
  v230SalesReportEpisodes(c).forEach(add);
  v230SalesEventEpisodes(c,rows).forEach(add);
  return rows.sort(function(a,b){return a.start-b.start;});
}
function v230SalesCaseRows(m){
  return (m.caseRows||[]).map(function(cm){
    return {cm:cm,episodes:v230SalesEpisodes(cm)};
  }).filter(function(x){return x.episodes.length>0;});
}
function v225AreaTouches(c,area){
  if(!area)return true;
  if(area==="ventas"){
    if(c.salesAdvisor||c.createdBy||c.createdByName||c.createdByEmail)return true;
    if(v228RequirementList(c).some(function(x){return v230ObjectTargetsSales(x.r||{});} ))return true;
    if(reportMetricsForCase(c).some(function(x){return v230ObjectTargetsSales(x.report||{});} ))return true;
    return caseEvents(c).some(v230ObjectTargetsSales);
  }
  var def=V225_AREA_DEF[area]||{processes:[]},ps=c.processStats||{};
  return def.processes.some(function(p){
    return c.currentProcess===p||!!ps[p]||(p==="corte_cable"&&(c.cutRequests||[]).length>0);
  });
}
function v225BuildAreaRows(m){
  return V225_AREA_ORDER.map(function(area){
    if(area==="ventas"){
      var salesCases=v230SalesCaseRows(m);
      if(!salesCases.length)return null;
      var episodes=[];
      salesCases.forEach(function(x){episodes=episodes.concat(x.episodes);});
      var total=episodes.reduce(function(s,x){return s+x.duration;},0);
      var direct=episodes.reduce(function(s,x){return s+x.direct;},0);
      var wait=episodes.reduce(function(s,x){return s+x.wait;},0);
      var open=episodes.filter(function(x){return x.open;}).length;
      var onTime=episodes.filter(function(x){return x.onTime;}).length;
      var workers={};
      salesCases.forEach(function(x){
        var c=x.cm.c,adv=advisor(c);
        if(adv&&!v231IsExcludedSuperAdmin({
          name:adv,email:c.createdByEmail||c.salesAdvisorEmail,
          uid:c.createdBy||c.createdByUid,role:c.createdByRole||c.salesAdvisorRole
        }))workers[normKey(adv)]=1;
        allTraceEvents(c).forEach(function(e){
          if(v230RoleIsSales(e.role)&&e.user)workers[normKey(e.user)]=1;
        });
      });
      var reliabilities=salesCases.map(function(x){return v225ReliabilityForCase(x.cm);});
      var noDeliveries=(m.specialWait&&m.specialWait.noDeliveryRows||[]).filter(function(x){return x.area==="ventas";});
      return {
        area:"ventas",label:"Ventas",
        cases:salesCases.length,
        interventions:episodes.length,
        wip:open,
        closed:episodes.length-open,
        avg:episodes.length?total/episodes.length:0,
        work:episodes.length?direct/episodes.length:0,
        block:episodes.length?wait/episodes.length:0,
        unexplained:0,
        compliance:episodes.length?v225Pct(onTime,episodes.length):0,
        rework:episodes.filter(function(x){return x.type==="Retorno a Ventas";}).length,
        reliability:Math.round(v225Mean(reliabilities.map(function(x){return x.score;}))),
        workers:Object.keys(workers).length,
        utilization:0,utilizationPct:0,
        noDeliveries:noDeliveries.length,
        salesEpisodes:episodes
      };
    }

    var def=V225_AREA_DEF[area],caseRows=(m.caseRows||[]).filter(function(cm){
      return (cm.pRows||[]).some(function(p){return def.processes.indexOf(p.process)>=0;});
    });
    if(!caseRows.length)return null;
    var procRows=(m.processRows||[]).filter(function(r){return def.processes.indexOf(r.process)>=0;});
    var cases=caseRows.length,wip=caseRows.filter(function(cm){return !cm.closed&&v225AreaForProcess(cm.c.currentProcess)===area;}).length;
    var closed=caseRows.filter(function(cm){return cm.closed;}).length;
    var total=procRows.reduce(function(s,r){return s+(r.total||0);},0);
    var active=procRows.reduce(function(s,r){return s+(r.active||0);},0);
    var wait=procRows.reduce(function(s,r){return s+(r.wait||0);},0);
    var residual=Math.max(0,total-active-wait);
    var avg=cases?total/cases:0,work=cases?active/cases:0,block=cases?wait/cases:0;
    var unexplained=cases?residual/cases:0;
    var complianceDen=procRows.reduce(function(s,r){return s+(r.slaCount||0);},0);
    var complianceNum=procRows.reduce(function(s,r){return s+(r.slaOk||0);},0);
    var compliance=complianceDen?v225Pct(complianceNum,complianceDen):0;
    var rework=caseRows.reduce(function(s,cm){return s+v225CountRework(cm.c);},0);
    var reliabilities=caseRows.map(v225ReliabilityForCase);
    var reliability=Math.round(v225Mean(reliabilities.map(function(x){return x.score;})));
    var workers={};
    caseRows.forEach(function(cm){
      (cm.pRows||[]).filter(function(p){return def.processes.indexOf(p.process)>=0;}).forEach(function(p){
        personsForProcess(cm.c,p.process).forEach(function(x){if(!x.synthetic)workers[x.key]=1;});
      });
    });
    var workerCount=Object.keys(workers).length;
    var period=v226PeriodWindow(m);
    var utilization=period.hours&&workerCount?active/(period.hours*3600000*workerCount):0;
    return {
      area:area,label:v225AreaLabel(area),cases:cases,wip:wip,closed:closed,avg:avg,work:work,block:block,
      unexplained:unexplained,compliance:compliance,rework:rework,reliability:reliability,
      workers:workerCount,utilization:utilization,utilizationPct:Math.round(utilization*100),
      noDeliveries:0
    };
  }).filter(Boolean);
}
function renderAreaBoard(){
  var m=app.metrics;if(!m)return;
  $("areaBoard").innerHTML=(m.areaRows||[]).map(function(r){
    var status=v225Status(r.compliance,85,65);
    if(r.area==="ventas"){
      return '<article class="process-card '+(status.cls==="bad"?'late':'')+'">'+
        '<div class="process-title"><h3>Ventas</h3><span class="status-chip '+status.cls+'">'+status.label+'</span></div>'+
        '<div class="process-main"><div><span>LT por intervención</span><strong>'+v225Time(r.avg)+'</strong></div><div><span>Cumplimiento 4 h</span><strong>'+r.compliance+'%</strong></div></div>'+
        '<div class="process-stats"><div><span>Intervenciones</span><b>'+r.interventions+'</b></div><div><span>Abiertas</span><b>'+r.wip+'</b></div><div><span>Trabajo trazado</span><b>'+v225Time(r.work)+'</b></div></div>'+
        '<div class="progress"><i style="width:'+Math.max(0,Math.min(100,r.compliance))+'%"></i></div>'+
        '<small class="metric-note">Pedidos '+r.cases+' · respuestas cerradas '+r.closed+' · actores '+r.workers+' · confiabilidad '+r.reliability+'%. Incluye registro inicial, requerimientos, novedades y retornos a Ventas.</small>'+
      '</article>';
    }
    return '<article class="process-card '+(status.cls==="bad"?'late':'')+'">'+
      '<div class="process-title"><h3>'+esc(r.label)+'</h3><span class="status-chip '+status.cls+'">'+status.label+'</span></div>'+
      '<div class="process-main"><div><span>LT promedio</span><strong>'+v225Time(r.avg)+'</strong></div><div><span>Cumplimiento</span><strong>'+r.compliance+'%</strong></div></div>'+
      '<div class="process-stats"><div><span>Trabajo</span><b>'+v225Time(r.work)+'</b></div><div><span>Bloqueo</span><b>'+v225Time(r.block)+'</b></div><div><span>WIP</span><b>'+r.wip+'</b></div></div>'+
      '<div class="progress"><i style="width:'+Math.max(0,Math.min(100,r.compliance))+'%"></i></div>'+
      '<small class="metric-note">Casos '+r.cases+' · cerrados '+r.closed+' · actores '+r.workers+' · confiabilidad '+r.reliability+'% · no entregas '+Number(r.noDeliveries||0)+'</small>'+
    '</article>';
  }).join("")||'<p class="muted">Sin datos suficientes por área.</p>';
}
function renderTable(){
  var m=app.metrics;if(!m)return;
  if($("fView").value==="areas"){
    $("tableTitle").textContent="Resumen por área";
    $("rowCount").textContent=m.areaRows.length+" área(s) · total cargado "+m.totalLoaded;
    $("mainTable").innerHTML=v225Table(
      ["Área","Casos/pedidos","Intervenciones","WIP/abiertas","Cerrados","LT promedio","Trabajo directo","Espera/atención","Cumplimiento","Confiabilidad","Actores"],
      m.areaRows.map(function(r){
        return '<tr><td><strong>'+esc(r.label)+'</strong></td>'+
          '<td>'+r.cases+'</td>'+
          '<td>'+(r.area==="ventas"?r.interventions:"—")+'</td>'+
          '<td>'+r.wip+'</td>'+
          '<td>'+r.closed+'</td>'+
          '<td><strong>'+v225Time(r.avg)+'</strong></td>'+
          '<td>'+v225Time(r.work)+'</td>'+
          '<td>'+v225Time(r.block)+'</td>'+
          '<td>'+r.compliance+'%</td>'+
          '<td>'+r.reliability+'%</td>'+
          '<td>'+r.workers+'</td></tr>';
      })
    );
    return;
  }
  renderTableV230Base();
}


/* ============================================================
   V231 · EXCLUSIÓN DEL SUPER ADMIN EN RESPUESTAS OPERATIVAS
============================================================ */
function v228ReqEnd(r,open){
  r=r||{};
  var candidates=[
    {at:r.answeredAt,name:r.answeredByName,email:r.answeredByEmail,uid:r.answeredBy,role:r.answeredByRole},
    {at:r.resolvedAt,name:r.resolvedByName,email:r.resolvedByEmail,uid:r.resolvedBy,role:r.resolvedByRole},
    {at:r.closedAt,name:r.closedByName,email:r.closedByEmail,uid:r.closedBy,role:r.closedByRole},
    {at:r.completedAt,name:r.completedByName,email:r.completedByEmail,uid:r.completedBy,role:r.completedByRole},
    {at:r.respondedAt,name:r.respondedByName,email:r.respondedByEmail,uid:r.respondedBy,role:r.respondedByRole}
  ].filter(function(x){return !v231IsExcludedSuperAdmin(x);})
   .map(function(x){return tms(x.at);}).filter(isFinite);
  if(candidates.length)return Math.min.apply(Math,candidates);
  if(v228ClosedText(r.status)){
    var updater={name:r.updatedByName,email:r.updatedByEmail,uid:r.updatedBy||r.updatedByUid,role:r.updatedByRole};
    var updated=tms(r.updatedAt);
    if(isFinite(updated)&&!v231IsExcludedSuperAdmin(updater))return updated;
  }
  return open?nowMs():NaN;
}
function v228RequirementList(c){
  var out=[],seen={};
  function add(r,source,forceOpen){
    if(!r||v231IsExcludedSuperAdmin({
      name:r.sentByName||r.createdByName,
      email:r.sentByEmail||r.createdByEmail,
      uid:r.sentBy||r.createdBy,
      role:r.sentByRole||r.createdByRole
    }))return;
    var start=v228ReqStart(r)||tms(c.waitStartedAt);
    var key=String(r.id||[start,r.reason,r.targetRole,r.source,r.returnProcess].join("|"));
    if(seen[key])return;
    seen[key]=1;
    var operationalEnd=v228ReqEnd(r,false);
    var open=forceOpen===true||!isFinite(operationalEnd);
    var end=isFinite(operationalEnd)?operationalEnd:nowMs();
    if(!isFinite(start)||!isFinite(end)||end<start)return;
    out.push({r:r,source:source,start:start,end:end,open:open});
  }
  (c.requirements||[]).forEach(function(r){add(r,"cases.requirements",false);});
  add(c.openRequirement,"cases.openRequirement",true);
  return out;
}
function v228NoDeliveryEnd(c,start,report){
  var candidates=[];
  function add(at,actor){
    var x=tms(at);
    if(isFinite(x)&&x>=start&&!v231IsExcludedSuperAdmin(actor||{}))candidates.push(x);
  }
  add(report&&report.closedAt,{name:report&&report.closedByName,email:report&&report.closedByEmail,uid:report&&report.closedBy,role:report&&report.closedByRole});
  add(report&&report.resolvedAt,{name:report&&report.resolvedByName,email:report&&report.resolvedByEmail,uid:report&&report.resolvedBy,role:report&&report.resolvedByRole});
  add(report&&report.completedAt,{name:report&&report.completedByName,email:report&&report.completedByEmail,uid:report&&report.completedBy,role:report&&report.completedByRole});
  (report&&report.history||[]).forEach(function(h){
    if(v228ClosedText([h.action,h.status,h.detail].join(" "))&&!v231IsExcludedSuperAdmin(h)){
      add(h.at||h.timestamp||h.createdAt,h);
    }
  });
  (c.requirements||[]).filter(function(r){return r.source==="no_entrega"||v228NoDeliveryText(JSON.stringify(r));}).forEach(function(r){
    var end=v228ReqEnd(r,false);
    if(isFinite(end)&&end>=start)candidates.push(end);
  });
  caseEvents(c).filter(function(e){return !v231IsExcludedSuperAdmin(e);}).forEach(function(e){
    if(e.type==="NO_DELIVERY_CLOSED")add(e.timestamp||e.createdAt,e);
  });
  if(v228ClosedText((report&&report.status)||c.noDeliveryStatus||c.status||"")){
    add(c.closedAt||c.updatedAt,{
      name:c.closedByName||c.updatedByName,email:c.closedByEmail||c.updatedByEmail,
      uid:c.closedBy||c.updatedBy,role:c.closedByRole||c.updatedByRole
    });
  }
  return candidates.length?Math.min.apply(Math,candidates):nowMs();
}


/* ============================================================
   V232 · GENERADOR DE INFORMES INTELIGENTES
============================================================ */
function v232StoredValue(key){
  try{return localStorage.getItem(key)||"";}catch(e){return "";}
}
function v232StoreValue(key,value){
  try{localStorage.setItem(key,value||"");}catch(e){}
}
function v232CurrentScopeText(){
  var parts=[];
  var from=$("fFrom")&&$("fFrom").value,to=$("fTo")&&$("fTo").value;
  if(from||to)parts.push("Periodo: "+(from||"inicio")+" a "+(to||"fecha actual"));
  else parts.push("Periodo: todo el histórico cargado");
  if($("fArea")&&$("fArea").value)parts.push("Área: "+v225AreaLabel($("fArea").value));
  if($("fProcess")&&$("fProcess").value)parts.push("Proceso: "+processTitle($("fProcess").value));
  if($("fOrderType")&&$("fOrderType").value)parts.push("Tipo: "+($("fOrderType").value==="pve"?"PVE":"Normal"));
  if($("fStatus")&&$("fStatus").value)parts.push("Estado: "+$("fStatus").options[$("fStatus").selectedIndex].text);
  if($("fUser")&&$("fUser").value)parts.push("Actor: "+$("fUser").options[$("fUser").selectedIndex].text);
  if($("fSla")&&$("fSla").value)parts.push("Cumplimiento: "+$("fSla").options[$("fSla").selectedIndex].text);
  if(clean($("fSearch")&&$("fSearch").value))parts.push('Búsqueda: "'+clean($("fSearch").value)+'"');
  return parts.join(" · ");
}
function v232OpenReportModal(){
  if(!app.metrics){
    status("Primero deben cargarse y calcularse los datos del VSM.","bad");
    return;
  }
  var modal=$("smartReportModal");
  if(!modal){
    status("El formulario del generador no está disponible en esta versión del HTML.","bad");
    return;
  }
  $("smartReportScope").innerHTML="<strong>Alcance que se utilizará:</strong> "+esc(v232CurrentScopeText())+
    "<br><strong>Base actual:</strong> "+Number(app.metrics.totalLoaded||app.cases.length||0)+" pedidos cargados · "+
    Number(app.metrics.cases||0)+" trazados en los indicadores.";
  $("reportAuthor").value=v232StoredValue("ei_vsm_report_author")||((app.user&&app.user.displayName)||"");
  $("reportPosition").value=v232StoredValue("ei_vsm_report_position");
  $("reportDepartment").value=v232StoredValue("ei_vsm_report_department");
  $("reportAudience").value=v232StoredValue("ei_vsm_report_audience");
  $("reportPeriodName").value=v232StoredValue("ei_vsm_report_period");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  setTimeout(function(){$("reportAuthor").focus();},50);
}
function v232CloseReportModal(){
  var modal=$("smartReportModal");
  if(!modal)return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
}
function v232CollectMeta(){
  var meta={
    author:clean($("reportAuthor").value),
    position:clean($("reportPosition").value),
    department:clean($("reportDepartment").value),
    audience:clean($("reportAudience").value),
    type:$("reportType").value,
    format:$("reportFormat").value,
    title:clean($("reportDocumentTitle").value),
    objective:clean($("reportObjective").value),
    confidentiality:$("reportConfidentiality").value,
    periodName:clean($("reportPeriodName").value),
    notes:clean($("reportNotes").value),
    includeOrders:$("reportIncludeOrders").checked,
    includeActors:$("reportIncludeActors").checked,
    includeMethodology:$("reportIncludeMethodology").checked,
    includeActionPlan:$("reportIncludeActionPlan").checked,
    includeAlerts:$("reportIncludeAlerts").checked,
    includeWaits:$("reportIncludeWaits").checked,
    scope:v232CurrentScopeText(),
    generatedAt:new Date()
  };
  if(!meta.author||!meta.position||!meta.department||!meta.audience||!meta.title||!meta.objective){
    throw new Error("Complete todos los campos obligatorios del informe.");
  }
  v232StoreValue("ei_vsm_report_author",meta.author);
  v232StoreValue("ei_vsm_report_position",meta.position);
  v232StoreValue("ei_vsm_report_department",meta.department);
  v232StoreValue("ei_vsm_report_audience",meta.audience);
  v232StoreValue("ei_vsm_report_period",meta.periodName);
  return meta;
}
function v232TypeLabel(type){
  return {
    ejecutivo:"Informe ejecutivo para toma de decisiones",
    operativo:"Informe operativo detallado",
    productividad:"Informe de productividad",
    auditoria:"Informe de auditoría y confiabilidad",
    comite:"Informe para comité de seguimiento"
  }[type]||"Informe analítico";
}
function v232Average(values){
  values=(values||[]).filter(function(x){return isFinite(x);});
  return values.length?values.reduce(function(s,x){return s+x;},0)/values.length:0;
}
function v232OverallScore(m){
  var proc=(m.processRows||[]).filter(function(r){return r.cases>0;});
  var compliance=v232Average(proc.map(function(r){return Number(r.slaPct||0);}));
  var reliability=Number((m.reliability||{}).avg||0);
  var wipScore=m.wip?Math.max(0,100-(Number(m.lateWip||0)/m.wip*100)):100;
  var traceBase=Math.max(1,Number(m.totalLoaded||m.cases||1));
  var traceScore=Math.max(0,100-(Number(m.notTraced||0)/traceBase*100));
  var noDeliveryRate=Math.min(100,(Number(m.noDeliveryCount||0)/Math.max(1,m.cases))*100);
  var reworkRate=Math.min(100,((m.specialWait&&m.specialWait.reworkRows||[]).length/Math.max(1,m.cases))*100);
  return Math.max(0,Math.min(100,Math.round(
    compliance*.30+reliability*.25+wipScore*.20+traceScore*.10+
    (100-noDeliveryRate)*.075+(100-reworkRate)*.075
  )));
}
function v232ScoreLabel(score){
  if(score>=85)return {label:"Favorable",cls:"ok",text:"El desempeño general se mantiene controlado, con oportunidades puntuales de mejora."};
  if(score>=70)return {label:"Requiere atención",cls:"warn",text:"El flujo presenta desviaciones que deben gestionarse para evitar crecimiento del WIP y de los tiempos."};
  return {label:"Crítico",cls:"bad",text:"El resultado exige intervención prioritaria sobre tiempos, cumplimiento, trazabilidad y causas recurrentes."};
}
function v232Analyze(meta){
  var m=app.metrics||{},processes=(m.processRows||[]).filter(function(r){return r.cases||r.wip;});
  var areas=(m.areaRows||[]).slice(),actors=(m.actorRows||[]).filter(function(r){return !v231IsExcludedSuperAdmin(r);});
  var score=v232OverallScore(m),scoreState=v232ScoreLabel(score);
  var slowest=processes.slice().sort(function(a,b){return Number(b.avg||0)-Number(a.avg||0);})[0]||{};
  var lowestCompliance=processes.slice().filter(function(r){return r.slaCount||r.cases;}).sort(function(a,b){return Number(a.slaPct||0)-Number(b.slaPct||0);})[0]||{};
  var highestWip=processes.slice().sort(function(a,b){return Number(b.wip||0)-Number(a.wip||0);})[0]||{};
  var weakestArea=areas.slice().sort(function(a,b){return Number(a.compliance||0)-Number(b.compliance||0);})[0]||{};
  var highestAreaLt=areas.slice().sort(function(a,b){return Number(b.avg||0)-Number(a.avg||0);})[0]||{};
  var topWorkActor=actors.slice().sort(function(a,b){return Number(b.active||0)-Number(a.active||0);})[0]||{};
  var highestActorWip=actors.slice().sort(function(a,b){return Number(b.open||0)-Number(a.open||0);})[0]||{};
  var findings=[],recommendations=[],actions=[];
  findings.push("La base del informe contiene "+Number(m.totalLoaded||app.cases.length||0)+" pedidos cargados; "+Number(m.cases||0)+" cuentan con trazabilidad suficiente para los indicadores.");
  findings.push("El índice compuesto de desempeño es "+score+"% y se clasifica como "+scoreState.label.toLowerCase()+".");
  findings.push("El Lead Time mediano es "+v225Time(m.leadP50||0)+" y el percentil 90 alcanza "+v225Time(m.leadP90||0)+".");
  if(slowest.label)findings.push("El proceso con mayor LT promedio es "+slowest.label+" con "+v225Time(slowest.avg||0)+".");
  if(lowestCompliance.label)findings.push("El menor cumplimiento se presenta en "+lowestCompliance.label+" con "+Number(lowestCompliance.slaPct||0)+"%.");
  if(highestWip.label)findings.push("La mayor concentración de WIP está en "+highestWip.label+" con "+Number(highestWip.wip||0)+" pedido(s), de los cuales "+Number(highestWip.wipLate||0)+" están fuera de meta.");
  if(weakestArea.label)findings.push("El área con menor cumplimiento es "+weakestArea.label+" con "+Number(weakestArea.compliance||0)+"%.");
  if(highestAreaLt.label)findings.push("El área con mayor tiempo promedio es "+highestAreaLt.label+" con "+v225Time(highestAreaLt.avg||0)+".");
  if(topWorkActor.user)findings.push("El mayor volumen de trabajo directo trazado corresponde a "+topWorkActor.user+" con "+v225Time(topWorkActor.active||0)+"; este dato representa carga registrada, no una calificación aislada del desempeño.");
  if(highestActorWip.user&&highestActorWip.open>0)findings.push(highestActorWip.user+" concentra el mayor WIP individual con "+highestActorWip.open+" caso(s) abiertos.");
  if((m.reliability||{}).avg<90)findings.push("La confiabilidad promedio de la trazabilidad es "+Number((m.reliability||{}).avg||0)+"%, por debajo del objetivo recomendado de 90%.");
  if(m.specialWait){
    findings.push("Las esperas especiales suman "+v225Time((m.specialWait.novelty||0)+(m.specialWait.rework||0)+(m.specialWait.noDelivery||0))+": novedades "+v225Time(m.specialWait.novelty||0)+", reprocesos "+v225Time(m.specialWait.rework||0)+" y no entregas "+v225Time(m.specialWait.noDelivery||0)+".");
  }

  if(Number(m.lateWip||0)>0){
    recommendations.push("Definir una rutina diaria de priorización para los "+m.lateWip+" pedidos fuera de meta.");
    actions.push({priority:"Alta",issue:"WIP fuera de meta",action:"Revisar y reasignar diariamente los pedidos vencidos, registrando causa y próxima acción.",owner:highestWip.label||"Operaciones",target:"Reducir atrasados en al menos 50% en el siguiente corte"});
  }
  if(lowestCompliance.label&&Number(lowestCompliance.slaPct||0)<80){
    recommendations.push("Intervenir el proceso "+lowestCompliance.label+" mediante análisis de causa y ajuste de tiempos estándar.");
    actions.push({priority:"Alta",issue:"Bajo cumplimiento en "+lowestCompliance.label,action:"Revisar actividades, responsables, puntos de espera y meta del proceso.",owner:v225AreaLabel(v225AreaForProcess(lowestCompliance.process)),target:"Cumplimiento ≥ 85%"});
  }
  if((m.reliability||{}).avg<90){
    recommendations.push("Establecer obligatoriedad de fecha, responsable, estado y proceso en cada transición.");
    actions.push({priority:"Alta",issue:"Confiabilidad de datos",action:"Corregir registros incompletos y bloquear cierres sin trazabilidad mínima.",owner:"Calidad / Sistemas",target:"Confiabilidad ≥ 90%"});
  }
  if(m.specialWait&&m.specialWait.noveltyOpen>0){
    recommendations.push("Asignar SLA y responsables visibles a las novedades pendientes.");
    actions.push({priority:"Media",issue:"Novedades abiertas",action:"Cerrar o responder las "+m.specialWait.noveltyOpen+" novedades abiertas con fecha y responsable.",owner:"Áreas destinatarias",target:"Primera respuesta dentro de la meta"});
  }
  if(m.specialWait&&m.specialWait.rework>0){
    recommendations.push("Realizar análisis de causa raíz sobre los retornos que exceden la meta.");
    actions.push({priority:"Media",issue:"Reprocesos fuera de meta",action:"Clasificar los reprocesos por causa, área de origen y reincidencia.",owner:"Calidad / Área responsable",target:"Reducir tiempo de reproceso 20%"});
  }
  if(Number(m.noDeliveryCount||0)>0){
    recommendations.push("Separar las causas de no entrega por transportadora, cliente, documentación y preparación del pedido.");
    actions.push({priority:"Media",issue:"No entregas",action:"Cerrar trazabilidad y causa de los "+m.noDeliveryCount+" pedido(s) identificados.",owner:"Despacho / Cartera",target:"100% de no entregas con causa y cierre"});
  }
  if(highestActorWip.user&&Number(highestActorWip.open||0)>3){
    recommendations.push("Balancear la carga operativa del actor con mayor WIP antes de asignar nuevos casos.");
    actions.push({priority:"Media",issue:"Concentración de carga",action:"Redistribuir casos abiertos y revisar capacidad disponible.",owner:"Líder del área",target:"Ningún actor con concentración desproporcionada"});
  }
  if(!recommendations.length)recommendations.push("Mantener el seguimiento periódico, validar la estabilidad de los indicadores y documentar las mejoras implementadas.");
  if(!actions.length)actions.push({priority:"Baja",issue:"Sostenimiento",action:"Mantener revisión semanal de KPIs y alertas.",owner:"Líderes de proceso",target:"Conservar desempeño favorable"});

  return {
    m:m,score:score,scoreState:scoreState,findings:findings,
    recommendations:recommendations,actions:actions,
    processes:processes,areas:areas,actors:actors,
    slowest:slowest,lowestCompliance:lowestCompliance,highestWip:highestWip
  };
}
function v232FileName(meta,ext){
  var base=normKey(meta.title||"informe_vsm").replace(/_/g,"-").slice(0,70)||"informe-vsm";
  return base+"-"+meta.generatedAt.toISOString().slice(0,10)+"."+ext;
}
function v232ReportCss(){
  return `
    *{box-sizing:border-box}body{margin:0;background:#eef3f9;color:#102033;font-family:"Century Gothic",Arial,sans-serif}
    .report{width:100%;max-width:1060px;margin:auto;background:#fff}
    .cover{min-height:680px;padding:55px 54px;background:linear-gradient(145deg,#061b46,#12376d);color:#fff;display:flex;flex-direction:column;justify-content:space-between}
    .cover h1{font-size:34px;line-height:1.16;margin:0 0 18px}.cover h2{font-size:17px;font-weight:normal;margin:0;opacity:.86}
    .cover .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:38px}.cover .meta div{padding:12px;border:1px solid rgba(255,255,255,.2);border-radius:12px}
    .cover small{opacity:.8}.section{padding:28px 34px;border-bottom:1px solid #e2e8f0;page-break-inside:avoid}
    .section h2{margin:0 0 14px;color:#061b46;font-size:21px}.section h3{color:#0f2d5c;margin:18px 0 8px}
    .lead{font-size:14px;line-height:1.6;color:#334155}.muted{color:#64748b}
    .score{display:flex;align-items:center;gap:18px;padding:17px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0}
    .score strong{font-size:34px;color:#061b46}.score.ok{border-left:6px solid #0f9f6e}.score.warn{border-left:6px solid #d97706}.score.bad{border-left:6px solid #dc2626}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{padding:12px;border-radius:13px;border:1px solid #dbe4f0;background:#fff}
    .kpi span{display:block;font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase}.kpi strong{display:block;font-size:20px;color:#061b46;margin-top:5px}.kpi small{display:block;font-size:10px;color:#64748b;margin-top:4px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:15px}.panel{border:1px solid #dbe4f0;border-radius:15px;padding:14px;page-break-inside:avoid}
    .bar-row{display:grid;grid-template-columns:130px 1fr 70px;gap:8px;align-items:center;margin:8px 0;font-size:11px}
    .bar-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar-track{height:12px;background:#edf2f7;border-radius:999px;overflow:hidden}.bar{height:100%;background:#2563eb;border-radius:999px}.bar.ok{background:#0f9f6e}.bar.warn{background:#d97706}.bar.bad{background:#dc2626}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:10px}th,td{border:1px solid #d8e2ef;padding:6px;text-align:left;vertical-align:top}th{background:#061b46;color:#fff}
    ul{margin:8px 0 0;padding-left:20px}li{margin:6px 0;line-height:1.45}
    .priority{font-weight:bold}.priority.Alta{color:#b91c1c}.priority.Media{color:#b45309}.priority.Baja{color:#047857}
    .note{padding:11px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:11px;line-height:1.45}
    .footer{padding:18px 34px;font-size:9px;color:#64748b;background:#f8fafc}
    @media print{body{background:#fff}.report{max-width:none}.section{break-inside:auto}.cover{page-break-after:always}.page-break{page-break-before:always}}
    @media(max-width:720px){.kpis{grid-template-columns:1fr 1fr}.grid2,.cover .meta{grid-template-columns:1fr}.bar-row{grid-template-columns:1fr}}
  `;
}
function v232Kpi(title,value,detail){
  return '<article class="kpi"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail||"")+'</small></article>';
}
function v232BarChart(rows,valueFn,labelFn,metaFn,classFn){
  rows=(rows||[]).slice(0,12);
  var max=rows.reduce(function(a,r){return Math.max(a,Number(valueFn(r))||0);},0)||1;
  return rows.map(function(r){
    var v=Number(valueFn(r))||0,cls=classFn?classFn(r):"";
    return '<div class="bar-row"><b class="bar-label">'+esc(labelFn(r))+'</b><div class="bar-track"><div class="bar '+cls+'" style="width:'+Math.max(2,Math.min(100,v/max*100))+'%"></div></div><span>'+esc(metaFn(r))+'</span></div>';
  }).join("")||'<p class="muted">Sin datos suficientes.</p>';
}
function v232Rows(headers,rows){
  return '<table><thead><tr>'+headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table>';
}
function v232ReportBody(meta,analysis,mode){
  var m=analysis.m,w=m.specialWait||{},r=m.reliability||{};
  var processByLt=analysis.processes.slice().sort(function(a,b){return Number(b.avg||0)-Number(a.avg||0);});
  var processByCompliance=analysis.processes.slice().sort(function(a,b){return Number(a.slaPct||0)-Number(b.slaPct||0);});
  var areasByCompliance=analysis.areas.slice().sort(function(a,b){return Number(a.compliance||0)-Number(b.compliance||0);});
  var actorsByWork=analysis.actors.slice().sort(function(a,b){return Number(b.active||0)-Number(a.active||0);});
  var period=meta.periodName||meta.scope;
  var body='';

  body+='<div class="cover"><div><small>'+esc(meta.confidentiality)+' · '+esc(v232TypeLabel(meta.type))+'</small><h1>'+esc(meta.title)+'</h1><h2>'+esc(meta.objective)+'</h2></div>'+
    '<div class="meta"><div><small>Elaborado por</small><br><strong>'+esc(meta.author)+'</strong><br>'+esc(meta.position)+'</div>'+
    '<div><small>Área responsable</small><br><strong>'+esc(meta.department)+'</strong></div>'+
    '<div><small>Dirigido a</small><br><strong>'+esc(meta.audience)+'</strong></div>'+
    '<div><small>Periodo / alcance</small><br><strong>'+esc(period)+'</strong></div></div>'+
    '<small>Generado el '+esc(meta.generatedAt.toLocaleString("es-CO"))+' · VSM '+esc(VERSION)+' · Super Admin excluido de productividad y tiempos operativos.</small></div>';

  body+='<section class="section"><h2>1. Resumen ejecutivo</h2><div class="score '+analysis.scoreState.cls+'"><strong>'+analysis.score+'%</strong><div><b>'+esc(analysis.scoreState.label)+'</b><p class="lead">'+esc(analysis.scoreState.text)+'</p></div></div>'+
    '<div class="kpis" style="margin-top:14px">'+
    v232Kpi("Total cargado",m.totalLoaded||app.cases.length,"Pedidos disponibles")+
    v232Kpi("Trazados VSM",m.cases||0,"Pedidos calculables")+
    v232Kpi("WIP actual",m.wip||0,(m.lateWip||0)+" fuera de meta")+
    v232Kpi("Cerrados",m.closed||0,"Throughput "+(m.throughput||0)+"/día")+
    v232Kpi("LT P50",v225Time(m.leadP50||0),"P90 "+v225Time(m.leadP90||0))+
    v232Kpi("Picking promedio",v225Time(m.pickingAvg||0),"P90 "+v225Time(m.pickingP90||0))+
    v232Kpi("Confiabilidad",Number(r.avg||0)+"%",Number(r.low||0)+" registros críticos")+
    v232Kpi("No entregas",m.noDeliveryCount||0,"Filtro actual")+
    '</div></section>';

  body+='<section class="section"><h2>2. Hallazgos analíticos</h2><ul>'+analysis.findings.map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul>';
  if(meta.notes)body+='<div class="note" style="margin-top:14px"><strong>Contexto suministrado:</strong> '+esc(meta.notes)+'</div>';
  body+='</section>';

  body+='<section class="section"><h2>3. Desempeño por proceso</h2><div class="grid2"><article class="panel"><h3>Lead Time promedio</h3>'+
    v232BarChart(processByLt,function(x){return x.avg;},function(x){return x.label;},function(x){return v225Time(x.avg);})+
    '</article><article class="panel"><h3>Cumplimiento de meta</h3>'+
    v232BarChart(processByCompliance,function(x){return x.slaPct;},function(x){return x.label;},function(x){return Number(x.slaPct||0)+"%";},function(x){return x.slaPct>=85?"ok":(x.slaPct>=65?"warn":"bad");})+
    '</article></div>'+
    v232Rows(["Proceso","Casos","WIP","Atrasados","LT promedio","P50","P90","Cumplimiento"],analysis.processes.map(function(x){
      return '<tr><td><strong>'+esc(x.label)+'</strong></td><td>'+Number(x.cases||0)+'</td><td>'+Number(x.wip||0)+'</td><td>'+Number(x.wipLate||0)+'</td><td>'+esc(v225Time(x.avg||0))+'</td><td>'+esc(v225Time(x.p50||0))+'</td><td>'+esc(v225Time(x.p90||0))+'</td><td>'+Number(x.slaPct||0)+'%</td></tr>';
    }))+'</section>';

  body+='<section class="section"><h2>4. Desempeño por área</h2><div class="grid2"><article class="panel"><h3>Cumplimiento por área</h3>'+
    v232BarChart(areasByCompliance,function(x){return x.compliance;},function(x){return x.label;},function(x){return Number(x.compliance||0)+"%";},function(x){return x.compliance>=85?"ok":(x.compliance>=65?"warn":"bad");})+
    '</article><article class="panel"><h3>WIP por área</h3>'+
    v232BarChart(analysis.areas.slice().sort(function(a,b){return b.wip-a.wip;}),function(x){return x.wip;},function(x){return x.label;},function(x){return Number(x.wip||0)+" pedido(s)";})+
    '</article></div>'+
    v232Rows(["Área","Casos","WIP","Cerrados","LT promedio","Trabajo","Cumplimiento","Confiabilidad","No entregas"],analysis.areas.map(function(x){
      return '<tr><td><strong>'+esc(x.label)+'</strong></td><td>'+Number(x.cases||0)+'</td><td>'+Number(x.wip||0)+'</td><td>'+Number(x.closed||0)+'</td><td>'+esc(v225Time(x.avg||0))+'</td><td>'+esc(v225Time(x.work||0))+'</td><td>'+Number(x.compliance||0)+'%</td><td>'+Number(x.reliability||0)+'%</td><td>'+Number(x.noDeliveries||0)+'</td></tr>';
    }))+'</section>';

  if(meta.includeActors){
    body+='<section class="section"><h2>5. Productividad por actor</h2><div class="note">El Super Admin está excluido. La carga directa no debe interpretarse aisladamente como evaluación de desempeño.</div>'+
      '<article class="panel" style="margin-top:12px"><h3>Trabajo directo trazado</h3>'+
      v232BarChart(actorsByWork,function(x){return x.active;},function(x){return x.user;},function(x){return v225Time(x.active||0);})+'</article>'+
      v232Rows(["Actor","Rol","Casos","WIP","Cerrados","Trabajo directo","Promedio directo","Cumplimiento","Carga directa"],analysis.actors.slice(0,30).map(function(x){
        return '<tr><td><strong>'+esc(x.user)+'</strong></td><td>'+esc(roleTitle(x.role))+'</td><td>'+Number(x.count||0)+'</td><td>'+Number(x.open||0)+'</td><td>'+Number(x.closed||0)+'</td><td>'+esc(v225Time(x.active||0))+'</td><td>'+esc(v225Time(x.directPerCase||0))+'</td><td>'+Number(x.compliance||0)+'%</td><td>'+Number(x.directLoadPct||0)+'%</td></tr>';
      }))+'</section>';
  }

  if(meta.includeWaits){
    body+='<section class="section"><h2>6. Novedades, reprocesos y no entregas</h2><div class="kpis">'+
      v232Kpi("Espera en novedades",v225Time(w.novelty||0),(w.noveltyOpen||0)+" abiertas")+
      v232Kpi("Espera en reproceso",v225Time(w.rework||0),(w.reworkOpen||0)+" abiertos")+
      v232Kpi("Espera en no entregas",v225Time(w.noDelivery||0),(w.noDeliveryOpen||0)+" abiertas")+
      v232Kpi("No entregas",m.noDeliveryCount||0,"Pedidos identificados")+
      '</div><div class="grid2" style="margin-top:14px"><article class="panel"><h3>Composición de esperas especiales</h3>'+
      v232BarChart([
        {label:"Novedades",value:w.novelty||0,cls:"warn"},
        {label:"Reprocesos",value:w.rework||0,cls:"bad"},
        {label:"No entregas",value:w.noDelivery||0,cls:"warn"}
      ],function(x){return x.value;},function(x){return x.label;},function(x){return v225Time(x.value);},function(x){return x.cls;})+
      '</article><article class="panel"><h3>Registros principales</h3>'+
      v232Rows(["Pedido","Categoría","Área","Duración"],(w.all||[]).slice(0,12).map(function(x){
        return '<tr><td>'+esc(x.pedido)+'</td><td>'+esc(x.category)+'</td><td>'+esc(v225AreaLabel(x.area))+'</td><td>'+esc(v225Time(x.duration||0))+'</td></tr>';
      }))+'</article></div></section>';
  }

  if(meta.includeAlerts){
    body+='<section class="section"><h2>7. Alertas y riesgos prioritarios</h2>'+
      v232Rows(["Prioridad","Pedido","Proceso","Hallazgo","Acción sugerida"],(m.alertRows||[]).slice(0,25).map(function(x){
        return '<tr><td>'+(x.severity==="bad"?"Alta":"Media")+'</td><td>'+esc(x.pedido||"")+'</td><td>'+esc(x.proceso||"")+'</td><td>'+esc(x.detalle||"")+'</td><td>'+esc(x.accion||"")+'</td></tr>';
      }))+'</section>';
  }

  body+='<section class="section"><h2>8. Recomendaciones</h2><ul>'+analysis.recommendations.map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul></section>';

  if(meta.includeActionPlan){
    body+='<section class="section"><h2>9. Plan de acción propuesto</h2>'+
      v232Rows(["Prioridad","Situación","Acción","Responsable sugerido","Meta"],analysis.actions.map(function(x){
        return '<tr><td class="priority '+esc(x.priority)+'">'+esc(x.priority)+'</td><td>'+esc(x.issue)+'</td><td>'+esc(x.action)+'</td><td>'+esc(x.owner)+'</td><td>'+esc(x.target)+'</td></tr>';
      }))+'</section>';
  }

  if(meta.includeOrders){
    var critical=(m.wipRows||[]).slice(0,mode==="excel"?500:50);
    body+='<section class="section page-break"><h2>10. Anexo de pedidos críticos</h2>'+
      v232Rows(["Pedido","OC","Cliente","Proceso","Responsable","Tiempo en proceso","Meta","Estado","Bloqueo","Próxima acción"],critical.map(function(x){
        return '<tr><td><strong>'+esc(x.pedido)+'</strong></td><td>'+esc(x.oc)+'</td><td>'+esc(x.cliente)+'</td><td>'+esc(x.processLabel)+'</td><td>'+esc(x.responsable)+'</td><td>'+esc(v225Time(x.age||0))+'</td><td>'+Number(x.slaHours||0)+' h</td><td>'+(x.late?"Fuera de meta":"Dentro de meta")+'</td><td>'+esc(x.blocker||"")+'</td><td>'+esc(x.next||"")+'</td></tr>';
      }))+'</section>';
  }

  if(meta.includeMethodology){
    body+='<section class="section"><h2>11. Metodología, fórmulas y fuentes</h2>'+
      v232Rows(["Elemento","Criterio aplicado"],[
        '<tr><td>Jornada laboral</td><td>07:00–12:00 y 13:40–17:30; se excluyen sábados, domingos y festivos colombianos cargados.</td></tr>',
        '<tr><td>Lead Time</td><td>Tiempo laboral desde el inicio del pedido o etapa hasta su cierre o corte de análisis.</td></tr>',
        '<tr><td>P50 / P90</td><td>P50 es la mediana; P90 representa el tiempo bajo el cual termina el 90% de los casos.</td></tr>',
        '<tr><td>Trabajo directo</td><td>Actividad registrada o inferida mediante eventos operativos; no incluye las intervenciones del Super Admin.</td></tr>',
        '<tr><td>Reproceso</td><td>Exceso sobre la meta cuando el pedido regresa a Ventas u otra etapa por corrección, diferencia, rechazo o no conformidad.</td></tr>',
        '<tr><td>No entrega</td><td>Desde la confirmación mediante noDelivery, noDeliveryReports, requirementType=no_entrega o NO_DELIVERY_* hasta solución o cierre.</td></tr>',
        '<tr><td>Índice compuesto</td><td>30% cumplimiento, 25% confiabilidad, 20% WIP en meta, 10% cobertura de trazabilidad, 7,5% no entregas y 7,5% reprocesos.</td></tr>',
        '<tr><td>Fuentes</td><td>cases, case_events, reportes_novedad, processStats, requirements, openRequirement, noDeliveryReports, stateHistory y flowTrace.</td></tr>'
      ])+'</section>';
  }

  body+='<section class="section"><h2>Conclusión</h2><p class="lead">'+esc(analysis.scoreState.text)+' El seguimiento debe concentrarse en '+esc((analysis.lowestCompliance.label||"los procesos con menor cumplimiento"))+', el WIP fuera de meta y la mejora de la confiabilidad de los registros.</p></section>'+
    '<footer class="footer">Elaborado por '+esc(meta.author)+' · '+esc(meta.position)+' · '+esc(meta.department)+' · '+esc(meta.confidentiality)+' · '+esc(meta.generatedAt.toLocaleString("es-CO"))+'</footer>';
  return body;
}
function v232FullReportHtml(meta,analysis,mode){
  return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(meta.title)+'</title><style>'+v232ReportCss()+'</style></head><body><main class="report">'+v232ReportBody(meta,analysis,mode)+'</main></body></html>';
}

/* ============================================================
   V234 · MOTORES NATIVOS DE INFORMES
   PDF: jsPDF + AutoTable, sin capturas HTML.
   Excel: ExcelJS .xlsx con hojas, estilos y gráficas.
============================================================ */
async function v234LoadPdfLibraries(){
  if(!(window.jspdf&&window.jspdf.jsPDF)){
    await loadOne([
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
      "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js"
    ],function(){return !!(window.jspdf&&window.jspdf.jsPDF);},"jsPDF");
  }
  var PDF=window.jspdf&&window.jspdf.jsPDF;
  if(!(PDF&&PDF.API&&PDF.API.autoTable)){
    await loadOne([
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
      "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
      "https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"
    ],function(){
      var P=window.jspdf&&window.jspdf.jsPDF;
      return !!(P&&P.API&&P.API.autoTable);
    },"jsPDF AutoTable");
  }
}
async function v234LoadExcelLibrary(){
  if(!window.ExcelJS){
    await loadOne([
      "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
      "https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js"
    ],function(){return !!window.ExcelJS;},"ExcelJS");
  }
}
function v234MsHours(ms){
  var n=Number(ms||0)/3600000;
  return isFinite(n)?Math.round(n*100)/100:0;
}
function v234PdfPageState(doc){
  return {
    pageWidth:doc.internal.pageSize.getWidth(),
    pageHeight:doc.internal.pageSize.getHeight(),
    margin:42,
    y:50,
    section:"",
    contentWidth:doc.internal.pageSize.getWidth()-84
  };
}
function v234PdfHeader(doc,state,title){
  doc.setFillColor(6,27,70);
  doc.rect(0,0,state.pageWidth,28,"F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(8);
  doc.text("ELECTROINGENIERÍA · VSM OPERATIVO",state.margin,18);
  doc.setFont("helvetica","normal");
  doc.text(title||state.section||"Informe analítico",state.pageWidth-state.margin,18,{align:"right"});
  doc.setTextColor(16,32,51);
  state.y=46;
}
function v234PdfNewPage(doc,state,title){
  doc.addPage();
  state.section=title||state.section;
  v234PdfHeader(doc,state,state.section);
}
function v234PdfEnsure(doc,state,height,title){
  if(state.y+height>state.pageHeight-48)v234PdfNewPage(doc,state,title||state.section);
}
function v234PdfSection(doc,state,title){
  v234PdfEnsure(doc,state,42,title);
  state.section=title;
  doc.setFillColor(238,243,249);
  doc.roundedRect(state.margin,state.y,state.contentWidth,28,6,6,"F");
  doc.setTextColor(6,27,70);
  doc.setFont("helvetica","bold");
  doc.setFontSize(13);
  doc.text(title,state.margin+10,state.y+18);
  state.y+=40;
}
function v234PdfParagraph(doc,state,text,opts){
  opts=opts||{};
  var size=opts.size||9.5;
  var indent=opts.indent||0;
  var width=state.contentWidth-indent;
  doc.setFont("helvetica",opts.bold?"bold":"normal");
  doc.setFontSize(size);
  doc.setTextColor(16,32,51);
  var lines=doc.splitTextToSize(String(text||""),width);
  var h=lines.length*(size*1.38)+4;
  v234PdfEnsure(doc,state,h,state.section);
  doc.text(lines,state.margin+indent,state.y);
  state.y+=h;
}
function v234PdfBulletList(doc,state,items){
  (items||[]).forEach(function(item){
    var lines=doc.splitTextToSize(String(item||""),state.contentWidth-18);
    var h=Math.max(16,lines.length*12+4);
    v234PdfEnsure(doc,state,h,state.section);
    doc.setFillColor(242,183,5);
    doc.circle(state.margin+4,state.y-3,2.2,"F");
    doc.setFont("helvetica","normal");
    doc.setFontSize(9.2);
    doc.setTextColor(16,32,51);
    doc.text(lines,state.margin+14,state.y);
    state.y+=h;
  });
}
function v234PdfKpiGrid(doc,state,kpis){
  var cols=4,gap=8,w=(state.contentWidth-gap*(cols-1))/cols,h=66;
  for(var i=0;i<kpis.length;i++){
    if(i%cols===0)v234PdfEnsure(doc,state,h+10,state.section);
    var col=i%cols,x=state.margin+col*(w+gap),y=state.y;
    doc.setDrawColor(216,226,239);
    doc.setFillColor(248,250,252);
    doc.roundedRect(x,y,w,h,6,6,"FD");
    doc.setFont("helvetica","bold");
    doc.setTextColor(100,116,139);
    doc.setFontSize(7);
    var title=doc.splitTextToSize(String(kpis[i].title||""),w-12);
    doc.text(title,x+6,y+12);
    doc.setTextColor(6,27,70);
    doc.setFontSize(15);
    doc.text(String(kpis[i].value||"—"),x+6,y+35);
    doc.setTextColor(100,116,139);
    doc.setFont("helvetica","normal");
    doc.setFontSize(6.8);
    var detail=doc.splitTextToSize(String(kpis[i].detail||""),w-12);
    doc.text(detail,x+6,y+49);
    if(col===cols-1||i===kpis.length-1)state.y+=h+10;
  }
}
function v234PdfBarChart(doc,state,title,rows,valueFn,labelFn,displayFn,colorFn){
  rows=(rows||[]).slice(0,12);
  var rowH=21,boxH=42+rows.length*rowH;
  v234PdfEnsure(doc,state,boxH+8,state.section);
  var x=state.margin,y=state.y,w=state.contentWidth;
  doc.setDrawColor(216,226,239);
  doc.setFillColor(255,255,255);
  doc.roundedRect(x,y,w,boxH,7,7,"FD");
  doc.setFont("helvetica","bold");
  doc.setTextColor(6,27,70);
  doc.setFontSize(10);
  doc.text(title,x+10,y+18);
  var max=rows.reduce(function(a,r){return Math.max(a,Number(valueFn(r))||0);},0)||1;
  rows.forEach(function(r,i){
    var yy=y+34+i*rowH;
    var value=Number(valueFn(r))||0;
    var label=String(labelFn(r)||"");
    var display=String(displayFn(r)||"");
    doc.setFont("helvetica","normal");
    doc.setFontSize(7.2);
    doc.setTextColor(51,65,85);
    var shortLabel=label.length>27?label.slice(0,26)+"…":label;
    doc.text(shortLabel,x+10,yy+8);
    var barX=x+145,barW=w-225;
    doc.setFillColor(237,242,247);
    doc.roundedRect(barX,yy,barW,10,5,5,"F");
    var cls=colorFn?colorFn(r):"info";
    if(cls==="ok")doc.setFillColor(15,159,110);
    else if(cls==="warn")doc.setFillColor(217,119,6);
    else if(cls==="bad")doc.setFillColor(220,38,38);
    else doc.setFillColor(37,99,235);
    doc.roundedRect(barX,yy,Math.max(3,barW*Math.min(1,value/max)),10,5,5,"F");
    doc.setTextColor(6,27,70);
    doc.setFont("helvetica","bold");
    doc.text(display,x+w-10,yy+8,{align:"right"});
  });
  state.y+=boxH+12;
}
function v234PdfTable(doc,state,title,head,body,options){
  options=options||{};
  v234PdfSection(doc,state,title);
  doc.autoTable({
    startY:state.y,
    head:[head],
    body:body.length?body:[head.map(function(){return "Sin datos";})],
    margin:{left:state.margin,right:state.margin,top:42,bottom:42},
    theme:"grid",
    styles:{
      font:"helvetica",fontSize:options.fontSize||7.2,
      cellPadding:3,textColor:[16,32,51],lineColor:[216,226,239],lineWidth:.35,
      overflow:"linebreak",valign:"top"
    },
    headStyles:{fillColor:[6,27,70],textColor:[255,255,255],fontStyle:"bold"},
    alternateRowStyles:{fillColor:[248,250,252]},
    columnStyles:options.columnStyles||{},
    didDrawPage:function(){
      state.section=title;
      v234PdfHeader(doc,state,title);
    }
  });
  state.y=(doc.lastAutoTable&&doc.lastAutoTable.finalY||state.y)+16;
}
function v234PdfFooterAll(doc,meta){
  var pages=doc.getNumberOfPages();
  for(var i=1;i<=pages;i++){
    doc.setPage(i);
    var w=doc.internal.pageSize.getWidth(),h=doc.internal.pageSize.getHeight();
    doc.setDrawColor(216,226,239);
    doc.line(42,h-27,w-42,h-27);
    doc.setFont("helvetica","normal");
    doc.setFontSize(7);
    doc.setTextColor(100,116,139);
    doc.text(meta.author+" · "+meta.department,42,h-15);
    doc.text("Página "+i+" de "+pages,w-42,h-15,{align:"right"});
  }
}
function v234PdfConclusion(analysis){
  var parts=[];
  parts.push(analysis.scoreState.text);
  if(analysis.lowestCompliance&&analysis.lowestCompliance.label){
    parts.push("El proceso que requiere mayor atención es "+analysis.lowestCompliance.label+
      ", con un cumplimiento de "+Number(analysis.lowestCompliance.slaPct||0)+"%.");
  }
  if(analysis.highestWip&&analysis.highestWip.label){
    parts.push("La concentración de trabajo pendiente se ubica en "+analysis.highestWip.label+
      ", con "+Number(analysis.highestWip.wip||0)+" caso(s) en WIP.");
  }
  parts.push("Las decisiones deben priorizar la reducción de atrasos, la trazabilidad completa de cada transición y el cierre oportuno de novedades, reprocesos y no entregas.");
  return parts.join(" ");
}
function v234OpenPrintFallback(meta,analysis){
  var win=window.open("","_blank");
  if(!win)throw new Error("El navegador bloqueó la ventana de impresión. Habilite las ventanas emergentes.");
  win.document.open();
  win.document.write(v232FullReportHtml(meta,analysis,"pdf"));
  win.document.close();
  setTimeout(function(){try{win.focus();win.print();}catch(e){}},700);
}
async function v232GeneratePdf(meta,analysis){
  try{
    await v234LoadPdfLibraries();
    var PDF=window.jspdf.jsPDF;
    var doc=new PDF({orientation:"portrait",unit:"pt",format:"a4",compress:true});
    var state=v234PdfPageState(doc);
    var m=analysis.m,w=m.specialWait||{},r=m.reliability||{};

    // Portada.
    doc.setFillColor(6,27,70);
    doc.rect(0,0,state.pageWidth,state.pageHeight,"F");
    doc.setFillColor(242,183,5);
    doc.rect(0,0,15,state.pageHeight,"F");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    doc.text(meta.confidentiality.toUpperCase()+" · "+v232TypeLabel(meta.type).toUpperCase(),52,68);
    doc.setFontSize(27);
    var titleLines=doc.splitTextToSize(meta.title,state.pageWidth-104);
    doc.text(titleLines,52,122);
    var titleBottom=122+titleLines.length*32;
    doc.setFont("helvetica","normal");
    doc.setFontSize(12);
    var objLines=doc.splitTextToSize(meta.objective,state.pageWidth-104);
    doc.text(objLines,52,titleBottom+20);
    var boxY=titleBottom+105;
    var boxW=(state.pageWidth-116)/2;
    [
      ["Elaborado por",meta.author+"\n"+meta.position],
      ["Área responsable",meta.department],
      ["Dirigido a",meta.audience],
      ["Periodo / alcance",meta.periodName||meta.scope]
    ].forEach(function(item,i){
      var col=i%2,row=Math.floor(i/2),x=52+col*(boxW+12),y=boxY+row*88;
      doc.setFillColor(15,45,92);
      doc.setDrawColor(67,94,135);
      doc.roundedRect(x,y,boxW,72,7,7,"FD");
      doc.setFont("helvetica","bold");
      doc.setFontSize(8);
      doc.setTextColor(242,183,5);
      doc.text(item[0],x+10,y+17);
      doc.setFont("helvetica","normal");
      doc.setFontSize(10);
      doc.setTextColor(255,255,255);
      doc.text(doc.splitTextToSize(item[1],boxW-20),x+10,y+35);
    });
    doc.setFontSize(8);
    doc.setTextColor(203,213,225);
    doc.text("Generado el "+meta.generatedAt.toLocaleString("es-CO")+" · "+VERSION,52,state.pageHeight-45);
    doc.text("Super Admin excluido de productividad y tiempos operativos.",52,state.pageHeight-29);

    // Resumen ejecutivo.
    v234PdfNewPage(doc,state,"Resumen ejecutivo");
    v234PdfSection(doc,state,"1. Resumen ejecutivo");
    v234PdfParagraph(doc,state,"Índice general de desempeño: "+analysis.score+"% · "+analysis.scoreState.label+".",{"bold":true});
    v234PdfParagraph(doc,state,analysis.scoreState.text);
    v234PdfKpiGrid(doc,state,[
      {title:"Total cargado",value:String(m.totalLoaded||app.cases.length||0),detail:"Pedidos disponibles"},
      {title:"Trazados VSM",value:String(m.cases||0),detail:"Pedidos calculables"},
      {title:"WIP actual",value:String(m.wip||0),detail:String(m.lateWip||0)+" fuera de meta"},
      {title:"Cerrados",value:String(m.closed||0),detail:"Throughput "+String(m.throughput||0)+"/día"},
      {title:"LT P50",value:v225Time(m.leadP50||0),detail:"P90 "+v225Time(m.leadP90||0)},
      {title:"Picking promedio",value:v225Time(m.pickingAvg||0),detail:"P90 "+v225Time(m.pickingP90||0)},
      {title:"Confiabilidad",value:String(Number(r.avg||0))+"%",detail:String(Number(r.low||0))+" registros críticos"},
      {title:"No entregas",value:String(m.noDeliveryCount||0),detail:"Filtro actual"}
    ]);

    v234PdfSection(doc,state,"2. Hallazgos analíticos");
    v234PdfBulletList(doc,state,analysis.findings);
    if(meta.notes){
      v234PdfParagraph(doc,state,"Contexto suministrado: "+meta.notes,{bold:true});
    }

    // Gráficas.
    v234PdfSection(doc,state,"3. Gráficas para toma de decisiones");
    v234PdfBarChart(
      doc,state,"Lead Time promedio por proceso",
      analysis.processes.slice().sort(function(a,b){return Number(b.avg||0)-Number(a.avg||0);}),
      function(x){return Number(x.avg||0);},
      function(x){return x.label;},
      function(x){return v225Time(x.avg||0);}
    );
    v234PdfBarChart(
      doc,state,"Cumplimiento por proceso",
      analysis.processes.slice().sort(function(a,b){return Number(a.slaPct||0)-Number(b.slaPct||0);}),
      function(x){return Number(x.slaPct||0);},
      function(x){return x.label;},
      function(x){return Number(x.slaPct||0)+"%";},
      function(x){return x.slaPct>=85?"ok":(x.slaPct>=65?"warn":"bad");}
    );
    v234PdfBarChart(
      doc,state,"WIP por área",
      analysis.areas.slice().sort(function(a,b){return Number(b.wip||0)-Number(a.wip||0);}),
      function(x){return Number(x.wip||0);},
      function(x){return x.label;},
      function(x){return Number(x.wip||0)+" pedido(s)";}
    );
    if(meta.includeWaits){
      v234PdfBarChart(
        doc,state,"Novedades, reprocesos y no entregas",
        [
          {label:"Novedades",value:w.novelty||0,cls:"warn"},
          {label:"Reprocesos",value:w.rework||0,cls:"bad"},
          {label:"No entregas",value:w.noDelivery||0,cls:"warn"}
        ],
        function(x){return x.value;},
        function(x){return x.label;},
        function(x){return v225Time(x.value);},
        function(x){return x.cls;}
      );
    }

    // Tablas.
    v234PdfTable(doc,state,"4. Desempeño por proceso",
      ["Proceso","Casos","WIP","Atrasados","LT prom.","P50","P90","Cumpl."],
      analysis.processes.map(function(x){
        return [
          x.label,Number(x.cases||0),Number(x.wip||0),Number(x.wipLate||0),
          v225Time(x.avg||0),v225Time(x.p50||0),v225Time(x.p90||0),Number(x.slaPct||0)+"%"
        ];
      }),
      {fontSize:6.8}
    );
    v234PdfTable(doc,state,"5. Desempeño por área",
      ["Área","Casos","WIP","Cerrados","LT prom.","Trabajo","Cumpl.","Confiab.","No entregas"],
      analysis.areas.map(function(x){
        return [
          x.label,Number(x.cases||0),Number(x.wip||0),Number(x.closed||0),
          v225Time(x.avg||0),v225Time(x.work||0),Number(x.compliance||0)+"%",
          Number(x.reliability||0)+"%",Number(x.noDeliveries||0)
        ];
      }),
      {fontSize:6.5}
    );

    if(meta.includeActors){
      v234PdfTable(doc,state,"6. Productividad por actor",
        ["Actor","Rol","Casos","WIP","Cerrados","Trabajo","Promedio","Cumpl.","Carga"],
        analysis.actors.slice(0,40).map(function(x){
          return [
            x.user,roleTitle(x.role),Number(x.count||0),Number(x.open||0),Number(x.closed||0),
            v225Time(x.active||0),v225Time(x.directPerCase||0),
            Number(x.compliance||0)+"%",Number(x.directLoadPct||0)+"%"
          ];
        }),
        {fontSize:6.3}
      );
      v234PdfParagraph(doc,state,"Nota: el Super Admin está excluido. La carga directa representa actividad trazada y no debe utilizarse aisladamente como evaluación individual.");
    }

    if(meta.includeWaits){
      v234PdfTable(doc,state,"7. Trazabilidad de tiempos especiales",
        ["Pedido","Categoría","Área","Proceso","Duración","Abierto","Origen"],
        (w.all||[]).slice(0,80).map(function(x){
          return [
            x.pedido,x.category,v225AreaLabel(x.area),processTitle(x.process),
            v225Time(x.duration||0),x.open?"Sí":"No",x.source
          ];
        }),
        {fontSize:6.2,columnStyles:{6:{cellWidth:145}}}
      );
    }

    if(meta.includeAlerts){
      v234PdfTable(doc,state,"8. Alertas y riesgos prioritarios",
        ["Prioridad","Pedido","Proceso","Hallazgo","Acción sugerida"],
        (m.alertRows||[]).slice(0,60).map(function(x){
          return [
            x.severity==="bad"?"Alta":"Media",x.pedido||"",x.proceso||"",
            x.detalle||"",x.accion||""
          ];
        }),
        {fontSize:6.3,columnStyles:{3:{cellWidth:150},4:{cellWidth:150}}}
      );
    }

    v234PdfSection(doc,state,"9. Recomendaciones");
    v234PdfBulletList(doc,state,analysis.recommendations);

    if(meta.includeActionPlan){
      v234PdfTable(doc,state,"10. Plan de acción propuesto",
        ["Prioridad","Situación","Acción","Responsable sugerido","Meta"],
        analysis.actions.map(function(x){
          return [x.priority,x.issue,x.action,x.owner,x.target];
        }),
        {fontSize:6.5,columnStyles:{2:{cellWidth:165}}}
      );
    }

    if(meta.includeOrders){
      v234PdfTable(doc,state,"11. Anexo de pedidos críticos",
        ["Pedido","OC","Cliente","Proceso","Responsable","Tiempo","Meta","Estado","Próxima acción"],
        (m.wipRows||[]).slice(0,120).map(function(x){
          return [
            x.pedido,x.oc,x.cliente,x.processLabel,x.responsable,
            v225Time(x.age||0),Number(x.slaHours||0)+" h",
            x.late?"Fuera de meta":"Dentro de meta",x.next||""
          ];
        }),
        {fontSize:5.8,columnStyles:{2:{cellWidth:90},8:{cellWidth:110}}}
      );
    }

    if(meta.includeMethodology){
      v234PdfTable(doc,state,"12. Metodología, fórmulas y fuentes",
        ["Elemento","Criterio aplicado"],
        [
          ["Jornada laboral","07:00–12:00 y 13:40–17:30; se excluyen sábados, domingos y festivos colombianos cargados."],
          ["Lead Time","Tiempo laboral desde el inicio del pedido o etapa hasta su cierre o corte de análisis."],
          ["P50 / P90","P50 es la mediana; P90 es el tiempo bajo el cual termina el 90% de los casos."],
          ["Trabajo directo","Actividad registrada o inferida mediante eventos operativos; no incluye al Super Admin."],
          ["Reproceso","Exceso sobre la meta cuando el pedido regresa a una etapa anterior por corrección, diferencia, rechazo o no conformidad."],
          ["No entrega","Desde la confirmación mediante noDelivery, noDeliveryReports, requirementType=no_entrega o NO_DELIVERY_* hasta su solución."],
          ["Índice compuesto","30% cumplimiento, 25% confiabilidad, 20% WIP en meta, 10% cobertura, 7,5% no entregas y 7,5% reprocesos."],
          ["Fuentes","cases, case_events, reportes_novedad, processStats, requirements, openRequirement, noDeliveryReports, stateHistory y flowTrace."]
        ],
        {fontSize:7,columnStyles:{0:{cellWidth:95}}}
      );
    }

    v234PdfSection(doc,state,"13. Conclusión");
    v234PdfParagraph(doc,state,v234PdfConclusion(analysis),{size:10});
    v234PdfParagraph(doc,state,"Informe elaborado por "+meta.author+", "+meta.position+", para "+meta.audience+".");
    v234PdfFooterAll(doc,meta);
    doc.save(v232FileName(meta,"pdf"));
  }catch(e){
    console.error("[V234 Informe PDF]",e);
    v234OpenPrintFallback(meta,analysis);
    status("El navegador no cargó el motor PDF. Se abrió el informe completo para imprimir y guardar como PDF.","ok");
  }
}
function v234ExcelStyleHeader(row){
  row.height=26;
  row.eachCell(function(cell){
    cell.font={bold:true,color:{argb:"FFFFFFFF"},size:10};
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF061B46"}};
    cell.alignment={vertical:"middle",horizontal:"center",wrapText:true};
    cell.border={
      top:{style:"thin",color:{argb:"FFD8E2EF"}},
      left:{style:"thin",color:{argb:"FFD8E2EF"}},
      bottom:{style:"thin",color:{argb:"FFD8E2EF"}},
      right:{style:"thin",color:{argb:"FFD8E2EF"}}
    };
  });
}
function v234ExcelStyleTable(sheet,startRow,endRow){
  for(var r=startRow;r<=endRow;r++){
    var row=sheet.getRow(r);
    row.eachCell(function(cell){
      cell.alignment={vertical:"top",wrapText:true};
      cell.border={
        top:{style:"thin",color:{argb:"FFD8E2EF"}},
        left:{style:"thin",color:{argb:"FFD8E2EF"}},
        bottom:{style:"thin",color:{argb:"FFD8E2EF"}},
        right:{style:"thin",color:{argb:"FFD8E2EF"}}
      };
      if(r%2===0)cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF8FAFC"}};
    });
  }
}
function v234ExcelTitle(sheet,title,subtitle){
  sheet.mergeCells("A1:J1");
  var c=sheet.getCell("A1");
  c.value=title;
  c.font={bold:true,size:18,color:{argb:"FFFFFFFF"}};
  c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF061B46"}};
  c.alignment={vertical:"middle",horizontal:"left"};
  sheet.getRow(1).height=34;
  sheet.mergeCells("A2:J2");
  var s=sheet.getCell("A2");
  s.value=subtitle||"";
  s.font={italic:true,size:10,color:{argb:"FF475569"}};
  s.alignment={wrapText:true};
  sheet.getRow(2).height=30;
}
function v234ExcelAutoWidths(sheet,min,max){
  min=min||10;max=max||42;
  sheet.columns.forEach(function(col){
    var width=min;
    col.eachCell({includeEmpty:true},function(cell){
      var value=cell.value;
      var text=value===null||value===undefined?"":String(value.richText?value.richText.map(function(x){return x.text;}).join(""):value);
      width=Math.max(width,Math.min(max,text.length+2));
    });
    col.width=width;
  });
}
function v234CanvasChart(title,rows,valueFn,labelFn,displayFn,colorFn){
  rows=(rows||[]).slice(0,12);
  var canvas=document.createElement("canvas");
  canvas.width=1100;
  canvas.height=Math.max(440,130+rows.length*48);
  var ctx=canvas.getContext("2d");
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#061b46";ctx.font="bold 28px Arial";ctx.fillText(title,35,48);
  ctx.font="18px Arial";
  var max=rows.reduce(function(a,r){return Math.max(a,Number(valueFn(r))||0);},0)||1;
  rows.forEach(function(r,i){
    var y=95+i*48,value=Number(valueFn(r))||0,label=String(labelFn(r)||"");
    var display=String(displayFn(r)||"");
    ctx.fillStyle="#334155";ctx.font="16px Arial";
    ctx.fillText(label.length>31?label.slice(0,30)+"…":label,35,y+18);
    var barX=330,barY=y,barW=600,barH=22;
    ctx.fillStyle="#edf2f7";ctx.beginPath();ctx.roundRect(barX,barY,barW,barH,11);ctx.fill();
    var cls=colorFn?colorFn(r):"info";
    ctx.fillStyle=cls==="ok"?"#0f9f6e":cls==="warn"?"#d97706":cls==="bad"?"#dc2626":"#2563eb";
    ctx.beginPath();ctx.roundRect(barX,barY,Math.max(6,barW*Math.min(1,value/max)),barH,11);ctx.fill();
    ctx.fillStyle="#061b46";ctx.font="bold 16px Arial";ctx.textAlign="right";
    ctx.fillText(display,1060,y+18);ctx.textAlign="left";
  });
  return canvas.toDataURL("image/png");
}
function v234ExcelAddImage(workbook,sheet,dataUrl,range){
  var id=workbook.addImage({base64:dataUrl,extension:"png"});
  sheet.addImage(id,range);
}
function v234ExcelSheet(workbook,name,title,subtitle,headers,rows){
  var sheet=workbook.addWorksheet(name,{views:[{state:"frozen",ySplit:3}]});
  v234ExcelTitle(sheet,title,subtitle);
  sheet.addRow([]);
  var headerRow=sheet.addRow(headers);
  v234ExcelStyleHeader(headerRow);
  rows.forEach(function(row){sheet.addRow(row);});
  v234ExcelStyleTable(sheet,headerRow.number+1,sheet.rowCount);
  sheet.autoFilter={from:{row:headerRow.number,column:1},to:{row:sheet.rowCount,column:headers.length}};
  v234ExcelAutoWidths(sheet);
  return sheet;
}
function v234DownloadBlob(blob,filename){
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
}
async function v232GenerateExcel(meta,analysis){
  await v234LoadExcelLibrary();
  var ExcelJS=window.ExcelJS,m=analysis.m,w=m.specialWait||{},r=m.reliability||{};
  var workbook=new ExcelJS.Workbook();
  workbook.creator=meta.author;
  workbook.lastModifiedBy=meta.author;
  workbook.created=meta.generatedAt;
  workbook.modified=meta.generatedAt;
  workbook.properties.date1904=false;
  workbook.calcProperties.fullCalcOnLoad=true;

  // Portada / resumen.
  var summary=workbook.addWorksheet("Resumen",{views:[{showGridLines:false}]});
  summary.mergeCells("A1:H3");
  var title=summary.getCell("A1");
  title.value=meta.title;
  title.font={bold:true,size:22,color:{argb:"FFFFFFFF"}};
  title.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF061B46"}};
  title.alignment={vertical:"middle",horizontal:"left",wrapText:true};
  summary.getRow(1).height=35;summary.getRow(2).height=35;summary.getRow(3).height=35;
  summary.getCell("A5").value="Elaborado por";summary.getCell("B5").value=meta.author;
  summary.getCell("A6").value="Cargo";summary.getCell("B6").value=meta.position;
  summary.getCell("A7").value="Área responsable";summary.getCell("B7").value=meta.department;
  summary.getCell("A8").value="Dirigido a";summary.getCell("B8").value=meta.audience;
  summary.getCell("A9").value="Periodo / alcance";summary.getCell("B9").value=meta.periodName||meta.scope;
  summary.getCell("A10").value="Clasificación";summary.getCell("B10").value=meta.confidentiality;
  summary.getCell("A12").value="Objetivo";summary.getCell("B12").value=meta.objective;
  summary.mergeCells("B12:H14");
  summary.getCell("B12").alignment={wrapText:true,vertical:"top"};

  var kpiStart=16;
  var kpis=[
    ["Índice de desempeño",analysis.score+"%",analysis.scoreState.label],
    ["Total cargado",m.totalLoaded||app.cases.length||0,"Pedidos disponibles"],
    ["Trazados VSM",m.cases||0,"Pedidos calculables"],
    ["WIP actual",m.wip||0,(m.lateWip||0)+" fuera de meta"],
    ["Cerrados",m.closed||0,"Throughput "+(m.throughput||0)+"/día"],
    ["LT P50",v234MsHours(m.leadP50||0),"Horas; P90 "+v234MsHours(m.leadP90||0)],
    ["Confiabilidad",Number(r.avg||0)+"%",Number(r.low||0)+" críticos"],
    ["No entregas",m.noDeliveryCount||0,"Filtro actual"]
  ];
  kpis.forEach(function(k,i){
    var row=kpiStart+Math.floor(i/4)*4,col=1+(i%4)*2;
    summary.mergeCells(row,col,row+2,col+1);
    var cell=summary.getCell(row,col);
    cell.value={richText:[
      {text:k[0]+"\n",font:{bold:true,size:9,color:{argb:"FF64748B"}}},
      {text:String(k[1])+"\n",font:{bold:true,size:18,color:{argb:"FF061B46"}}},
      {text:String(k[2]),font:{size:8,color:{argb:"FF64748B"}}}
    ]};
    cell.alignment={vertical:"middle",horizontal:"left",wrapText:true};
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF8FAFC"}};
    cell.border={
      top:{style:"thin",color:{argb:"FFD8E2EF"}},left:{style:"thin",color:{argb:"FFD8E2EF"}},
      bottom:{style:"thin",color:{argb:"FFD8E2EF"}},right:{style:"thin",color:{argb:"FFD8E2EF"}}
    };
  });

  var rowNum=25;
  summary.getCell("A"+rowNum).value="Hallazgos analíticos";
  summary.getCell("A"+rowNum).font={bold:true,size:14,color:{argb:"FF061B46"}};
  rowNum++;
  analysis.findings.forEach(function(f){
    summary.mergeCells(rowNum,1,rowNum,8);
    summary.getCell(rowNum,1).value="• "+f;
    summary.getCell(rowNum,1).alignment={wrapText:true,vertical:"top"};
    rowNum++;
  });
  rowNum+=1;
  summary.getCell("A"+rowNum).value="Recomendaciones";
  summary.getCell("A"+rowNum).font={bold:true,size:14,color:{argb:"FF061B46"}};
  rowNum++;
  analysis.recommendations.forEach(function(f){
    summary.mergeCells(rowNum,1,rowNum,8);
    summary.getCell(rowNum,1).value="• "+f;
    summary.getCell(rowNum,1).alignment={wrapText:true,vertical:"top"};
    rowNum++;
  });
  summary.columns=[{width:22},{width:26},{width:18},{width:18},{width:18},{width:18},{width:18},{width:18}];

  // Procesos.
  var processSheet=v234ExcelSheet(
    workbook,"Procesos","Desempeño por proceso",meta.scope,
    ["Proceso","Casos","WIP","Atrasados","LT promedio (h)","P50 (h)","P90 (h)","Trabajo directo (h)","Bloqueo (h)","Cumplimiento (%)"],
    analysis.processes.map(function(x){
      return [
        x.label,Number(x.cases||0),Number(x.wip||0),Number(x.wipLate||0),
        v234MsHours(x.avg||0),v234MsHours(x.p50||0),v234MsHours(x.p90||0),
        v234MsHours(x.cases?x.active/x.cases:0),v234MsHours(x.cases?x.wait/x.cases:0),
        Number(x.slaPct||0)
      ];
    })
  );
  var processChart=v234CanvasChart(
    "Lead Time promedio por proceso",
    analysis.processes.slice().sort(function(a,b){return Number(b.avg||0)-Number(a.avg||0);}),
    function(x){return Number(x.avg||0);},function(x){return x.label;},
    function(x){return v225Time(x.avg||0);}
  );
  v234ExcelAddImage(workbook,processSheet,processChart,{tl:{col:0,row:processSheet.rowCount+2},ext:{width:760,height:420}});

  // Áreas.
  var areaSheet=v234ExcelSheet(
    workbook,"Áreas","Desempeño por área",meta.scope,
    ["Área","Casos","Intervenciones","WIP / abiertas","Cerrados","LT promedio (h)","Trabajo directo (h)","Bloqueo / espera (h)","Cumplimiento (%)","Confiabilidad (%)","No entregas","Actores"],
    analysis.areas.map(function(x){
      return [
        x.label,Number(x.cases||0),x.area==="ventas"?Number(x.interventions||0):"",
        Number(x.wip||0),Number(x.closed||0),v234MsHours(x.avg||0),v234MsHours(x.work||0),
        v234MsHours(x.block||0),Number(x.compliance||0),Number(x.reliability||0),
        Number(x.noDeliveries||0),Number(x.workers||0)
      ];
    })
  );
  var areaChart=v234CanvasChart(
    "Cumplimiento por área",
    analysis.areas.slice().sort(function(a,b){return Number(a.compliance||0)-Number(b.compliance||0);}),
    function(x){return Number(x.compliance||0);},function(x){return x.label;},
    function(x){return Number(x.compliance||0)+"%";},
    function(x){return x.compliance>=85?"ok":(x.compliance>=65?"warn":"bad");}
  );
  v234ExcelAddImage(workbook,areaSheet,areaChart,{tl:{col:0,row:areaSheet.rowCount+2},ext:{width:760,height:420}});

  // Actores.
  if(meta.includeActors){
    var actorSheet=v234ExcelSheet(
      workbook,"Actores","Productividad por actor","Super Admin excluido de todas las mediciones.",
      ["Actor","Rol","Casos","WIP","Cerrados","Trabajo directo (h)","Promedio directo (h)","Cumplimiento (%)","Carga directa (%)","Procesos"],
      analysis.actors.map(function(x){
        return [
          x.user,roleTitle(x.role),Number(x.count||0),Number(x.open||0),Number(x.closed||0),
          v234MsHours(x.active||0),v234MsHours(x.directPerCase||0),Number(x.compliance||0),
          Number(x.directLoadPct||0),x.processList||""
        ];
      })
    );
    var actorChart=v234CanvasChart(
      "Trabajo directo trazado por actor",
      analysis.actors.slice().sort(function(a,b){return Number(b.active||0)-Number(a.active||0);}),
      function(x){return Number(x.active||0);},function(x){return x.user;},
      function(x){return v225Time(x.active||0);}
    );
    v234ExcelAddImage(workbook,actorSheet,actorChart,{tl:{col:0,row:actorSheet.rowCount+2},ext:{width:760,height:460}});
  }

  // Esperas.
  if(meta.includeWaits){
    var waitsSheet=v234ExcelSheet(
      workbook,"Esperas","Novedades, reprocesos y no entregas",meta.scope,
      ["Pedido","Categoría","Área","Proceso","Inicio","Fin / corte","Duración (h)","Abierto","Origen del cálculo","Detalle"],
      (w.all||[]).map(function(x){
        return [
          x.pedido,x.category,v225AreaLabel(x.area),processTitle(x.process),
          x.start?new Date(x.start):"",x.end?new Date(x.end):"",
          v234MsHours(x.duration||0),x.open?"Sí":"No",x.source,x.detail
        ];
      })
    );
    waitsSheet.getColumn(5).numFmt="dd/mm/yyyy hh:mm";
    waitsSheet.getColumn(6).numFmt="dd/mm/yyyy hh:mm";
    var waitsChart=v234CanvasChart(
      "Tiempos especiales de espera",
      [
        {label:"Novedades",value:w.novelty||0,cls:"warn"},
        {label:"Reprocesos",value:w.rework||0,cls:"bad"},
        {label:"No entregas",value:w.noDelivery||0,cls:"warn"}
      ],
      function(x){return x.value;},function(x){return x.label;},
      function(x){return v225Time(x.value);},function(x){return x.cls;}
    );
    v234ExcelAddImage(workbook,waitsSheet,waitsChart,{tl:{col:0,row:waitsSheet.rowCount+2},ext:{width:760,height:320}});
  }

  // Alertas.
  if(meta.includeAlerts){
    v234ExcelSheet(
      workbook,"Alertas","Alertas y riesgos prioritarios",meta.scope,
      ["Prioridad","Pedido","Proceso","Hallazgo","Acción sugerida"],
      (m.alertRows||[]).map(function(x){
        return [x.severity==="bad"?"Alta":"Media",x.pedido||"",x.proceso||"",x.detalle||"",x.accion||""];
      })
    );
  }

  // Plan de acción.
  if(meta.includeActionPlan){
    v234ExcelSheet(
      workbook,"Plan de acción","Plan de acción propuesto","Generado automáticamente a partir de los resultados del tablero.",
      ["Prioridad","Situación","Acción","Responsable sugerido","Meta","Estado","Fecha compromiso","Observaciones"],
      analysis.actions.map(function(x){return [x.priority,x.issue,x.action,x.owner,x.target,"Pendiente","",""];})
    );
  }

  // Pedidos críticos.
  if(meta.includeOrders){
    v234ExcelSheet(
      workbook,"Pedidos críticos","Anexo de pedidos críticos",meta.scope,
      ["Pedido","OC","Cliente","Proceso","Responsable","Tiempo en proceso (h)","Meta (h)","Estado","Bloqueo","Próxima acción","Lead Time total (h)"],
      (m.wipRows||[]).map(function(x){
        return [
          x.pedido,x.oc,x.cliente,x.processLabel,x.responsable,
          v234MsHours(x.age||0),Number(x.slaHours||0),x.late?"Fuera de meta":"Dentro de meta",
          x.blocker||"",x.next||"",v234MsHours(x.lead||0)
        ];
      })
    );
  }

  // Metodología.
  if(meta.includeMethodology){
    v234ExcelSheet(
      workbook,"Metodología","Metodología, fórmulas y fuentes","Criterios aplicados por el VSM.",
      ["Elemento","Criterio aplicado"],
      [
        ["Jornada laboral","07:00–12:00 y 13:40–17:30; se excluyen sábados, domingos y festivos colombianos cargados."],
        ["Lead Time","Tiempo laboral desde el inicio del pedido o etapa hasta su cierre o corte de análisis."],
        ["P50 / P90","P50 es la mediana; P90 representa el tiempo bajo el cual termina el 90% de los casos."],
        ["Trabajo directo","Actividad registrada o inferida mediante eventos operativos; el Super Admin está excluido."],
        ["Reproceso","Exceso sobre la meta cuando el pedido regresa a una etapa anterior por corrección, diferencia, rechazo o no conformidad."],
        ["No entrega","Desde noDelivery, noDeliveryReports, requirementType=no_entrega o NO_DELIVERY_* hasta solución o cierre."],
        ["Índice compuesto","30% cumplimiento, 25% confiabilidad, 20% WIP en meta, 10% cobertura, 7,5% no entregas y 7,5% reprocesos."],
        ["Fuentes","cases, case_events, reportes_novedad, processStats, requirements, openRequirement, noDeliveryReports, stateHistory y flowTrace."]
      ]
    );
  }

  // Conclusiones.
  v234ExcelSheet(
    workbook,"Conclusiones","Conclusiones y recomendaciones",meta.scope,
    ["Tipo","Contenido"],
    [
      ["Conclusión general",v234PdfConclusion(analysis)]
    ].concat(
      analysis.findings.map(function(x){return ["Hallazgo",x];}),
      analysis.recommendations.map(function(x){return ["Recomendación",x];})
    )
  );

  workbook.eachSheet(function(sheet){
    sheet.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};
    sheet.headerFooter={
      oddHeader:"&CElectroingeniería · "+meta.title,
      oddFooter:"&L"+meta.author+" · "+meta.department+"&RPage &P of &N"
    };
  });

  var buffer=await workbook.xlsx.writeBuffer();
  var blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  v234DownloadBlob(blob,v232FileName(meta,"xlsx"));
}
async function v232GenerateReport(meta){
  if(!app.metrics)await refresh();
  var analysis=v232Analyze(meta);
  loading(true,"Construyendo texto, tablas, gráficas, conclusiones y plan de acción...");
  try{
    if(meta.format==="excel")v232GenerateExcel(meta,analysis);
    else if(meta.format==="pdf")await v232GeneratePdf(meta,analysis);
    else{
      v232GenerateExcel(meta,analysis);
      await sleep(350);
      await v232GeneratePdf(meta,analysis);
    }
    v232CloseReportModal();
    status("Informe inteligente generado correctamente para "+analysis.m.cases+" pedido(s) trazados.","ok");
  }finally{
    loading(false);
  }
}
function bind(){
  bindV232Base();

  var openButton=$("btnSmartReport");
  var closeButton=$("btnCloseSmartReport");
  var cancelButton=$("btnCancelSmartReport");
  var modal=$("smartReportModal");
  var form=$("smartReportForm");

  if(openButton)openButton.onclick=v232OpenReportModal;
  if(closeButton)closeButton.onclick=v232CloseReportModal;
  if(cancelButton)cancelButton.onclick=v232CloseReportModal;

  if(modal){
    modal.addEventListener("click",function(e){
      if(e.target===modal)v232CloseReportModal();
    });
  }

  document.addEventListener("keydown",function(e){
    var currentModal=$("smartReportModal");
    if(e.key==="Escape"&&currentModal&&currentModal.classList.contains("show")){
      v232CloseReportModal();
    }
  });

  if(form){
    form.addEventListener("submit",function(e){
      e.preventDefault();
      try{
        var meta=v232CollectMeta();
        v232GenerateReport(meta).catch(function(err){
          loading(false);
          status("Error generando informe: "+esc(err.message||err),"bad");
        });
      }catch(err){
        status("No se pudo generar el informe: "+esc(err.message||err),"bad");
      }
    });
  }else{
    console.warn("[V233] El formulario del generador no está disponible; el VSM continúa funcionando.");
  }
}

function bindBase(){['fFrom','fTo','fProcess','fStatus','fOrderType','fUser','fView'].forEach(function(id){$(id).addEventListener('change',function(){refresh().catch(function(e){loading(false);status('Error recalculando: '+esc(e.message||e),'bad');});});});$('fSearch').addEventListener('input',function(){clearTimeout(window.__vsmSearch);window.__vsmSearch=setTimeout(function(){refresh().catch(function(e){loading(false);status('Error filtrando: '+esc(e.message||e),'bad');});},250);});$('btnLoad').onclick=function(){loadCases(false).catch(function(e){loading(false);status('Error cargando datos: '+esc(e.message||e),'bad');});};$('btnLoadAll').onclick=function(){loadCases(true).catch(function(e){loading(false);status('Error cargando histórico: '+esc(e.message||e),'bad');});};$('btnExport').onclick=function(){exportExcel().catch(function(e){loading(false);status('Error exportando Excel: '+esc(e.message||e),'bad');});};if($('btnReset'))$('btnReset').onclick=resetVsmFilters;}
(async function(){try{bind();await initFirebase();$('fFrom').value='';$('fTo').value='';await loadCases(false);if(/[?&]export=1/.test(location.search))setTimeout(function(){$('btnExport').click();},900);}catch(e){loading(false);status('Error inicializando VSM: '+esc(e.message||e),'bad');}})();
})();
