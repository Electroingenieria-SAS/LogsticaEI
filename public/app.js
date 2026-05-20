(function(){
"use strict";

var appEl = document.getElementById("app");
var logoPath = (window.appSettings && window.appSettings.logoPath) || "./assets/logo-electroingenieria.jpeg";
var storageKey = "ei_trazabilidad_v31_despachos_roles_unificados";
var db = null;
var auth = null;
var firebaseReady = false;
var firebaseInitError = null;

var driveTokenClient = null;
var driveAccessToken = "";
var driveTokenExpiresAt = 0;
var DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

var state = {
  user: null,
  route: "dashboard",
  cases: [],
  events: [],
  users: [],
  filters: { search:"", status:"", process:"" },
  kpiFilters: { from:"", to:"", process:"" },
  pdfExtraction: null,
  realtime: { caseUnsubs: [], eventUnsub: null, eventUnsubs: [], userUnsub: null, pollTimer: null, buckets: {}, eventBuckets: {}, initialCasesLoaded: false, initialEventsLoaded: false, lastHash: "", lastEventHash: "", lastChangeAt: 0, lastEventAt: 0, startedAt: 0, pendingRender: false },
  notifications: { enabled: true, memory: {}, queue: [], queueTimer: null, lastSoundAt: 0 }
};

var roles = {
  admin:"Administrador / Desarrollador",
  super_admin:"Super administrador",
  super_administrador:"Super administrador",
  gerencia:"Gerencia",
  ventas:"Ventas",
  jefe_logistica:"Jefe de logística",
  lider_logistico:"Logística / despacho (unificado)",
  coordinador_logistico:"Logística / despacho (unificado)",
  aux_logistica:"Auxiliar logística",
  auxiliar_corte:"Auxiliar de corte",
  caja:"Caja",
  inventarios:"Inventarios",
  auditoria:"Auditoría"
};

var FLOW = [
  "recepcion_pedidos",
  "alistamiento",
  "corte_cable",
  "facturacion",
  "caja",
  "cliente_punto",
  "cliente_recoge",
  "despacho_local",
  "despacho_nacional",
  "cierre_despacho_nacional"
];

var processes = {
  recepcion_pedidos:{
    code:"S-PR-2", title:"Recepción de pedidos", ownerRoles:["coordinador_logistico"], icon:"RP",
    checklist:["Pedido registrado por ventas","PDF del pedido cargado en recepción","Documento legible y completo","Número de pedido identificado","Cliente identificado","Referencias del pedido identificadas","Cantidades y unidades de medida identificadas","Cortes automáticos detectados si aplica","Tipo PVC/PVN validado","Tipo de entrega definido","Forma de pago definida","Mercancía comprometida en SIESA/ERP","Observaciones revisadas","Pedido listo para alistamiento"],
    waits:["Falta PDF del pedido","PDF ilegible","Falta referencia","Falta cantidad","Falta unidad de medida","Falta tipo de entrega","Falta forma de pago","Mercancía sin comprometer","Falta autorización comercial","Falta aclaración del asesor","Pedido no coincide con lo registrado por ventas"],
    next:["alistamiento"]
  },
  alistamiento:{
    code:"S-PR-4", title:"Alistamiento de mercancía", ownerRoles:["aux_logistica"], icon:"AL",
    checklist:["Pedido recibido desde recepción","Productos y cantidades ubicadas","Referencia coincide","Descripción coincide","Cantidad coincide","Unidad de medida coincide","Ubicación correcta","Estado físico conforme","Líneas que requieren corte definidas","Cortes enviados al módulo de corte si aplica","Cortes terminados o en seguimiento","Pedido listo para facturación"],
    waits:["No se encuentra mercancía","Cantidad insuficiente","Referencia diferente","Unidad de medida diferente","Ubicación errada","Mercancía averiada","Remanente crítico","Requiere aprobación logística","Requiere ajuste de ventas","Corte pendiente por finalizar"],
    next:["facturacion"]
  },
  corte_cable:{
    code:"S-PR-9", title:"Corte de cable", ownerRoles:["auxiliar_corte"], icon:"CT",
    checklist:["Solicitud de corte recibida","Referencia validada","Metros solicitados validados","Disponibilidad verificada","Remanente calculado","Aprobación gestionada si aplica","Foto inicial anexada","Cronómetro iniciado","Cronómetro finalizado","Foto final anexada","Corte guardado en Firebase principal"],
    waits:["Cable no disponible en su totalidad para el corte","Chipa con cantidad mayor que se puede vender toda","Mal registro del pedido","Otros","Pendiente iniciar corte","Pendiente foto inicial","Pendiente aprobación por remanente","Pendiente disponibilidad física","Pendiente finalizar corte","Pendiente foto final"],
    next:[]
  },
  compromiso_mercancia:{
    hidden:true, legacy:true,
    code:"S-PR-4", title:"Compromiso inicial de mercancía (legacy)", ownerRoles:["coordinador_logistico"], icon:"CM",
    checklist:["Pedido recibido desde recepción","PDF revisado contra pedido","Pedido correcto para comprometer","Referencias principales identificadas","Cantidades revisadas","Cortes automáticos identificados si aplica","Mercancía comprometida/bloqueada en SIESA/ERP","Novedades de devolución o cancelación descartadas","Pedido liberado para alistamiento"],
    waits:["No se logró comprometer mercancía","Producto ya fue vendido o reservado","Cantidad insuficiente para comprometer","Devolución reportada","Pedido cancelado por ventas o cliente","Error al comprometer en SIESA/ERP","Requiere autorización logística","Requiere corrección de Ventas"],
    next:["alistamiento"]
  },
  ratificacion_compromiso:{
    hidden:true, legacy:true,
    code:"S-PR-4", title:"Ratificación compromiso (legacy)", ownerRoles:["coordinador_logistico"], icon:"RC",
    checklist:["Alistamiento validado","Cortes finalizados si aplica","Producto correcto contra PDF","Referencia correcta","Cantidad correcta","Unidad de medida correcta","Sin devolución pendiente","Sin cancelación pendiente","Compromiso inicial revisado","Compromiso ratificado en SIESA/ERP","Pedido listo para facturación"],
    waits:["Diferencia entre pedido y compromiso","Hubo devolución","Pedido cancelado","Producto liberado por error","Error al ratificar compromiso en SIESA/ERP","Requiere ajuste de ventas","Requiere autorización logística","Corte pendiente por finalizar"],
    next:["facturacion"]
  },
  facturacion:{
    code:"S-PR-5", title:"Facturación del pedido", ownerRoles:["coordinador_logistico"], icon:"FC",
    checklist:["Pedido recibido para facturar","Compromiso ratificado por facturación","Tipo de pedido validado","Si es PVC, continúa facturación logística","Si no es PVC, relevar a caja","Factura generada correctamente","Documento validado","Tipo de entrega seleccionado","Factura entregada a despacho"],
    waits:["Pago pendiente","Soporte incompleto","Error en Siesa","Error de factura electrónica","Documento rechazado","Falta autorización de cartera","Cliente con datos incompletos"],
    next:["caja","cliente_punto","cliente_recoge","despacho_local","despacho_nacional"]
  },
  caja:{
    code:"S-PR-5", title:"Caja", ownerRoles:["caja"], icon:"CJ",
    checklist:["Pedido recibido desde facturación","Valor validado","Soporte de pago validado","Recaudo confirmado","Liberación registrada","Pedido listo para despacho"],
    waits:["Cliente no ha pagado","Pago pendiente de validación","Soporte incompleto","Diferencia en valor","Caja no confirma recaudo"],
    next:["cliente_punto","cliente_recoge","despacho_local","despacho_nacional"]
  },
  cliente_punto:{
    code:"S-PR-6", title:"Entrega cliente en punto", ownerRoles:["coordinador_logistico"], icon:"CP",
    checklist:["Factura coincide con pedido","Producto coincide con factura","Cliente identificado","Referencias correctas","Cantidades correctas","Estado físico conforme","Chequeo con el cliente realizado","Foto de mercancía rotulada cargada","Guía de transportadora / soporte final cargado","Cliente recibe conforme"],
    waits:["Cliente no acepta mercancía","Cliente solicita cambio","Cliente no está autorizado","Cliente no confirma retiro","Documento no coincide","Producto equivocado","Cantidad diferente"],
    next:["cierre_caso"]
  },
  cliente_recoge:{
    code:"S-PR-6", title:"Cliente recoge", ownerRoles:["coordinador_logistico"], icon:"CR",
    checklist:["Factura coincide con pedido","Producto coincide con factura","Autorización de recogida validada","Persona autorizada identificada","Referencias correctas","Cantidades correctas","Estado físico conforme","Foto de mercancía rotulada cargada","Guía de transportadora / soporte final cargado","Entrega realizada"],
    waits:["Persona no autorizada","Falta autorización del cliente","Documento no coincide","Producto incompleto","Producto equivocado","Cantidad diferente","Cliente no confirma retiro"],
    next:["cierre_caso"]
  },
  despacho_local:{
    code:"S-PR-6", title:"Despacho local", ownerRoles:["coordinador_logistico"], icon:"DL",
    checklist:["Factura coincide con pedido","Producto coincide con factura","Dirección completa","Documento de salida validado","Empaque conforme","Rotulación conforme","Foto de mercancía rotulada cargada","Logística finalizada, espera transportadora/entrega","Guía de transportadora / soporte final cargado","Cierre de despacho registrado"],
    waits:["Falta empaque","Falta etiqueta","Mercancía incompleta","Dirección incompleta","Falta documento","Pedido no liberado","Novedad de cargue","Cliente no recibe"],
    next:["cierre_caso"]
  },
  despacho_nacional:{
    code:"S-PR-6", title:"Despacho nacional", ownerRoles:["coordinador_logistico"], icon:"DN",
    checklist:["Factura coincide con pedido","Producto coincide con factura","Número de unidades definido","Dimensiones registradas","Destino validado","Condiciones de envío definidas","Transportadora coordinada","Foto de mercancía rotulada cargada","Logística finalizada, espera transportadora","Guía de transportadora / soporte final cargado","Cierre de despacho registrado"],
    waits:["Falta guía","Falta flete","Transportadora no recoge","Plataforma no disponible","Falta datos de destino","Falta confirmación de recogida","Pedido no liberado"],
    next:["cierre_despacho_nacional"]
  },
  cierre_despacho_nacional:{
    code:"S-PR-6", title:"Cierre despacho nacional", ownerRoles:["coordinador_logistico"], icon:"CD",
    checklist:["Foto de mercancía rotulada cargada","Logística finalizada, espera transportadora","Guía de transportadora / soporte final cargado","Confirmación de entrega validada","Proceso cerrado"],
    waits:["Transportadora no confirma entrega","Falta guía","Falta soporte","Pendiente reporte","Novedad sin cierre"],
    next:["cierre_caso"]
  }
};



function deliveryProcessKeys(){return ["cliente_punto","cliente_recoge","despacho_local","despacho_nacional","cierre_despacho_nacional"];} 
function isDeliveryProcess(p){return deliveryProcessKeys().indexOf(p)>=0;}
function deliveryEvidenceDefinitions(processKey){
  return [
    {key:"supportPdf", type:"PDF_SOPORTE_DESPACHO", title:"PDF / soporte de despacho", checklist:"PDF/soporte de despacho recibido si aplica", hint:"Opcional: puede anexar PDF de factura, remisión, soporte de despacho o documento de transporte.", accept:"application/pdf,image/*,.doc,.docx,.xls,.xlsx", required:false},
    {key:"mercanciaRotulada", type:"FOTO_MERCANCIA_ROTULADA", title:"Foto de mercancía rotulada", checklist:"Foto de mercancía rotulada cargada", hint:"Debe verse la mercancía lista, rotulada/sticker visible y preparada para entrega o transportadora. Al subir esta foto termina el tiempo operativo de logística y el caso queda en espera de transportadora/entrega.", accept:"image/*", required:true},
    {key:"guiaTransportadora", type:"GUIA_TRANSPORTADORA", title:"Guía de transportadora / soporte final", checklist:"Guía de transportadora / soporte final cargado", hint:"Obligatoria para cierre: suba la guía de despacho, guía de transportadora o soporte final de entrega. Al guardar este soporte se cierra el despacho.", accept:"application/pdf,image/*", required:true}
  ];
}
function ensureDeliveryChecklistDefinitions(){
  deliveryProcessKeys().forEach(function(k){
    if(!processes[k])return;
    var checks=processes[k].checklist=processes[k].checklist||[];
    deliveryEvidenceDefinitions(k).filter(function(d){return d.required!==false;}).forEach(function(d){if(checks.indexOf(d.checklist)<0)checks.push(d.checklist);});
  });
}
ensureDeliveryChecklistDefinitions();

var routeInfo = {
  dashboard:["Inicio","IN"], cases:["Casos","CS"], create:["Crear pedido","CR"], requirements:["Requerimientos","RQ"],
  approvals:["Aprobaciones","AU"], corte_cable:["Cortes","CT"], indicators:["VSM","VS"], users:["Usuarios","US"], admin:["Admin","AD"]
};

function qs(sel,root){return (root||document).querySelector(sel);}
function qsa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c];});}
function uid(p){return (p||"id")+"_"+Date.now()+"_"+Math.random().toString(16).slice(2);}
function now(){return new Date().toISOString();}
function msSince(iso){return iso?Date.now()-new Date(iso).getTime():0;}
function fmt(ms){ms=Math.max(0,Math.floor((ms||0)/1000));var h=("0"+Math.floor(ms/3600)).slice(-2);var m=("0"+Math.floor((ms%3600)/60)).slice(-2);var s=("0"+(ms%60)).slice(-2);return h+":"+m+":"+s;}
function fmtDate(iso){try{return iso?new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(iso)):"—";}catch(e){return iso||"—";}}
function clamp(n,min,max){n=Number(n);if(!Number.isFinite(n))n=0;return Math.max(min,Math.min(max,n));}
function pct(num,den,dec){if(!den||den<=0)return 0;var v=(Number(num||0)/Number(den||0))*100;v=clamp(v,0,100);return Number(v.toFixed(dec==null?1:dec));}
function avgMs(sum,count){return count?Math.max(0,Number(sum||0)/count):0;}
function toDayStart(d){var x=new Date(d);x.setHours(0,0,0,0);return x;}
function daysBetweenInclusive(a,b){var ms=toDayStart(b)-toDayStart(a);return Math.max(1,Math.floor(ms/86400000)+1);}
function normalizeRole(r){
  var x=stripAccents(String(r||"").trim().toLowerCase()).replace(/[\s\-]+/g,"_");
  if(x==="superadmin"||x==="super_admin"||x==="super_administrador"||x==="superadministrador"||x==="super_administracion")return "super_admin";
  if(x==="administrador")return "admin";
  if(x==="jefe_logistico")return "jefe_logistica";
  if(x==="auxiliar_de_corte"||x==="operario_corte"||x==="operario_de_corte")return "auxiliar_corte";
  if(x==="lider_logistica"||x==="lider_logistico"||x==="lider_de_logistica"||x==="lider_despacho"||x==="coordinador_logistica")return "coordinador_logistico";
  return x;
}
function roleTitle(r){var nr=normalizeRole(r);return roles[nr]||roles[r]||r||"Sin rol";}
function isAdminRoleValue(r){var nr=normalizeRole(r);return nr==="admin"||nr==="super_admin"||nr==="superadministrador";}
function isPrivilegedKpiRole(r){var nr=normalizeRole(r);return nr==="admin"||nr==="super_admin"||nr==="gerencia"||nr==="jefe_logistica";}
function isSuperAdminRoleValue(r){return normalizeRole(r)==="super_admin";}
function processTitle(p){return processes[p]?processes[p].title:p||"Sin proceso";}
function legacyProcessTarget(p){
  if(p==="compromiso_mercancia"||p==="compromiso_inicial")return "alistamiento";
  if(p==="ratificacion_compromiso"||p==="ratificar_compromiso")return "facturacion";
  return "";
}
function isLegacyProcess(p){return !!legacyProcessTarget(p);}
function migrateLegacyCaseInMemory(c, reason){
  if(!c || !isLegacyProcess(c.currentProcess))return false;
  var oldProcess=c.currentProcess, target=legacyProcessTarget(oldProcess);
  c.legacyProcessMigratedFrom=oldProcess;
  c.legacyProcessMigratedTo=target;
  c.legacyProcessMigratedAt=c.legacyProcessMigratedAt||now();
  c.legacyProcessMigrationReason=reason||"Flujo V22/V23: se eliminaron los módulos de compromiso; el compromiso queda dentro de Recepción y se ratifica al facturar.";
  c.currentProcess=target;
  if(!c.closedAt && c.status!=="cancelado" && c.status!=="cerrado_conforme"){
    c.status="asignado";
    c.assignedRole=primaryOwnerRole(target);
    c.assignedName=processOwnerTitle(target);
    c.assignedTo="";
    c.deadStartedAt=c.deadStartedAt||now();
    c.activeStartedAt=null;
    c.waitStartedAt=null;
  }
  c.checklist={};
  if(processes[target] && processes[target].checklist){
    processes[target].checklist.forEach(function(x){c.checklist[x]="pending";});
  }
  c.documentFlow=c.documentFlow||{};
  if(oldProcess==="compromiso_mercancia"||oldProcess==="compromiso_inicial"){
    c.documentFlow.initialCommitmentStatus=c.documentFlow.initialCommitmentStatus||"SI";
    c.documentFlow.initialCommitmentDetail=c.documentFlow.initialCommitmentDetail||"Migrado: el compromiso de mercancía queda registrado dentro de Recepción de pedidos.";
  }
  if(oldProcess==="ratificacion_compromiso"||oldProcess==="ratificar_compromiso"){
    c.documentFlow.finalCommitmentStatus=c.documentFlow.finalCommitmentStatus||"RATIFICADO_POR_FACTURACION";
    c.documentFlow.finalCommitmentDetail=c.documentFlow.finalCommitmentDetail||"Migrado: la ratificación del compromiso se registra dentro de Facturación.";
  }
  if(target==="alistamiento")applyAlistamientoAutoChecklist(c);
  c.updatedAt=now();
  return true;
}
function processOwnerRoles(p){return processes[p] ? uniqueArray(processes[p].ownerRoles||[]) : [];}
function activeProcessKeys(){return Object.keys(processes).filter(function(k){return !processes[k].hidden;});}
function canAccessProcess(role,p){
  if(isAdminRoleValue(role))return true;
  var nr=normalizeRole(role);
  return processOwnerRoles(p).map(normalizeRole).indexOf(nr)>=0;
}
function primaryOwnerRole(p){return processOwnerRoles(p)[0]||"";}
function processOwnerTitle(p){return processOwnerRoles(p).map(function(r){return roleTitle(r);}).join(" / ");}
function isLeader(){return state.user && (isAdminRoleValue(state.user.role) || normalizeRole(state.user.role)==="coordinador_logistico");}
function isCutOperator(){return state.user && normalizeRole(state.user.role)==="auxiliar_corte";}
function isJefeLogistica(){return state.user && normalizeRole(state.user.role)==="jefe_logistica";}
function isExecutive(){return state.user && normalizeRole(state.user.role)==="gerencia";}
function canManageUsers(){return state.user && (isAdminRoleValue(state.user.role) || normalizeRole(state.user.role)==="gerencia");}
function canApprovePriority(){return state.user && normalizeRole(state.user.role)==="gerencia";}
function canSeeAll(){return state.user && isPrivilegedKpiRole(state.user.role);}
function canCreate(){return state.user && (normalizeRole(state.user.role)==="ventas" || isAdminRoleValue(state.user.role));}
function canSeeKpis(){return state.user && isPrivilegedKpiRole(state.user.role);}
function canUploadEvidenceForCase(c){
  if(!state.user || !c || c.closedAt)return false;
  if(canSeeAll())return true;
  if(normalizeRole(c.assignedRole)===normalizeRole(state.user.role))return true;
  if(c.assignedUid===state.user.uid || c.assignedTo===state.user.uid)return true;
  if(c.createdBy===state.user.uid)return true;
  if(normalizeRole(state.user.role)==="auxiliar_corte" && c.hasCuts===true)return true;
  return canAccessProcess(state.user.role,c.currentProcess);
}
function evidenceProcessOptions(current){
  var ordered=FLOW.slice();
  ["cierre_caso","requerimientos","ventas"].forEach(function(x){if(ordered.indexOf(x)<0)ordered.push(x);});
  return ordered.map(function(p){return '<option value="'+esc(p)+'" '+(p===current?'selected':'')+'>'+esc(processTitle(p))+'</option>';}).join("");
}
function evidenceTypeOptions(){
  var opts=[
    ["EVIDENCIA_PROCESO","Evidencia general del proceso"],
    ["PDF_PEDIDO","PDF / documento del pedido"],
    ["FOTO_ALISTAMIENTO","Foto alistamiento"],
    ["FOTO_CORTE","Foto soporte corte"],
    ["FOTO_DESPACHO","Foto despacho / carro / cargue"],
    ["SOPORTE_ENTREGA","Soporte de entrega"],
    ["GUIA_TRANSPORTE","Guía / transporte"],
    ["SOPORTE_CAJA","Soporte caja / pago"],
    ["SOPORTE_FACTURACION","Soporte facturación"],
    ["NOVEDAD","Novedad operativa"],
    ["REQUERIMIENTO","Soporte de requerimiento"],
    ["AUDITORIA","Soporte auditoría"]
  ];
  return opts.map(function(o){return '<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>';}).join("");
}
function defaultEvidenceTypeForProcess(p){
  var map={recepcion_pedidos:"PDF_PEDIDO",alistamiento:"FOTO_ALISTAMIENTO",corte_cable:"FOTO_CORTE",despacho_local:"FOTO_DESPACHO",despacho_nacional:"FOTO_DESPACHO",cierre_despacho_nacional:"SOPORTE_ENTREGA",cliente_punto:"SOPORTE_ENTREGA",cliente_recoge:"SOPORTE_ENTREGA",caja:"SOPORTE_CAJA",facturacion:"SOPORTE_FACTURACION",auditoria:"AUDITORIA"};
  return map[p]||"EVIDENCIA_PROCESO";
}
function persistEvidenceDocument(c,up,detail){
  if(!db || !c || !up)return Promise.resolve();
  var ev={
    id:uid("EVD"),caseId:c.id,caseNumber:c.caseNumber||c.id||"",pedido:c.reference||c.pedido||"",cliente:c.client||"",
    process:up.processKey||c.currentProcess,processName:up.processName||processTitle(up.processKey||c.currentProcess),
    evidenceType:up.evidenceType||"EVIDENCIA",cutId:up.cutId||"",detail:detail||"",fileName:up.fileName||up.name||"",
    mimeType:up.mimeType||"",driveUrl:up.url||"",driveId:up.fileId||"",folder:up.folderPath||up.folder||"",
    uploadedAt:up.uploadedAt||now(),createdAt:now(),createdBy:state.user?state.user.uid:"",createdByName:state.user?state.user.name:"",responsibleRole:state.user?state.user.role:""
  };
  return db.collection("evidences").doc(ev.id).set(ev).catch(function(){return null;});
}
function defaultRoute(role){var r=normalizeRole(role);if(r==="gerencia")return"indicators";if(isAdminRoleValue(r))return"dashboard";if(r==="ventas")return"create";if(r==="jefe_logistica")return"dashboard";if(r==="auxiliar_corte")return"corte_cable";if(r==="lider_logistico"||r==="coordinador_logistico")return"recepcion_pedidos";if(r==="aux_logistica")return"alistamiento";if(r==="caja")return"caja";return"dashboard";}
function currentProc(c){return c.currentProcess;}
function procStats(c,p){c.processStats=c.processStats||{};c.processStats[p]=c.processStats[p]||{activeMs:0,waitMs:0,deadMs:0,startedAt:null,completedAt:null,handoffs:0};return c.processStats[p];}
function addStateHistory(c, type, detail, extra){
  c.stateHistory=c.stateHistory||[];
  var item=Object.assign({
    id:uid("ST"),
    timestamp:now(),
    process:c.currentProcess||"",
    processName:processTitle(c.currentProcess),
    status:c.status||"",
    type:type||"valor",
    detail:detail||"",
    responsibleUid:state.user?state.user.uid:"",
    responsibleName:state.user?state.user.name:"",
    responsibleRole:state.user?state.user.role:""
  }, extra||{});
  c.stateHistory.push(item);
  if(c.stateHistory.length>500)c.stateHistory=c.stateHistory.slice(-500);
}
function totalMs(c){return (c.closedAt?new Date(c.closedAt).getTime():Date.now())-new Date(c.createdAt).getTime();}
function activeMs(c){var total=0;Object.keys(c.processStats||{}).forEach(function(k){total+=Number(c.processStats[k].activeMs||0);});if(c.status==="en_proceso"&&c.activeStartedAt)total+=msSince(c.activeStartedAt);return total;}
function waitMs(c){var total=0;Object.keys(c.processStats||{}).forEach(function(k){total+=Number(c.processStats[k].waitMs||0);});if((c.status==="en_espera"||c.status==="espera_ventas"||c.status==="pendiente_gerencia")&&c.waitStartedAt)total+=msSince(c.waitStartedAt);return total;}
function deadMs(c){var total=0;Object.keys(c.processStats||{}).forEach(function(k){total+=Number(c.processStats[k].deadMs||0);});if(c.status==="asignado"&&c.deadStartedAt)total+=msSince(c.deadStartedAt);return total;}
function progress(c){var def=processes[c.currentProcess];var list=def?def.checklist:[];var total=list.length||1;var done=0;for(var k in c.checklist){if(c.checklist[k]==="ok"||c.checklist[k]==="na")done++;}return clamp(Math.round(done/total*100),0,100);}
function showError(msg){appEl.innerHTML='<main class="error-box"><section class="error-card"><h1>No fue posible iniciar la app</h1><p>El error quedó visible para corregirlo.</p><pre>'+esc(msg)+'</pre><button class="btn btn-primary" onclick="location.reload()">Recargar</button></section></main>';}

function loadScriptOnce(src,id){
  return new Promise(function(resolve,reject){
    if(id && document.getElementById(id)){
      var existing=document.getElementById(id);
      if(existing.getAttribute("data-loaded")==="1")return resolve();
      existing.addEventListener("load",function(){resolve();},{once:true});
      existing.addEventListener("error",function(){reject(new Error("No se pudo cargar "+src));},{once:true});
      return;
    }
    var sc=document.createElement("script");
    if(id)sc.id=id;
    sc.async=false;
    sc.defer=false;
    sc.src=src;
    sc.onload=function(){sc.setAttribute("data-loaded","1");resolve();};
    sc.onerror=function(){reject(new Error("No se pudo cargar "+src));};
    document.head.appendChild(sc);
  });
}
function ensureFirebaseConfigLoaded(){
  if(window.firebaseConfig)return Promise.resolve();
  return loadScriptOnce("./firebase-config.js?v="+Date.now(),"firebase-config-retry").then(function(){
    if(!window.firebaseConfig)throw new Error("firebase-config.js cargó, pero no creó window.firebaseConfig. Revise que el archivo esté en la raíz y no esté vacío.");
  });
}
function ensureFirebaseSdkLoaded(){
  if(window.firebase && window.firebase.initializeApp && window.firebase.auth && window.firebase.firestore)return Promise.resolve();
  return loadScriptOnce("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js","firebase-app-compat-retry")
    .then(function(){return loadScriptOnce("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js","firebase-auth-compat-retry");})
    .then(function(){return loadScriptOnce("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js","firebase-firestore-compat-retry");})
    .then(function(){
      if(!window.firebase || !window.firebase.initializeApp)throw new Error("El SDK de Firebase no quedó disponible. Revise internet, bloqueo del navegador o ahorro de datos del celular.");
    });
}
function initFirebase(){
  try{
    if(!window.firebase || !window.firebaseConfig){throw new Error("No cargó Firebase o firebase-config.js");}
    if(!firebase.apps.length){firebase.initializeApp(window.firebaseConfig);}
    auth=firebase.auth();
    try{auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);}catch(persistenceError){}
    db=firebase.firestore();
    try{db.enableNetwork();}catch(networkError){}
    firebaseReady=true;
    firebaseInitError="";
  }catch(e){
    firebaseReady=false;
    firebaseInitError=e.message||String(e);
  }
}
function initFirebaseAsync(){
  return ensureFirebaseConfigLoaded().then(ensureFirebaseSdkLoaded).then(function(){
    initFirebase();
    if(!firebaseReady)throw new Error(firebaseInitError||"Firebase no inicializó.");
    return true;
  });
}
function clearPwaCachesAndReload(){
  var tasks=[];
  try{if(window.caches)tasks.push(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}));}catch(e){}
  try{if(navigator.serviceWorker)tasks.push(navigator.serviceWorker.getRegistrations().then(function(regs){return Promise.all(regs.map(function(r){return r.unregister();}));}));}catch(e){}
  Promise.all(tasks).then(function(){location.reload(true);}).catch(function(){location.reload(true);});
}

function docsToList(snap){
  var out=[];
  if(!snap)return out;
  snap.forEach(function(d){var x=d.data();x.id=d.id;out.push(x);});
  return out;
}

function uniqueById(list){
  var map={}, out=[];
  list.forEach(function(x){if(!x||!x.id||map[x.id])return;map[x.id]=1;out.push(x);});
  return out;
}

function sortByUpdated(list){
  return list.sort(function(a,b){return new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0);});
}

function loadCasesForRole(){
  if(canSeeAll()){
    return db.collection("cases").orderBy("updatedAt","desc").get().then(docsToList);
  }

  var queries=[];

  if(state.user.role==="auxiliar_corte"){
    queries.push(db.collection("cases").where("hasCuts","==",true).get());
  }else{
    queries.push(db.collection("cases").where("assignedRole","==",state.user.role).get());
    queries.push(db.collection("cases").where("createdBy","==",state.user.uid).get());
  }

  return Promise.all(queries).then(function(snaps){
    var all=[];
    snaps.forEach(function(snap){all=all.concat(docsToList(snap));});
    return sortByUpdated(uniqueById(all));
  });
}

function loadEventsForRole(){
  if(canSeeAll())return db.collection("case_events").orderBy("timestamp","desc").limit(900).get().then(docsToList).catch(function(){return [];});
  if(!state.user)return Promise.resolve([]);
  return db.collection("case_events").where("visibleRoles","array-contains",normalizeRole(state.user.role)).limit(120).get().then(docsToList).catch(function(){return [];});
}

function loadUsersForRole(){
  if(!canSeeAll() && !canManageUsers())return Promise.resolve([]);
  return db.collection("users").get().then(docsToList).catch(function(){return [];});
}

function loadData(){
  if(!firebaseReady || !db || !state.user){return Promise.resolve();}
  return Promise.all([
    loadCasesForRole(),
    loadEventsForRole(),
    loadUsersForRole()
  ]).then(function(res){
    state.cases=res[0]||[];
    state.events=res[1]||[];
    state.users=res[2]||[];
    autoMigrateLegacyProcesses();
  });
}


function caseLiveHash(list){
  return (list||[]).map(function(c){
    return [c.id,c.updatedAt||"",c.status||"",c.currentProcess||"",c.assignedRole||"",c.assignedTo||"",c.closedAt||""].join("|");
  }).sort().join("~");
}

function caseSummary(c){
  return (c && (c.reference || c.pedido || c.caseNumber || c.id)) || "Caso";
}

function caseRelevantToCurrentUser(c){
  if(!state.user || !c)return false;
  if(canSeeAll())return true;
  var r=normalizeRole(state.user.role);
  if(normalizeRole(c.assignedRole)===r || c.assignedTo===state.user.uid || c.assignedUid===state.user.uid || c.createdBy===state.user.uid)return true;
  if(r==="auxiliar_corte" && c.hasCuts===true)return true;
  return canAccessProcess(r,c.currentProcess);
}

function shouldAutoRenderNow(){
  var d=qs("#drawer");
  if(d && d.classList.contains("open"))return false;
  var a=document.activeElement;
  if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName||""))return false;
  return true;
}

function renderAfterLiveChange(){
  if(!state.user)return;
  if(shouldAutoRenderNow()){
    try{render();}catch(e){console.warn("No se pudo repintar en vivo",e);}
  }else{
    state.realtime.pendingRender=true;
    showLiveToast("Actualización disponible","Hubo movimiento en el sistema. Cuando termines el formulario, presiona Actualizar vista.",true);
  }
}

function showLiveToast(title,msg,withButton){
  var box=document.getElementById("ei-live-toast");
  if(!box){
    box=document.createElement("div");
    box.id="ei-live-toast";
    box.style.cssText="position:fixed;right:18px;bottom:18px;z-index:9999;max-width:390px;background:#061b46;color:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(6,27,70,.32);padding:14px 14px 12px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:none";
    document.body.appendChild(box);
  }
  box.innerHTML='<div style="font-weight:900;font-size:14px;margin-bottom:4px">'+esc(title||"Movimiento detectado")+'</div><div style="font-size:12px;line-height:1.35;opacity:.9">'+esc(msg||"")+'</div>'+(withButton?'<button id="ei-live-refresh-btn" style="margin-top:10px;border:0;background:#ffda37;color:#061b46;border-radius:12px;padding:8px 12px;font-weight:900;cursor:pointer">Actualizar vista</button>':'');
  box.style.display="block";
  var btn=document.getElementById("ei-live-refresh-btn");
  if(btn){btn.onclick=function(){state.realtime.pendingRender=false;box.style.display="none";try{render();}catch(e){location.reload();}};}
  clearTimeout(box.__hideTimer);
  box.__hideTimer=setTimeout(function(){if(!withButton)box.style.display="none";},6500);
}


function uniqueArray(arr){
  var out=[];
  (arr||[]).forEach(function(x){x=normalizeRole(x||"");if(x && out.indexOf(x)<0)out.push(x);});
  return out;
}

function notificationVisibleRolesForEvent(c,event){
  var roles=[];
  if(c){
    roles.push(c.assignedRole,c.createdByRole);
    if(c.currentProcess)roles.push(primaryOwnerRole(c.currentProcess));
    if(c.openRequirement){roles.push(c.openRequirement.targetRole,c.openRequirement.sourceRole);}
  }
  if(event){
    roles.push(event.assignedRole,event.targetRole,event.sourceRole,event.role,event.createdByRole,event.toRole,event.fromRole);
    if(event.process)roles.push(primaryOwnerRole(event.process));
  }
  return uniqueArray(roles);
}

function enrichCaseEvent(c,event){
  event=event||{};
  var visible=notificationVisibleRolesForEvent(c,event);
  return Object.assign({
    caseReference:(c&&(c.reference||c.pedido||c.caseNumber))||"",
    caseClient:(c&&c.client)||"",
    caseStatus:(c&&c.status)||"",
    currentProcess:(c&&c.currentProcess)||event.process||"",
    processName:processTitle((c&&c.currentProcess)||event.process),
    assignedRole:(c&&c.assignedRole)||event.assignedRole||"",
    assignedTo:(c&&(c.assignedTo||c.assignedUid))||"",
    sourceRole:state.user?state.user.role:"",
    createdBy:state.user?state.user.uid:"",
    createdByRole:state.user?state.user.role:"",
    visibleRoles:visible
  },event);
}

function eventHash(list){
  return (list||[]).map(function(e){return [e.id,e.timestamp||"",e.type||"",e.caseId||"",e.detail||e.reason||""].join("|");}).sort().join("~");
}

function eventRelevantToCurrentUser(e){
  if(!state.user || !e)return false;
  if(canSeeAll())return true;
  var r=normalizeRole(state.user.role);
  if(e.userId===state.user.uid || e.createdBy===state.user.uid || e.assignedTo===state.user.uid || e.assignedUid===state.user.uid)return true;
  if(normalizeRole(e.targetRole)===r || normalizeRole(e.assignedRole)===r || normalizeRole(e.sourceRole)===r || normalizeRole(e.role)===r)return true;
  if(Array.isArray(e.visibleRoles) && e.visibleRoles.map(normalizeRole).indexOf(r)>=0)return true;
  var c=e.caseId?caseById(e.caseId):null;
  return c?caseRelevantToCurrentUser(c):false;
}

function eventKindLabel(type){
  var map={
    CASE_CREATED:"Pedido creado",
    CASE_ACCEPTED:"Caso aceptado",
    TRANSFER_SENT:"Cambio de etapa",
    CHECK_UPDATED:"Checklist actualizado",
    REQUIREMENT_SENT:"Requerimiento generado",
    REQUIREMENT_ANSWERED:"Requerimiento respondido",
    EVIDENCE_UPLOADED:"Evidencia cargada",
    DELIVERY_EVIDENCE_UPLOADED:"Evidencia de entrega cargada",
    LOGISTICS_READY_FOR_CARRIER:"Logística finalizada · espera transportadora",
    CUT_REGISTERED:"Corte registrado",
    CUT_STARTED:"Corte iniciado",
    CUT_FINISHED:"Corte finalizado",
    SIESA_FLAT_FILE_CUT_EXPORTED:"Plano SIESA exportado",
    CASE_CLOSED:"Caso cerrado",
    MANAGER_APPROVED:"Gerencia aprobó",
    MANAGER_REJECTED:"Gerencia rechazó",
    USER_CREATED:"Usuario creado",
    CASE_DELETED_ADMIN:"Caso eliminado"
  };
  return map[type]||String(type||"Movimiento").replace(/_/g," ");
}

function eventMessage(e){
  var ref=e.caseReference||e.pedido||e.caseNumber||e.caseId||"Caso";
  var proc=e.processName||processTitle(e.currentProcess||e.process)||"";
  var det=e.detail||e.reason||"";
  return ref+(proc?" · "+proc:"")+(det?" · "+det:"");
}

function dispatchNotification(title,msg,forceSound){
  showLiveToast(title,msg,false);
  var nowMs=Date.now();
  if(canNotify() && Notification.permission==="granted"){
    try{new Notification(title,{body:msg,icon:"./assets/app-icon.svg",badge:"./assets/app-icon.svg",tag:"ei-logistica-"+title,renotify:true});}catch(e){}
  }
  if(forceSound || !(canNotify() && Notification.permission==="granted")){
    if(nowMs-(state.notifications.lastSoundAt||0)>900){state.notifications.lastSoundAt=nowMs;playBeep();}
  }
}

function queueEventNotification(e){
  if(!e || !e.id || !eventRelevantToCurrentUser(e))return;
  if(state.realtime.startedAt && Date.now()-state.realtime.startedAt<2500)return;
  var key=e.id+"_"+(e.timestamp||"");
  if(state.notifications.memory[key])return;
  state.notifications.memory[key]=true;
  state.notifications.queue.push(e);
  clearTimeout(state.notifications.queueTimer);
  state.notifications.queueTimer=setTimeout(flushEventNotifications,700);
}

function flushEventNotifications(){
  var q=state.notifications.queue.splice(0);
  if(!q.length)return;
  if(q.length===1){
    var e=q[0];
    dispatchNotification(eventKindLabel(e.type),eventMessage(e),true);
    return;
  }
  var ref=q[0].caseReference||q[0].caseId||"el sistema";
  dispatchNotification("Nuevos movimientos",q.length+" movimientos registrados. Último: "+eventMessage(q[q.length-1]),true);
}

function applyRealtimeEvents(list){
  list=(list||[]).filter(eventRelevantToCurrentUser).sort(function(a,b){return new Date(b.timestamp||0)-new Date(a.timestamp||0);});
  var h=eventHash(list);
  if(!state.realtime.initialEventsLoaded){
    state.events=list;
    state.realtime.lastEventHash=h;
    state.realtime.initialEventsLoaded=true;
    (list||[]).slice(0,60).forEach(function(e){if(e&&e.id)state.notifications.memory[e.id+"_"+(e.timestamp||"")]=true;});
    return;
  }
  if(h===state.realtime.lastEventHash)return;
  var old={};
  (state.events||[]).forEach(function(e){if(e&&e.id)old[e.id]=true;});
  state.events=list;
  state.realtime.lastEventHash=h;
  list.forEach(function(e){if(!old[e.id])queueEventNotification(e);});
  renderAfterLiveChange();
}

function rebuildRealtimeEventsFromBuckets(){
  var all=[];
  Object.keys(state.realtime.eventBuckets||{}).forEach(function(k){all=all.concat(state.realtime.eventBuckets[k]||[]);});
  applyRealtimeEvents(uniqueById(all));
}

function addEventRealtimeListener(key,query){
  try{
    var unsub=query.onSnapshot(function(snap){
      state.realtime.eventBuckets[key]=docsToList(snap);
      rebuildRealtimeEventsFromBuckets();
    },function(err){console.warn("Escucha de notificaciones falló",key,err);});
    state.realtime.eventUnsubs.push(unsub);
  }catch(e){console.warn("No se pudo activar listener de notificaciones",key,e);}
}

function startNotificationListeners(){
  if(!db || !state.user)return;
  var r=normalizeRole(state.user.role);
  if(canSeeAll()){
    addEventRealtimeListener("events_all",db.collection("case_events").orderBy("timestamp","desc").limit(200));
    return;
  }
  addEventRealtimeListener("events_user",db.collection("case_events").where("userId","==",state.user.uid).limit(100));
  addEventRealtimeListener("events_created",db.collection("case_events").where("createdBy","==",state.user.uid).limit(100));
  addEventRealtimeListener("events_target",db.collection("case_events").where("targetRole","==",r).limit(100));
  addEventRealtimeListener("events_assigned",db.collection("case_events").where("assignedRole","==",r).limit(100));
  addEventRealtimeListener("events_visible",db.collection("case_events").where("visibleRoles","array-contains",r).limit(100));
}

function notifyRealtimeChanges(newList, oldList){
  var oldMap={};
  (oldList||[]).forEach(function(c){if(c&&c.id)oldMap[c.id]=c;});
  var changes=[];
  (newList||[]).forEach(function(c){
    if(!c || !c.id || !caseRelevantToCurrentUser(c))return;
    var old=oldMap[c.id];
    if(!old){changes.push({type:"nuevo",c:c,msg:"Nuevo caso visible: "+caseSummary(c)+"."});return;}
    if((old.currentProcess||"") !== (c.currentProcess||"")){
      changes.push({type:"proceso",c:c,msg:caseSummary(c)+" pasó de "+processTitle(old.currentProcess)+" a "+processTitle(c.currentProcess)+"."});return;
    }
    if((old.status||"") !== (c.status||"")){
      changes.push({type:"estado",c:c,msg:caseSummary(c)+" cambió de estado a "+(c.status||"sin estado")+"."});return;
    }
    if((old.assignedRole||"") !== (c.assignedRole||"") || (old.assignedTo||"") !== (c.assignedTo||"")){
      changes.push({type:"asignacion",c:c,msg:caseSummary(c)+" fue reasignado a "+roleTitle(c.assignedRole)+"."});return;
    }
  });
  if(!changes.length)return;
  var nowMs=Date.now();
  if(state.realtime.startedAt && nowMs-state.realtime.startedAt<3000)return;
  if(nowMs - (state.realtime.lastChangeAt||0) < 1200)return;
  state.realtime.lastChangeAt=nowMs;
  var title=changes.length===1?"Movimiento detectado":"Movimientos detectados";
  var msg=changes.length===1?changes[0].msg:(changes.length+" casos tuvieron cambios. Actualizando la vista.");
  showLiveToast(title,msg,false);
  if(canNotify() && Notification.permission==="granted"){
    try{new Notification(title,{body:msg,icon:"./assets/app-icon.svg",badge:"./assets/app-icon.svg"});}catch(e){}
  }else{
    playBeep();
  }
}

function applyRealtimeCases(list){
  list=sortByUpdated(uniqueById(list||[]));
  var newHash=caseLiveHash(list);
  if(!state.realtime.initialCasesLoaded){
    state.cases=list;
    state.realtime.lastHash=newHash;
    state.realtime.initialCasesLoaded=true;
    autoMigrateLegacyProcesses();
    return;
  }
  if(newHash===state.realtime.lastHash)return;
  var oldList=state.cases.slice();
  state.cases=list;
  state.realtime.lastHash=newHash;
  autoMigrateLegacyProcesses();
  notifyRealtimeChanges(list,oldList);
  renderAfterLiveChange();
}

function rebuildRealtimeFromBuckets(){
  var all=[];
  Object.keys(state.realtime.buckets||{}).forEach(function(k){all=all.concat(state.realtime.buckets[k]||[]);});
  applyRealtimeCases(all);
}

function addCaseRealtimeListener(key,query){
  try{
    var unsub=query.onSnapshot(function(snap){
      state.realtime.buckets[key]=docsToList(snap);
      rebuildRealtimeFromBuckets();
    },function(err){
      console.warn("Escucha en tiempo real falló",key,err);
      showLiveToast("Conexión en tiempo real intermitente","La app seguirá actualizando automáticamente cada 25 segundos.",false);
    });
    state.realtime.caseUnsubs.push(unsub);
  }catch(e){console.warn("No se pudo activar listener",key,e);}
}

function stopRealtimeSync(){
  try{(state.realtime.caseUnsubs||[]).forEach(function(fn){try{fn();}catch(e){}});}catch(e){}
  try{if(state.realtime.eventUnsub)state.realtime.eventUnsub();}catch(e){}
  try{(state.realtime.eventUnsubs||[]).forEach(function(fn){try{fn();}catch(e){}});}catch(e){}
  try{if(state.realtime.userUnsub)state.realtime.userUnsub();}catch(e){}
  if(state.realtime.pollTimer)clearInterval(state.realtime.pollTimer);
  state.realtime={caseUnsubs:[],eventUnsub:null,eventUnsubs:[],userUnsub:null,pollTimer:null,buckets:{},eventBuckets:{},initialCasesLoaded:false,initialEventsLoaded:false,lastHash:"",lastEventHash:"",lastChangeAt:0,lastEventAt:0,startedAt:0,pendingRender:false};
}

function startRealtimeSync(){
  if(!firebaseReady || !db || !state.user)return;
  stopRealtimeSync();
  state.realtime.startedAt=Date.now();
  var r=state.user.role;
  if(canSeeAll()){
    addCaseRealtimeListener("all",db.collection("cases").orderBy("updatedAt","desc"));
  }else if(r==="auxiliar_corte"){
    addCaseRealtimeListener("cuts",db.collection("cases").where("hasCuts","==",true));
  }else{
    addCaseRealtimeListener("assigned",db.collection("cases").where("assignedRole","==",r));
    addCaseRealtimeListener("created",db.collection("cases").where("createdBy","==",state.user.uid));
  }
  startNotificationListeners();
  if(canSeeAll()){
    try{
      state.realtime.userUnsub=db.collection("users").onSnapshot(function(snap){state.users=docsToList(snap);},function(e){console.warn("Usuarios en vivo no disponibles",e);});
    }catch(e){}
  }
  state.realtime.pollTimer=setInterval(function(){
    if(!state.user || !firebaseReady || !db)return;
    loadData().then(function(){
      var h=caseLiveHash(state.cases);
      if(h!==state.realtime.lastHash){
        state.realtime.lastHash=h;
        renderAfterLiveChange();
      }
    }).catch(function(e){console.warn("Refresco silencioso falló",e);});
  },25000);
}

function autoMigrateLegacyProcesses(){
  if(!state.cases || !state.cases.length)return;
  var migrated=[];
  state.cases.forEach(function(c){
    if(migrateLegacyCaseInMemory(c,"Migración automática de procesos legacy al cargar la app"))migrated.push(c);
  });
  if(!migrated.length || !db || !state.user)return;
  if(!(canSeeAll() || isAdminRoleValue(state.user.role)))return;
  migrated.forEach(function(c){
    db.collection("cases").doc(c.id).set(c,{merge:true}).catch(function(e){console.warn("No se pudo migrar proceso legacy",c.id,e);});
  });
}

function migrateLegacyProcessesNow(){
  if(!canUseAdminPanel()){alert("No tiene permiso para corregir procesos legacy.");return;}
  var migrated=[];
  state.cases.forEach(function(c){if(migrateLegacyCaseInMemory(c,"Corrección manual desde Admin"))migrated.push(c);});
  if(!migrated.length){alert("No hay casos atrapados en procesos de compromiso legacy.");renderAdmin();return;}
  Promise.all(migrated.map(function(c){return db.collection("cases").doc(c.id).set(c,{merge:true});}))
    .then(function(){alert("Procesos corregidos: "+migrated.length+". Los casos de compromiso pasaron al flujo actual.");renderAdmin();})
    .catch(function(e){showError((e&&e.message)||e||"No se pudieron corregir los procesos legacy.");});
}

function persistCase(c,event){
  c.updatedAt=now();
  return db.collection("cases").doc(c.id).set(c,{merge:true}).then(function(){
    var i=-1;for(var x=0;x<state.cases.length;x++){if(state.cases[x].id===c.id)i=x;}
    if(i>=0)state.cases[i]=c;else state.cases.unshift(c);
    if(event)return createEvent(enrichCaseEvent(c,Object.assign({caseId:c.id,process:c.currentProcess},event)));
  });
}

function createEvent(e){
  e=e||{};
  e.id=e.id||uid("ev");
  e.timestamp=e.timestamp||now();
  e.userId=e.userId||(state.user?state.user.uid:"");
  e.userName=e.userName||(state.user?state.user.name:"Usuario");
  e.createdBy=e.createdBy||e.userId;
  e.createdByRole=e.createdByRole||(state.user?state.user.role:"");
  e.sourceRole=e.sourceRole||(state.user?state.user.role:"");
  e.visibleRoles=uniqueArray(e.visibleRoles||notificationVisibleRolesForEvent(null,e));
  return db.collection("case_events").doc(e.id).set(e).then(function(){state.events.unshift(e);queueEventNotification(e);});
}

function caseById(id){for(var i=0;i<state.cases.length;i++){if(state.cases[i].id===id)return state.cases[i];}return null;}
function statusChip(st){
  var map={creado_ventas:["Creado por ventas","info"],asignado:["Asignado","primary"],en_proceso:["En proceso","success"],en_espera:["En espera","warning"],espera_transportadora:["Espera transportadora","warning"],espera_ventas:["Ventas pendiente","warning"],pendiente_gerencia:["Gerencia pendiente","warning"],cerrado_conforme:["Cerrado conforme","success"],cerrado_con_novedad:["Cerrado con novedad","danger"],cancelado:["Cancelado","danger"]};
  var m=map[st]||[st||"Sin estado","info"];return '<span class="chip '+m[1]+'">'+esc(m[0])+'</span>';
}

function routes(){
  if(!state.user)return{main:[],processes:[]};
  var r=normalizeRole(state.user.role);
  if(r==="auxiliar_corte")return{main:["corte_cable"],processes:[]};
  if(r==="gerencia")return{main:["indicators","approvals","users","admin","dashboard"],processes:[]};
  if(isAdminRoleValue(r))return{main:["dashboard","create","cases","requirements","approvals","indicators","users","admin"],processes:activeProcessKeys()};
  if(r==="jefe_logistica"){
    return{main:["dashboard","cases","requirements","approvals","indicators","admin"],processes:activeProcessKeys().filter(function(k){return k!=="caja";})};
  }
  var own=activeProcessKeys().filter(function(k){return canAccessProcess(r,k);});
  return{main:["dashboard"].concat(canCreate()?["create"]:[]).concat(["requirements"]),processes:own};
}

function navBtn(r){
  var p=processes[r];var label=p?p.title:(routeInfo[r]?routeInfo[r][0]:r);var icon=p?p.icon:(routeInfo[r]?routeInfo[r][1]:"•");
  return '<button class="'+(state.route===r?'active':'')+'" data-route="'+r+'"><span class="nav-icon">'+esc(icon)+'</span><span>'+esc(label)+'</span></button>';
}

function mobileItems(){
  var r=state.user?normalizeRole(state.user.role):"";
  if(r==="auxiliar_corte")return [["corte_cable","Cortes","CT"]];
  if(r==="gerencia")return [["indicators","VSM","◉"],["approvals","Aprob.","✓"],["users","Usuarios","US"],["admin","Admin","AD"],["dashboard","Inicio","⌂"]];
  if(r==="jefe_logistica")return [["dashboard","Inicio","⌂"],["cases","Casos","▤"],["requirements","Req.","↗"],["approvals","Aprob.","✓"],["indicators","VSM","◉"]];
  if(isAdminRoleValue(r))return [["dashboard","Inicio","⌂"],["create","Crear","+"],["indicators","VSM","◉"],["admin","Admin","AD"]];
  var rs=routes();return [["dashboard","Inicio","⌂"],[rs.processes[0]||"cases","Panel","▤"],[canCreate()?"create":"requirements",canCreate()?"Crear":"Req.",canCreate()?"+":"↗"],["requirements","Req.","↗"]];
}

function allMobileRoutes(){
  var rs=routes();
  var items=[];
  rs.main.forEach(function(r){
    var info=routeInfo[r]||[r,"•"];
    items.push({route:r,label:info[0],icon:info[1],group:"Principal"});
  });
  rs.processes.forEach(function(r){
    if(processes[r])items.push({route:r,label:processes[r].title,icon:processes[r].icon,group:"Macroprocesos"});
  });
  return items;
}

function mobileFullMenuHtml(){
  var items=allMobileRoutes();
  var groups={};
  items.forEach(function(item){
    groups[item.group]=groups[item.group]||[];
    groups[item.group].push(item);
  });
  return '<section class="mobile-menu-panel"><div class="mobile-menu-head"><div><strong>Menú completo</strong><span>'+esc(roleTitle(state.user.role))+'</span></div><button class="btn btn-small btn-gold" data-action="certificate">Certificado</button><button class="btn btn-small" data-action="closeMobileMenu">Cerrar</button></div>'+
    Object.keys(groups).map(function(group){
      return '<div class="mobile-menu-group"><h3>'+esc(group)+'</h3><div class="mobile-menu-grid">'+groups[group].map(function(item){
        return '<button class="'+(state.route===item.route?'active':'')+'" data-route="'+item.route+'"><b>'+esc(item.icon)+'</b><span>'+esc(item.label)+'</span></button>';
      }).join("")+'</div></div>';
    }).join("")+
  '</section>';
}

function layout(content){
  var rs=routes();
  appEl.innerHTML='<div class="app-layout"><aside class="sidebar"><div class="sidebar-brand"><img class="sidebar-logo" src="'+logoPath+'"><div><strong>Electroingeniería</strong><span>'+esc(roleTitle(state.user.role))+'</span></div></div><nav class="nav">'+rs.main.map(navBtn).join("")+(rs.processes.length?'<div style="height:1px;background:rgba(255,255,255,.16);margin:8px 0"></div>':"")+rs.processes.map(navBtn).join("")+'</nav><div class="sidebar-footer"><div><strong>'+esc(state.user.name)+'</strong><div>'+esc(roleTitle(state.user.role))+'</div></div><button class="btn btn-small btn-gold" data-action="certificate">Certificado de creación</button><button class="btn btn-small" data-action="logout">Salir</button></div></aside><header class="mobile-top"><img class="mobile-logo" src="'+logoPath+'"><strong>'+esc(roleTitle(state.user.role))+'</strong><button class="btn btn-small" data-action="openMobileMenu">Menú</button></header><main class="main">'+content+'</main><nav class="bottom-nav">'+mobileItems().map(function(x){return'<button class="'+(state.route===x[0]?'active':'')+'" data-route="'+x[0]+'"><b>'+x[2]+'</b><span>'+x[1]+'</span></button>';}).join("")+'<button data-action="openMobileMenu"><b>☰</b><span>Todo</span></button></nav></div><div class="drawer" id="drawer"></div><div class="mobile-menu-overlay" id="mobileMenu"><div class="mobile-menu-backdrop" data-action="closeMobileMenu"></div>'+mobileFullMenuHtml()+'</div>';
  qsa("[data-route]").forEach(function(b){b.onclick=function(ev){if(ev)ev.preventDefault();state.route=b.getAttribute("data-route");closeMobileMenu();try{render();}catch(e){showError("Error al abrir el módulo "+state.route+": "+(e&&e.message?e.message:e));}};});
  bindActions();
}

function header(t,sub,actions){return '<div class="topbar"><div class="page-title"><h2>'+esc(t)+'</h2><p>'+esc(sub||"")+'</p></div><div class="top-actions">'+(actions||"")+'</div></div>';}

function renderLogin(){
  var firebaseMsg=firebaseReady?'Conexión Firebase activa.':'Firebase no conectó: '+esc(firebaseInitError||"revisa conexión");
  var helper=firebaseReady?'':'<div class="alert warning"><strong>Conexión pendiente.</strong><br>En celular normalmente se corrige limpiando caché/PWA o reintentando la carga del SDK. No borra datos de Firebase.</div>';
  appEl.innerHTML='<main class="login-wrap"><section class="login-card"><div class="brand-panel"><div><div class="logo-box"><img src="'+logoPath+'" alt="Electroingeniería"></div><h1>Trazabilidad secuencial.</h1><p>Ventas inicia, logística valida, aux logística alista, corte opera con evidencias y los estados se actualizan en tiempo real.</p></div><div class="brand-metrics"><div class="metric"><strong>Secuencia</strong><span>Sin procesos sueltos</span></div><div class="metric"><strong>Tiempo</strong><span>Macroproceso y espera</span></div><div class="metric"><strong>VSM</strong><span>Indicadores por área</span></div></div></div><form class="login-panel" id="loginForm"><h2>Ingreso operativo</h2><p>'+firebaseMsg+'</p>'+helper+'<div class="form"><label class="field"><span>Correo</span><input class="input" name="email" type="email" required placeholder="usuario@empresa.com"></label><label class="field"><span>Contraseña</span><input class="input" name="password" type="password" required placeholder="Contraseña"></label><button class="btn btn-primary" type="submit">Ingresar</button><button class="btn" type="button" id="retryFirebaseBtn">Reintentar conexión</button><button class="btn btn-gold" type="button" id="clearPwaBtn">Limpiar caché del celular</button></div></form></section></main>';
  qs("#loginForm").onsubmit=function(e){e.preventDefault();login(new FormData(e.target));};
  var retry=qs("#retryFirebaseBtn");if(retry)retry.onclick=function(){showLoading("Reintentando conexión con Firebase...");initFirebaseAsync().then(function(){renderLogin();}).catch(function(e){firebaseReady=false;firebaseInitError=e.message||String(e);renderLogin();});};
  var clear=qs("#clearPwaBtn");if(clear)clear.onclick=function(){showLoading("Limpiando caché local y recargando...");clearPwaCachesAndReload();};
}

function showLoading(msg){
  appEl.innerHTML='<main class="error-box"><section class="error-card"><h1>Cargando la app</h1><p>'+esc(msg||"Validando sesión y permisos...")+'</p><pre>Espere un momento.</pre></section></main>';
}

function applyProfileFromDoc(fbUser,doc){
  if(!doc.exists)throw new Error("El usuario existe en Authentication, pero no tiene perfil en Firestore users/"+fbUser.uid+". Cree ese documento con role e isActive:true.");
  var p=doc.data();
  if(p.isActive===false)throw new Error("Usuario inactivo en Firestore.");
  var normalizedRole=normalizeRole(p.role||"coordinador_logistico");
  state.user={uid:fbUser.uid,email:fbUser.email||p.email||"",name:p.name||p.email||fbUser.email||"Usuario",role:normalizedRole,rawRole:p.role||normalizedRole};
  sessionStorage.setItem(storageKey+"_session",JSON.stringify(state.user));
  state.route=defaultRoute(state.user.role);
}

function loadProfileAndRender(fbUser){
  showLoading("Sesión detectada. Cargando perfil y módulo asignado...");
  return db.collection("users").doc(fbUser.uid).get().then(function(doc){
    applyProfileFromDoc(fbUser,doc);
    return loadData();
  }).then(function(){
    startRealtimeSync();
    render();
  });
}

function login(fd){
  var email=String(fd.get("email")||"").trim();var password=String(fd.get("password")||"");
  if(!firebaseReady){showError("Firebase no está conectado. "+(firebaseInitError||""));return;}
  showLoading("Validando correo, contraseña y permisos...");
  auth.signInWithEmailAndPassword(email,password).catch(function(err){showError(err.message||err);});
}

function visibleCases(){
  var list=canSeeAll()?state.cases:state.cases.filter(function(c){
    return normalizeRole(c.assignedRole)===normalizeRole(state.user.role) || c.createdBy===state.user.uid || c.assignedTo===state.user.uid || canAccessProcess(state.user.role,c.currentProcess);
  });
  var f=state.filters;
  if(f.search){var q=f.search.toLowerCase();list=list.filter(function(c){return [c.reference,c.client,c.assignedName,c.createdByName,c.deliveryType].join(" ").toLowerCase().indexOf(q)>=0;});}
  if(f.status)list=list.filter(function(c){return c.status===f.status;});
  if(f.process)list=list.filter(function(c){return c.currentProcess===f.process;});
  return list.sort(function(a,b){
    var pa=(a.priority==="Alta"||a.managerApproved)?1:0, pb=(b.priority==="Alta"||b.managerApproved)?1:0;
    if(pa!==pb)return pb-pa;
    return new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt);
  });
}

function renderDashboard(){
  if(isExecutive())return renderIndicators();
  var list=visibleCases();var open=list.filter(function(c){return !c.closedAt;});
  var waits=open.filter(function(c){return c.status==="en_espera"||c.status==="espera_ventas"||c.status==="pendiente_gerencia";});
  layout(header("Inicio","Bandeja operativa según el flujo secuencial.",((canNotify()&&Notification.permission!=="granted")?'<button class="btn btn-gold" data-action="notifyOn">Activar notificaciones</button>':'')+(canCreate()?'<button class="btn btn-primary" data-route="create">Crear pedido</button>':''))+'<section class="grid grid-4"><article class="card kpi"><span>Abiertos</span><strong>'+open.length+'</strong><small>Casos visibles</small></article><article class="card kpi"><span>Esperas</span><strong>'+waits.length+'</strong><small>Bloqueos activos</small></article><article class="card kpi"><span>Requerimientos</span><strong>'+state.cases.filter(function(c){return c.status==="espera_ventas"||c.status==="en_espera";}).length+'</strong><small>En resolución</small></article><article class="card kpi"><span>Prioritarios</span><strong>'+state.cases.filter(function(c){return c.priority==="Alta"&&!c.closedAt;}).length+'</strong><small>Gerencia aprobada</small></article></section><section class="card" style="margin-top:16px"><h3>Casos recientes</h3>'+caseList(list.slice(0,10))+'</section>');
}

function caseList(list){
  if(!list.length)return'<div class="empty">No hay casos.</div>';
  return'<div class="case-list">'+list.map(function(c){return'<article class="case-card"><div><h3>'+esc(c.reference||c.id)+' · '+esc(c.client||"Caso operativo")+'</h3><div class="case-meta">'+(c.priority==="Alta"?'<span class="chip warning">Prioritario</span>':'')+'<span class="chip primary">'+esc(processes[c.currentProcess]?processes[c.currentProcess].code:"")+'</span><span class="chip">'+esc(processTitle(c.currentProcess))+'</span>'+statusChip(c.status)+'<span class="chip info">'+fmt(totalMs(c))+'</span></div></div><div class="case-actions"><button class="btn btn-small" data-action="open" data-id="'+c.id+'">Ver</button>'+(c.status==="asignado"&&canAccessProcess(state.user.role,c.currentProcess)?'<button class="btn btn-primary btn-small" data-action="accept" data-id="'+c.id+'">Aceptar</button>':"")+'</div></article>';}).join("")+'</div>';
}

function renderCases(){
  var content=header("Casos","Consulta y gestión por macroproceso.",((canNotify()&&Notification.permission!=="granted")?'<button class="btn btn-gold" data-action="notifyOn">Activar notificaciones</button>':'')+(canCreate()?'<button class="btn btn-primary" data-route="create">Crear pedido</button>':''))+'<section class="filters"><input class="input" id="fSearch" placeholder="Buscar"><select class="select" id="fStatus"><option value="">Todos los estados</option><option value="asignado">Asignado</option><option value="en_proceso">En proceso</option><option value="espera_transportadora">Espera transportadora</option><option value="espera_ventas">Ventas pendiente</option><option value="pendiente_gerencia">Gerencia pendiente</option><option value="cerrado_conforme">Cerrado</option></select><select class="select" id="fProcess"><option value="">Todos los macroprocesos</option>'+activeProcessKeys().map(function(k){return'<option value="'+k+'">'+esc(processes[k].title)+'</option>';}).join("")+'</select></section>'+caseList(visibleCases());
  layout(content);
  qs("#fSearch").value=state.filters.search;qs("#fStatus").value=state.filters.status;qs("#fProcess").value=state.filters.process;
  ["fSearch","fStatus","fProcess"].forEach(function(id){qs("#"+id).oninput=function(){state.filters.search=qs("#fSearch").value;state.filters.status=qs("#fStatus").value;state.filters.process=qs("#fProcess").value;renderCases();};});
}

function renderCreate(){
  if(!canCreate()){layout(header("Crear pedido","Acceso restringido.")+'<div class="empty">Solo ventas inicia pedidos. Los demás roles reciben por secuencia.</div>');return;}
  layout(header("Crear pedido","Ventas registra únicamente el nombre o número del pedido. El PDF se carga en Recepción de pedidos para iniciar la verificación documental.")+'<section class="card"><form class="form" id="caseForm"><div class="notice"><strong>Flujo documental:</strong> ventas registra el pedido PVC/PVN y recepción carga el PDF oficial.</div><div class="grid grid-2"><label class="field"><span>Número / nombre del pedido</span><input class="input" name="reference" id="reference" required placeholder="PVC-0000 / PVN-0000"></label><label class="field"><span>Tipo de pedido</span><select class="select" name="orderKind" id="orderKind"><option value="PVC">PVC</option><option value="PVN">PVN</option><option value="VENTAS">Otro ventas</option><option value="ALUMBRADO">Alumbrado</option></select></label></div><div class="grid grid-2"><label class="field"><span>Cliente</span><input class="input" name="client" id="client" placeholder="Nombre del cliente"></label><label class="field"><span>Tipo de gestión</span><select class="select" name="priorityMode"><option value="normal">Pedido normal a logística</option><option value="gerencia">Pedido prioritario / salida especial a gerencia</option></select></label></div><div class="grid grid-2"><label class="field"><span>Motivo prioridad</span><input class="input" name="priorityReason" placeholder="Urgencia, cliente crítico, autorización especial"></label><label class="field"><span>Tipo de entrega esperado</span><select class="select" name="requestedDelivery" id="requestedDelivery"><option value="">Sin definir</option><option value="cliente_punto">Cliente en punto</option><option value="cliente_recoge">Cliente recoge</option><option value="despacho_local">Despacho local</option><option value="despacho_nacional">Despacho nacional</option></select></label></div><label class="field"><span>Observación comercial</span><textarea class="textarea" name="description" id="description" placeholder="Aclaraciones del asesor, condición especial o instrucción inicial."></textarea></label><button class="btn btn-primary" type="submit">Crear y enviar a recepción</button></form></section>');
  qs("#caseForm").onsubmit=function(e){e.preventDefault();createCase(new FormData(e.target));};
}

function readPdfFile(file){
  if(!file)return Promise.reject(new Error("No se seleccionó PDF."));
  if(!window.pdfjsLib)return Promise.reject(new Error("No cargó el lector PDF."));
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onload=function(){
      var arr=new Uint8Array(reader.result);
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      pdfjsLib.getDocument({data:arr}).promise.then(function(pdf){
        var pages=[];var chain=Promise.resolve();
        for(var i=1;i<=pdf.numPages;i++){(function(pageNo){chain=chain.then(function(){return pdf.getPage(pageNo);}).then(function(page){return page.getTextContent();}).then(function(tc){
          var rows={};
          tc.items.forEach(function(it){
            if(!it || !String(it.str||"").trim())return;
            var tr=it.transform||[0,0,0,0,0,0];
            var x=Math.round(tr[4]||0), y=Math.round(tr[5]||0);
            var key=String(y);
            rows[key]=rows[key]||[];
            rows[key].push({x:x,text:String(it.str||"").trim()});
          });
          var lines=Object.keys(rows).sort(function(a,b){return Number(b)-Number(a);}).map(function(y){
            return rows[y].sort(function(a,b){return a.x-b.x;}).map(function(it){return it.text;}).join(" ").replace(/\s+/g," ").trim();
          }).filter(Boolean);
          pages.push("--- PAGINA "+pageNo+" ---\n"+lines.join("\n"));
        });})(i);}
        return chain.then(function(){resolve(pages.join("\n"));});
      }).catch(reject);
    };
    reader.onerror=function(){reject(new Error("No fue posible leer el archivo."));};
    reader.readAsArrayBuffer(file);
  });
}

function fileToBase64Payload(file){
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onload=function(){var data=String(reader.result||"");resolve(data.split(",")[1]||data);};
    reader.onerror=function(){reject(new Error("No fue posible preparar el archivo para Drive."));};
    reader.readAsDataURL(file);
  });
}

function uploadReceptionPdfToDrive(file,c){
  return uploadFileToDrive(file,c,{processName:"Recepción de pedidos",processKey:"recepcion_pedidos",fileName:file&&file.name?file.name:"pedido.pdf",evidenceType:"PDF_PEDIDO"});
}
function prepareFileForDrive(file){
  if(!file)return Promise.reject(new Error("No se seleccionó archivo."));
  if(/^image\//i.test(file.type||"")){
    return compressImageForAudit(file,900,0.72).catch(function(){
      return fileToBase64Payload(file).then(function(base64){return {base64:base64,mimeType:file.type||"image/jpeg",fileName:file.name,sizeBytes:file.size||0,compressed:false};});
    });
  }
  return fileToBase64Payload(file).then(function(base64){return {base64:base64,mimeType:file.type||"application/octet-stream",fileName:file.name,sizeBytes:file.size||0,compressed:false};});
}
function compressImageForAudit(file,maxSide,quality){
  return new Promise(function(resolve,reject){
    var img=new Image();
    var url=URL.createObjectURL(file);
    img.onload=function(){
      try{
        var w=img.naturalWidth||img.width, h=img.naturalHeight||img.height, scale=Math.min(1,(maxSide||900)/Math.max(w,h));
        var canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
        var ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,canvas.width,canvas.height);
        var data=canvas.toDataURL("image/jpeg",quality||0.72);
        URL.revokeObjectURL(url);
        resolve({base64:data.split(",")[1]||data,mimeType:"image/jpeg",fileName:String(file.name||"foto.jpg").replace(/\.[^.]+$/,"")+".jpg",sizeBytes:Math.round((data.length*3)/4),compressed:true});
      }catch(e){URL.revokeObjectURL(url);reject(e);}
    };
    img.onerror=function(){URL.revokeObjectURL(url);reject(new Error("No fue posible comprimir la imagen."));};
    img.src=url;
  });
}
function driveClientId(){return (window.appSettings&&window.appSettings.googleDriveClientId)||"";}
function driveRootFolderName(){return (window.appSettings&&window.appSettings.driveRootFolderName)||"EVIDENCIAS_LOGISTICA_ELECTROINGENIERIA";}
function driveConfigured(){var id=driveClientId();return !!(id && id.indexOf("PEGAR_")<0 && id.indexOf(".apps.googleusercontent.com")>0);}
function waitForGoogleDriveClient(){
  if(window.google && google.accounts && google.accounts.oauth2)return Promise.resolve(true);
  return new Promise(function(resolve,reject){
    var started=Date.now();
    var timer=setInterval(function(){
      if(window.google && google.accounts && google.accounts.oauth2){clearInterval(timer);resolve(true);return;}
      if(Date.now()-started>12000){clearInterval(timer);reject(new Error("No cargó Google Identity Services. Revise conexión, bloqueadores o dominios autorizados del OAuth Client."));}
    },250);
  });
}
function ensureDriveToken(promptMode){
  if(driveAccessToken && Date.now()<driveTokenExpiresAt)return Promise.resolve(driveAccessToken);
  if(!driveConfigured())return Promise.reject(new Error("Drive no está configurado. Falta el Google OAuth Client ID en firebase-config.js > appSettings.googleDriveClientId."));
  return waitForGoogleDriveClient().then(function(){
    return new Promise(function(resolve,reject){
      try{
        if(!driveTokenClient){
          driveTokenClient=google.accounts.oauth2.initTokenClient({client_id:driveClientId(),scope:DRIVE_SCOPE,callback:function(){}});
        }
        driveTokenClient.callback=function(resp){
          if(resp && resp.access_token){
            driveAccessToken=resp.access_token;
            var expires=Number(resp.expires_in||3600);
            driveTokenExpiresAt=Date.now()+Math.max(60,expires-60)*1000;
            resolve(driveAccessToken);
          }else{
            reject(new Error((resp&&resp.error_description)||"No se autorizó Google Drive."));
          }
        };
        driveTokenClient.requestAccessToken({prompt:promptMode || "consent"});
      }catch(e){reject(e);}
    });
  });
}
function driveFetch(url,options){
  return ensureDriveToken("").then(function(token){
    options=options||{};
    var headers=new Headers(options.headers||{});
    headers.set("Authorization","Bearer "+token);
    return fetch(url,Object.assign({},options,{headers:headers})).then(function(res){
      if(res.status===401 || res.status===403){
        driveAccessToken="";driveTokenExpiresAt=0;
        throw new Error("Google Drive requiere autorización nuevamente. Presione la acción otra vez y autorice el acceso.");
      }
      if(!res.ok){return res.text().catch(function(){return "";}).then(function(txt){throw new Error("Error Google Drive "+res.status+": "+txt.slice(0,220));});}
      return res;
    });
  });
}
function driveQueryEscape(value){return String(value||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
function safeDrivePart(value){return String(value||"SIN_DATO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\\/:*?\"<>|#%{}~&]+/g,"-").replace(/\s+/g," ").trim().slice(0,90)||"SIN_DATO";}
function safeDriveFileName(value){return String(value||("evidencia_"+Date.now())).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\\/:*?\"<>|#%{}~&]+/g,"-").replace(/\s+/g," ").trim().slice(0,150)||("evidencia_"+Date.now());}
function driveFindFolder(name,parentId){
  var q="name = '"+driveQueryEscape(name)+"' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if(parentId)q+=" and '"+parentId+"' in parents";
  var url="https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name,webViewLink)&q="+encodeURIComponent(q);
  return driveFetch(url,{method:"GET"}).then(function(res){return res.json();}).then(function(data){return data.files&&data.files[0]?data.files[0]:null;});
}
function driveCreateFolder(name,parentId){
  var meta={name:name,mimeType:"application/vnd.google-apps.folder"};
  if(parentId)meta.parents=[parentId];
  return driveFetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(meta)}).then(function(res){return res.json();});
}
function driveEnsureFolder(name,parentId){
  var key="ei_drive_folder_"+(parentId||"root")+"_"+safeDrivePart(name);
  var cached=localStorage.getItem(key);
  if(cached)return Promise.resolve({id:cached,name:name});
  return driveFindFolder(name,parentId).then(function(existing){
    if(existing&&existing.id){localStorage.setItem(key,existing.id);return existing;}
    return driveCreateFolder(name,parentId).then(function(folder){localStorage.setItem(key,folder.id);return folder;});
  });
}
function driveEnsurePath(parts){
  var parent="";
  var folderPath=[];
  return parts.reduce(function(chain,part){
    return chain.then(function(){
      var name=safeDrivePart(part);
      folderPath.push(name);
      return driveEnsureFolder(name,parent).then(function(folder){parent=folder.id;return folder;});
    });
  },Promise.resolve()).then(function(folder){return {folderId:parent,folderPath:folderPath.join(" / "),folder:folder};});
}
function base64ToBlob(base64,mimeType){
  var bin=atob(base64);var len=bin.length;var bytes=new Uint8Array(len);
  for(var i=0;i<len;i++)bytes[i]=bin.charCodeAt(i);
  return new Blob([bytes],{type:mimeType||"application/octet-stream"});
}
function driveUploadMultipart(blob,metadata){
  var boundary="eiDriveBoundary"+Date.now()+Math.random().toString(16).slice(2);
  var body=new Blob(["--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n",JSON.stringify(metadata),"\r\n--"+boundary+"\r\nContent-Type: "+(metadata.mimeType||"application/octet-stream")+"\r\n\r\n",blob,"\r\n--"+boundary+"--"],{type:"multipart/related; boundary="+boundary});
  return driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType,size",{method:"POST",headers:{"Content-Type":"multipart/related; boundary="+boundary},body:body}).then(function(res){return res.json();});
}
function driveTryShare(fileId){
  if(!fileId)return Promise.resolve(false);
  return driveFetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(fileId)+"/permissions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"anyone",role:"reader"})}).then(function(){return true;}).catch(function(){return false;});
}
function uploadFileToDrive(file,c,processOrOptions,fileName){
  var opts=typeof processOrOptions==="object"?(processOrOptions||{}):{processName:processOrOptions,fileName:fileName};
  return ensureDriveToken("consent").then(function(){return prepareFileForDrive(file);}).then(function(prep){
    var uploadedAt=now();
    var date=new Date(uploadedAt);
    var year=String(date.getFullYear());
    var month=year+"-"+("0"+(date.getMonth()+1)).slice(-2);
    var processName=opts.processName||processTitle(c.currentProcess);
    var evidenceType=opts.evidenceType||"EVIDENCIA";
    var ownerName=state.user?state.user.name:"Responsable";
    var orderNumber=c.reference||c.pedido||"SIN_PEDIDO";
    var caseNumber=c.caseNumber||c.id||"SIN_CASO";
    var path=[driveRootFolderName(),year,month,processName,ownerName,orderNumber,caseNumber,evidenceType];
    return driveEnsurePath(path).then(function(folderInfo){
      var name=safeDriveFileName(opts.fileName||prep.fileName||file.name||("evidencia_"+Date.now()));
      var blob=base64ToBlob(prep.base64,prep.mimeType);
      var meta={name:name,mimeType:prep.mimeType||file.type||"application/octet-stream",parents:[folderInfo.folderId]};
      return driveUploadMultipart(blob,meta).then(function(uploaded){
        return driveTryShare(uploaded.id).then(function(){
          return {ok:true,fileId:uploaded.id,url:uploaded.webViewLink||uploaded.webContentLink||"",contentUrl:uploaded.webContentLink||"",name:uploaded.name,fileName:uploaded.name,mimeType:uploaded.mimeType||prep.mimeType,evidenceType:evidenceType,uploadedAt:uploadedAt,processKey:opts.processKey||c.currentProcess,processName:processName,cutId:opts.cutId||"",folderPath:folderInfo.folderPath,folder:folderInfo.folderId,sizeBytes:prep.sizeBytes||file.size||0,compressed:!!prep.compressed};
        });
      });
    });
  });
}
function appendEvidence(c,up,detail){
  c.evidence=c.evidence||[];
  c.evidence.push({
    id:uid("EVD"),
    process:up.processKey||c.currentProcess,
    processName:up.processName||processTitle(up.processKey||c.currentProcess),
    evidenceType:up.evidenceType||"EVIDENCIA",
    cutId:up.cutId||"",
    detail:detail||"",
    fileName:up.fileName||up.name||"",
    mimeType:up.mimeType||"",
    driveUrl:up.url||"",
    driveId:up.fileId||"",
    folder:up.folderPath||up.folder||"",
    uploadedAt:up.uploadedAt||now(),
    uploadedByName:state.user?state.user.name:""
  });
}

function readPdf(file){
  if(!file)return;
  if(!window.pdfjsLib){qs("#pdfBox").innerHTML="No cargó el lector PDF. Puedes llenar los datos manualmente.";return;}
  qs("#pdfBox").innerHTML="Leyendo PDF...";
  var reader=new FileReader();
  reader.onload=function(){
    var arr=new Uint8Array(reader.result);
    pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    pdfjsLib.getDocument({data:arr}).promise.then(function(pdf){
      var pages=[];var chain=Promise.resolve();
      for(var i=1;i<=pdf.numPages;i++){(function(pageNo){chain=chain.then(function(){return pdf.getPage(pageNo);}).then(function(page){return page.getTextContent();}).then(function(tc){pages.push(tc.items.map(function(it){return it.str;}).join(" "));});})(i);}
      return chain.then(function(){return pages.join(" ");});
    }).then(function(text){
      var x=extractPedido(text); state.pdfExtraction=x;
      if(x.orderNumber)qs("#reference").value=x.orderNumber;
      if(x.client)qs("#client").value=x.client;
      if(x.paymentCondition)qs("#paymentCondition").value=x.paymentCondition;
      qs("#pdfBox").innerHTML="<strong>PDF leído.</strong><br>Pedido: "+esc(x.orderNumber||"No detectado")+"<br>Cliente: "+esc(x.client||"No detectado")+"<br>Pago: "+esc(x.paymentCondition||"No detectado");
    }).catch(function(err){qs("#pdfBox").innerHTML="No se pudo leer el PDF. Llena los datos manualmente. "+esc(err.message||err);});
  };
  reader.readAsArrayBuffer(file);
}

function stripAccents(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function cleanPdfValue(v){
  return String(v||"").replace(/\s+/g," ").replace(/^[:#\-\s]+|[:#\-\s]+$/g,"").trim();
}
function pdfFlat(text){return cleanPdfValue(String(text||"").replace(/\r/g,"\n").replace(/--- PAGINA \d+ ---/g," "));}
function pdfLines(text){
  return String(text||"").replace(/\r/g,"\n").split(/\n+/).map(function(x){return cleanPdfValue(x);}).filter(Boolean);
}
function labelValue(flat, labelRx, stopRx){
  var rx=new RegExp(labelRx+"\\s*[:#\\-]?\\s*(.{2,180}?)(?="+(stopRx||"\\s{2,}|$|")+")","i");
  var m=flat.match(rx);
  return m?cleanPdfValue(m[1]):"";
}
function findLineValue(lines, labels, stops){
  var labelText=labels.join("|");
  var stopText=(stops||["NIT","CLIENTE","DIRECCION","DIRECCIÓN","TELEFONO","TELÉFONO","CIUDAD","VENDEDOR","FORMA DE PAGO","CONDICION","CONDICIÓN","FECHA","PEDIDO","ORDEN","TOTAL","SUBTOTAL"]).join("|");
  for(var i=0;i<lines.length;i++){
    var l=lines[i];
    var rx=new RegExp("(?:"+labelText+")\\s*[:#\\-]?\\s*(.+)$","i");
    var m=l.match(rx);
    if(m){
      var val=cleanPdfValue(m[1].replace(new RegExp("\\b(?:"+stopText+")\\b.*$","i"),""));
      if(val)return val;
      if(lines[i+1] && !new RegExp("^(?:"+stopText+")\\b","i").test(lines[i+1]))return cleanPdfValue(lines[i+1]);
    }
  }
  return "";
}
function inferOrderKind(orderNumber, flat){
  var m=String(orderNumber||"").match(/\b(PVC|PVN|PVR|PVE|PV|PED)\b/i) || String(orderNumber||"").match(/^(PVC|PVN|PVR|PVE|PV|PED)/i) || String(flat||"").match(/\b(PVC|PVN|PVR|PVE|ALUMBRADO)\b/i);
  return m ? String(m[1]).toUpperCase() : "VENTAS";
}
function extractPedido(text){
  var raw=String(text||"");
  var lines=pdfLines(raw);
  var flat=pdfFlat(raw);
  function first(rx){var m=flat.match(rx);return m?cleanPdfValue(m[1]||m[0]):"";}
  var orderNumber=
    first(/(?:PEDIDO(?:\s+DE\s+VENTA)?|ORDEN(?:\s+DE\s+VENTA)?|DOCUMENTO|DOC\.?|NUMERO|N[°ºO.]*)\s*[:#\-]?\s*((?:PVC|PVN|PVR|PVE|PV|PED|OV|OP)?[\-\s]?[0-9]{3,}[A-Z0-9\-]*)/i) ||
    first(/\b((?:PVC|PVN|PVR|PVE|PV|PED|OV|OP)[\-\s]?[0-9]{3,}[A-Z0-9\-]*)\b/i) ||
    findLineValue(lines,["Pedido","Pedido de venta","Orden","Orden de venta","Documento","No\\.","Nro"],["Fecha","Cliente","NIT","Vendedor","Forma"]);
  var client=
    findLineValue(lines,["Cliente","Señores","Razon social","Razón social"],["NIT","CC","Direccion","Dirección","Telefono","Teléfono","Ciudad","Vendedor","Forma","Fecha","Pedido"]) ||
    labelValue(flat,"(?:Cliente|Señores|Raz[oó]n social)","\\s+(?:NIT|CC|Direcci[oó]n|Tel[eé]fono|Ciudad|Vendedor|Forma|Fecha|Pedido)\\b|$");
  var nit=findLineValue(lines,["NIT","Nit","C.C.","CC"],["Cliente","Direccion","Dirección","Telefono","Teléfono","Ciudad","Vendedor","Forma","Fecha","Pedido"]);
  var address=findLineValue(lines,["Direccion","Dirección"],["NIT","Telefono","Teléfono","Ciudad","Vendedor","Forma","Fecha","Pedido"]);
  var city=findLineValue(lines,["Ciudad"],["NIT","Telefono","Teléfono","Vendedor","Forma","Fecha","Pedido"]);
  var phone=findLineValue(lines,["Telefono","Teléfono","Celular","Tel"],["NIT","Ciudad","Vendedor","Forma","Fecha","Pedido"]);
  var paymentCondition=findLineValue(lines,["Forma de pago","Condicion de pago","Condición de pago","Pago"],["Vendedor","Fecha","Pedido","Cliente","TOTAL","Observaciones"]);
  var salesAdvisor=findLineValue(lines,["Vendedor","Asesor","Representante"],["Forma","Fecha","Pedido","Cliente","TOTAL","Observaciones"]);
  var orderDate=first(/(?:Fecha(?:\s+pedido|\s+documento)?|Fecha de emisi[oó]n)\s*[:#\-]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
  var delivery="";
  if(/despacho\s+nacional|transportadora|gu[ií]a|flete/i.test(flat))delivery="despacho_nacional";
  else if(/despacho\s+local|domicilio|direcci[oó]n\s+de\s+entrega/i.test(flat))delivery="despacho_local";
  else if(/cliente\s+recoge|recoge/i.test(flat))delivery="cliente_recoge";
  else if(/cliente\s+en\s+punto|punto\s+de\s+venta/i.test(flat))delivery="cliente_punto";
  var observations=findLineValue(lines,["Observaciones","Observacion","Observación","Notas"],["TOTAL","SUBTOTAL","IVA","Valor"]);
  var items=extractPedidoItems(raw);
  var meterItems=items.filter(function(x){return x.requiereCorte;}).length;
  return {
    orderNumber:orderNumber,
    orderKind:inferOrderKind(orderNumber, flat),
    client:client,
    nit:nit,
    address:address,
    city:city,
    phone:phone,
    paymentCondition:paymentCondition,
    salesAdvisor:salesAdvisor,
    orderDate:orderDate,
    requestedDelivery:delivery,
    observations:observations,
    items:items,
    meterItems:meterItems,
    pages:(raw.match(/--- PAGINA \d+ ---/g)||[]).length||1,
    raw:flat.slice(0,10000)
  };
}

function meterUnitPattern(){return "MTRS?|MTS?|MT|M\\/L|ML|M|METROS?";}
function orderUnitPattern(){return "(?:"+meterUnitPattern()+"|KGS?|KG|KLS?|KL|GRAMOS?|GRS?|GR|LB|LBS|UND(?:S)?|UN(?:DAD(?:ES)?)?|UNIDAD(?:ES)?|PZA|PZAS|PCS|PCE|CAJ(?:A|AS)?|CJ|ROL(?:LO|LOS)?|BOLSA(?:S)?|PAQ(?:UETE|S)?|PAQS?|PAR(?:ES)?|JGO|JUEGO|KIT|GL|GAL|LT|LTS|LITRO(?:S)?|CM|MM|M2|M3)";}
function normalizePdfUnit(unit){return String(unit||"").toUpperCase().replace(/\./g,"").trim();}
function isMeterUnit(unit){
  return new RegExp("^(?:"+meterUnitPattern()+")$","i").test(normalizePdfUnit(unit));
}
function isOrderUnit(unit){
  return new RegExp("^(?:"+orderUnitPattern()+")$","i").test(normalizePdfUnit(unit));
}
function isLikelyCable(ref, desc){
  var t=stripAccents((String(ref||"")+" "+String(desc||"")).toUpperCase());
  if(/\b(TUBO|PVC|CPVC|EMT|IMC|GALVANIZ|CANALETA|BISAGRA|RIEL|PERFIL|ANGULO|CINTA|MANGUERA|CORAZA|DUCTO|TUBERIA|TUBERÍA|ABRAZADERA|BARRA|VARILLA|CADENA)\b/.test(t) && !/\b(CABLE|CONDUCTOR|ALAMBRE)\b/.test(t)){
    return false;
  }
  return /(CABLE|CONDUCTOR|ALAMBRE|THHN|THHW|AWG|ENCAUCH|ACOMET|UTP|COAX|COBRE|ALUMINIO|DUPLEX|TRIPLEX|MULTIPLEX|FLEXIBLE|ALUMBRADO|CORDON|CALIBRE|XLPE|NYLON|DESNUDO|AISLADO|MALLA|FIBRA|VFD|SOLDADOR|CONTROL|MONOPOLAR|BIPOLAR|TRENZADO|BAJANTE|SUBTERRANEO|SUBTERRANEO|ESMALTADO)/.test(t);
}
function normalizePdfNumber(v){
  var s=String(v||"").trim();
  if(!s)return "";
  s=s.replace(/\s+/g,"");
  if(/,\d{1,4}$/.test(s) && s.indexOf('.')>=0)s=s.replace(/\./g,"").replace(',', '.');
  else if(/,\d{1,4}$/.test(s))s=s.replace(',', '.');
  else s=s.replace(/,(?=\d{3}\b)/g,"").replace(/\.(?=\d{3}\b)/g,"");
  return s;
}
function isProbablyPriceContext(line, index){
  var near=String(line||"").slice(Math.max(0,index-24), index+42);
  return /\$|VALOR|UNITARIO|PARCIAL|PRECIO|IVA|DTO|SUBTOTAL|TOTAL/i.test(near);
}
function normalizeRefText(v){return stripAccents(String(v||"").toUpperCase()).replace(/[^A-Z0-9]+/g,"");}
function normalizeQty(v){
  var s=String(v||"").trim();
  if(!s)return "";
  return s.replace(/\s+/g,"").replace(/,(?=\d{3}\b)/g,"").replace(/\.(?=\d{3}\b)/g,"");
}
function lineLooksHeader(line){
  return /(valor\s*unit|valor\s*parcial|subtotal|iva|total\s|descuento|vendedor|forma\s+de\s+pago|referencia\s+descripci|cantidad\s+unidad|pedido\s+de\s+venta|orden\s+de\s+entrega|nit\s|cliente\s*:|direcci[oó]n\s*:|elaborado|aprobado|recibido|pagina|página)/i.test(line);
}
function cleanDesc(desc){
  return cleanPdfValue(String(desc||"").replace(/\b(?:VR|VALOR|UNITARIO|PARCIAL|DTO|IVA|SUBTOTAL|TOTAL)\b.*$/i,""));
}
function refFromBefore(before){
  var tokens=cleanPdfValue(before).split(/\s+/).filter(Boolean);
  while(tokens.length && /^\d{1,3}$/.test(tokens[0]))tokens.shift();
  if(!tokens.length)return {ref:"",desc:""};
  var ref=tokens[0];
  if(/^(COD|CODIGO|CÓDIGO|REF|REFERENCIA|ITEM)$/i.test(ref) && tokens[1]){tokens.shift();ref=tokens[0];}
  var desc=tokens.slice(1).join(" ");
  if(!/[A-Za-zÁÉÍÓÚÑ0-9]/.test(ref))return {ref:"",desc:""};
  return {ref:ref,desc:cleanDesc(desc)};
}
function fallbackRefFromDesc(desc){
  var t=cleanPdfValue(desc||"");
  if(!t)return "ITEM";
  var parts=t.split(/\s+/).filter(Boolean);
  var code=parts.filter(function(x){return /^[A-Z0-9][A-Z0-9._\-/]{2,}$/i.test(x);})[0];
  if(code)return code;
  return cleanPdfValue(parts.slice(0,4).join(" ")).slice(0,32)||"ITEM";
}
function shouldIgnorePdfItem(ref,desc,qty,unit,line){
  var t=stripAccents((String(ref||"")+" "+String(desc||"")+" "+String(line||"")).toUpperCase());
  if(!qty || !unit || !isOrderUnit(unit))return true;
  if(lineLooksHeader(t))return true;
  if(/\b(SUBTOTAL|TOTAL|IVA|APROBADO|ELABORADO|RECIBIDO|ORIGINAL|REIMPRESO|PAGINA)\b/.test(t))return true;
  return false;
}
function addPdfItem(items, seen, ref, desc, qty, unit, rawLine, reason){
  ref=cleanPdfValue(ref||"");
  desc=cleanDesc(desc||"");
  qty=normalizePdfNumber(qty);
  unit=normalizePdfUnit(unit);
  if(!ref && desc){var rd=refFromBefore(desc);ref=rd.ref;desc=rd.desc||desc;}
  if(!desc && ref)desc=ref;
  if(!ref || ref.length<2)ref=fallbackRefFromDesc(desc||rawLine);
  if(!desc || desc.length<2)desc=ref;
  if(shouldIgnorePdfItem(ref,desc,qty,unit,rawLine))return;
  var posibleCorte=isMeterUnit(unit) && isLikelyCable(ref,desc);
  var itemText=normalizeRefText(ref+" "+desc);
  for(var ei=0;ei<items.length;ei++){
    var ex=items[ei];
    if(String(ex.cantidad||"")===qty && String(ex.unidad||"").toUpperCase()===unit){
      var exText=normalizeRefText((ex.referencia||"")+" "+(ex.descripcion||""));
      if(exText && itemText && (exText.indexOf(itemText)>=0 || itemText.indexOf(exText)>=0))return;
    }
  }
  var key=[normalizeRefText(ref),normalizeRefText(desc),qty,unit].join("|");
  if(seen[key])return;
  seen[key]=1;
  items.push({
    id:uid("LIN"),
    referencia:ref,
    descripcion:desc,
    cantidad:qty,
    unidad:unit,
    requiereCorte:posibleCorte,
    posibleCorte:posibleCorte,
    esCable:posibleCorte,
    decisionCorteRecepcion:posibleCorte?"MANDAR_CORTE":"NO_APLICA",
    estado:posibleCorte?"PENDIENTE_CORTE":"PENDIENTE_ALISTAMIENTO",
    rawLine:String(rawLine||"").slice(0,350),
    detectionReason:reason||(posibleCorte?"Cable con unidad en metros detectado desde PDF":"Línea de pedido detectada desde PDF ("+unit+")")
  });
}
function parseItemCandidate(candidate, seen, items){
  var unit=orderUnitPattern();
  var line=cleanPdfValue(candidate);
  if(!line || lineLooksHeader(line))return;
  var match;
  // REF + DESCRIPCIÓN + CANTIDAD + UNIDAD
  var rx2=new RegExp("\\b([A-Z0-9][A-Z0-9._\\-/]{1,})\\s+(.{2,190}?)\\s+([0-9]{1,7}(?:[.,][0-9]{1,4})?)\\s*("+unit+")\\b","ig");
  while((match=rx2.exec(line))){
    if(isProbablyPriceContext(line, match.index))continue;
    addPdfItem(items,seen,match[1],match[2],match[3],match[4],line,"Referencia + descripción + cantidad + unidad");
  }
  // REF + DESCRIPCIÓN + UNIDAD + CANTIDAD, común cuando la tabla tiene columnas U.M. y Cantidad.
  var rx4=new RegExp("\\b([A-Z0-9][A-Z0-9._\\-/]{1,})\\s+(.{2,190}?)\\s+("+unit+")\\s+([0-9]{1,7}(?:[.,][0-9]{1,4})?)\\b","ig");
  while((match=rx4.exec(line))){
    if(isProbablyPriceContext(line, match.index))continue;
    addPdfItem(items,seen,match[1],match[2],match[4],match[3],line,"Referencia + descripción + unidad + cantidad");
  }
  // CANTIDAD + UNIDAD + REF + DESCRIPCIÓN
  var rx3=new RegExp("^(?:\\d{1,3}\\s+)?([0-9]{1,7}(?:[.,][0-9]{1,4})?)\\s*("+unit+")\\s+([A-Z0-9][A-Z0-9._\\-/]{1,})\\s+(.{2,190})$","i");
  var m3=line.match(rx3);
  if(m3)addPdfItem(items,seen,m3[3],m3[4],m3[1],m3[2],line,"Cantidad + unidad + referencia + descripción");
  // DESCRIPCIÓN + UNIDAD + CANTIDAD + CÓDIGO OPCIONAL
  var rx5=new RegExp("^(.{3,190}?)\\s+("+unit+")\\s+([0-9]{1,7}(?:[.,][0-9]{1,4})?)(?:\\s*([A-Z0-9][A-Z0-9._\\-/]{2,}))?$","i");
  var m5=line.match(rx5);
  if(m5){
    var ref=m5[4]||fallbackRefFromDesc(m5[1]);
    addPdfItem(items,seen,ref,m5[1],m5[3],m5[2],line,"Descripción + unidad + cantidad");
  }
  // Búsqueda más flexible por cantidad/unidad en medio de la línea.
  var rx=new RegExp("\\b([0-9]{1,7}(?:[.,][0-9]{1,4})?)\\s*("+unit+")\\b","ig");
  while((match=rx.exec(line))){
    if(isProbablyPriceContext(line, match.index))continue;
    var qty=match[1], u=match[2];
    var before=line.slice(0,match.index);
    var after=line.slice(rx.lastIndex);
    var rd=refFromBefore(before);
    if(rd.ref || rd.desc){
      addPdfItem(items,seen,rd.ref,rd.desc,qty,u,line,"Cantidad/unidad asociada a descripción previa");
      continue;
    }
    var afterClean=cleanPdfValue(after).replace(/^\$?\s*[0-9][0-9.,]*(\s+\$?\s*[0-9][0-9.,]*)?.*$/,"");
    var parts=afterClean.split(/\s+/).filter(Boolean);
    if(parts.length>=1){
      var ref=parts[0];
      var desc=parts.slice(1,16).join(" ")||ref;
      addPdfItem(items,seen,ref,desc,qty,u,line,"Cantidad + unidad antes de referencia/descripción");
    }
  }
}
function extractPedidoItems(text){
  var raw=String(text||"").replace(/\r/g,"\n");
  var lines=pdfLines(raw).filter(function(l){return !/^--- PAGINA/i.test(l);});
  var candidates=[];
  var anyUnitRx=new RegExp("\\b(?:(?:[0-9][0-9.,]*\\s*(?:"+orderUnitPattern()+"))|(?:(?:"+orderUnitPattern()+")\\s*[0-9][0-9.,]*))\\b","i");
  lines.forEach(function(l,i){
    candidates.push(l);
    if(lines[i+1]){
      if(!anyUnitRx.test(l) && anyUnitRx.test(lines[i+1]))candidates.push(l+" "+lines[i+1]);
      if(anyUnitRx.test(l) && /^[0-9]{1,7}(?:[.,][0-9]{1,4})?\b/.test(lines[i+1]))candidates.push(l+" "+lines[i+1]);
      if(new RegExp("\\b(?:"+orderUnitPattern()+")\\b","i").test(l) && !/[0-9]{1,7}(?:[.,][0-9]{1,4})/.test(l))candidates.push(l+" "+lines[i+1]);
    }
    if(lines[i+1]&&lines[i+2] && new RegExp("\\b(?:"+orderUnitPattern()+")\\b","i").test(l))candidates.push(l+" "+lines[i+1]+" "+lines[i+2]);
  });
  var compact=cleanPdfValue(raw.replace(/\n/g," "));
  var boundary=new RegExp("(?=\\b(?:\\d{1,3}\\s+)?[A-Z0-9][A-Z0-9._\\-\\/]{1,}\\s+.{3,220}?\\s+(?:[0-9][0-9.,]*\\s*(?:"+orderUnitPattern()+")|(?:"+orderUnitPattern()+")\\s*[0-9][0-9.,]*)\\b)","ig");
  compact.split(boundary).forEach(function(x){x=cleanPdfValue(x);if(x)candidates.push(x.slice(0,300));});
  var items=[], seen={};
  candidates.forEach(function(c){parseItemCandidate(c,seen,items);});
  return items.slice(0,300);
}

function createCase(fd){
  var created=now(), p="recepcion_pedidos", def=processes[p], priority=fd.get("priorityMode")==="gerencia";
  var c={id:uid("PED"),type:"pedido_venta",procedureCode:def.code,currentProcess:p,status:priority?"pendiente_gerencia":"asignado",priority:priority?"Pendiente gerencia":"Normal",reference:fd.get("reference"),orderKind:fd.get("orderKind")||"VENTAS",client:fd.get("client"),description:fd.get("description"),requestedDelivery:fd.get("requestedDelivery"),deliveryType:"",paymentCondition:"",salesAdvisor:state.user.name,assignedRole:priority?"gerencia":"coordinador_logistico",assignedName:priority?"Gerencia":"Logística / despacho",assignedTo:"",createdAt:created,createdBy:state.user.uid,createdByName:state.user.name,updatedAt:created,activeStartedAt:null,waitStartedAt:priority?created:null,deadStartedAt:priority?null:created,totalRequirements:0,checklist:{},openRequirement:null,priorityApproval:priority?{status:"pendiente",reason:fd.get("priorityReason")||"Solicitud prioritaria",requestedAt:created,requestedByName:state.user.name}:null,evidence:[],pdfExtraction:null,orderItems:[],cutRequests:[],hasCuts:false,documentFlow:{salesRegisteredAt:created,salesRegisteredBy:state.user.name,receptionPdfLoadedAt:null,initialCommitmentStatus:"PENDIENTE_RECEPCION",initialCommitmentDetail:""},processStats:{}};
  procStats(c,p).startedAt=created;
  if(priority){procStats(c,p).waitMs=0;} else {procStats(c,p).deadMs=0;}
  def.checklist.forEach(function(item){c.checklist[item]=item==="Pedido registrado por ventas"?"ok":"pending";});
  persistCase(c,{type:"CASE_CREATED",detail:priority?"Pedido registrado por ventas y enviado a gerencia":"Pedido registrado por ventas y enviado a recepción"}).then(function(){state.route="dashboard";render();}).catch(function(e){showError(e.message||e);});
}

function initialCheckFromPdf(item,x){if(!x)return"pending";if(item==="Contenido del pedido completo")return x.orderNumber&&x.client?"ok":"pending";if(item==="Cliente identificado")return x.client?"ok":"pending";if(item==="Forma de pago definida")return x.paymentCondition?"ok":"pending";return"pending";}

function renderDetail(id){
  var c=caseById(id);if(!c){renderCases();return;}
  if(migrateLegacyCaseInMemory(c,"Corrección automática al abrir detalle")){
    if(db && (canSeeAll() || isAdminRoleValue(state.user.role))){db.collection("cases").doc(c.id).set(c,{merge:true}).catch(function(e){console.warn("No se pudo guardar migración legacy",e);});}
  }
  if(isCutOperator() && !(c.cutRequests||[]).some(function(x){return ["CONFORME","AUTORIZADO","FINALIZADO"].indexOf(x.status)<0;})){renderCutsQueue();return;}
  var def=processes[c.currentProcess]||processes.recepcion_pedidos, actions="";
  if(!c.closedAt){
    if(c.status==="asignado"&&canAccessProcess(state.user.role,c.currentProcess))actions+='<button class="btn btn-primary" data-action="accept" data-id="'+c.id+'">Aceptar</button>';
    if(canUploadEvidenceForCase(c))actions+='<button class="btn" data-action="evidence" data-id="'+c.id+'">Subir evidencia a Drive</button>';
    if(c.status==="en_proceso"&&canAccessProcess(state.user.role,c.currentProcess))actions+='<button class="btn btn-gold" data-action="wait" data-id="'+c.id+'">Requerimiento / espera</button>';
    if(c.status==="espera_ventas"&&normalizeRole(state.user.role)==="ventas")actions+='<button class="btn btn-primary" data-action="answer" data-id="'+c.id+'">Responder</button>';
    if(c.status==="en_espera"&&normalizeRole(state.user.role)===normalizeRole(c.assignedRole))actions+='<button class="btn btn-primary" data-action="answer" data-id="'+c.id+'">'+(normalizeRole(state.user.role)==="jefe_logistica"?"Aprobar / resolver":"Resolver")+'</button>';
    if(isJefeLogistica()&&!c.closedAt)actions+='<button class="btn btn-gold" data-action="supervise" data-id="'+c.id+'">Observación jefe logística</button>';
    if(c.status==="en_proceso"&&c.currentProcess==="recepcion_pedidos"&&canAccessProcess(state.user.role,c.currentProcess))actions+='<button class="btn btn-primary" data-action="receptionPdf" data-id="'+c.id+'">Cargar / releer PDF recepción</button>';
    if(c.status==="en_proceso"&&c.currentProcess==="alistamiento"&&canAccessProcess(state.user.role,c.currentProcess))actions+='<button class="btn btn-primary" data-action="planCuts" data-id="'+c.id+'">Revisar / ajustar cortes</button><button class="btn btn-gold" data-action="syncCuts" data-id="'+c.id+'">Sincronizar cortes</button>';
    if(c.status==="pendiente_gerencia"&&normalizeRole(state.user.role)==="gerencia")actions+='<button class="btn btn-success" data-action="approve" data-id="'+c.id+'">Aprobar</button><button class="btn btn-danger" data-action="reject" data-id="'+c.id+'">Rechazar</button>';
    if(c.status==="en_proceso"&&canAccessProcess(state.user.role,c.currentProcess)){
      if(c.currentProcess==="facturacion")actions+='<button class="btn btn-primary" data-action="delivery" data-id="'+c.id+'">Definir facturación / entrega</button>';
      else if(c.currentProcess==="caja")actions+='<button class="btn btn-primary" data-action="delivery" data-id="'+c.id+'">Confirmar caja / enviar a despacho</button>';
      else actions+=nextActionButtons(c);
    }
    if(c.status==="en_proceso"&&canAccessProcess(state.user.role,c.currentProcess)&&canCloseHere(c))actions+='<button class="btn btn-success" data-action="close" data-id="'+c.id+'">Cerrar caso</button>';
  }
  var checks=def.checklist.map(function(item){var v=c.checklist[item]||"pending";return'<div class="check-row"><div class="check-title">'+esc(item)+'</div><div class="segment" data-check="'+esc(item)+'" data-id="'+c.id+'">'+["ok|Conforme|ok","bad|No conforme|bad","na|N/A|na","pending|Pendiente|pending"].map(function(x){var a=x.split("|");return'<button class="'+(v===a[0]?'active '+a[2]:'')+'" data-action="check" data-value="'+a[0]+'">'+a[1]+'</button>';}).join("")+'</div></div>';}).join("");
  layout(header(c.reference||c.id,processTitle(c.currentProcess)+" · "+(c.client||"Sin cliente"),'<button class="btn" data-route="cases">Volver</button>'+actions)+'<section class="grid grid-4"><article class="card kpi"><span>Lead Time</span><strong style="font-size:1.55rem">'+fmt(totalMs(c))+'</strong><small>Desde ventas</small></article><article class="card kpi"><span>VA</span><strong style="font-size:1.55rem">'+fmt(activeMs(c))+'</strong><small>Tiempo activo</small></article><article class="card kpi"><span>NVA</span><strong style="font-size:1.55rem">'+fmt(waitMs(c)+deadMs(c))+'</strong><small>Espera + muerto</small></article><article class="card kpi"><span>Avance</span><strong>'+progress(c)+'%</strong><small>Checklist</small></article></section>'+pdfDocumentCard(c,false)+(c.openRequirement?'<section class="notice" style="margin-top:16px"><strong>Requerimiento activo:</strong> '+esc(c.openRequirement.reason)+' · '+esc(c.openRequirement.detail||"")+'</section>':"")+orderItemsPanel(c)+cutsPanel(c)+deliveryEvidencePanel(c)+evidencePanel(c)+'<section class="grid grid-2" style="margin-top:16px"><article class="card"><h3>Checklist</h3><div class="checklist">'+checks+'</div></article><article class="card"><h3>Datos del caso</h3>'+caseInfo(c)+'<h3 style="margin-top:18px">Secuencia y tiempos</h3>'+timeline(c)+'<h3 style="margin-top:18px">Eventos</h3>'+eventList(c.id)+'</article></section>');
}

function nextActionButtons(c){
  var next=(processes[c.currentProcess]||{}).next||[];
  return next.filter(function(n){return n!=="cierre_caso";}).map(function(n){
    var disabled="", label="Enviar a "+processTitle(n), cls="btn btn-primary";
    if(c.currentProcess==="recepcion_pedidos" && n==="alistamiento" && !receptionPdfIsComplete(c)){cls="btn btn-gold";label="PDF y compromiso obligatorios";}
    if(c.currentProcess==="alistamiento" && n==="facturacion")label="Enviar a facturación";
    return '<button class="'+cls+'" data-action="transfer" data-next="'+n+'" data-id="'+c.id+'">'+esc(label)+'</button>';
  }).join("");
}
function canCloseHere(c){var next=(processes[c.currentProcess]||{}).next||[];return next.indexOf("cierre_caso")>=0;}
function caseInfo(c){var cuts=(c.cutRequests||[]), done=cuts.filter(function(x){return x.status==="CONFORME"||x.status==="AUTORIZADO"||x.status==="FINALIZADO";}).length;var df=c.documentFlow||{};var rows=[["Estado",c.status],["Responsable",c.assignedName],["Creado",fmtDate(c.createdAt)],["Tipo pedido",c.orderKind],["Pedido fecha PDF",c.orderDate||""],["Cliente",c.client],["NIT/CC",c.nit||""],["Dirección",c.address||""],["Ciudad",c.city||""],["Teléfono",c.phone||""],["Asesor",c.salesAdvisor||""],["PDF recepción",df.receptionPdfLoadedAt?fmtDate(df.receptionPdfLoadedAt):"Pendiente"],["Mercancía comprometida",df.initialCommitmentStatus==="SI"?"Sí, desde recepción":(df.initialCommitmentStatus||"Pendiente")],["Detalle compromiso",df.initialCommitmentDetail||""],["PDF Drive",df.receptionPdfDriveUrl?"Guardado":"Sin URL"],["Páginas PDF",df.pdfPages||""],["Líneas detectadas",(c.orderItems||[]).length],["Cortes detectados",df.extractedCuts!==undefined?df.extractedCuts:cuts.length],["Cortes",cuts.length?(done+"/"+cuts.length):"Sin cortes"],["Cortes pendientes SIESA",countPendingSiesaCutsInCase(c)],["Entrega solicitada",processTitle(c.requestedDelivery)],["Entrega definida",processTitle(c.deliveryType)],["Forma pago",c.paymentCondition],["Prioridad",c.priority],["Requerimientos",c.totalRequirements]];return rows.map(function(r){return r[1]!==undefined&&r[1]!==""?'<div class="case-meta" style="justify-content:space-between;border-bottom:1px solid #eef2f7;padding:8px 0"><span>'+esc(r[0])+'</span><strong>'+esc(r[1])+'</strong></div>':"";}).join("");}
function timeline(c){
  return '<div class="timeline">'+FLOW.filter(function(p){return c.processStats&&c.processStats[p];}).map(function(p){var s=c.processStats[p];return'<div class="timeline-row"><b>'+esc(processes[p].icon+' · '+processTitle(p))+'</b><span>VA '+fmt(s.activeMs||0)+' · Espera '+fmt(s.waitMs||0)+' · Muerto '+fmt(s.deadMs||0)+'</span><strong>'+esc(s.completedAt?"Cerrado":"Activo")+'</strong></div>';}).join("")+'</div>';
}
function eventList(id){var list=state.events.filter(function(e){return e.caseId===id;}).slice(0,12);if(!list.length)return'<div class="empty">Sin eventos.</div>';return list.map(function(e){return'<div style="border-bottom:1px solid #eef2f7;padding:8px 0"><strong>'+esc(e.type)+'</strong><br><span style="color:#64748b">'+esc(e.detail||e.reason||"")+' · '+fmtDate(e.timestamp)+'</span></div>';}).join("");}

function casePdfUrl(c){
  return c && c.documentFlow && c.documentFlow.receptionPdfDriveUrl ? c.documentFlow.receptionPdfDriveUrl : "";
}
function casePdfLoadedAt(c){
  return c && c.documentFlow && c.documentFlow.receptionPdfLoadedAt ? c.documentFlow.receptionPdfLoadedAt : "";
}
function pdfDocumentCard(c, compact){
  var url=casePdfUrl(c), loaded=casePdfLoadedAt(c), title=compact?"PDF del pedido":"Documento oficial del pedido";
  if(url){
    return '<section class="card pdf-card" style="margin-top:16px"><div class="section-title"><div><h3>'+esc(title)+'</h3><p>Disponible para validación durante todo el flujo: recepción, alistamiento, corte, despacho, caja y auditoría.</p></div><a class="btn btn-primary btn-small" href="'+esc(url)+'" target="_blank" rel="noopener">Abrir PDF del pedido</a></div><div class="case-meta"><span>Estado documental</span><strong>PDF guardado en Drive'+(loaded?' · '+esc(fmtDate(loaded)):'')+'</strong></div></section>';
  }
  return '<section class="card pdf-card" style="margin-top:16px"><div class="section-title"><div><h3>'+esc(title)+'</h3><p>Este soporte debe cargarse en Recepción de pedidos antes de continuar con validaciones documentales.</p></div></div><div class="empty">PDF del pedido pendiente.</div></section>';
}
function pdfMiniButton(c){
  var url=casePdfUrl(c);
  return url?'<a class="btn btn-small" href="'+esc(url)+'" target="_blank" rel="noopener">Ver PDF</a>':'<span class="chip warning">Sin PDF</span>';
}



function orderItemsPanel(c){
  var items=c.orderItems||[];
  var pdfLink=(c.documentFlow&&c.documentFlow.receptionPdfDriveUrl)?'<a class="btn btn-small" href="'+esc(c.documentFlow.receptionPdfDriveUrl)+'" target="_blank" rel="noopener">Abrir PDF del pedido</a>':'';
  if(!items.length)return c.currentProcess==="recepcion_pedidos"?'<section class="card" style="margin-top:16px"><h3>Documento del pedido</h3><div class="empty">Pendiente cargar PDF en Recepción de pedidos.</div></section>':(pdfLink?'<section class="card" style="margin-top:16px"><h3>Documento del pedido</h3>'+pdfLink+'</section>':"");
  return '<section class="card" style="margin-top:16px"><div class="section-title"><div><h3>Líneas detectadas del pedido</h3><p>La recepción lee todas las unidades del PDF: metros, KG/KLS, UND y demás. Los cables en metros quedan como candidatos y Recepción decide si van a corte o si se entrega el carreto completo.</p></div>'+pdfLink+'</div><div class="table-wrap"><table><thead><tr><th>Referencia</th><th>Descripción</th><th>Cantidad</th><th>Unidad</th><th>Decisión recepción</th><th>Destino</th><th>Detección</th></tr></thead><tbody>'+items.map(function(it){var decision=it.posibleCorte?(it.requiereCorte?"Enviar a corte":"No cortar · carreto completo"):"No aplica";return'<tr><td>'+esc(it.referencia)+'</td><td>'+esc(it.descripcion)+'</td><td>'+esc(it.cantidad)+'</td><td>'+esc(it.unidad)+'</td><td>'+esc(decision)+'</td><td>'+esc(it.requiereCorte?"Corte de cable":"Alistamiento")+'</td><td>'+esc(it.detectionReason||"")+'</td></tr>';}).join("")+'</tbody></table></div></section>';
}
function cutStatusChip(st){var map={PENDIENTE_CORTE:["Pendiente corte","warning"],EN_CORTE:["En corte","primary"],CONFORME:["Conforme","success"],AUTORIZADO:["Autorizado","success"],FINALIZADO:["Finalizado","success"],APROBADO_PENDIENTE_CORTE:["Aprobado, pendiente corte","warning"],PENDIENTE_REGISTRO:["Pendiente registrar","warning"],PENDIENTE_GERENCIA:["Pendiente gerencia","warning"],PENDIENTE_LIDER:["Pendiente jefe logística","warning"],PENDIENTE_JEFE_LOGISTICA:["Pendiente jefe logística","warning"],REQUERIMIENTO:["Requerimiento a ventas","warning"],RECHAZADO:["Rechazado","danger"],NO_CONFORME:["No conforme","danger"],REVISAR:["Revisar","warning"]};var m=map[st]||[st||"Pendiente","info"];return '<span class="chip '+m[1]+'">'+esc(m[0])+'</span>';}
function cutsPanel(c){
  var cuts=c.cutRequests||[];if(!cuts.length)return "";
  return '<section class="card" style="margin-top:16px"><h3>Cortes vinculados al pedido</h3><div class="table-wrap"><table><thead><tr><th>Corte</th><th>Referencia</th><th>Metros</th><th>Disponible</th><th>Estado</th><th>Tiempo</th><th>Acción</th></tr></thead><tbody>'+cuts.map(function(cut){var canLaunch=state.user&&(normalizeRole(state.user.role)==="auxiliar_corte"||normalizeRole(state.user.role)==="jefe_logistica"||normalizeRole(state.user.role)==="gerencia"||isAdminRoleValue(state.user.role));return'<tr><td>'+esc(cut.code||cut.id)+'</td><td>'+esc(cut.referencia)+'</td><td>'+esc(cut.metrosSolicitados||"")+'</td><td>'+esc(cut.disponibleAntes||"")+'</td><td>'+cutStatusChip(cut.status)+'</td><td>'+esc(cut.durationText||"—")+'</td><td>'+(canLaunch?'<button class="btn btn-small btn-primary" data-action="launchCut" data-id="'+esc(c.id)+'" data-cut="'+esc(cut.id)+'">Abrir corte</button>':"—")+'</td></tr>';}).join("")+'</tbody></table></div></section>';
}
function deliveryEvidenceForCase(c){
  c.deliveryEvidence=c.deliveryEvidence||{};
  return c.deliveryEvidence;
}
function deliveryEvidenceComplete(c){
  if(!isDeliveryProcess(c.currentProcess))return true;
  var ev=deliveryEvidenceForCase(c);
  return deliveryEvidenceDefinitions(c.currentProcess).filter(function(d){return d.required!==false;}).every(function(d){return !!(ev[d.key]&&ev[d.key].driveUrl);});
}
function deliveryEvidenceMissingText(c){
  var ev=deliveryEvidenceForCase(c);
  return deliveryEvidenceDefinitions(c.currentProcess).filter(function(d){return d.required!==false && !(ev[d.key]&&ev[d.key].driveUrl);}).map(function(d){return d.title;}).join(", ");
}
function deliveryEvidencePanel(c){
  if(!isDeliveryProcess(c.currentProcess))return "";
  var ev=deliveryEvidenceForCase(c);
  var canUpload=canAccessProcess(state.user.role,c.currentProcess)||isAdminRoleValue(state.user.role)||isJefeLogistica();
  var cards=deliveryEvidenceDefinitions(c.currentProcess).map(function(d){
    var item=ev[d.key]||{};
    var done=!!item.driveUrl;
    return '<article class="evidence-required-card '+(done?'done':'pending')+'"><div><strong>'+esc(d.title)+'</strong><p>'+esc(d.hint)+'</p>'+(done?'<small>Guardada: '+esc(fmtDate(item.uploadedAt))+' · '+esc(item.uploadedByName||'')+'</small>':(d.required===false?'<small>Opcional para trazabilidad documental.</small>':'<small>Pendiente obligatorio para cerrar el despacho.</small>'))+'</div><div class="evidence-required-actions">'+(done?'<a class="btn btn-small" href="'+esc(item.driveUrl)+'" target="_blank" rel="noopener">Ver archivo</a>':'')+(canUpload?'<button class="btn btn-small btn-primary" data-action="deliveryEvidence" data-id="'+esc(c.id)+'" data-delivery-evidence="'+esc(d.key)+'">'+(done?'Reemplazar':'Subir')+'</button>':'')+'</div></article>';
  }).join('');
  var status=deliveryEvidenceComplete(c)?'<span class="chip success">Evidencias completas</span>':'<span class="chip warning">Faltan evidencias obligatorias</span>';
  return '<section class="card delivery-evidence-panel" style="margin-top:16px"><div class="section-title"><div><h3>Evidencias obligatorias de entrega</h3><p>Después del chequeo, debe quedar trazabilidad documental y fotográfica: PDF/soporte opcional, foto de mercancía rotulada y guía/soporte final obligatorio.</p></div>'+status+'</div><div class="notice"><strong>Guía:</strong> la foto de mercancía rotulada marca el fin operativo de logística y deja el caso en espera de transportadora/entrega; la guía de transportadora o soporte final es obligatoria para cerrar.</div><div class="delivery-evidence-grid">'+cards+'</div></section>';
}

function evidencePanel(c){
  var list=c.evidence||[];
  if(!list.length)return "";
  return '<section class="card" style="margin-top:16px"><h3>Evidencias del proceso</h3><div class="table-wrap"><table><thead><tr><th>Proceso</th><th>Archivo</th><th>Descripción</th><th>Responsable</th><th>Fecha</th><th>Drive</th></tr></thead><tbody>'+list.slice().reverse().map(function(e){return '<tr><td>'+esc(e.processName||processTitle(e.process))+'</td><td>'+esc(e.fileName||'')+'</td><td>'+esc(e.detail||'')+'</td><td>'+esc(e.uploadedByName||'')+'</td><td>'+esc(fmtDate(e.uploadedAt))+'</td><td>'+(e.driveUrl?'<a href="'+esc(e.driveUrl)+'" target="_blank" rel="noopener">Abrir</a>':'Sin URL')+'</td></tr>';}).join('')+'</tbody></table></div></section>';
}


function blankPdfValue(value){
  return value === undefined || value === null || String(value).trim() === "";
}
function assignPdfField(c, key, value, label, filled){
  if(blankPdfValue(value))return;
  if(blankPdfValue(c[key])){
    c[key]=value;
    filled.push(label||key);
  }
}
function mergePdfItemsIntoCase(c, parsed){
  var incoming=(parsed && parsed.items) ? parsed.items : [];
  c.orderItems=c.orderItems||[];
  var index={};
  c.orderItems.forEach(function(it,idx){
    var k=[normalizeRefText(it.referencia||it.reference||""), normalizeRefText(it.descripcion||it.description||""), normalizeQty(it.cantidad||it.quantity||""), String(it.unidad||it.unit||"").toUpperCase()].join("|");
    index[k]=idx;
  });
  var added=0, updated=0;
  incoming.forEach(function(it){
    var k=[normalizeRefText(it.referencia||it.reference||""), normalizeRefText(it.descripcion||it.description||""), normalizeQty(it.cantidad||it.quantity||""), String(it.unidad||it.unit||"").toUpperCase()].join("|");
    if(index[k]!==undefined){
      var existing=c.orderItems[index[k]];
      existing.requiereCorte=!!it.requiereCorte;
      existing.posibleCorte=!!it.posibleCorte;
      existing.esCable=!!it.esCable;
      existing.decisionCorteRecepcion=it.decisionCorteRecepcion||existing.decisionCorteRecepcion||"NO_APLICA";
      existing.noCutReason=it.noCutReason||"";
      existing.estado=it.requiereCorte ? "PENDIENTE_CORTE" : "PENDIENTE_ALISTAMIENTO";
      existing.detectionReason=it.detectionReason||existing.detectionReason||"";
      updated++;
      return;
    }
    c.orderItems.push(Object.assign({
      id: uid("LIN"),
      estado: it.requiereCorte ? "PENDIENTE_CORTE" : "PENDIENTE_ALISTAMIENTO",
      origen: "PDF_RECEPCION",
      createdAt: now()
    }, it));
    index[k]=c.orderItems.length-1;
    added++;
  });
  return added;
}
function mergePdfExtractionIntoCase(c, parsed){
  parsed=parsed||{};
  var filled=[];
  c.pdfExtraction=parsed;
  assignPdfField(c,"reference",parsed.orderNumber,"pedido",filled);
  assignPdfField(c,"orderKind",parsed.orderKind,"tipo de pedido",filled);
  assignPdfField(c,"client",parsed.client,"cliente",filled);
  assignPdfField(c,"nit",parsed.nit,"NIT/CC",filled);
  assignPdfField(c,"address",parsed.address,"dirección",filled);
  assignPdfField(c,"city",parsed.city,"ciudad",filled);
  assignPdfField(c,"phone",parsed.phone,"teléfono",filled);
  assignPdfField(c,"paymentCondition",parsed.paymentCondition,"forma de pago",filled);
  assignPdfField(c,"salesAdvisor",parsed.salesAdvisor,"asesor",filled);
  assignPdfField(c,"orderDate",parsed.orderDate,"fecha del pedido",filled);
  assignPdfField(c,"requestedDelivery",parsed.requestedDelivery,"tipo de entrega",filled);
  if(blankPdfValue(c.description) && !blankPdfValue(parsed.observations)){
    c.description=parsed.observations;
    filled.push("observaciones");
  }
  c.documentFlow=c.documentFlow||{};
  c.documentFlow.extractionMode="PDFJS_TEXT_EXHAUSTIVO";
  c.documentFlow.lastPdfExtractionAt=now();
  c.documentFlow.lastPdfExtractionBy=state.user ? state.user.name : "";
  c.documentFlow.fieldsFilled=filled.slice();
  c.documentFlow.pdfReadStatus="LEIDO";
  mergePdfItemsIntoCase(c, parsed);
  c.hasCuts=(c.cutRequests&&c.cutRequests.length>0) || (c.orderItems||[]).some(function(it){return !!it.requiereCorte;});
  return filled;
}

function applyReceptionChecklistFromPdf(c, parsed){
  c.checklist=c.checklist||{};
  var items=(c.orderItems||[]), cuts=(c.cutRequests||[]), df=c.documentFlow||{};
  var vals={
    "Pedido registrado por ventas":"ok",
    "PDF del pedido cargado en recepción":df.receptionPdfLoadedAt?"ok":"pending",
    "Documento legible y completo":(parsed&&parsed.raw&&String(parsed.raw).length>40)?"ok":"pending",
    "Número de pedido identificado":(c.reference||parsed.orderNumber)?"ok":"pending",
    "Cliente identificado":(c.client||parsed.client)?"ok":"pending",
    "Referencias del pedido identificadas":items.length>0?"ok":"pending",
    "Cantidades y unidades de medida identificadas":items.some(function(it){return it.cantidad&&it.unidad;})?"ok":"pending",
    "Cortes automáticos detectados si aplica":cuts.length>0 || items.every(function(it){return !it.requiereCorte;})?"ok":"pending",
    "Tipo PVC/PVN validado":(c.orderKind||parsed.orderKind)?"ok":"pending",
    "Tipo de entrega definido":(c.requestedDelivery||parsed.requestedDelivery)?"ok":"pending",
    "Forma de pago definida":(c.paymentCondition||parsed.paymentCondition)?"ok":"pending",
    "Mercancía comprometida en SIESA/ERP":df.initialCommitmentStatus==="SI"?"ok":"pending",
    "Observaciones revisadas":"ok",
    "Pedido listo para alistamiento":(df.receptionPdfLoadedAt && df.initialCommitmentStatus==="SI" && (c.reference||parsed.orderNumber) && (c.client||parsed.client) && items.length>0)?"ok":"pending"
  };
  Object.keys(vals).forEach(function(k){if(c.checklist[k]!==undefined)c.checklist[k]=vals[k];});
}
function applyAlistamientoAutoChecklist(c){
  c.checklist=c.checklist||{};
  var items=c.orderItems||[], cuts=c.cutRequests||[], cd=cutDoneCount(c);
  var vals={
    "Pedido recibido desde recepción":"ok",
    "Productos y cantidades ubicadas":items.length?"ok":"pending",
    "Referencia coincide":items.length?"ok":"pending",
    "Descripción coincide":items.length?"ok":"pending",
    "Cantidad coincide":items.length?"ok":"pending",
    "Unidad de medida coincide":items.length?"ok":"pending",
    "Ubicación correcta":"pending",
    "Estado físico conforme":"pending",
    "Líneas que requieren corte definidas":cuts.length || items.every(function(it){return !it.requiereCorte;})?"ok":"pending",
    "Cortes enviados al módulo de corte si aplica":cuts.length || items.every(function(it){return !it.requiereCorte;})?"ok":"pending",
    "Cortes terminados o en seguimiento":cuts.length? (cd.done===cd.total?"ok":"pending") : "ok",
    "Pedido listo para facturación":cuts.length? (cd.done===cd.total?"ok":"pending") : "ok"
  };
  Object.keys(vals).forEach(function(k){if(c.checklist[k]!==undefined)c.checklist[k]=vals[k];});
}
function receptionPdfIsComplete(c){
  var df=c.documentFlow||{};
  var items=c.orderItems||[];
  return !!(df.receptionPdfLoadedAt && df.receptionPdfDriveUrl && df.initialCommitmentStatus==="SI" && c.reference && c.client && items.length>0);
}

function applyReceptionCutDecisions(parsed, fd){
  if(!parsed||!parsed.items)return parsed;
  parsed.items.forEach(function(it,idx){
    if(!it.posibleCorte){it.requiereCorte=false;it.decisionCorteRecepcion="NO_APLICA";it.estado="PENDIENTE_ALISTAMIENTO";return;}
    var decision=String(fd.get("cutDecision_"+idx)||"MANDAR_CORTE");
    it.decisionCorteRecepcion=decision;
    if(decision==="CARRETO_COMPLETO"){
      it.requiereCorte=false;
      it.estado="PENDIENTE_ALISTAMIENTO";
      it.noCutReason="Recepción indicó que no requiere corte porque se entrega carreto completo.";
      it.detectionReason=(it.detectionReason||"Cable en metros detectado")+" · Decisión recepción: no cortar, carreto completo.";
    }else{
      it.requiereCorte=true;
      it.estado="PENDIENTE_CORTE";
      it.noCutReason="";
      it.detectionReason=(it.detectionReason||"Cable en metros detectado")+" · Decisión recepción: enviar a corte.";
    }
  });
  parsed.meterItems=parsed.items.filter(function(x){return x.requiereCorte;}).length;
  return parsed;
}

function openReceptionPdf(id){
  var c=caseById(id);if(!c)return;
  drawer(modal("Cargar y leer PDF en recepción",'<form class="form" id="recPdfForm"><div class="notice"><strong>Lectura automática obligatoria:</strong> el iframe solo muestra el documento. La extracción real se hace con PDF.js para llenar todos los campos vacíos y crear automáticamente los líneas detectadas en cualquier unidad del pedido. Si la línea es cable en metros, recepción decide si se envía a corte o si no se corta porque se entrega carreto completo. En esta misma recepción se registra el compromiso de mercancía para pasar directo a alistamiento.</div><label class="field"><span>PDF del pedido</span><input class="input" type="file" name="pdf" id="receptionPdfInput" accept="application/pdf" required></label><div id="pdfPreviewBox" style="display:none"><iframe id="pdfPreviewFrame" title="Vista previa PDF" style="width:100%;height:420px;border:1px solid #dbe7f4;border-radius:16px;background:#fff"></iframe></div><div class="notice" id="receptionPdfStatus">Seleccione el PDF oficial del pedido. La app buscará pedido, cliente, NIT, asesor, pago, entrega, referencias, cantidades, unidades KG/UND/MTR/etc. y candidatos de corte.</div><div id="pdfExtractPreview"></div><section class="card" style="margin-top:12px"><h3>Compromiso de mercancía en recepción</h3><label class="check-card"><input type="checkbox" name="merchCommitted" required> Confirmo que la mercancía fue comprometida/bloqueada en SIESA/ERP</label><label class="field"><span>Observación del compromiso</span><textarea class="textarea" name="commitDetail" placeholder="Ej.: mercancía comprometida en SIESA, parcial con novedad, validación realizada contra el PDF."></textarea></label></section><button class="btn btn-primary" type="submit">Guardar PDF, compromiso, datos, líneas y cortes automáticos</button></form>'));
  var parsed=null,fileName="",selectedFile=null,previewUrl="";
  qs("#receptionPdfInput").onchange=function(e){
    var f=e.target.files&&e.target.files[0];if(!f)return;
    selectedFile=f;fileName=f.name;parsed=null;
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    previewUrl=URL.createObjectURL(f);
    qs("#pdfPreviewBox").style.display="block";
    qs("#pdfPreviewFrame").src=previewUrl;
    qs("#receptionPdfStatus").innerHTML="Leyendo PDF de forma exhaustiva...";
    qs("#pdfExtractPreview").innerHTML="";
    readPdfFile(f).then(function(text){
      parsed=extractPedido(text);
      var auto=(parsed.items||[]).filter(function(x){return x.requiereCorte;}).length;
      var rows=(parsed.items||[]).map(function(it,idx){var decision=it.posibleCorte?'<select class="select" name="cutDecision_'+idx+'"><option value="MANDAR_CORTE" '+(it.requiereCorte?'selected':'')+'>Enviar a corte</option><option value="CARRETO_COMPLETO">No cortar · carreto completo</option></select>':'<span class="chip info">Alistamiento</span>';return '<tr><td>'+esc(it.referencia)+'</td><td>'+esc(it.descripcion)+'</td><td>'+esc(it.cantidad)+'</td><td>'+esc(it.unidad)+'</td><td>'+decision+'</td><td>'+esc(it.posibleCorte?'Candidato por cable en metros':'Línea normal')+'</td></tr>';}).join('');
      qs("#receptionPdfStatus").innerHTML="<strong>PDF leído.</strong><br>Pedido: "+esc(parsed.orderNumber||c.reference||"No detectado")+"<br>Cliente: "+esc(parsed.client||c.client||"No detectado")+"<br>NIT/CC: "+esc(parsed.nit||"No detectado")+"<br>Forma de pago: "+esc(parsed.paymentCondition||"No detectada")+"<br>Líneas detectadas: "+(parsed.items||[]).length+"<br>Candidatos de corte por cable en metros: "+auto;
      qs("#pdfExtractPreview").innerHTML='<section class="card" style="margin-top:12px"><h3>Vista de extracción</h3><div class="notice"><strong>Recepción decide:</strong> si el PDF trae cable en metros, seleccione si se manda a corte o si no se corta porque se entrega el carreto completo. Alistamiento podrá ver esta decisión.</div><div class="grid grid-3"><div><small>Pedido</small><strong>'+esc(parsed.orderNumber||c.reference||"—")+'</strong></div><div><small>Cliente</small><strong>'+esc(parsed.client||c.client||"—")+'</strong></div><div><small>Asesor</small><strong>'+esc(parsed.salesAdvisor||"—")+'</strong></div></div><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Referencia</th><th>Descripción</th><th>Cantidad</th><th>Unidad</th><th>Decisión recepción</th><th>Tipo</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">No se detectaron líneas. Si el PDF es escaneado como imagen, se requiere OCR o digitación manual.</td></tr>')+'</tbody></table></div></section>';
    }).catch(function(e){qs("#receptionPdfStatus").innerHTML="No fue posible leer el PDF. "+esc(e.message||e)+". Si es un PDF escaneado como imagen, el lector no puede extraer texto sin OCR.";});
  };
  qs("#recPdfForm").onsubmit=function(e){
    e.preventDefault();
    if(!parsed){alert("Primero seleccione y lea el PDF.");return;}
    var fd=new FormData(e.target);
    if(!fd.get("merchCommitted")){alert("Recepción debe confirmar que la mercancía fue comprometida/bloqueada antes de continuar a alistamiento.");return;}
    parsed=applyReceptionCutDecisions(parsed,fd);
    var filledFields=mergePdfExtractionIntoCase(c,parsed);
    c.documentFlow=c.documentFlow||{};c.documentFlow.initialCommitmentStatus="SI";c.documentFlow.initialCommitmentDetail=fd.get("commitDetail")||"Mercancía comprometida/bloqueada en SIESA/ERP desde recepción.";c.documentFlow.initialCommitmentAt=now();c.documentFlow.initialCommitmentBy=state.user.name;c.documentFlow.receptionPdfLoadedAt=now();c.documentFlow.receptionPdfLoadedBy=state.user.name;c.documentFlow.receptionPdfFileName=fileName;c.documentFlow.pdfPages=parsed.pages||1;c.documentFlow.extractedLines=(parsed.items||[]).length;c.documentFlow.extractedCuts=(parsed.items||[]).filter(function(x){return x.requiereCorte;}).length;
    var added=autoCreateCutsFromItems(c,state.user.name);
    applyReceptionChecklistFromPdf(c,parsed);
    uploadReceptionPdfToDrive(selectedFile,c).then(function(up){
      c.documentFlow.receptionPdfDriveUrl=up.url;c.documentFlow.receptionPdfDriveId=up.fileId;c.documentFlow.receptionPdfDriveFolder=up.folderPath||up.folder;
      appendEvidence(c,up,"PDF oficial del pedido recibido en Recepción de pedidos, con mercancía comprometida. Lectura: "+c.orderItems.length+" líneas, "+added+" cortes automáticos.");
      return persistCase(c,{type:"RECEPTION_PDF_EXTRACTED",detail:"PDF leído y guardado en Drive. Pedido: "+(c.reference||"")+". Campos autollenados: "+(filledFields.length?filledFields.join(", "):"sin campos vacíos pendientes")+". Líneas detectadas: "+c.orderItems.length+". Cortes automáticos generados: "+added});
    }).then(function(){if(previewUrl)URL.revokeObjectURL(previewUrl);closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});
  };
}
function autoCreateCutsFromItems(c,createdByName){
  c.cutRequests=c.cutRequests||[];
  var activeLineIds={};
  (c.orderItems||[]).forEach(function(it){if(it.requiereCorte)activeLineIds[it.id]=true;});
  c.cutRequests=c.cutRequests.filter(function(x){
    if(!x.sourceLineId || activeLineIds[x.sourceLineId])return true;
    if(x.generatedBy==="PDF_AUTO_CABLE_METROS" && ["PENDIENTE_CORTE","REVISAR"].indexOf(x.status||"")>=0)return false;
    return true;
  });
  var added=0;
  (c.orderItems||[]).forEach(function(it){
    if(!it.requiereCorte)return;
    var exists=c.cutRequests.some(function(x){return x.sourceLineId===it.id;});
    if(exists)return;
    var idc=uid("CUT");
    c.cutRequests.push({
      id:idc,
      code:"CT-"+String(c.cutRequests.length+1).padStart(3,"0"),
      sourceLineId:it.id,
      caseId:c.id,
      pedido:c.reference,
      cliente:c.client||"",
      tipoPedido:c.orderKind||"VENTAS",
      referencia:it.referencia||"",
      descripcion:it.descripcion||"",
      metrosSolicitados:it.cantidad||"",
      unidad:it.unidad||"M",
      disponibleAntes:"",
      status:"PENDIENTE_CORTE",
      createdAt:now(),
      createdByName:createdByName||state.user.name,
      generatedBy:"PDF_AUTO_CABLE_METROS",
      detectionReason:it.detectionReason||"Cable en metros detectado desde PDF",
      siesaExportStatus:"PENDIENTE",
      siesaExportedAt:"",
      siesaBatchId:""
    });
    added++;
  });
  if(added){
    c.hasCuts=true;
    var st=procStats(c,"corte_cable");st.startedAt=st.startedAt||now();
  }
  return added;
}
function openCutsPlanner(id){
  var c=caseById(id);if(!c)return;var items=c.orderItems||[];
  var rows=items.length?items.map(function(it,i){var checked=it.requiereCorte?'checked':'';var decision=it.posibleCorte?(it.requiereCorte?'Recepción: enviar a corte':'Recepción: no cortar · carreto completo'):'No aplica';return'<tr><td><input type="checkbox" name="cut_'+i+'" '+checked+'></td><td>'+esc(it.referencia)+'</td><td>'+esc(it.descripcion)+'</td><td>'+esc(it.cantidad||"")+'</td><td>'+esc(it.unidad||"")+'</td><td>'+esc(decision)+'</td><td><input class="input" name="meters_'+i+'" value="'+esc(it.cantidad||"")+'"></td><td><input class="input" name="available_'+i+'" placeholder="Metros disponibles si ya se conoce"></td></tr>';}).join(""):'<tr><td colspan="8">No hay líneas del PDF. Puede crear un corte manual.</td></tr>';
  drawer(modal("Definir / ajustar cortes del pedido",'<form class="form" id="cutsPlanForm"><div class="notice">Alistamiento visualiza todas las líneas leídas desde Recepción. Las líneas con decisión “no cortar · carreto completo” quedan para alistamiento normal; las marcadas se envían al módulo de corte.</div><div class="table-wrap"><table><thead><tr><th>Corte</th><th>Referencia</th><th>Descripción</th><th>Cant.</th><th>Unidad</th><th>Decisión recepción</th><th>Metros a cortar</th><th>Disponible</th></tr></thead><tbody>'+rows+'</tbody></table></div><fieldset><legend>Corte manual opcional</legend><div class="grid grid-3"><label class="field"><span>Referencia</span><input class="input" name="manualRef"></label><label class="field"><span>Metros</span><input class="input" name="manualMeters"></label><label class="field"><span>Disponible</span><input class="input" name="manualAvailable"></label></div><label class="field"><span>Observación</span><textarea class="textarea" name="manualObs"></textarea></label></fieldset><button class="btn btn-primary" type="submit">Guardar solicitudes de corte</button></form>'));
  qs("#cutsPlanForm").onsubmit=function(e){e.preventDefault();var fd=new FormData(e.target);c.cutRequests=c.cutRequests||[];var added=0;items.forEach(function(it,i){it.requiereCorte=!!fd.get("cut_"+i);it.estado=it.requiereCorte?"PENDIENTE_CORTE":"PENDIENTE_ALISTAMIENTO";if(!it.requiereCorte)return;var meters=fd.get("meters_"+i)||it.cantidad||"";var ref=it.referencia||"";var exists=c.cutRequests.some(function(x){return x.sourceLineId===it.id;});if(exists){c.cutRequests.forEach(function(x){if(x.sourceLineId===it.id){x.metrosSolicitados=meters;x.disponibleAntes=fd.get("available_"+i)||x.disponibleAntes||"";}});return;}var idc=uid("CUT");c.cutRequests.push({id:idc,code:"CT-"+(c.cutRequests.length+1),sourceLineId:it.id,caseId:c.id,pedido:c.reference,tipoPedido:c.orderKind||"VENTAS",referencia:ref,descripcion:it.descripcion||"",metrosSolicitados:meters,unidad:it.unidad||"M",disponibleAntes:fd.get("available_"+i)||"",status:"PENDIENTE_CORTE",createdAt:now(),createdByName:state.user.name,generatedBy:"ALISTAMIENTO",siesaExportStatus:"PENDIENTE",siesaExportedAt:"",siesaBatchId:""});added++;});
    c.cutRequests=c.cutRequests.filter(function(x){if(!x.sourceLineId)return true;var it=(c.orderItems||[]).filter(function(y){return y.id===x.sourceLineId;})[0];if(!it || it.requiereCorte)return true;return !((x.generatedBy==="PDF_AUTO_CABLE_METROS"||x.generatedBy==="ALISTAMIENTO") && ["PENDIENTE_CORTE","REVISAR"].indexOf(x.status||"")>=0);});
    if(fd.get("manualRef")||fd.get("manualMeters")){var idm=uid("CUT");c.cutRequests.push({id:idm,code:"CT-"+(c.cutRequests.length+1),caseId:c.id,pedido:c.reference,tipoPedido:c.orderKind||"VENTAS",referencia:fd.get("manualRef")||"Corte manual",descripcion:fd.get("manualObs")||"",metrosSolicitados:fd.get("manualMeters")||"",unidad:"M",disponibleAntes:fd.get("manualAvailable")||"",status:"PENDIENTE_CORTE",createdAt:now(),createdByName:state.user.name,generatedBy:"MANUAL",siesaExportStatus:"PENDIENTE",siesaExportedAt:"",siesaBatchId:""});added++;}
    c.hasCuts=(c.cutRequests||[]).length>0;var st=procStats(c,"corte_cable");if(c.hasCuts)st.startedAt=st.startedAt||now();c.checklist=c.checklist||{};if(c.checklist["Líneas que requieren corte definidas"]!==undefined)c.checklist["Líneas que requieren corte definidas"]="ok";if(c.checklist["Cortes enviados al módulo de corte si aplica"]!==undefined)c.checklist["Cortes enviados al módulo de corte si aplica"]=c.cutRequests.length?"ok":"na";
    persistCase(c,{type:"CUT_REQUESTS_CREATED",detail:"Solicitudes de corte creadas/ajustadas: "+added}).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});};
}
function cutPayload(c,cut){return {caseId:c.id,cutId:cut.id,pedido:c.reference||cut.pedido||"",tipoPedido:(String(c.orderKind||cut.tipoPedido||"VENTAS").toUpperCase()==="ALUMBRADO"?"ALUMBRADO":"VENTAS"),referencia:cut.referencia||"",descripcion:cut.descripcion||"",metrosSolicitados:cut.metrosSolicitados||"",disponibleAntes:cut.disponibleAntes||"",cliente:c.client||"",source:"firebase_principal"};}
function findCut(c,cutId){return (c.cutRequests||[]).filter(function(x){return x.id===cutId;})[0]||null;}
function cutDone(st){return ["CONFORME","AUTORIZADO","FINALIZADO"].indexOf(st)>=0;}
function cutElapsedMs(cut){
  var stored=Number(cut.durationMs||0);
  if(cut.status==="EN_CORTE"&&cut.startedAt)stored+=msSince(cut.startedAt);
  return stored;
}
function cutParseDecimal(value){
  var s=String(value==null?"":value).trim().replace(/\s/g,"");
  if(!s)return NaN;
  var lastComma=s.lastIndexOf(','), lastDot=s.lastIndexOf('.');
  if(lastComma>lastDot){s=s.replace(/\./g,'').replace(',', '.');}
  else{s=s.replace(/,/g,'');}
  var n=Number(s);
  return Number.isFinite(n)?n:NaN;
}
function cutNormalizeDecimal(v){
  if(v===""||v===null||v===undefined)return "";
  var n=typeof v==="number"?v:cutParseDecimal(v);
  if(!Number.isFinite(n))return String(v||"");
  return String(n.toFixed(2)).replace(/\.00$/,'').replace('.', ',');
}
function cutSame(a,b){return Math.abs(Number(a)-Number(b))<0.000001;}
function cutRule(tipo, rem){
  var t=String(tipo||"VENTAS").toUpperCase();
  if(!Number.isFinite(rem))return {requires:false,status:"PENDIENTE_CORTE",condition:"",css:"warn",approverRole:"",approverLabel:"",message:"Ingrese metros disponibles y metros a cortar para calcular la restricción.",route:"Pendiente de cálculo."};
  if(t==="ALUMBRADO"){
    if(rem<10)return {requires:true,status:"PENDIENTE_GERENCIA",condition:"<10 m",css:"stop",approverRole:"gerencia",approverLabel:"Gerencia",message:"Requiere autorización de Gerencia por sobrante menor a 10 m.",route:"Alumbrado: no continuar hasta aprobación de Gerencia."};
    if(rem<15)return {requires:true,status:"PENDIENTE_JEFE_LOGISTICA",condition:"<15 m",css:"warn",approverRole:"jefe_logistica",approverLabel:"Jefe logístico",message:"Requiere aprobación del Jefe Logístico por sobrante menor a 15 m.",route:"Alumbrado: no continuar hasta aprobación logística."};
    return {requires:false,status:"CONFORME",condition:cutSame(rem,15)?"=15 m":">15 m",css:"ok",approverRole:"",approverLabel:"",message:"Corte habilitado.",route:"Alumbrado: no requiere aprobación."};
  }
  if(rem<50)return {requires:true,status:"PENDIENTE_GERENCIA",condition:"<50 m",css:"stop",approverRole:"gerencia",approverLabel:"Gerencia",message:"Requiere autorización de Gerencia por sobrante menor a 50 m.",route:"Ventas: no continuar hasta aprobación de Gerencia."};
  if(cutSame(rem,50))return {requires:true,status:"PENDIENTE_JEFE_LOGISTICA",condition:"=50 m",css:"warn",approverRole:"jefe_logistica",approverLabel:"Jefe logístico",message:"Requiere validación del Jefe Logístico por sobrante igual a 50 m.",route:"Ventas: no continuar hasta aprobación logística."};
  return {requires:false,status:"CONFORME",condition:">50 m",css:"ok",approverRole:"",approverLabel:"",message:"Corte habilitado.",route:"Ventas: no requiere aprobación."};
}
function cutApproverGroup(rule){
  var ar=normalizeRole(rule && rule.approverRole || "");
  var cond=String(rule && rule.condition || "");
  if(ar==="jefe_logistica")return {primary:"jefe_logistica",backup:"super_admin",label:"Jefe logístico o Super Admin"};
  if(ar==="gerencia")return {primary:"gerencia",backup:"super_admin",label:"Gerencia o Super Admin"};
  if(cond==="=50 m")return {primary:"jefe_logistica",backup:"super_admin",label:"Jefe logístico o Super Admin"};
  if(cond==="<50 m")return {primary:"gerencia",backup:"super_admin",label:"Gerencia o Super Admin"};
  if(cond==="<15 m")return {primary:"jefe_logistica",backup:"super_admin",label:"Jefe logístico o Super Admin"};
  if(cond==="<10 m")return {primary:"gerencia",backup:"super_admin",label:"Gerencia o Super Admin"};
  return {primary:ar,backup:"super_admin",label:roleTitle(ar)||"Autorizador"};
}
function userCanApproveCut(rule, cut){
  if(!state.user)return false;
  var r=normalizeRole(state.user.role);
  var group=cutApproverGroup(rule||cutRule(cut && cut.tipoPedido, cutParseDecimal(cut && cut.remanenteProyectado)));
  return r===group.primary || r===group.backup;
}
function cutApprovalIsPending(cut){return cut && cut.approvalRequired===true && cut.approvalStatus==="PENDIENTE";}
function cutApprovalTargetLabel(rule, cut){
  return cutApproverGroup(rule||{}).label || roleTitle((rule&&rule.approverRole)||(cut&&cut.approverRole)||"");
}
function cutValuesFromForm(){
  var f=qs("#cutFullForm");
  if(!f)return {};
  var fd=new FormData(f);
  function get(name,fallback){var el=f.elements[name];return el?String(el.value||""):String(fd.get(name)||fallback||"");}
  function checked(name){var el=f.elements[name];return el?!!el.checked:!!fd.get(name);}
  return {
    tipoPedido:String(get("tipoPedido","VENTAS")||"VENTAS").toUpperCase(),
    pedido:get("pedido"),
    referencia:get("referencia"),
    descripcion:get("descripcion"),
    metrosSolicitados:get("metrosSolicitados"),
    disponibleAntes:get("disponibleAntes"),
    siesaBodega:get("siesaBodega"),
    metrajeFinal:get("metrajeFinal"),
    motivoVentas:get("motivoVentas"),
    observacion:get("observacion"),
    finishDetail:get("finishDetail"),
    corteUniforme:checked("corteUniforme"),
    tramoRotulado:checked("tramoRotulado"),
    evidenciaRegistro:checked("evidenciaRegistro")
  };
}
function applyCutFormValues(cut, v){
  v=v||cutValuesFromForm();
  cut.tipoPedido=v.tipoPedido||cut.tipoPedido||"VENTAS";
  cut.pedido=v.pedido||cut.pedido||"";
  cut.referencia=v.referencia||cut.referencia||"";
  cut.descripcion=v.descripcion||cut.descripcion||"";
  cut.metrosSolicitados=v.metrosSolicitados||cut.metrosSolicitados||"";
  cut.disponibleAntes=v.disponibleAntes||cut.disponibleAntes||"";
  cut.siesaBodega=v.siesaBodega||cut.siesaBodega||((window.appSettings&&window.appSettings.siesaFlatFile&&window.appSettings.siesaFlatFile.warehouse)||"");
  cut.metrajeFinal=v.metrajeFinal||cut.metrajeFinal||"";
  cut.motivoVentas=v.motivoVentas||cut.motivoVentas||"";
  cut.observacion=v.observacion||cut.observacion||"";
  cut.finishDetail=v.finishDetail||cut.finishDetail||"";
  cut.corteUniforme=v.corteUniforme;
  cut.tramoRotulado=v.tramoRotulado;
  cut.evidenciaRegistro=v.evidenciaRegistro;
  var dis=cutParseDecimal(cut.disponibleAntes), sol=cutParseDecimal(cut.metrosSolicitados);
  if(Number.isFinite(dis)&&Number.isFinite(sol)){
    cut.remanenteProyectado=cutNormalizeDecimal(dis-sol);
    cut.restriccionRemanente=cutRule(cut.tipoPedido, dis-sol).condition;
  }
}
function cutCalc(cut){
  var dis=cutParseDecimal(cut.disponibleAntes), sol=cutParseDecimal(cut.metrosSolicitados);
  var rem=(Number.isFinite(dis)&&Number.isFinite(sol))?+(dis-sol).toFixed(2):NaN;
  var rule=cutRule(cut.tipoPedido||"VENTAS",rem);
  return {disponible:dis,solicitado:sol,remanente:rem,rule:rule,hasValues:Number.isFinite(rem)};
}
function cutIsApproved(cut){return cut.approvalStatus==="APROBADO" || cut.approvalRequired===false;}
function cutCanMeasure(cut){var c=cutCalc(cut);return c.hasValues && (!c.rule.requires || cutIsApproved(cut));}
function cutQualityOk(cut){return cut.corteUniforme!==false && cut.tramoRotulado!==false && cut.evidenciaRegistro!==false;}
function cutFinalOk(cut){return !!(cut.fotoInicioUrl && cut.fotoFinalUrl && cut.fotoInicioAt && cut.fotoFinalAt && cut.finishedAt);}
function launchCut(id,cutId){openCutModule(id,cutId);}
function openCutModule(id,cutId){
  var c=caseById(id);if(!c)return;
  var cut=findCut(c,cutId);if(!cut)return;
  var canOperate=state.user&&(normalizeRole(state.user.role)==="auxiliar_corte"||normalizeRole(state.user.role)==="jefe_logistica"||normalizeRole(state.user.role)==="gerencia"||isAdminRoleValue(state.user.role));
  if(!canOperate){alert("No tiene permiso para operar este corte.");return;}
  cut.id=cut.id||uid("CUT");
  cut.code=cut.code||("CT-"+(((c.cutRequests||[]).indexOf(cut)+1)||1));
  cut.caseId=c.id;
  cut.pedido=cut.pedido||c.reference||"";
  cut.cliente=cut.cliente||c.client||"";
  cut.tipoPedido=String(cut.tipoPedido||c.orderKind||"VENTAS").toUpperCase()==="ALUMBRADO"?"ALUMBRADO":"VENTAS";
  cut.takenByUid=cut.takenByUid||state.user.uid;
  cut.takenByName=cut.takenByName||state.user.name;
  cut.takenAt=cut.takenAt||now();
  if(cut.corteUniforme===undefined)cut.corteUniforme=true;
  if(cut.tramoRotulado===undefined)cut.tramoRotulado=true;
  if(cut.evidenciaRegistro===undefined)cut.evidenciaRegistro=true;
  var calc=cutCalc(cut), rule=calc.rule, finished=cutDone(cut.status), started=!!cut.startedAt || cut.status==="EN_CORTE", canMeasure=cutCanMeasure(cut);
  var approvalPending=rule.requires && cut.approvalStatus==="PENDIENTE";
  var waitingApproval=rule.requires && !cutIsApproved(cut);
  var approvalGroup=cutApproverGroup(rule);
  var canApproveNow=approvalPending && userCanApproveCut(rule,cut);
  var canEditOperation=state.user && normalizeRole(state.user.role)==="auxiliar_corte";
  var remText=calc.hasValues?cutNormalizeDecimal(calc.remanente):"";
  var timerText=fmt(cutElapsedMs(cut));
  var statusLabel=(finished?"Finalizado":(started?"En corte":(approvalPending?"Pendiente aprobación":(waitingApproval?"Bloqueado por aprobación":(canMeasure?"Habilitado":"Pendiente")))));
  var conditionHtml=calc.hasValues?'<div class="cut-calc-formula">'+esc(cutNormalizeDecimal(calc.disponible))+' m − '+esc(cutNormalizeDecimal(calc.solicitado))+' m = <span>'+esc(remText)+' m</span></div><div class="cut-calc-rule"><strong>'+esc((cut.tipoPedido==="ALUMBRADO"?"Alumbrado":"Ventas")+": "+rule.condition)+'</strong><br>'+esc(rule.route)+'</div>':'<div class="cut-calc-formula">Disponible − a cortar = <span>Sobrante</span></div><div class="cut-calc-rule">Ingrese disponibilidad y metros a cortar para calcular la restricción.</div>';
  var lockNote=!calc.hasValues?'Ingrese metros disponibles y metros a cortar para habilitar el corte.':(waitingApproval?('<strong>Corte bloqueado.</strong><br>'+esc(rule.message)):(finished?'<strong>Corte finalizado y registrado.</strong>':(started?'<strong>Cronómetro activo.</strong><br>Debe anexar foto final para finalizar.':'<strong>Corte habilitado.</strong><br>Anexe foto inicial para iniciar el cronómetro.')));
  var approvalActions='';
  if(canOperate && !finished){approvalActions+='<button type="button" class="btn btn-gold" data-cut-action="requestApproval">Abrir autorización de corte</button>';}
  if(canOperate && !finished){approvalActions+='<button type="button" class="btn btn-success" data-cut-action="approveCut">Aprobar autorización de corte</button>';}
  if(canApproveNow){approvalActions+='<button type="button" class="btn btn-danger" data-cut-action="rejectCut">Rechazar autorización y enviar a Ventas</button>';}
  var info='<section class="grid grid-3"><article class="card kpi"><span>Pedido</span><strong style="font-size:1.15rem">'+esc(c.reference||cut.pedido||"")+'</strong><small>'+esc(c.client||"")+'</small></article><article class="card kpi"><span>Referencia</span><strong style="font-size:1.15rem">'+esc(cut.referencia||"")+'</strong><small>'+esc(cut.descripcion||"")+'</small></article><article class="card kpi"><span>Tiempo real</span><strong id="cutLiveTimer" style="font-size:1.15rem">'+esc(timerText)+'</strong><small>'+esc(statusLabel)+'</small></article></section>'+pdfDocumentCard(c,true);
  var form='<form class="cut-full form" id="cutFullForm" style="margin-top:16px">'+
    '<fieldset><legend>Datos del corte</legend><div class="cut-grid">'+
      '<label class="field"><span>Tipo de pedido *</span><select class="select" name="tipoPedido" '+(started||finished?'disabled':'')+'><option value="VENTAS" '+(cut.tipoPedido!=="ALUMBRADO"?'selected':'')+'>Ventas</option><option value="ALUMBRADO" '+(cut.tipoPedido==="ALUMBRADO"?'selected':'')+'>Alumbrado</option></select></label>'+
      '<label class="field"><span>Pedido / requerimiento</span><input class="input" name="pedido" value="'+esc(cut.pedido||c.reference||"")+'" readonly></label>'+ 
      '<label class="field"><span>Cable / referencia *</span><input class="input" name="referencia" value="'+esc(cut.referencia||"")+'" required '+(started||finished?'readonly':'')+'></label>'+ 
      '<label class="field"><span>Metros a cortar *</span><input class="input" name="metrosSolicitados" inputmode="decimal" value="'+esc(cut.metrosSolicitados||"")+'" required '+(started||finished?'readonly':'')+'></label>'+ 
    '</div><label class="field"><span>Descripción</span><input class="input" name="descripcion" value="'+esc(cut.descripcion||"")+'" '+(started||finished?'readonly':'')+'></label></fieldset>'+ 
    '<fieldset><legend>Disponibilidad, sobrante y SIESA</legend><div class="cut-grid cut-grid-4">'+
      '<label class="field"><span>Metros disponibles para el corte *</span><input class="input" name="disponibleAntes" inputmode="decimal" value="'+esc(cut.disponibleAntes||"")+'" required '+(started||finished?'readonly':'')+'></label>'+ 
      '<label class="field"><span>Bodega / CO SIESA *</span><input class="input" name="siesaBodega" value="'+esc(cut.siesaBodega||((window.appSettings&&window.appSettings.siesaFlatFile&&window.appSettings.siesaFlatFile.warehouse)||""))+'" placeholder="Ej. Bodega o centro de operación" required '+(started||finished?'readonly':'')+'></label>'+ 
      '<label class="field"><span>Sobrante automático</span><input class="input" id="cutRemanenteInput" value="'+esc(remText)+'" readonly></label>'+ 
      '<label class="field"><span>Condición</span><input class="input" id="cutCondicionInput" value="'+esc(rule.condition||"")+'" readonly></label>'+ 
    '</div><div class="cut-calc '+esc(rule.css)+'" id="cutCalcBox">'+conditionHtml+'</div></fieldset>'+ 
    '<fieldset><legend>Verificación y requerimiento</legend><div class="cut-grid cut-grid-2">'+
      '<label class="field"><span>Responsable del corte</span><input class="input" value="'+esc(cut.takenByName||state.user.name||"")+'" readonly><small>Usuario activo: '+esc(roleTitle(state.user.role))+'</small></label>'+ 
      '<label class="field"><span>Requerimiento a Ventas</span><select class="select" name="motivoVentas"><option value="">Sin requerimiento</option><option '+(cut.motivoVentas==="Cable no disponible en su totalidad para el corte"?'selected':'')+'>Cable no disponible en su totalidad para el corte</option><option '+(cut.motivoVentas==="Chipa con cantidad mayor que se puede vender toda"?'selected':'')+'>Chipa con cantidad mayor que se puede vender toda</option><option '+(cut.motivoVentas==="Mal registro del pedido"?'selected':'')+'>Mal registro del pedido</option><option '+(cut.motivoVentas==="Otros"?'selected':'')+'>Otros</option></select></label>'+ 
    '</div><div class="notice"><strong>Autorización interna obligatoria:</strong> si el sobrante es igual a 50 m autoriza Jefe logístico o Super Admin; si es menor a 50 m autoriza Gerencia o Super Admin. Esta autorización desbloquea el corte. El requerimiento a Ventas es opcional y no debe bloquear el corte.</div><div class="top-actions">'+approvalActions+'</div><label class="field"><span>Observación / razón</span><textarea class="textarea" name="observacion" placeholder="Describa aprobación requerida o requerimiento a Ventas.">'+esc(cut.observacion||cut.requirementDetail||"")+'</textarea></label><div class="top-actions"><button type="button" class="btn" data-cut-action="sendSalesRequirement">Abrir requerimiento a Ventas opcional</button></div><div class="notice cut-status"><strong>Estado calculado:</strong> '+esc(statusLabel)+'<br>'+esc(rule.message)+'</div></fieldset>'+ 
    '<fieldset class="cut-measure '+(!canMeasure?'disabled-section':'')+'"><legend>Medición del corte</legend><div class="notice"><span>🔒</span> '+lockNote+'</div><div class="cut-timer-card"><div id="cutTimerDisplay" class="cut-timer">'+esc(timerText)+'</div><div><strong>Tiempo real del corte</strong><span> Iniciar exige foto inicial. Finalizar exige foto final.</span></div></div><div class="cut-grid cut-grid-4">'+
      '<label class="field"><span>Fecha corte</span><input class="input" name="fechaCorte" value="'+esc(cut.fechaCorte||new Date().toISOString().slice(0,10))+'" readonly></label>'+ 
      '<label class="field"><span>Hora inicio</span><input class="input" value="'+esc(cut.horaInicio||"")+'" readonly></label>'+ 
      '<label class="field"><span>Hora final</span><input class="input" value="'+esc(cut.horaFin||"")+'" readonly></label>'+ 
      '<label class="field"><span>Duración</span><input class="input" value="'+esc(cut.durationText||timerText||"--")+'" readonly></label>'+ 
      '<label class="field"><span>Metraje final</span><input class="input" name="metrajeFinal" inputmode="decimal" value="'+esc(cut.metrajeFinal||cut.metrosSolicitados||"")+'" '+(!started&& !cut.finishedAt?'readonly':'')+'></label>'+ 
      '<label class="field"><span>Sobrante real</span><input class="input" id="cutRealRemInput" value="'+esc(cut.remanenteReal||remText)+'" readonly></label>'+ 
    '</div><div class="cut-checks">'+
      '<label><input type="checkbox" name="corteUniforme" '+(cut.corteUniforme!==false?'checked':'')+'> Corte uniforme</label>'+ 
      '<label><input type="checkbox" name="tramoRotulado" '+(cut.tramoRotulado!==false?'checked':'')+'> Tramo rotulado</label>'+ 
      '<label><input type="checkbox" name="evidenciaRegistro" '+(cut.evidenciaRegistro!==false?'checked':'')+'> Evidencia/registro realizado</label>'+ 
    '</div><div class="cut-grid cut-grid-2">'+
      '<label class="field"><span>Foto inicial obligatoria</span><input class="input" type="file" id="cutInitialPhoto" accept="image/*" capture="environment" '+((!canMeasure||started||finished)?'disabled':'')+'><small>'+(cut.fotoInicioUrl?'Foto inicial cargada: '+fmtDate(cut.fotoInicioAt)+(cut.fotoInicioUrl?' · Drive OK':''):'Seleccione o tome la foto antes de iniciar el corte.')+'</small></label>'+ 
      '<label class="field"><span>Foto final obligatoria</span><input class="input" type="file" id="cutFinalPhoto" accept="image/*" capture="environment" '+((!started||finished)?'disabled':'')+'><small>'+(cut.fotoFinalUrl?'Foto final cargada: '+fmtDate(cut.fotoFinalAt)+(cut.fotoFinalUrl?' · Drive OK':''):'Seleccione o tome la foto antes de finalizar el corte.')+'</small></label>'+ 
    '</div><div class="top-actions"><button type="button" class="btn btn-primary" data-cut-action="startCut" '+((!canMeasure||started||finished)?'disabled':'')+'>Iniciar corte</button><button type="button" class="btn btn-gold" data-cut-action="finishCut" '+((!started||finished)?'disabled':'')+'>Finalizar corte</button><button type="button" class="btn btn-success" data-cut-action="registerCut" '+((!cutFinalOk(cut)||finished)?'disabled':'')+'>Registrar corte</button><button type="button" class="btn" data-cut-action="saveCutDraft">Guardar avance</button></div></fieldset>'+ 
  '</form>';
  drawer(modal("Corte de cable · módulo completo",info+form));
  function refreshPreview(){
    var v=cutValuesFromForm(), dis=cutParseDecimal(v.disponibleAntes), sol=cutParseDecimal(v.metrosSolicitados), rem=(Number.isFinite(dis)&&Number.isFinite(sol))?+(dis-sol).toFixed(2):NaN, r=cutRule(v.tipoPedido,rem);
    var remIn=qs("#cutRemanenteInput"), condIn=qs("#cutCondicionInput"), calcBox=qs("#cutCalcBox"), realIn=qs("#cutRealRemInput");
    if(remIn)remIn.value=Number.isFinite(rem)?cutNormalizeDecimal(rem):"";
    if(condIn)condIn.value=Number.isFinite(rem)?r.condition:"";
    if(realIn){var mf=cutParseDecimal(v.metrajeFinal);realIn.value=(Number.isFinite(dis)&&Number.isFinite(mf))?cutNormalizeDecimal(dis-mf):(Number.isFinite(rem)?cutNormalizeDecimal(rem):"");}
    if(calcBox){calcBox.className="cut-calc "+r.css;calcBox.innerHTML=Number.isFinite(rem)?'<div class="cut-calc-formula">'+esc(cutNormalizeDecimal(dis))+' m − '+esc(cutNormalizeDecimal(sol))+' m = <span>'+esc(cutNormalizeDecimal(rem))+' m</span></div><div class="cut-calc-rule"><strong>'+esc((v.tipoPedido==="ALUMBRADO"?"Alumbrado":"Ventas")+": "+r.condition)+'</strong><br>'+esc(r.route)+'</div>':'<div class="cut-calc-formula">Disponible − a cortar = <span>Sobrante</span></div><div class="cut-calc-rule">Ingrese disponibilidad y metros a cortar para calcular la restricción.</div>';}
  }
  qsa("#cutFullForm input, #cutFullForm select, #cutFullForm textarea").forEach(function(el){el.oninput=refreshPreview;el.onchange=refreshPreview;});
  if(started && !finished){
    window.__cutTimerInterval&&clearInterval(window.__cutTimerInterval);
    window.__cutTimerInterval=setInterval(function(){var t=fmt(cutElapsedMs(cut));var a=qs("#cutLiveTimer"),b=qs("#cutTimerDisplay");if(a)a.textContent=t;if(b)b.textContent=t;},1000);
  }
  qsa("[data-cut-action]").forEach(function(btn){btn.onclick=function(){handleCutAction(c,cut,btn.getAttribute("data-cut-action"));};});
}
function handleCutAction(c,cut,action){
  applyCutFormValues(cut);
  var calc=cutCalc(cut), rule=calc.rule;
  if(action==="saveCutDraft"){
    cut.status=cut.status||"PENDIENTE_CORTE";
    persistCase(c,{type:"CUT_DRAFT_SAVED",detail:"Avance de corte guardado: "+(cut.code||cut.id)}).then(function(){closeDrawer();renderCutsQueue();}).catch(function(e){showError(e.message||e);});
    return;
  }
  if(action==="sendSalesRequirement"){
    var v=cutValuesFromForm(), reason=v.motivoVentas||"", detail=v.observacion||"Requerimiento generado desde corte.";
    if(!reason){alert("El requerimiento a Ventas es opcional. Si necesita enviarlo, seleccione primero un motivo diferente a 'Sin requerimiento'.");return;}
    applyCutRequirementPayload({caseId:c.id,cutId:cut.id,reason:reason,detail:detail,responsable:state.user.name,responsableUid:state.user.uid}).then(function(){closeDrawer();renderCutsQueue();}).catch(function(e){showError(e.message||e);});
    return;
  }
  if(action==="requestApproval"){
    if(!calc.hasValues){alert("Primero registre disponibilidad y metros a cortar.");return;}
    if(!rule.requires){alert("Este corte no requiere aprobación: el sobrante está dentro de política.");return;}
    var group=cutApproverGroup(rule);
    cut.approvalRequired=true;cut.approvalStatus="PENDIENTE";cut.approverRole=group.primary;cut.approverBackupRole=group.backup;cut.approverLabel=group.label;cut.approvalReason=rule.message;cut.status=rule.status;cut.approvalRequestedAt=now();cut.approvalRequestedBy=state.user.uid;cut.approvalRequestedByName=state.user.name;
    c.status=group.primary==="gerencia"?"pendiente_gerencia":"en_espera";c.assignedRole=group.primary;c.assignedName=group.label;c.waitStartedAt=c.waitStartedAt||now();
    persistCase(c,{type:"CUT_APPROVAL_REQUESTED",detail:rule.message+" Autoriza: "+group.label,targetRole:group.primary,visibleRoles:["auxiliar_corte",group.primary,"super_admin","jefe_logistica","gerencia"]}).then(function(){closeDrawer();renderCutsQueue();}).catch(function(e){showError(e.message||e);});
    return;
  }
  if(action==="approveCut"){
    if(!calc.hasValues){alert("Primero registre metros disponibles y metros a cortar para calcular el sobrante.");return;}
    if(!rule.requires){alert("Este corte no requiere aprobación interna: el sobrante está dentro de política.");return;}
    if(!userCanApproveCut(rule,cut)){alert("No tiene permiso para aprobar este corte. Autoriza: "+cutApprovalTargetLabel(rule,cut));return;}
    var groupApprove=cutApproverGroup(rule);
    cut.approvalRequired=true;cut.approverRole=groupApprove.primary;cut.approverBackupRole=groupApprove.backup;cut.approverLabel=groupApprove.label;cut.approvalReason=rule.message;
    cut.approvalStatus="APROBADO";cut.approvedBy=state.user.uid;cut.approvedByName=state.user.name;cut.approvedAt=now();cut.status="APROBADO_PENDIENTE_CORTE";
    stopWait(c);c.status="asignado";c.assignedRole="auxiliar_corte";c.assignedName=roleTitle("auxiliar_corte");c.deadStartedAt=now();
    persistCase(c,{type:"CUT_APPROVED",detail:"Autorización interna de corte aprobada por "+state.user.name+". "+rule.message,visibleRoles:["auxiliar_corte",groupApprove.primary,"super_admin","jefe_logistica","gerencia"]}).then(function(){closeDrawer();openCutModule(c.id,cut.id);}).catch(function(e){showError(e.message||e);});
    return;
  }
  if(action==="rejectCut"){
    if(!userCanApproveCut(rule,cut)){alert("No tiene permiso para rechazar esta autorización. "+cutApprovalTargetLabel(rule,cut));return;}
    cut.approvalStatus="RECHAZADO";cut.rejectedBy=state.user.uid;cut.rejectedByName=state.user.name;cut.rejectedAt=now();cut.status="RECHAZADO";
    applyCutRequirementPayload({caseId:c.id,cutId:cut.id,reason:"Otros",detail:"Aprobación de corte rechazada. Ventas debe revisar o ajustar el pedido.",responsable:state.user.name,responsableUid:state.user.uid}).then(function(){closeDrawer();renderApprovals();}).catch(function(e){showError(e.message||e);});
    return;
  }
  if(action==="startCut"){
    if(!cut.siesaBodega){alert("Debe registrar la Bodega / CO SIESA antes de iniciar el corte.");return;}
    if(!cutCanMeasure(cut)){alert("El corte está bloqueado por cálculo o aprobación pendiente.");return;}
    var file=qs("#cutInitialPhoto")&&qs("#cutInitialPhoto").files&&qs("#cutInitialPhoto").files[0];
    if(!file){alert("Debe anexar foto inicial antes de iniciar el cronómetro.");return;}
    var uploadedAt=now();
    uploadFileToDrive(file,c,{processName:"Corte",processKey:"corte_cable",fileName:(c.reference||"pedido")+"_"+(cut.code||cut.id)+"_foto_inicial_"+file.name,evidenceType:"FOTO_INICIAL_CORTE",cutId:cut.id}).then(function(up){
      cut.fotoInicioUrl=up.url;cut.fotoInicioDriveId=up.fileId;cut.fotoInicioFolder=up.folderPath||up.folder;cut.initialPhotoName=up.fileName||file.name;cut.fotoInicioAt=uploadedAt;cut.fotoInicioByName=state.user.name;
      appendEvidence(c,up,"Foto inicial obligatoria del corte "+(cut.code||cut.id)+". Hora de cargue: "+fmtDate(uploadedAt));
      cut.status="EN_CORTE";cut.startedAt=now();cut.horaInicio=new Date().toTimeString().slice(0,8);cut.fechaCorte=new Date().toISOString().slice(0,10);cut.startedByName=state.user.name;cut.takenByUid=state.user.uid;cut.takenByName=state.user.name;c.hasCuts=true;procStats(c,"corte_cable").startedAt=procStats(c,"corte_cable").startedAt||now();
      return persistCase(c,{type:"CUT_STARTED",detail:"Foto inicial en Drive e inicio de cronómetro: "+(cut.code||cut.id)});
    }).then(function(){closeDrawer();openCutModule(c.id,cut.id);}).catch(function(e){showError(e.message||e);});
    return;
  }
  if(action==="finishCut"){
    if(!cut.startedAt){alert("Primero debe iniciar el corte con foto inicial.");return;}
    var file2=qs("#cutFinalPhoto")&&qs("#cutFinalPhoto").files&&qs("#cutFinalPhoto").files[0];
    if(!file2){alert("Debe anexar foto final antes de finalizar.");return;}
    var uploadedAt2=now();
    uploadFileToDrive(file2,c,{processName:"Corte",processKey:"corte_cable",fileName:(c.reference||"pedido")+"_"+(cut.code||cut.id)+"_foto_final_"+file2.name,evidenceType:"FOTO_FINAL_CORTE",cutId:cut.id}).then(function(up){
      var extra=cut.startedAt?msSince(cut.startedAt):0;cut.durationMs=Number(cut.durationMs||0)+extra;cut.durationText=fmt(cut.durationMs);cut.horaFin=new Date().toTimeString().slice(0,8);cut.finishedAt=now();cut.completedAt=cut.finishedAt;cut.finishedByName=state.user.name;cut.fotoFinalUrl=up.url;cut.fotoFinalDriveId=up.fileId;cut.fotoFinalFolder=up.folderPath||up.folder;cut.finalPhotoName=up.fileName||file2.name;cut.fotoFinalAt=uploadedAt2;cut.fotoFinalByName=state.user.name;cut.startedAt=null;cut.status="PENDIENTE_REGISTRO";
      appendEvidence(c,up,"Foto final obligatoria del corte "+(cut.code||cut.id)+". Hora de cargue: "+fmtDate(uploadedAt2));
      var dis=cutParseDecimal(cut.disponibleAntes), fin=cutParseDecimal(cut.metrajeFinal||cut.metrosSolicitados);if(Number.isFinite(dis)&&Number.isFinite(fin))cut.remanenteReal=cutNormalizeDecimal(dis-fin);
      return persistCase(c,{type:"CUT_FINISHED_PENDING_REGISTER",detail:"Foto final en Drive. Pendiente registrar corte: "+(cut.code||cut.id)+" · "+cut.durationText});
    }).then(function(){closeDrawer();openCutModule(c.id,cut.id);}).catch(function(e){showError(e.message||e);});
    return;
  }
  if(action==="registerCut"){
    if(!cut.siesaBodega){alert("Debe registrar la Bodega / CO SIESA antes de registrar el corte.");return;}
    if(!cutFinalOk(cut)){alert("No se puede registrar sin foto inicial en Drive, foto final en Drive, hora inicial y hora final.");return;}
    if(!cutQualityOk(cut)){alert("Falta confirmar corte uniforme, tramo rotulado y evidencia/registro realizado.");return;}
    cut.status="FINALIZADO";cut.registeredAt=now();cut.siesaExportStatus=cut.siesaExportStatus||"PENDIENTE";cut.registeredBy=state.user.uid;cut.registeredByName=state.user.name;refreshCutStats(c);
    var pending=(c.cutRequests||[]).filter(function(x){return !cutDone(x.status) && x.id!==cut.id;});
    var event={type:"CUT_REGISTERED",detail:"Corte registrado: "+(cut.code||cut.id)+" · "+(cut.durationText||"")};
    if(pending.length===0 && (c.currentProcess==="alistamiento"||c.currentProcess==="corte_cable")){
      stopWait(c);stopActive(c);procStats(c,"corte_cable").completedAt=now();
      c.currentProcess="facturacion";c.status="asignado";c.assignedRole=primaryOwnerRole("facturacion");c.assignedName=processOwnerTitle("facturacion");c.assignedTo="";c.deadStartedAt=now();c.activeStartedAt=null;c.waitStartedAt=null;c.checklist={};processes.facturacion.checklist.forEach(function(x){c.checklist[x]="pending";});if(c.checklist["Compromiso ratificado por facturación"]!==undefined)c.checklist["Compromiso ratificado por facturación"]="pending";
      event.detail+=". Todos los cortes finalizados; pasa a Facturación. La facturación ratifica el compromiso de mercancía.";
    }else{
      c.assignedRole="auxiliar_corte";c.assignedName=roleTitle("auxiliar_corte");c.status="asignado";
    }
    persistCase(c,event).then(function(){closeDrawer();renderCutsQueue();enforceSiesaExportIfNeeded(c);}).catch(function(e){showError(e.message||e);});
    return;
  }
}
function durationToMs(v){var s=String(v||"");var m=s.match(/(\d+):(\d+):(\d+)/);if(m)return ((+m[1])*3600+(+m[2])*60+(+m[3]))*1000;var n=Number(s);return Number.isFinite(n)?n:0;}
function refreshCutStats(c){var cuts=c.cutRequests||[], st=procStats(c,"corte_cable"), total=0, complete=0;cuts.forEach(function(x){total+=durationToMs(x.durationText||x.durationMs);if(["CONFORME","AUTORIZADO","FINALIZADO"].indexOf(x.status)>=0)complete++;});st.activeMs=total;if(cuts.length&&complete===cuts.length){st.completedAt=st.completedAt||now();if(c.checklist&&c.checklist["Cortes terminados o en seguimiento"]!==undefined)c.checklist["Cortes terminados o en seguimiento"]="ok";}}
function normalizeCutRequirementReason(reason){
  var map={CABLE_NO_DISPONIBLE_TOTAL:"Cable no disponible en su totalidad para el corte",CHIPA_MAYOR_VENDER_TODA:"Chipa con cantidad mayor que se puede vender toda",MAL_REGISTRO_PEDIDO:"Mal registro del pedido",OTROS:"Otros"};
  return map[reason]||reason||"Requerimiento generado desde corte";
}
function applyCutRequirementPayload(payload){
  if(!payload||!payload.caseId)return Promise.resolve(false);
  var c=caseById(payload.caseId);if(!c)return Promise.resolve(false);
  var reason=normalizeCutRequirementReason(payload.reasonCode||payload.reason);
  var target="ventas";
  c.requirements=c.requirements||[];
  c.requirements.push({id:uid("REQ"),source:"corte_cable",cutId:payload.cutId||"",reason:reason,reasonCode:payload.reasonCode||"",detail:payload.detail||"",targetRole:target,sentAt:now(),sentByName:payload.responsable||"Auxiliar de corte",status:"pendiente"});
  c.openRequirement={reason:reason,detail:payload.detail||"",targetRole:target,sentAt:now(),sentBy:payload.responsableUid||"",sentByName:payload.responsable||"Auxiliar de corte",returnProcess:c.currentProcess,source:"corte_cable",cutId:payload.cutId||""};
  c.totalRequirements=Number(c.totalRequirements||0)+1;
  c.status=target==="ventas"?"espera_ventas":"en_espera";
  c.assignedRole=target;c.assignedName=roleTitle(target);c.waitStartedAt=c.waitStartedAt||now();
  (c.cutRequests||[]).forEach(function(x){if(x.id===payload.cutId){x.status="REQUERIMIENTO";x.requirementReason=reason;x.requirementDetail=payload.detail||"";}});
  return persistCase(c,{type:"CUT_REQUIREMENT_TO_SALES",reason:reason,detail:payload.detail||"",targetRole:target}).then(function(){return true;});
}
function applyCutBridgePayload(payload){if(!payload||!payload.caseId)return Promise.resolve(false);var c=caseById(payload.caseId);if(!c)return Promise.resolve(false);var cuts=c.cutRequests||[];var cut=cuts.filter(function(x){return x.id===payload.cutId;})[0];if(!cut){cut={id:payload.cutId||uid("CUT"),code:"CT-"+(cuts.length+1),caseId:c.id,pedido:c.reference,referencia:payload.referencia||payload.REFERENCIA_CABLE,metrosSolicitados:payload.metrosSolicitados||payload.METROS_SOLICITADOS,status:"REGISTRADO",createdAt:now()};cuts.push(cut);c.cutRequests=cuts;}cut.status=payload.estadoCorte||payload.ESTADO_CORTE||"FINALIZADO";cut.recordId=payload.recordId||payload.id||"";cut.consecutivo=payload.consecutivo||payload.CONSECUTIVO||"";cut.durationText=payload.duracion||payload.DURACION_CORTE||"";cut.completedAt=now();cut.responsable=payload.responsable||payload.RESPONSABLE_CORTE||"";cut.driveInicialUrl=payload.fotoInicialUrl||payload.FOTO_INICIAL_DRIVE_URL||"";cut.driveFinalUrl=payload.fotoFinalUrl||payload.FOTO_FINAL_DRIVE_URL||"";cut.requerimiento=payload.requerimiento||cut.requerimiento||"";refreshCutStats(c);return persistCase(c,{type:"CUT_SAVED",detail:"Corte guardado: "+(cut.consecutivo||cut.code||cut.id)+" · "+(cut.status||"")}).then(function(){return true;});}
function syncCutBridge(id){
  var c=caseById(id);if(!c)return;
  var raw=localStorage.getItem("ei_trazabilidad_corte_bridge_events");var list=[];
  try{list=JSON.parse(raw||"[]")||[];}catch(e){}
  var pending=list.filter(function(x){return x&&x.caseId===id&&!x.synced;});
  var chain=Promise.resolve();
  pending.forEach(function(ev){
    chain=chain.then(function(){
      var fn=ev.type==="EI_CUT_REQUIREMENT"?applyCutRequirementPayload:applyCutBridgePayload;
      return fn(ev).then(function(){ev.synced=true;});
    });
  });
  chain.then(function(){localStorage.setItem("ei_trazabilidad_corte_bridge_events",JSON.stringify(list.slice(-100)));renderDetail(id);}).catch(function(e){showError(e.message||e);});
}
function renderCutsQueue(){var list=state.cases.filter(function(c){return (c.cutRequests||[]).some(function(x){return ["CONFORME","AUTORIZADO","FINALIZADO"].indexOf(x.status)<0;});});var rows=[];list.forEach(function(c){(c.cutRequests||[]).forEach(function(cut){if(["CONFORME","AUTORIZADO","FINALIZADO"].indexOf(cut.status)>=0)return;rows.push({c:c,cut:cut});});});layout(header("Cortes de cable","Solicitudes generadas desde alistamiento y operadas dentro del mismo Firebase principal. El PDF del pedido queda disponible para consulta antes y durante el corte.",'<button class="btn btn-gold" data-action="exportSiesaCuts">Exportar plano SIESA pendiente</button>')+'<section class="card"><div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>PDF</th><th>Corte</th><th>Referencia</th><th>Metros</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+(rows.length?rows.map(function(r){return'<tr><td>'+esc(r.c.reference)+'</td><td>'+esc(r.c.client||"")+'</td><td>'+pdfMiniButton(r.c)+'</td><td>'+esc(r.cut.code||r.cut.id)+'</td><td>'+esc(r.cut.referencia)+'</td><td>'+esc(r.cut.metrosSolicitados)+'</td><td>'+cutStatusChip(r.cut.status)+'</td><td><button class="btn btn-small btn-primary" data-action="launchCut" data-id="'+esc(r.c.id)+'" data-cut="'+esc(r.cut.id)+'">Abrir corte</button></td></tr>';}).join(""):'<tr><td colspan="8">No hay cortes pendientes.</td></tr>')+'</tbody></table></div></section>');}

function isRequirementVisibleForUser(c){
  if(!state.user)return false;
  if(canSeeAll())return c.status==="espera_ventas"||c.status==="en_espera"||c.openRequirement||(c.requirements&&c.requirements.length);
  var r=state.user.role;
  if(c.openRequirement && c.openRequirement.targetRole===r)return true;
  if(c.assignedRole===r && (c.status==="espera_ventas"||c.status==="en_espera"))return true;
  return (c.requirements||[]).some(function(req){return req.targetRole===r && req.status!=="resuelto";});
}
function visibleRequirements(){
  return state.cases.filter(isRequirementVisibleForUser).sort(function(a,b){return new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt);});
}
function renderRequirements(){
  var title=state.user&&normalizeRole(state.user.role)==="ventas"?"Requerimientos de Ventas":"Requerimientos";
  var subtitle=state.user&&normalizeRole(state.user.role)==="ventas"?"Solicitudes enviadas a Ventas desde corte, alistamiento u otros procesos para corregir o aclarar el pedido.":"Trazabilidad de tiempos de resolución según el módulo responsable.";
  layout(header(title,subtitle)+caseList(visibleRequirements()));
}
function cutApprovalsForRole(){
  var role=state.user?state.user.role:"";
  var nr=normalizeRole(role);
  var rows=[];
  state.cases.forEach(function(c){
    (c.cutRequests||[]).forEach(function(cut){
      var pending=cut.approvalStatus==="PENDIENTE" || cut.status==="PENDIENTE_GERENCIA" || cut.status==="PENDIENTE_JEFE_LOGISTICA" || cut.status==="PENDIENTE_LIDER";
      if(!pending)return;
      var rule=cutRule(cut.tipoPedido||"VENTAS",cutParseDecimal(cut.remanenteProyectado));
      if(nr==="admin" || nr==="super_admin" || userCanApproveCut(rule,cut) || normalizeRole(cut.approverRole)===nr || normalizeRole(c.assignedRole)===nr)rows.push({caseObj:c,cut:cut});
    });
  });
  return rows;
}
function renderApprovals(){
  var cutRows=cutApprovalsForRole();
  var title="Aprobaciones";
  var subtitle="Aprobaciones de remanente, prioridades y requerimientos críticos.";
  var cutHtml=cutRows.length?'<section class="card" style="margin-bottom:16px"><h3>Aprobaciones de corte</h3><div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Corte</th><th>Referencia</th><th>Sobrante</th><th>Solicita</th><th>Acción</th></tr></thead><tbody>'+cutRows.map(function(r){return '<tr><td>'+esc(r.caseObj.reference||"")+'</td><td>'+esc(r.caseObj.client||"")+'</td><td>'+esc(r.cut.code||r.cut.id)+'</td><td>'+esc(r.cut.referencia||"")+'</td><td>'+esc(r.cut.remanenteProyectado||"")+'</td><td>'+esc(r.cut.approverLabel||roleTitle(r.cut.approverRole))+'</td><td><button class="btn btn-small btn-primary" data-action="launchCut" data-id="'+esc(r.caseObj.id)+'" data-cut="'+esc(r.cut.id)+'">Revisar</button></td></tr>';}).join('')+'</tbody></table></div></section>':'';
  var list;
  if(state.user && normalizeRole(state.user.role)==="jefe_logistica"){
    title="Aprobaciones logísticas";
    subtitle="Validaciones de corte igual a 50 m, excepciones y casos detenidos.";
    list=state.cases.filter(function(c){return !c.closedAt && (c.assignedRole==="jefe_logistica" || (c.openRequirement && c.openRequirement.targetRole==="jefe_logistica") || c.priority==="Alta" || c.status==="en_espera" || c.status==="espera_ventas");});
  }else{
    list=state.cases.filter(function(c){return c.status==="pendiente_gerencia";});
  }
  layout(header(title,subtitle)+cutHtml+caseList(list));
}


function bars(items){
  items=(items||[]).filter(function(x){return x&&Number.isFinite(Number(x.value||0));});
  if(!items.length)return '<div class="empty" style="padding:12px">Sin datos suficientes para graficar.</div>';
  var max=items.reduce(function(m,x){return Math.max(m,Number(x.value||0));},0)||1;
  return '<div class="bars">'+items.map(function(x){
    var val=Number(x.value||0);
    var w=clamp((val/max)*100,0,100);
    return '<div class="bar-row"><span>'+esc(x.label||'Sin etiqueta')+'</span><div><b style="width:'+w.toFixed(1)+'%"></b></div><small>'+fmt(val)+'</small></div>';
  }).join('')+'</div>';
}

function modal(title,body){
  return '<section class="modal"><div class="modal-head"><div><h3>'+esc(title||'Detalle')+'</h3></div><button class="btn btn-small" type="button" data-action="closeDrawer">Cerrar</button></div>'+(body||'')+'</section>';
}

function drawer(html){
  var d=qs('#drawer');
  if(!d){d=document.createElement('div');d.id='drawer';d.className='drawer';document.body.appendChild(d);}
  d.innerHTML=html||'';
  d.classList.add('open');
  qsa('[data-action="closeDrawer"]',d).forEach(function(btn){btn.onclick=function(ev){ev.preventDefault();closeDrawer();};});
  d.onclick=function(ev){if(ev.target===d)closeDrawer();};
}

function closeDrawer(){
  var d=qs('#drawer');
  if(!d)return;
  d.classList.remove('open');
  window.setTimeout(function(){if(!d.classList.contains('open'))d.innerHTML='';},120);
}

function renderUsers(){
  if(!canManageUsers()){layout(header("Usuarios","Acceso restringido.")+'<div class="empty">Solo admin y gerencia.</div>');return;}
  var ger=state.users.filter(function(u){return u.role==="gerencia";}).length;
  layout(header("Usuarios","Crear usuarios y asignar roles.",'<button class="btn btn-primary" data-action="userModal">Crear usuario</button>')+'<section class="grid grid-3"><article class="card kpi"><span>Usuarios</span><strong>'+state.users.length+'</strong><small>Perfiles</small></article><article class="card kpi"><span>Gerencia</span><strong>'+ger+'/2</strong><small>Límite</small></article><article class="card kpi"><span>Roles</span><strong>'+uniqueRoles()+'</strong><small>Activos</small></article></section><section class="card" style="margin-top:16px"><h3>Directorio</h3><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead><tbody>'+state.users.map(function(u){return'<tr><td>'+esc(u.name)+'</td><td>'+esc(u.email)+'</td><td>'+esc(roleTitle(u.role))+'</td><td>'+(u.isActive===false?"Inactivo":"Activo")+'</td></tr>';}).join("")+'</tbody></table></div></section>');
}
function uniqueRoles(){var m={};state.users.forEach(function(u){m[u.role]=1;});return Object.keys(m).length;}

function kpiFilteredCases(){
  var f=state.kpiFilters||{from:"",to:"",process:""};
  return state.cases.filter(function(c){
    if(c.excludeFromKpi===true)return false;
    var d=new Date(c.createdAt||c.updatedAt||now());
    if(f.from && d<new Date(f.from+"T00:00:00"))return false;
    if(f.to && d>new Date(f.to+"T23:59:59"))return false;
    if(f.process && !(c.currentProcess===f.process || (c.processStats&&c.processStats[f.process])))return false;
    return true;
  });
}
function caseChecks(c){
  var total=0,bad=0;
  Object.keys(c.checklist||{}).forEach(function(k){var v=c.checklist[k];if(v&&v!=="pending"){total++;if(v==="bad")bad++;}});
  return {total:total,bad:bad};
}
function hasRequirement(c){return Number(c.totalRequirements||0)>0 || ((c.requirements||[]).length>0);}
function cutDoneCount(c){var total=0,done=0;(c.cutRequests||[]).forEach(function(x){total++;if(cutDone(x.status))done++;});return {total:total,done:done};}
function isCancelled(c){return /cancel/i.test(String(c.status||"")) || !!c.cancelledAt;}
function slaDeadline(c){
  var d=new Date(c.createdAt||c.updatedAt||now());
  if(isNaN(d.getTime()))return null;
  var out=new Date(d);
  if(d.getHours()<12){out.setHours(18,0,0,0);}else{out.setDate(out.getDate()+1);out.setHours(12,0,0,0);}
  return out;
}
function closedAtDate(c){return c.closedAt?new Date(c.closedAt):null;}
function slaOk(c){var dl=slaDeadline(c), cl=closedAtDate(c);return !!(dl&&cl&&cl<=dl);}
function isOverdue(c){var dl=slaDeadline(c);return !!(!c.closedAt&&dl&&new Date()>dl);}
function approvalTimes(c){
  var arr=[];(c.cutRequests||[]).forEach(function(x){if(x.approvalRequestedAt&&x.approvedAt){arr.push(new Date(x.approvedAt)-new Date(x.approvalRequestedAt));}});
  return arr.filter(function(x){return Number.isFinite(x)&&x>=0;});
}
function availabilityConfirmed(c){var df=c.documentFlow||{};return df.initialCommitmentStatus==="SI" || df.initialCommitmentStatus==="RATIFICADO" || df.finalCommitmentStatus==="RATIFICADO";}
function orderAccurate(c){var ch=caseChecks(c);return ch.bad===0 && !hasRequirement(c);}
function processRows(data){
  return FLOW.map(function(p){
    var count=0, ac=0, wt=0, dd=0, req=0, cuts=0, finishedCuts=0, wip=0, bad=0, checks=0;
    data.forEach(function(c){
      if(c.processStats&&c.processStats[p]){count++;ac+=Number(c.processStats[p].activeMs||0);wt+=Number(c.processStats[p].waitMs||0);dd+=Number(c.processStats[p].deadMs||0);}
      if(c.currentProcess===p){if(!(c.processStats&&c.processStats[p]))count++; if(!c.closedAt)wip++;}
      if(c.requirements){c.requirements.forEach(function(r){if(r.source===p||r.sourceProcess===p)req++;});}
      var ch=caseChecks(c);checks+=ch.total;bad+=ch.bad;
      if(p==="corte_cable"){(c.cutRequests||[]).forEach(function(x){cuts++;if(cutDone(x.status))finishedCuts++;});}
    });
    var total=ac+wt+dd;
    return{key:p,label:processTitle(p),value:total,count:count,active:ac,wait:wt,dead:dd,requirements:req,cuts:cuts,finishedCuts:finishedCuts,wip:wip,badChecks:bad,totalChecks:checks,avg:count?total/count:0};
  }).filter(function(r){return r.count>0 || r.cuts>0;}).sort(function(a,b){return b.avg-a.avg;});
}
function vsmSummary(data){
  var closed=data.filter(function(c){return c.closedAt&&!isCancelled(c);});
  var open=data.filter(function(c){return !c.closedAt;});
  var allClosed=data.filter(function(c){return c.closedAt;});
  var leadSum=0, va=0, wait=0, dead=0, handoffs=0, rework=0, correctFirst=0, checks=0, bad=0, cutTotal=0, cutDoneN=0, reqCases=0, approvals=[], cancelled=0, avail=0, accurate=0, overdue=0, slaInTime=0;
  data.forEach(function(c){
    var lead=totalMs(c); if(c.closedAt)leadSum+=lead;
    va+=activeMs(c); wait+=waitMs(c); dead+=deadMs(c);
    if(hasRequirement(c)){rework++;reqCases++;}
    if(c.closedAt&&!hasRequirement(c)&&caseChecks(c).bad===0)correctFirst++;
    var ch=caseChecks(c);checks+=ch.total;bad+=ch.bad;
    var cd=cutDoneCount(c);cutTotal+=cd.total;cutDoneN+=cd.done;
    Object.keys(c.processStats||{}).forEach(function(k){handoffs+=Number((c.processStats[k]||{}).handoffs||0);});
    approvalTimes(c).forEach(function(x){approvals.push(x);});
    if(isCancelled(c))cancelled++;
    if(availabilityConfirmed(c))avail++;
    if(orderAccurate(c))accurate++;
    if(isOverdue(c))overdue++;
    if(c.closedAt&&slaOk(c))slaInTime++;
  });
  var periodDays=1;
  if(data.length){
    var dates=data.map(function(c){return new Date(c.createdAt||c.updatedAt||now());}).filter(function(d){return !isNaN(d.getTime());}).sort(function(a,b){return a-b;});
    if(dates.length)periodDays=daysBetweenInclusive(dates[0],new Date());
  }
  var leadTotal=leadSum || data.reduce(function(s,c){return s+totalMs(c);},0);
  var nva=Math.max(0,leadTotal-va-wait);
  var rows=processRows(data);
  var bottleneck=rows.length?rows.slice().sort(function(a,b){return b.avg-a.avg || b.wip-a.wip;})[0]:null;
  return {data:data,closed:closed,allClosed:allClosed,open:open,leadTotal:leadTotal,leadAvg:avgMs(leadSum,closed.length),va:va,wait:wait,dead:dead,nva:nva,vaPct:pct(va,leadTotal),waitPct:pct(wait,leadTotal),wip:open.length,fpy:pct(correctFirst,closed.length),reworkPct:pct(rework,allClosed.length||data.length),bad:bad,checks:checks,badPct:pct(bad,checks),cutTotal:cutTotal,cutDone:cutDoneN,cutPct:pct(cutDoneN,cutTotal),handoffs:handoffs,handoffAvg:closed.length?Number((handoffs/closed.length).toFixed(1)):0,throughput:Number((closed.length/periodDays).toFixed(2)),slaPct:pct(slaInTime,allClosed.length),overdue:overdue,reqPct:pct(reqCases,data.length),approvalAvg:avgMs(approvals.reduce(function(s,x){return s+x;},0),approvals.length),cancelPct:pct(cancelled,data.length),availabilityPct:pct(avail,data.length),accuracyPct:pct(accurate,data.length),bottleneck:bottleneck,rows:rows};
}
function escapeExcel(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function downloadKpiExcel(){
  var data=kpiFilteredCases(), s=vsmSummary(data), rows=s.rows;
  var html='<html><head><meta charset="utf-8"><style>body{font-family:Century Gothic,Arial}h1{color:#061B46}.kpi{font-size:18px;font-weight:bold;color:#061B46}table{border-collapse:collapse;width:100%;margin-bottom:18px}th{background:#061B46;color:white}td,th{border:1px solid #cbd5e1;padding:8px}.note{background:#f8fafc;border:1px solid #cbd5e1;padding:10px}</style></head><body>'+ 
    '<h1>Dashboard VSM · Trazabilidad logística</h1><p>Exportado: '+escapeExcel(new Date().toLocaleString())+'</p>'+ 
    '<div class="note"><strong>Fórmula base:</strong> Lead Time = Tiempo VA + Tiempo NVA + Tiempo de espera. Los porcentajes están limitados a máximo 100%.</div>'+ 
    '<h2>Indicadores generales</h2><table><tr><th>Indicador</th><th>Valor</th><th>Fórmula / criterio</th></tr>'+ 
    '<tr><td>Lead Time promedio</td><td>'+escapeExcel(fmt(s.leadAvg))+'</td><td>Finalización - solicitud / procesos finalizados</td></tr>'+ 
    '<tr><td>% VA</td><td>'+s.vaPct+'%</td><td>Tiempo VA / Lead Time × 100</td></tr>'+ 
    '<tr><td>Tiempo de espera</td><td>'+escapeExcel(fmt(s.wait))+'</td><td>Tiempo acumulado en esperas, bloqueos y requerimientos</td></tr>'+ 
    '<tr><td>% Espera</td><td>'+s.waitPct+'%</td><td>Tiempo espera / Lead Time × 100</td></tr>'+ 
    '<tr><td>WIP</td><td>'+s.wip+'</td><td>Registros abiertos, pendientes, en proceso o en espera</td></tr>'+ 
    '<tr><td>FPY</td><td>'+s.fpy+'%</td><td>Correctos a la primera / finalizados × 100</td></tr>'+ 
    '<tr><td>Reproceso</td><td>'+s.reworkPct+'%</td><td>Procesos con requerimiento / finalizados × 100</td></tr>'+ 
    '<tr><td>No conformidad</td><td>'+s.badPct+'%</td><td>Checks no conformes / checks realizados × 100</td></tr>'+ 
    '<tr><td>Cortes</td><td>'+s.cutDone+'/'+s.cutTotal+' · '+s.cutPct+'%</td><td>Cortes finalizados / cortes solicitados × 100</td></tr>'+ 
    '<tr><td>Handoffs</td><td>'+s.handoffs+'</td><td>Cambios de responsable o etapa</td></tr>'+ 
    '<tr><td>Throughput</td><td>'+s.throughput+'</td><td>Finalizados por día del periodo</td></tr>'+ 
    '<tr><td>Cumplimiento SLA</td><td>'+s.slaPct+'%</td><td>Entregados a tiempo / finalizados × 100</td></tr>'+ 
    '<tr><td>Pedidos vencidos</td><td>'+s.overdue+'</td><td>Abiertos con fecha límite vencida</td></tr>'+ 
    '<tr><td>Tiempo aprobación</td><td>'+escapeExcel(fmt(s.approvalAvg))+'</td><td>Aprobación - solicitud aprobación</td></tr>'+ 
    '<tr><td>Cancelaciones</td><td>'+s.cancelPct+'%</td><td>Cancelados / pedidos recibidos × 100</td></tr>'+ 
    '<tr><td>Disponibilidad</td><td>'+s.availabilityPct+'%</td><td>Pedidos con compromiso confirmado / revisados × 100</td></tr>'+ 
    '<tr><td>Exactitud pedido</td><td>'+s.accuracyPct+'%</td><td>Pedidos sin errores de información / recibidos × 100</td></tr></table>'+ 
    '<h2>VSM por macroproceso</h2><table><tr><th>Macroproceso</th><th>Casos</th><th>WIP</th><th>VA</th><th>Espera</th><th>Muerto/NVA</th><th>Total</th><th>Promedio etapa</th><th>Requerimientos</th><th>Cortes</th><th>Cortes finalizados</th></tr>'+rows.map(function(r){return '<tr><td>'+escapeExcel(r.label)+'</td><td>'+r.count+'</td><td>'+r.wip+'</td><td>'+escapeExcel(fmt(r.active))+'</td><td>'+escapeExcel(fmt(r.wait))+'</td><td>'+escapeExcel(fmt(r.dead))+'</td><td>'+escapeExcel(fmt(r.value))+'</td><td>'+escapeExcel(fmt(r.avg))+'</td><td>'+r.requirements+'</td><td>'+r.cuts+'</td><td>'+r.finishedCuts+'</td></tr>';}).join('')+'</table>'+ 
    '<h2>Casos</h2><table><tr><th>Pedido</th><th>Cliente</th><th>Macroproceso actual</th><th>Estado</th><th>Lead Time</th><th>VA</th><th>Espera</th><th>NVA</th><th>SLA</th><th>Requerimientos</th><th>Cortes</th></tr>'+data.map(function(c){return '<tr><td>'+escapeExcel(c.reference||c.id)+'</td><td>'+escapeExcel(c.client||'')+'</td><td>'+escapeExcel(processTitle(c.currentProcess))+'</td><td>'+escapeExcel(c.status||'')+'</td><td>'+escapeExcel(fmt(totalMs(c)))+'</td><td>'+escapeExcel(fmt(activeMs(c)))+'</td><td>'+escapeExcel(fmt(waitMs(c)))+'</td><td>'+escapeExcel(fmt(Math.max(0,totalMs(c)-activeMs(c)-waitMs(c))))+'</td><td>'+escapeExcel(c.closedAt?(slaOk(c)?'A tiempo':'Fuera SLA'):(isOverdue(c)?'Vencido':'Vigente'))+'</td><td>'+escapeExcel(c.totalRequirements||0)+'</td><td>'+escapeExcel((c.cutRequests||[]).length)+'</td></tr>';}).join('')+'</table>'+ 
    '<h2>Cortes</h2><table><tr><th>Pedido</th><th>Cliente</th><th>Corte</th><th>Referencia</th><th>Metros</th><th>Bodega/CO SIESA</th><th>Estado</th><th>Responsable</th><th>Duración</th><th>Foto inicial</th><th>Foto final</th><th>Lote SIESA</th></tr>'+data.map(function(c){return (c.cutRequests||[]).map(function(x){return '<tr><td>'+escapeExcel(c.reference||'')+'</td><td>'+escapeExcel(c.client||'')+'</td><td>'+escapeExcel(x.code||x.id)+'</td><td>'+escapeExcel(x.referencia||'')+'</td><td>'+escapeExcel(x.metrosSolicitados||'')+'</td><td>'+escapeExcel(x.siesaBodega||'')+'</td><td>'+escapeExcel(x.status||'')+'</td><td>'+escapeExcel(x.takenByName||x.finishedByName||'')+'</td><td>'+escapeExcel(x.durationText||fmt(x.durationMs||0))+'</td><td>'+escapeExcel(x.fotoInicioUrl?'Sí':'No')+'</td><td>'+escapeExcel(x.fotoFinalUrl?'Sí':'No')+'</td><td>'+escapeExcel(x.siesaBatchId||'Pendiente')+'</td></tr>';}).join('');}).join('')+'</table>'+ 
    '</body></html>';
  var blob=new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dashboard_vsm_logistica_'+new Date().toISOString().slice(0,10)+'.xls';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);
}
function bindKpiFilters(){
  var from=qs("#kpiFrom"),to=qs("#kpiTo"),proc=qs("#kpiProcess");
  if(!from||!to||!proc)return;
  from.value=state.kpiFilters.from||"";to.value=state.kpiFilters.to||"";proc.value=state.kpiFilters.process||"";
  [from,to,proc].forEach(function(el){el.onchange=function(){state.kpiFilters.from=from.value;state.kpiFilters.to=to.value;state.kpiFilters.process=proc.value;renderIndicators();};});
}
function siesaSettings(){
  var cfg=(window.appSettings&&window.appSettings.siesaFlatFile)||{};
  return {delimiter:cfg.delimiter||"|",movementCode:cfg.movementCode||"CORTE",warehouse:cfg.warehouse||"",company:cfg.company||"",includeHeader:!!cfg.includeHeader,cutBatchSize:Number(cfg.cutBatchSize||20)};
}
function plainSiesa(v){
  return String(v==null?"":v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\r\n|;]/g," ").trim();
}
function countPendingSiesaCutsInCase(c){
  var n=0;(c.cutRequests||[]).forEach(function(cut){if(cut.status==="FINALIZADO"&&cut.siesaExportStatus!=="EXPORTADO")n++;});return n;
}
function pendingSiesaCuts(){
  var rows=[];
  state.cases.forEach(function(c){
    if(c.excludeFromKpi===true)return;
    (c.cutRequests||[]).forEach(function(cut){
      if(cut.status==="FINALIZADO"&&cut.siesaExportStatus!=="EXPORTADO"){rows.push({caseObj:c,cut:cut});}
    });
  });
  return rows.sort(function(a,b){return new Date(a.cut.registeredAt||a.cut.finishedAt||a.caseObj.updatedAt||0)-new Date(b.cut.registeredAt||b.cut.finishedAt||b.caseObj.updatedAt||0);});
}
function siesaLine(row,batchId){
  var c=row.caseObj, cut=row.cut, cfg=siesaSettings(), d=cfg.delimiter;
  var fields=[
    cfg.movementCode,
    cfg.company,
    cut.siesaBodega||cfg.warehouse,
    c.reference||cut.pedido||"",
    cut.code||cut.id||"",
    (cut.fechaCorte||String(cut.registeredAt||now()).slice(0,10)),
    cut.referencia||"",
    cut.descripcion||"",
    String(cut.metrosFinales||cut.metrosSolicitados||"").replace(",","."),
    "M",
    String(cut.disponibleAntes||"").replace(",","."),
    String(cut.sobranteReal||cut.remanenteProyectado||"").replace(",","."),
    cut.takenByName||cut.finishedByName||"",
    batchId,
    cut.observacion||cut.detail||""
  ];
  return fields.map(plainSiesa).join(d);
}
function downloadTextFile(filename,content,mime){
  var blob=new Blob([content],{type:mime||"text/plain;charset=utf-8"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);
}
function exportSiesaPendingCuts(){
  if(!(state.user&&(normalizeRole(state.user.role)==="auxiliar_corte"||normalizeRole(state.user.role)==="jefe_logistica"||normalizeRole(state.user.role)==="gerencia"||isAdminRoleValue(state.user.role)))){alert("No tiene permiso para exportar planos SIESA.");return;}
  var rows=pendingSiesaCuts();
  if(!rows.length){alert("No hay cortes finalizados pendientes por exportar a SIESA.");return;}
  var cfg=siesaSettings(), batchId="SIESA_"+new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,14);
  var chosen=rows.slice(0,Math.max(cfg.cutBatchSize,rows.length<cfg.cutBatchSize?rows.length:cfg.cutBatchSize));
  if(rows.length<cfg.cutBatchSize && !confirm("Hay "+rows.length+" corte(s) pendiente(s), menos de "+cfg.cutBatchSize+". ¿Exportar de todas formas para actualizar SIESA?"))return;
  var lines=[];
  if(cfg.includeHeader)lines.push(["MOV","EMPRESA","BODEGA","PEDIDO","CORTE","FECHA","REFERENCIA","DESCRIPCION","CANTIDAD","UNIDAD","DISPONIBLE","SOBRANTE","RESPONSABLE","LOTE_EXPORTACION","OBSERVACION"].join(cfg.delimiter));
  chosen.forEach(function(r){lines.push(siesaLine(r,batchId));});
  downloadTextFile("siesa_cortes_"+batchId+".txt",lines.join("\r\n"),"text/plain;charset=utf-8");
  if(confirm("Se descargó el archivo plano. ¿Marcar estos "+chosen.length+" corte(s) como EXPORTADOS a SIESA?")){
    var ps=[];
    chosen.forEach(function(r){r.cut.siesaExportStatus="EXPORTADO";r.cut.siesaBatchId=batchId;r.cut.siesaExportedAt=now();r.cut.siesaExportedBy=state.user.uid;r.cut.siesaExportedByName=state.user.name;ps.push(persistCase(r.caseObj,{type:"SIESA_FLAT_FILE_CUT_EXPORTED",detail:"Corte "+(r.cut.code||r.cut.id)+" exportado en lote "+batchId}));});
    Promise.all(ps).then(function(){return db.collection("siesa_exports").doc(batchId).set({id:batchId,type:"CORTES",createdAt:now(),createdBy:state.user.uid,createdByName:state.user.name,count:chosen.length,fileName:"siesa_cortes_"+batchId+".txt",delimiter:cfg.delimiter,status:"DESCARGADO_MARCADO"}).catch(function(){return null;});}).then(function(){loadData().then(render);}).catch(function(e){showError(e.message||e);});
  }
}
function enforceSiesaExportIfNeeded(c){
  var pending=pendingSiesaCuts();
  var cfg=siesaSettings();
  var casePending=countPendingSiesaCutsInCase(c);
  var allCaseDone=(c.cutRequests||[]).length>0 && (c.cutRequests||[]).every(function(x){return cutDone(x.status);});
  if(pending.length>=cfg.cutBatchSize || (allCaseDone && casePending>0)){
    setTimeout(function(){alert("Hay cortes finalizados pendientes por exportar a SIESA. Se debe descargar el archivo plano antes de seguir acumulando registros.");exportSiesaPendingCuts();},300);
  }
}

function renderIndicators(){
  if(!canSeeKpis()){layout(header("Indicadores","Acceso restringido.")+'<div class="empty">Los KPIs consolidados solo están disponibles para jefe logístico, gerencia y super admin. Rol detectado: '+esc(state.user?state.user.role:'sin sesión')+'</div>');return;}
  var data=kpiFilteredCases(), s=vsmSummary(data), rows=s.rows;
  var filterHtml='<section class="card" style="margin-bottom:16px"><div class="grid grid-3"><label class="field"><span>Desde</span><input class="input" type="date" id="kpiFrom"></label><label class="field"><span>Hasta</span><input class="input" type="date" id="kpiTo"></label><label class="field"><span>Macroproceso</span><select class="select" id="kpiProcess"><option value="">Todos</option>'+FLOW.map(function(p){return'<option value="'+p+'">'+esc(processTitle(p))+'</option>';}).join('')+'</select></label></div></section>';
  var bottleneck=s.bottleneck?esc(s.bottleneck.label):"Sin datos";
  var cards=[
    ["Lead Time prom.",fmt(s.leadAvg),"Finalización - solicitud"],
    ["% VA",s.vaPct+"%","Tiempo valor agregado / Lead Time"],
    ["Tiempo espera",fmt(s.wait),"Lead Time - VA visible por esperas"],
    ["% Espera",s.waitPct+"%","Espera / Lead Time"],
    ["WIP",s.wip,"Abiertos, pendientes o en espera"],
    ["FPY",s.fpy+"%","Correctos a la primera"],
    ["Reproceso",s.reworkPct+"%","Con requerimientos o correcciones"],
    ["No conformidad",s.badPct+"%","Checks no conformes"],
    ["Cortes",s.cutDone+"/"+s.cutTotal,"Avance "+s.cutPct+"%"],
    ["Handoffs",s.handoffs,"Promedio "+s.handoffAvg],
    ["Throughput",s.throughput,"Finalizados por día"],
    ["SLA",s.slaPct+"%","Entregados a tiempo"],
    ["Vencidos",s.overdue,"Abiertos fuera de plazo"],
    ["% Requerimientos",s.reqPct+"%","Procesos con novedad"],
    ["T. aprobación",fmt(s.approvalAvg),"Promedio autorizaciones"],
    ["Cancelaciones",s.cancelPct+"%","Cancelados / recibidos"],
    ["Disponibilidad",s.availabilityPct+"%","Compromiso confirmado"],
    ["Exactitud pedido",s.accuracyPct+"%","Sin errores ni requerimientos"]
  ];
  layout(header("Dashboard VSM y KPIs","Indicadores por módulo, fecha, cuello de botella, tiempos, requerimientos y cortes. Todos los porcentajes se controlan sobre máximo 100%.",'<button class="btn btn-primary" data-action="exportKpiExcel">Exportar informe Excel</button><button class="btn btn-gold" data-action="exportSiesaCuts">Exportar plano SIESA cortes</button>')+filterHtml+
    '<section class="grid grid-4">'+cards.map(function(c){return'<article class="card kpi"><span>'+esc(c[0])+'</span><strong style="font-size:1.45rem">'+esc(c[1])+'</strong><small>'+esc(c[2])+'</small></article>';}).join('')+'</section>'+ 
    '<section class="grid grid-2" style="margin-top:16px"><article class="chart-card"><div class="chart-title">Cuello de botella principal</div><div class="notice"><strong>'+bottleneck+'</strong><br>Se calcula comparando tiempo promedio por etapa y WIP acumulado.</div>'+bars(rows.map(function(r){return {label:r.label,value:r.avg};}))+'</article><article class="chart-card"><div class="chart-title">VA · NVA · Espera</div>'+bars([{label:"VA",value:s.va},{label:"Espera",value:s.wait},{label:"NVA",value:s.nva},{label:"Tiempo muerto",value:s.dead}])+'</article></section>'+ 
    '<section class="card" style="margin-top:16px"><h3>Tabla VSM por macroproceso</h3><div class="table-wrap"><table><thead><tr><th>Macroproceso</th><th>Casos</th><th>WIP</th><th>VA</th><th>Espera</th><th>NVA/Muerto</th><th>Total</th><th>Promedio etapa</th><th>Req.</th><th>Cortes</th><th>Cuello</th></tr></thead><tbody>'+rows.map(function(r,i){return'<tr><td>'+esc(r.label)+'</td><td>'+r.count+'</td><td>'+r.wip+'</td><td>'+fmt(r.active)+'</td><td>'+fmt(r.wait)+'</td><td>'+fmt(r.dead)+'</td><td>'+fmt(r.value)+'</td><td>'+fmt(r.avg)+'</td><td>'+r.requirements+'</td><td>'+r.finishedCuts+'/'+r.cuts+'</td><td>'+(s.bottleneck&&s.bottleneck.key===r.key?'Principal':'—')+'</td></tr>';}).join("")+'</tbody></table></div></section>');
  bindKpiFilters();
}

function startActive(c){
  if(c.deadStartedAt){procStats(c,c.currentProcess).deadMs+=msSince(c.deadStartedAt);}
  c.deadStartedAt=null;c.activeStartedAt=now();c.status="en_proceso";c.assignedTo=state.user.uid;c.assignedName=state.user.name;addStateHistory(c,"valor","Inicio de trabajo en "+processTitle(c.currentProcess),{tipo_estado:"valor",fecha_hora_inicio_estado:c.activeStartedAt});
}
function stopActive(c){
  if(c.activeStartedAt){procStats(c,c.currentProcess).activeMs+=msSince(c.activeStartedAt);}
  c.activeStartedAt=null;
}
function stopWait(c){
  if(c.waitStartedAt){procStats(c,c.currentProcess).waitMs+=msSince(c.waitStartedAt);}
  c.waitStartedAt=null;
}
function assignToProcess(c,next,detail){
  var current=c.currentProcess;
  stopActive(c);stopWait(c);
  procStats(c,current).completedAt=now();
  addStateHistory(c,"handoff","Cambio de etapa: "+processTitle(current)+" → "+processTitle(next),{fromProcess:current,toProcess:next,fecha_hora_fin_estado:procStats(c,current).completedAt,tipo_estado:"valor"});
  c.currentProcess=next;c.status="asignado";c.assignedRole=primaryOwnerRole(next);c.assignedName=processOwnerTitle(next);c.assignedTo="";c.deadStartedAt=now();c.activeStartedAt=null;c.waitStartedAt=null;c.openRequirement=null;c.checklist={};
  var s=procStats(c,next);s.startedAt=s.startedAt||now();s.handoffs=Number(s.handoffs||0)+1;
  processes[next].checklist.forEach(function(x){c.checklist[x]="pending";});
  if(next==="alistamiento")applyAlistamientoAutoChecklist(c);
  return persistCase(c,{type:"TRANSFER_SENT",detail:detail||("Relevo a "+processTitle(next))});
}

function openEvidence(id){
  var c=caseById(id);if(!c)return;
  if(!canUploadEvidenceForCase(c)){alert("Este usuario no tiene permiso para anexar evidencias en este caso.");return;}
  var current=c.currentProcess||"recepcion_pedidos";
  drawer(modal("Subir evidencia a Drive",'<form class="form" id="evidenceForm"><div class="notice">La evidencia se guarda en Google Drive con la misma cuenta autorizada por Google Cloud. La carpeta se crea por año, mes, proceso, responsable, pedido, caso y tipo de evidencia.</div><section class="grid grid-2"><label class="field"><span>Proceso / módulo de la evidencia</span><select class="select" name="processKey" id="evidenceProcessSelect">'+evidenceProcessOptions(current)+'</select></label><label class="field"><span>Tipo de evidencia</span><select class="select" name="evidenceType" id="evidenceTypeSelect">'+evidenceTypeOptions()+'</select></label></section><label class="field"><span>Archivo o foto</span><input class="input" type="file" name="evidence" id="evidenceInput" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv" required></label><label class="field"><span>Descripción</span><textarea class="textarea" name="detail" placeholder="Ej.: PDF del pedido, foto del carro, soporte de despacho, guía, novedad, evidencia de alistamiento, soporte de caja o auditoría."></textarea></label><div class="notice" id="evidenceStatus">Seleccione el archivo y guarde. No se registra en el caso hasta que Drive confirme el cargue.</div><button class="btn btn-primary" type="submit">Guardar evidencia en Drive</button></form>'));
  var processSelect=qs("#evidenceProcessSelect"), typeSelect=qs("#evidenceTypeSelect");
  if(typeSelect)typeSelect.value=defaultEvidenceTypeForProcess(current);
  if(processSelect && typeSelect){processSelect.onchange=function(){typeSelect.value=defaultEvidenceTypeForProcess(processSelect.value);};}
  qs("#evidenceForm").onsubmit=function(e){
    e.preventDefault();
    var fd=new FormData(e.target), file=qs("#evidenceInput").files&&qs("#evidenceInput").files[0];
    if(!file){alert("Seleccione una evidencia.");return;}
    var processKey=fd.get("processKey")||c.currentProcess;
    var evidenceType=fd.get("evidenceType")||defaultEvidenceTypeForProcess(processKey);
    var statusEl=qs("#evidenceStatus");if(statusEl)statusEl.textContent="Subiendo evidencia a Drive...";
    uploadFileToDrive(file,c,{processName:processTitle(processKey),processKey:processKey,fileName:file.name,evidenceType:evidenceType}).then(function(up){
      appendEvidence(c,up,fd.get("detail")||"");
      return persistCase(c,{type:"PROCESS_EVIDENCE_UPLOADED",process:processKey,detail:(fd.get("detail")||file.name)+" · "+processTitle(processKey)+" · "+evidenceType}).then(function(){return persistEvidenceDocument(c,up,fd.get("detail")||"");});
    }).then(function(){closeDrawer();renderDetail(c.id);}).catch(function(err){if(statusEl)statusEl.textContent="No fue posible cargar la evidencia: "+(err.message||err);showError(err.message||err);});
  };
}

function openWait(id){
  var c=caseById(id), def=processes[c.currentProcess];
  drawer(modal("Requerimiento / espera",'<form class="form" id="waitForm"><label class="field"><span>Motivo</span><select class="select" name="reason">'+def.waits.map(function(w){return'<option>'+esc(w)+'</option>';}).join("")+'</select></label><label class="field"><span>Área responsable</span><select class="select" name="role"><option value="ventas">Ventas</option><option value="coordinador_logistico">Logística / despacho</option><option value="jefe_logistica">Jefe de logística</option><option value="aux_logistica">Auxiliar logística</option><option value="gerencia">Gerencia</option></select></label><label class="field"><span>Detalle</span><textarea class="textarea" name="detail"></textarea></label><button class="btn btn-primary" type="submit">Enviar requerimiento</button></form>'));
  qs("#waitForm").onsubmit=function(e){e.preventDefault();var fd=new FormData(e.target);stopActive(c);c.status=fd.get("role")==="ventas"?"espera_ventas":"en_espera";c.waitStartedAt=now();addStateHistory(c,"espera",fd.get("reason")+" · "+(fd.get("detail")||""),{tipo_estado:"espera",motivo_novedad:fd.get("reason"),fecha_hora_inicio_estado:c.waitStartedAt});c.assignedRole=fd.get("role");c.assignedName=roleTitle(fd.get("role"));c.openRequirement={reason:fd.get("reason"),detail:fd.get("detail"),targetRole:fd.get("role"),sentAt:now(),sentBy:state.user.uid,returnProcess:c.currentProcess};c.totalRequirements=Number(c.totalRequirements||0)+1;persistCase(c,{type:"REQUIREMENT_SENT",reason:fd.get("reason"),detail:fd.get("detail"),targetRole:fd.get("role")}).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});};
}
function openAnswer(id){
  var c=caseById(id);
  drawer(modal("Responder / resolver requerimiento",'<form class="form" id="ansForm"><label class="field"><span>Respuesta</span><textarea class="textarea" name="detail" required></textarea></label><button class="btn btn-primary" type="submit">Resolver y devolver al proceso</button></form>'));
  qs("#ansForm").onsubmit=function(e){
    e.preventDefault();
    var fd=new FormData(e.target);
    var req=c.openRequirement||null;
    var ret=req?req.returnProcess:c.currentProcess;
    stopWait(c);
    if(req && c.requirements){
      c.requirements.forEach(function(r){
        var sameCut=(req.cutId&&r.cutId===req.cutId)||(!req.cutId&&!r.cutId);
        if(r.status!=="resuelto" && r.targetRole===req.targetRole && sameCut){
          r.status="resuelto";
          r.answeredAt=now();
          r.answeredBy=state.user.uid;
          r.answeredByName=state.user.name;
          r.answer=fd.get("detail");
        }
      });
    }
    c.currentProcess=ret;c.status="en_proceso";c.assignedRole=primaryOwnerRole(ret);c.assignedName=processOwnerTitle(ret);c.activeStartedAt=now();c.openRequirement=null;
    persistCase(c,{type:"REQUIREMENT_ANSWERED",detail:fd.get("detail")}).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});
  };
}

function setChecklistValues(c, values){
  c.checklist=c.checklist||{};
  Object.keys(values||{}).forEach(function(k){if(c.checklist[k]!==undefined)c.checklist[k]=values[k];});
}
function openInitialCommitment(id){
  var c=caseById(id);if(!c)return;
  var pdf=casePdfUrl(c)?'<a class="btn btn-small" href="'+esc(casePdfUrl(c))+'" target="_blank" rel="noopener">Abrir PDF del pedido</a>':'<span class="chip warning">PDF pendiente</span>';
  drawer(modal("Compromiso inicial de mercancía",'<form class="form" id="initialCommitForm"><div class="notice">Este módulo es el segundo paso del flujo. Revise el PDF, confirme que se bloqueó/comprometió la mercancía en SIESA/ERP y luego envíe el pedido a alistamiento.</div>'+pdf+'<section class="grid grid-2"><label class="check-card"><input type="checkbox" name="pdfOk"> PDF corresponde al pedido</label><label class="check-card"><input type="checkbox" name="itemsOk"> Referencias y cantidades revisadas</label><label class="check-card"><input type="checkbox" name="commitOk"> Mercancía comprometida/bloqueada</label><label class="check-card"><input type="checkbox" name="noCancel"> Sin devolución ni cancelación pendiente</label></section><label class="field"><span>Resultado</span><select class="select" name="result" required><option value="COMPROMETIDO">Comprometer y enviar a alistamiento</option><option value="REQUERIMIENTO_VENTAS">Generar requerimiento a Ventas</option><option value="CANCELADO">Cancelar / terminar proceso</option></select></label><label class="field"><span>Detalle / observación</span><textarea class="textarea" name="detail" placeholder="Ej.: mercancía comprometida en SIESA, pedido parcial, devolución, cancelación o ajuste requerido."></textarea></label><button class="btn btn-primary" type="submit">Guardar compromiso</button></form>'));
  qs("#initialCommitForm").onsubmit=function(e){
    e.preventDefault();var fd=new FormData(e.target), result=fd.get("result"), detail=fd.get("detail")||"";
    c.documentFlow=c.documentFlow||{};
    if(!receptionPdfIsComplete(c) && result==="COMPROMETIDO"){alert("No puede comprometer mercancía si Recepción no cargó, leyó y guardó el PDF oficial con líneas detectadas.");return;}
    if(result==="CANCELADO"){
      stopActive(c);stopWait(c);c.status="cancelado";c.closedAt=now();c.documentFlow.initialCommitmentStatus="CANCELADO";c.documentFlow.initialCommitmentDetail=detail;addStateHistory(c,"cancelacion",detail||"Cancelado en compromiso inicial",{tipo_estado:"cancelacion",motivo_novedad:detail});
      persistCase(c,{type:"INITIAL_COMMITMENT_CANCELLED",detail:detail}).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});return;
    }
    if(result==="REQUERIMIENTO_VENTAS"){
      stopActive(c);c.status="espera_ventas";c.waitStartedAt=now();c.assignedRole="ventas";c.assignedName=roleTitle("ventas");c.openRequirement={reason:"Requiere corrección de Ventas",detail:detail,targetRole:"ventas",sentAt:now(),sentBy:state.user.uid,returnProcess:"compromiso_mercancia"};c.totalRequirements=Number(c.totalRequirements||0)+1;c.documentFlow.initialCommitmentStatus="REQUERIMIENTO_VENTAS";c.documentFlow.initialCommitmentDetail=detail;addStateHistory(c,"espera",detail||"Requerimiento a Ventas desde compromiso inicial",{tipo_estado:"espera",motivo_novedad:"Requerimiento a Ventas"});
      persistCase(c,{type:"INITIAL_COMMITMENT_REQUIREMENT",detail:detail,targetRole:"ventas"}).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});return;
    }
    if(!fd.get("pdfOk")||!fd.get("itemsOk")||!fd.get("commitOk")||!fd.get("noCancel")){alert("Para comprometer debe confirmar todos los checks del compromiso inicial.");return;}
    c.documentFlow.initialCommitmentStatus="SI";c.documentFlow.initialCommitmentDetail=detail||"Mercancía comprometida/bloqueada en SIESA/ERP";c.documentFlow.initialCommitmentAt=now();c.documentFlow.initialCommitmentBy=state.user.name;
    setChecklistValues(c,{"Pedido recibido desde recepción":"ok","PDF revisado contra pedido":"ok","Pedido correcto para comprometer":"ok","Referencias principales identificadas":"ok","Cantidades revisadas":"ok","Cortes automáticos identificados si aplica":"ok","Mercancía comprometida/bloqueada en SIESA/ERP":"ok","Novedades de devolución o cancelación descartadas":"ok","Pedido liberado para alistamiento":"ok"});
    assignToProcess(c,"alistamiento",detail||"Compromiso inicial realizado; pedido pasa a alistamiento").then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});
  };
}
function openRatificationCommitment(id){
  var c=caseById(id);if(!c)return;
  var cuts=cutDoneCount(c);
  var pendingCuts=cuts.total-cuts.done;
  var pdf=casePdfUrl(c)?'<a class="btn btn-small" href="'+esc(casePdfUrl(c))+'" target="_blank" rel="noopener">Abrir PDF del pedido</a>':'<span class="chip warning">PDF pendiente</span>';
  drawer(modal("Ratificar compromiso antes de facturar",'<form class="form" id="ratifyCommitForm"><div class="notice">Antes de facturar se confirma que el compromiso inicial sigue válido, que el producto es el correcto y que no hay devolución, cancelación o corte pendiente.</div>'+pdf+(pendingCuts>0?'<div class="notice danger"><strong>Atención:</strong> hay '+pendingCuts+' corte(s) pendiente(s). No debería ratificarse hasta finalizar cortes.</div>':'')+'<section class="grid grid-2"><label class="check-card"><input type="checkbox" name="productOk"> Era el producto correcto</label><label class="check-card"><input type="checkbox" name="refOk"> Referencia correcta contra PDF</label><label class="check-card"><input type="checkbox" name="qtyOk"> Cantidad correcta</label><label class="check-card"><input type="checkbox" name="unitOk"> Unidad de medida correcta</label><label class="check-card"><input type="checkbox" name="cutsOk" '+(pendingCuts>0?'':'checked')+'> Cortes finalizados si aplica</label><label class="check-card"><input type="checkbox" name="noCancel"> Sin devolución ni cancelación</label></section><label class="field"><span>Resultado</span><select class="select" name="result" required><option value="RATIFICADO">Ratificar compromiso y enviar a facturación</option><option value="REQUERIMIENTO_VENTAS">Generar requerimiento a Ventas</option><option value="CANCELADO">Cancelar / terminar proceso</option></select></label><label class="field"><span>Detalle / observación</span><textarea class="textarea" name="detail" placeholder="Ej.: compromiso ratificado, devolución detectada, producto diferente, cantidad incorrecta o cancelación."></textarea></label><button class="btn btn-primary" type="submit">Guardar ratificación</button></form>'));
  qs("#ratifyCommitForm").onsubmit=function(e){
    e.preventDefault();var fd=new FormData(e.target), result=fd.get("result"), detail=fd.get("detail")||"";
    c.documentFlow=c.documentFlow||{};
    if(result==="RATIFICADO" && pendingCuts>0){alert("No puede ratificar si hay cortes pendientes por finalizar.");return;}
    if(result==="CANCELADO"){
      stopActive(c);stopWait(c);c.status="cancelado";c.closedAt=now();c.documentFlow.finalCommitmentStatus="CANCELADO";c.documentFlow.finalCommitmentDetail=detail;addStateHistory(c,"cancelacion",detail||"Cancelado en ratificación de compromiso",{tipo_estado:"cancelacion",motivo_novedad:detail});
      persistCase(c,{type:"FINAL_COMMITMENT_CANCELLED",detail:detail}).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});return;
    }
    if(result==="REQUERIMIENTO_VENTAS"){
      stopActive(c);c.status="espera_ventas";c.waitStartedAt=now();c.assignedRole="ventas";c.assignedName=roleTitle("ventas");c.openRequirement={reason:"Diferencia en ratificación de compromiso",detail:detail,targetRole:"ventas",sentAt:now(),sentBy:state.user.uid,returnProcess:"ratificacion_compromiso"};c.totalRequirements=Number(c.totalRequirements||0)+1;c.documentFlow.finalCommitmentStatus="REQUERIMIENTO_VENTAS";c.documentFlow.finalCommitmentDetail=detail;addStateHistory(c,"espera",detail||"Requerimiento a Ventas desde ratificación",{tipo_estado:"espera",motivo_novedad:"Requerimiento a Ventas"});
      persistCase(c,{type:"FINAL_COMMITMENT_REQUIREMENT",detail:detail,targetRole:"ventas"}).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});return;
    }
    if(!fd.get("productOk")||!fd.get("refOk")||!fd.get("qtyOk")||!fd.get("unitOk")||!fd.get("cutsOk")||!fd.get("noCancel")){alert("Para ratificar debe confirmar todas las preguntas del chequeo final.");return;}
    c.documentFlow.finalCommitmentStatus="RATIFICADO";c.documentFlow.finalCommitmentDetail=detail||"Compromiso ratificado antes de facturar";c.documentFlow.finalCommitmentAt=now();c.documentFlow.finalCommitmentBy=state.user.name;
    setChecklistValues(c,{"Alistamiento validado":"ok","Cortes finalizados si aplica":"ok","Producto correcto contra PDF":"ok","Referencia correcta":"ok","Cantidad correcta":"ok","Unidad de medida correcta":"ok","Sin devolución pendiente":"ok","Sin cancelación pendiente":"ok","Compromiso inicial revisado":"ok","Compromiso ratificado en SIESA/ERP":"ok","Pedido listo para facturación":"ok"});
    assignToProcess(c,"facturacion",detail||"Compromiso ratificado; pedido pasa a facturación").then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});
  };
}
function openDeliveryEvidence(id,key){
  var c=caseById(id);if(!c)return;
  if(!isDeliveryProcess(c.currentProcess)){alert("Las evidencias obligatorias de entrega solo aplican en módulos de entrega/despacho.");return;}
  if(!(canAccessProcess(state.user.role,c.currentProcess)||isAdminRoleValue(state.user.role)||isJefeLogistica())){alert("No tiene permiso para anexar evidencias en este proceso.");return;}
  var defs=deliveryEvidenceDefinitions(c.currentProcess);
  var def=defs.filter(function(x){return x.key===key;})[0]||defs[0];
  drawer(modal(def.title,'<form class="form" id="deliveryEvidenceForm"><div class="notice"><strong>'+(def.required===false?'Opcional:':'Control obligatorio:')+'</strong> '+esc(def.hint)+' El archivo quedará en Drive con fecha, hora, usuario, pedido y proceso.</div><label class="field"><span>'+esc(def.title)+'</span><input class="input" type="file" name="photo" accept="'+esc(def.accept||'image/*,application/pdf')+'" required></label><label class="field"><span>Observación</span><textarea class="textarea" name="detail" placeholder="Ej.: mercancía rotulada con sticker visible, guía de transportadora, soporte PDF o entrega final."></textarea></label><div class="notice" id="deliveryEvidenceStatus">Seleccione el archivo y guarde. No se marca conforme hasta que Drive confirme el cargue.</div><button class="btn btn-primary" type="submit">Guardar evidencia</button></form>'));
  qs("#deliveryEvidenceForm").onsubmit=function(e){
    e.preventDefault();
    var fd=new FormData(e.target), file=e.target.photo.files&&e.target.photo.files[0];
    if(!file){alert("Seleccione el archivo o evidencia requerida.");return;}
    c.deliveryEvidence=c.deliveryEvidence||{};
    if(def.key==="guiaTransportadora" && !(c.deliveryEvidence.mercanciaRotulada&&c.deliveryEvidence.mercanciaRotulada.driveUrl)){alert("Primero debe subir la foto de mercancía rotulada. Esa evidencia marca el cierre operativo de logística y la espera de transportadora/entrega.");return;}
    var statusEl=qs("#deliveryEvidenceStatus");if(statusEl)statusEl.textContent="Subiendo evidencia a Drive...";
    var safeName=(c.reference||"pedido")+"_"+def.type+"_"+file.name;
    uploadFileToDrive(file,c,{processName:processTitle(c.currentProcess),processKey:c.currentProcess,fileName:safeName,evidenceType:def.type}).then(function(up){
      c.deliveryEvidence=c.deliveryEvidence||{};
      c.deliveryEvidence[def.key]={driveUrl:up.url||up.driveUrl||"",fileName:up.fileName||up.name||file.name,fileId:up.fileId||"",uploadedAt:up.uploadedAt||now(),uploadedBy:state.user.uid,uploadedByName:state.user.name,evidenceType:def.type,process:c.currentProcess,detail:fd.get("detail")||def.hint};
      c.checklist=c.checklist||{};
      c.checklist[def.checklist]="ok";
      c.deliveryFlow=c.deliveryFlow||{};
      var eventType="DELIVERY_EVIDENCE_UPLOADED";
      var eventDetail=def.title+" · "+(fd.get("detail")||"");
      if(def.key==="mercanciaRotulada"){
        stopActive(c);
        if(!c.waitStartedAt)c.waitStartedAt=now();
        c.status="espera_transportadora";
        c.deliveryFlow.logisticsCompletedAt=c.deliveryFlow.logisticsCompletedAt||c.deliveryEvidence[def.key].uploadedAt;
        c.deliveryFlow.logisticsCompletedBy=state.user.name;
        c.deliveryFlow.waitingCarrierSince=c.deliveryFlow.waitingCarrierSince||now();
        if(c.checklist["Logística finalizada, espera transportadora"]!==undefined)c.checklist["Logística finalizada, espera transportadora"]="ok";
        if(c.checklist["Logística finalizada, espera transportadora/entrega"]!==undefined)c.checklist["Logística finalizada, espera transportadora/entrega"]="ok";
        eventType="LOGISTICS_READY_FOR_CARRIER";
        eventDetail="Mercancía rotulada cargada. Termina el tiempo operativo de logística y queda en espera de transportadora/entrega.";
      }
      if(def.key==="guiaTransportadora"){
        stopActive(c);stopWait(c);
        if(c.deadStartedAt){procStats(c,c.currentProcess).deadMs+=msSince(c.deadStartedAt);c.deadStartedAt=null;}
        procStats(c,c.currentProcess).completedAt=now();
        c.status="cerrado_conforme";
        c.closedAt=now();
        c.deliveryFlow.guideUploadedAt=c.deliveryEvidence[def.key].uploadedAt;
        c.deliveryFlow.guideUploadedBy=state.user.name;
        c.deliveryFlow.closedByGuide=true;
        if(c.checklist["Cierre de despacho registrado"]!==undefined)c.checklist["Cierre de despacho registrado"]="ok";
        if(c.checklist["Proceso cerrado"]!==undefined)c.checklist["Proceso cerrado"]="ok";
        addStateHistory(c,"cierre","Cierre de despacho por guía/soporte final cargado",{tipo_estado:"cierre",fecha_hora_fin_estado:c.closedAt});
        eventType="CASE_CLOSED";
        eventDetail="Despacho cerrado con guía/soporte final obligatorio.";
      }
      appendEvidence(c,up,fd.get("detail")||def.title);
      return persistCase(c,{type:eventType,process:c.currentProcess,detail:eventDetail}).then(function(){return persistEvidenceDocument(c,up,fd.get("detail")||def.title);});
    }).then(function(){closeDrawer();renderDetail(c.id);}).catch(function(err){if(statusEl)statusEl.textContent="No fue posible cargar la evidencia: "+(err.message||err);showError(err.message||err);});
  };
}

function openDelivery(id){
  var c=caseById(id);
  var isCaja = c.currentProcess === "caja";
  var title = isCaja ? "Confirmar caja y enviar a despacho" : "Definir facturación y ruta de entrega";
  var typeField = isCaja ? "" : '<label class="field"><span>Tipo de pedido</span><select class="select" name="billingType" required><option value="PVC">PVC · continúa facturación logística</option><option value="NO_PVC">No es PVC · relevar a caja</option></select></label>';
  drawer(modal(title,'<form class="form" id="delForm">'+typeField+'<label class="field"><span>Tipo de entrega</span><select class="select" name="next" required><option value="cliente_punto">Cliente en punto · Coordinador</option><option value="cliente_recoge">Cliente recoge · Coordinador</option><option value="despacho_local">Despacho local · Coordinador</option><option value="despacho_nacional">Despacho nacional · Logística / despacho</option></select></label><label class="field"><span>Observación</span><textarea class="textarea" name="detail"></textarea></label><button class="btn btn-primary" type="submit">Continuar flujo</button></form>'));
  qs("#delForm").onsubmit=function(e){
    e.preventDefault();
    var fd=new FormData(e.target), next=fd.get("next"), billingType=fd.get("billingType")||"CAJA_OK";
    c.deliveryType=next;
    if(c.currentProcess==="facturacion"){c.documentFlow=c.documentFlow||{};c.documentFlow.finalCommitmentStatus="RATIFICADO_POR_FACTURACION";c.documentFlow.finalCommitmentDetail=(fd.get("detail")||"") || "Al facturar se ratifica el compromiso de mercancía.";c.documentFlow.finalCommitmentAt=now();c.documentFlow.finalCommitmentBy=state.user.name;if(c.checklist&&c.checklist["Compromiso ratificado por facturación"]!==undefined)c.checklist["Compromiso ratificado por facturación"]="ok";}
    if(!isCaja && billingType==="NO_PVC"){
      c.pendingDeliveryType=next;
      c.billingType="NO_PVC";
      assignToProcess(c,"caja",fd.get("detail")||"Facturación identifica No PVC y releva a caja").then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});
      return;
    }
    if(isCaja && c.pendingDeliveryType){ next=c.pendingDeliveryType; c.pendingDeliveryType=""; }
    c.billingType=billingType;
    assignToProcess(c,next,fd.get("detail")||((isCaja?"Caja libera y envía a ":"Facturación define ")+processTitle(next))).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});
  };
}
function openClose(id){
  var c=caseById(id);
  if(isDeliveryProcess(c.currentProcess) && !deliveryEvidenceComplete(c)){alert("No puede cerrar el despacho/entrega. Faltan evidencias obligatorias: "+deliveryEvidenceMissingText(c));return;}
  drawer(modal("Cerrar caso",'<form class="form" id="closeForm"><label class="field"><span>Resultado</span><select class="select" name="status"><option value="cerrado_conforme">Cerrado conforme</option><option value="cerrado_con_novedad">Cerrado con novedad</option><option value="cancelado">Cancelado</option></select></label><label class="field"><span>Detalle</span><textarea class="textarea" name="detail"></textarea></label><button class="btn btn-success" type="submit">Cerrar</button></form>'));
  qs("#closeForm").onsubmit=function(e){e.preventDefault();var fd=new FormData(e.target);stopActive(c);stopWait(c);if(c.deadStartedAt){procStats(c,c.currentProcess).deadMs+=msSince(c.deadStartedAt);c.deadStartedAt=null;}procStats(c,c.currentProcess).completedAt=now();c.status=fd.get("status");c.closedAt=now();addStateHistory(c,c.status==="cancelado"?"cancelacion":"cierre",fd.get("detail")||c.status,{tipo_estado:c.status==="cancelado"?"cancelacion":"cierre",fecha_hora_fin_estado:c.closedAt});persistCase(c,{type:"CASE_CLOSED",detail:fd.get("detail")}).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});};
}
function openSupervisorNote(id){
  var c=caseById(id);
  drawer(modal("Observación jefe de logística",'<form class="form" id="supForm"><label class="field"><span>Tipo de intervención</span><select class="select" name="type"><option value="SUPERVISION">Seguimiento</option><option value="APPROVAL">Aprobación logística</option><option value="EXCEPTION">Excepción autorizada</option><option value="REASSIGNMENT_NOTE">Nota de reasignación</option><option value="RISK">Riesgo de atraso</option></select></label><label class="field"><span>Detalle</span><textarea class="textarea" name="detail" required></textarea></label><button class="btn btn-primary" type="submit">Registrar trazabilidad</button></form>'));
  qs("#supForm").onsubmit=function(e){
    e.preventDefault();
    var fd=new FormData(e.target);
    c.supervisionNotes=c.supervisionNotes||[];
    c.supervisionNotes.push({type:fd.get("type"),detail:fd.get("detail"),by:state.user.uid,byName:state.user.name,at:now()});
    persistCase(c,{type:"LOGISTICS_CHIEF_"+fd.get("type"),detail:fd.get("detail")}).then(function(){closeDrawer();renderDetail(id);}).catch(function(e){showError(e.message||e);});
  };
}

function openCertificateModal(){
  var version=(window.appSettings&&window.appSettings.version)||"Sistema de trazabilidad logística";
  drawer(modal("Certificado de creación",'<section class="certificate-card"><div class="certificate-inner"><div class="certificate-ribbon">Certificado profesional de creación funcional</div><img class="certificate-logo" src="'+esc(logoPath)+'" alt="Electroingeniería"><h2>Sistema de Trazabilidad Logística y Control Operativo</h2><p class="certificate-lead">Se certifica que el presente aplicativo fue concebido, estructurado y promovido por:</p><h1>Juan Esteban Pérez</h1><p>Como autor funcional del sistema, incluyendo su enfoque operativo, flujo de procesos, trazabilidad documental, control de evidencias, módulos de corte, indicadores VSM/KPIs y estructura de seguimiento gerencial.</p><div class="certificate-meta"><span><b>Aplicativo:</b> Trazabilidad Logística EI</span><span><b>Versión:</b> '+esc(version)+'</span><span><b>Fecha:</b> '+esc(new Date().toLocaleDateString("es-CO"))+'</span><span><b>Uso:</b> Interno / operativo / gerencial</span></div><img class="certificate-gif" src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzk2bDF5cW0yNm5xeDQwa2pzNW40bzFqMnIxYnh3ZjJ3aXYwMWdnZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/YaP3iYxN3T8nIEN5rD/giphy.gif" alt="GIF de autoría"><div class="certificate-seal">Creación funcional · Juan Esteban Pérez</div><div class="certificate-actions"><button class="btn btn-primary" data-action="printCertificate">Imprimir / guardar PDF</button><button class="btn" data-action="closeDrawer">Cerrar</button></div></div></section>'));
}

function openUserModal(){
  var ger=state.users.filter(function(u){return u.role==="gerencia";}).length;
  drawer(modal("Crear usuario",'<form class="form" id="uForm"><label class="field"><span>Nombre</span><input class="input" name="name" required></label><label class="field"><span>Correo</span><input class="input" name="email" type="email" required></label><label class="field"><span>Contraseña temporal</span><input class="input" name="password" type="password" required minlength="6"></label><label class="field"><span>Rol</span><select class="select" name="role">'+Object.keys(roles).filter(function(r){return r!=="lider_logistico";}).map(function(r){return'<option value="'+r+'" '+(r==="gerencia"&&ger>=2?"disabled":"")+'>'+esc(roles[r])+(r==="gerencia"?" · "+ger+"/2":"")+'</option>';}).join("")+'</select></label><button class="btn btn-primary" type="submit">Crear</button></form>'));
  qs("#uForm").onsubmit=function(e){e.preventDefault();createUser(new FormData(e.target));};
}
function createUser(fd){
  var name=fd.get("name"),email=fd.get("email"),pass=fd.get("password"),role=fd.get("role");
  if(role==="gerencia"&&state.users.filter(function(u){return u.role==="gerencia";}).length>=2){alert("Solo se permiten dos usuarios de gerencia.");return;}
  var second=firebase.initializeApp(window.firebaseConfig,"creator_"+Date.now());
  second.auth().createUserWithEmailAndPassword(email,pass).then(function(cred){
    return db.collection("users").doc(cred.user.uid).set({name:name,email:email,role:role,isActive:true,createdAt:now(),createdBy:state.user.uid});
  }).then(function(){
    return createEvent({type:"USER_CREATED",detail:"Usuario creado: "+name+" · "+roleTitle(role),targetRole:"admin",visibleRoles:["admin","super_admin","super_administrador","gerencia"]}).catch(function(){return null;});
  }).then(function(){return second.auth().signOut();}).then(function(){return second.delete();}).then(function(){return loadData();}).then(function(){closeDrawer();renderUsers();}).catch(function(e){showError(e.message||e);});
}
function approve(id){
  var c=caseById(id);stopWait(c);c.status="asignado";c.assignedRole="coordinador_logistico";c.assignedName="Logística / despacho";c.deadStartedAt=now();c.priority="Alta";c.managerApproved=true;if(c.priorityApproval)c.priorityApproval.status="aprobado";persistCase(c,{type:"MANAGER_APPROVED",detail:"Gerencia aprobó prioridad. Pasa a logística primero."}).then(function(){renderApprovals();}).catch(function(e){showError(e.message||e);});
}
function reject(id){
  var c=caseById(id);stopWait(c);c.status="cancelado";c.closedAt=now();if(c.priorityApproval)c.priorityApproval.status="rechazado";persistCase(c,{type:"MANAGER_REJECTED",detail:"Gerencia rechazó prioridad"}).then(function(){renderApprovals();}).catch(function(e){showError(e.message||e);});
}
function accept(id){var c=caseById(id);startActive(c);persistCase(c,{type:"CASE_ACCEPTED",detail:"Caso aceptado por "+state.user.name}).then(function(){renderDetail(id);}).catch(function(e){showError(e.message||e);});}
function transfer(id,next){
  var c=caseById(id);
  if(c.currentProcess==="recepcion_pedidos" && next!=="alistamiento"){alert("El flujo obligatorio es: Recepción de pedidos → Alistamiento. El compromiso de mercancía se registra dentro de Recepción.");return;}
  if(next==="alistamiento" && !receptionPdfIsComplete(c)){alert("Recepción no puede avanzar: debe cargar el PDF oficial, leerlo correctamente, guardarlo en Drive, detectar las líneas del pedido y confirmar que la mercancía fue comprometida.");return;}
  if(c.currentProcess==="alistamiento" && next!=="facturacion"){alert("Después de alistamiento el flujo continúa directamente a Facturación. Si hay cortes, primero deben quedar registrados.");return;}
  if(c.currentProcess==="alistamiento" && next==="facturacion"){var cd=cutDoneCount(c);if(cd.total>0 && cd.done<cd.total){alert("No puede enviar a facturación: hay cortes pendientes por finalizar y registrar.");return;}}
  assignToProcess(c,next,"Relevo a "+processTitle(next)).then(function(){renderDetail(id);}).catch(function(e){showError(e.message||e);});
}
function updateCheck(el){
  var seg=el.parentNode,id=seg.getAttribute("data-id"),item=seg.getAttribute("data-check"),val=el.getAttribute("data-value"),c=caseById(id);
  if(c.currentProcess==="recepcion_pedidos"){alert("En Recepción el checklist se llena automáticamente con la lectura del PDF. Cargue/relea el PDF para actualizarlo.");return;}
  if(c.currentProcess==="alistamiento" && /pedido recibido|referencia|descripci|cantidad|unidad|corte/i.test(item)){alert("Ese checklist se calcula desde las líneas detectadas del PDF y los cortes. Use el PDF/cortes para actualizarlo.");return;}
  if(isDeliveryProcess(c.currentProcess) && /foto antes|mercancía subida|mercancia subida|carro cerrado|entrega final/i.test(item)){alert("Este punto se actualiza automáticamente al subir la foto obligatoria de entrega a Drive.");return;}
  c.checklist[item]=val;persistCase(c,{type:"CHECK_UPDATED",detail:item+": "+val}).then(function(){renderDetail(id);}).catch(function(e){showError(e.message||e);});
}
function clearPwaCache(){if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){if(r.active)r.active.postMessage({type:"CLEAR_CACHE"});r.update();});setTimeout(function(){location.reload();},700);}).catch(function(){location.reload();});}else location.reload();}


var reminderMemory = {};

function canNotify(){
  return "Notification" in window;
}

function requestNotifications(){
  if(!canNotify()){alert("Este navegador no soporta notificaciones.");return;}
  Notification.requestPermission().then(function(){notifyUser("Notificaciones activadas","Recibirás avisos de asignaciones, cambios de etapa, evidencias, requerimientos, cortes, cierres, aprobaciones, entregas y exportaciones SIESA.",true);});
}

function playBeep(){
  try{
    var AC=window.AudioContext||window.webkitAudioContext;
    var ctx=new AC();
    var osc=ctx.createOscillator();
    var gain=ctx.createGain();
    osc.type="sine";
    osc.frequency.value=880;
    gain.gain.setValueAtTime(0.0001,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22,ctx.currentTime+0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.34);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime+0.36);
  }catch(e){}
}

function notifyUser(title,msg,force){
  playBeep();
  if(canNotify()&&Notification.permission==="granted"){
    try{new Notification(title,{body:msg,icon:"./assets/app-icon.svg",badge:"./assets/app-icon.svg"});}catch(e){}
  }
  if(force){alert(title+"\\n"+msg);}
}

function reminderCheck(){
  if(!state.user||!state.cases.length)return;
  var visible=visibleCases().filter(function(c){return !c.closedAt;});
  visible.forEach(function(c){
    var key="", msg="", title="";
    if(c.status==="asignado"&&c.deadStartedAt&&msSince(c.deadStartedAt)>10*60*1000){
      key=c.id+"_asignado_10";
      title="Caso asignado sin aceptar";
      msg=(c.reference||c.id)+" lleva más de 10 minutos asignado en "+processTitle(c.currentProcess)+".";
    }else if(c.status==="en_proceso"&&c.activeStartedAt&&msSince(c.activeStartedAt)>30*60*1000){
      key=c.id+"_proceso_30";
      title="Recordatorio de proceso";
      msg=(c.reference||c.id)+" lleva más de 30 minutos en "+processTitle(c.currentProcess)+".";
    }else if((c.status==="en_espera"||c.status==="espera_ventas")&&c.waitStartedAt&&msSince(c.waitStartedAt)>20*60*1000){
      key=c.id+"_espera_20";
      title="Requerimiento en espera";
      msg=(c.reference||c.id)+" tiene un requerimiento pendiente por más de 20 minutos.";
    }
    if(key&&!reminderMemory[key]){
      reminderMemory[key]=true;
      notifyUser(title,msg,false);
    }
  });
}

function startReminderLoop(){
  if(window.__eiReminderLoop)return;
  window.__eiReminderLoop=setInterval(reminderCheck,60000);
  setTimeout(reminderCheck,4000);
}


function openMobileMenu(){
  var m=qs("#mobileMenu");
  if(m)m.classList.add("open");
}

function closeMobileMenu(){
  var m=qs("#mobileMenu");
  if(m)m.classList.remove("open");
}

function canUseAdminPanel(){return state.user && (canSeeAll() || canManageUsers());}
function canDeleteAdminData(){return state.user && isAdminRoleValue(state.user.role);}
function renderAdmin(){
  if(!canUseAdminPanel()){layout(header("Admin","Acceso restringido.")+'<div class="empty">Solo jefe logístico, gerencia, admin o super admin pueden abrir este módulo.</div>');return;}
  var total=state.cases.length, excl=state.cases.filter(function(c){return c.excludeFromKpi===true;}).length;
  var rows=state.cases.slice().sort(function(a,b){return new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0);}).slice(0,150).map(function(c){
    return '<tr><td>'+esc(c.reference||c.id)+'</td><td>'+esc(c.client||'')+'</td><td>'+esc(processTitle(c.currentProcess))+'</td><td>'+statusChip(c.status)+'</td><td>'+esc(c.excludeFromKpi?'Excluido':'Incluido')+'</td><td><button class="btn btn-small" data-action="toggleKpiCase" data-id="'+esc(c.id)+'">'+(c.excludeFromKpi?'Incluir VSM':'Excluir VSM')+'</button> '+(canDeleteAdminData()?'<button class="btn btn-small btn-danger" data-action="deleteCase" data-id="'+esc(c.id)+'">Eliminar</button>':'')+'</td></tr>';
  }).join('');
  layout(header("Admin","Limpieza de pruebas, control de VSM y mantenimiento operativo.",'<button class="btn btn-gold" data-action="migrateLegacy">Corregir procesos legacy</button><button class="btn btn-gold" data-action="clearPwa">Limpiar caché PWA</button>')+
    '<section class="grid grid-4"><article class="card kpi"><span>Casos</span><strong>'+total+'</strong><small>Total en base</small></article><article class="card kpi"><span>Excluidos VSM</span><strong>'+excl+'</strong><small>No afectan indicadores</small></article><article class="card kpi"><span>Usuarios</span><strong>'+state.users.length+'</strong><small>Perfiles cargados</small></article><article class="card kpi"><span>Rol</span><strong>'+esc(roleTitle(state.user.role))+'</strong><small>Permisos activos</small></article></section>'+ 
    '<section class="card" style="margin-top:16px"><div class="section-title"><div><h3>Casos y pruebas</h3><p>Use excluir para limpiar indicadores sin borrar evidencia. Eliminar borra caso, eventos y evidencias asociadas; úselo solo para pruebas.</p></div></div><div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Proceso</th><th>Estado</th><th>VSM</th><th>Acción</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">No hay casos.</td></tr>')+'</tbody></table></div></section>');
}
function toggleCaseKpi(id){
  var c=caseById(id);if(!c)return;
  if(!canUseAdminPanel()){alert("No tiene permiso para administrar indicadores.");return;}
  c.excludeFromKpi=!c.excludeFromKpi;
  c.excludeFromKpiAt=now();c.excludeFromKpiBy=state.user.uid;c.excludeFromKpiByName=state.user.name;
  persistCase(c,{type:c.excludeFromKpi?"CASE_EXCLUDED_FROM_VSM":"CASE_INCLUDED_IN_VSM",detail:c.excludeFromKpi?"Caso excluido de VSM/KPIs":"Caso incluido nuevamente en VSM/KPIs"}).then(function(){renderAdmin();}).catch(function(e){showError(e.message||e);});
}
function deleteQueryBatch(col, field, value){
  return db.collection(col).where(field,"==",value).get().then(function(snap){
    var ps=[];snap.forEach(function(doc){ps.push(doc.ref.delete());});return Promise.all(ps);
  }).catch(function(){return Promise.resolve();});
}
function deleteCaseHard(id){
  if(!canDeleteAdminData()){alert("Solo admin o super admin pueden eliminar definitivamente.");return;}
  var c=caseById(id);if(!c)return;
  if(!confirm("¿Eliminar definitivamente el caso "+(c.reference||id)+"? Esta acción es solo para pruebas y no se puede deshacer."))return;
  Promise.all([deleteQueryBatch("case_events","caseId",id),deleteQueryBatch("evidences","caseId",id),deleteQueryBatch("requirements","caseId",id)])
    .then(function(){return db.collection("cases").doc(id).delete();})
    .then(function(){return createEvent({type:"CASE_DELETED_ADMIN",detail:"Caso eliminado de pruebas: "+(c.reference||id),targetRole:"admin",visibleRoles:["admin","super_admin","super_administrador","gerencia","jefe_logistica"]}).catch(function(){return null;});})
    .then(function(){state.cases=state.cases.filter(function(x){return x.id!==id;});state.events=state.events.filter(function(x){return x.caseId!==id;});renderAdmin();})
    .catch(function(e){showError((e&&e.message)||e||"No se pudo eliminar. Revise reglas de Firestore para admin/super admin.");});
}

function bindActions(){
  qsa("[data-action]").forEach(function(b){b.onclick=function(){var a=b.getAttribute("data-action"),id=b.getAttribute("data-id");
    if(a==="logout"){stopRealtimeSync();sessionStorage.removeItem(storageKey+"_session");if(auth)auth.signOut().catch(function(){});state.user=null;renderLogin();}
    if(a==="migrateLegacy")migrateLegacyProcessesNow();
    if(a==="open")renderDetail(id);
    if(a==="accept")accept(id);
    if(a==="wait")openWait(id);
    if(a==="evidence")openEvidence(id);
    if(a==="answer")openAnswer(id);
    if(a==="delivery")openDelivery(id);
    if(a==="deliveryEvidence")openDeliveryEvidence(id,b.getAttribute("data-delivery-evidence"));
    if(a==="certificate")openCertificateModal();
    if(a==="printCertificate")window.print();
    if(a==="initialCommit")openInitialCommitment(id);
    if(a==="ratifyCommit")openRatificationCommitment(id);
    if(a==="transfer")transfer(id,b.getAttribute("data-next"));
    if(a==="close")openClose(id);
    if(a==="approve")approve(id);
    if(a==="reject")reject(id);
    if(a==="userModal")openUserModal();
    if(a==="check")updateCheck(b);
    if(a==="clearPwa")clearPwaCache();
    if(a==="openMobileMenu")openMobileMenu();
    if(a==="closeMobileMenu")closeMobileMenu();
    if(a==="closeDrawer")closeDrawer();
    if(a==="supervise")openSupervisorNote(id);
    if(a==="receptionPdf")openReceptionPdf(id);
    if(a==="planCuts")openCutsPlanner(id);
    if(a==="launchCut")launchCut(id,b.getAttribute("data-cut"));
    if(a==="syncCuts")syncCutBridge(id);
    if(a==="notifyOn")requestNotifications();
    if(a==="exportKpiExcel")downloadKpiExcel();
    if(a==="exportSiesaCuts")exportSiesaPendingCuts();
    if(a==="toggleKpiCase")toggleCaseKpi(id);
    if(a==="deleteCase")deleteCaseHard(id);
  };});
}

function render(){
  if(!state.user){renderLogin();return;}
  if(state.route==="vsm"||state.route==="kpis"||state.route==="indicadores")state.route="indicators";
  if(state.route==="administracion"||state.route==="administrador")state.route="admin";
  startReminderLoop();
  if(state.route==="corte_cable"){renderCutsQueue();return;}
  if(processes[state.route]){state.filters.process=state.route;renderCases();return;}
  if(state.route==="dashboard")renderDashboard();
  else if(state.route==="cases")renderCases();
  else if(state.route==="create")renderCreate();
  else if(state.route==="requirements")renderRequirements();
  else if(state.route==="approvals")renderApprovals();
  else if(state.route==="indicators")renderIndicators();
  else if(state.route==="users")renderUsers();
  else if(state.route==="admin")renderAdmin();
  else renderDashboard();
}

window.addEventListener("message",function(event){
  var data=event.data||{};
  if(!data)return;
  if(data.type==="EI_CUT_REQUIREMENT"){applyCutRequirementPayload(data.payload||data).then(function(){render();}).catch(function(e){showError(e.message||e);});return;}
  if(data.type!=="EI_CUT_SAVED")return;
  applyCutBridgePayload(data.payload||data).then(function(){render();}).catch(function(e){showError(e.message||e);});
});

function boot(){
  try{
    showLoading("Conectando Firebase y verificando sesión...");
    initFirebaseAsync().then(function(){
      if(!firebaseReady || !auth){renderLogin();return;}
      showLoading("Verificando sesión de Firebase...");
      auth.onAuthStateChanged(function(fbUser){
        if(!fbUser){
          sessionStorage.removeItem(storageKey+"_session");
          state.user=null;
          renderLogin();
          return;
        }
        loadProfileAndRender(fbUser).catch(function(e){
          sessionStorage.removeItem(storageKey+"_session");
          state.user=null;
          showError(e.message||e);
        });
      },function(e){showError(e.message||e);});
    }).catch(function(e){
      firebaseReady=false;
      firebaseInitError=e.message||String(e);
      renderLogin();
    });
  }catch(e){showError(e.message||e);}
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();

})();
