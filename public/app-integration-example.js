/*
  Ejemplo de integración para app.js.
  NO reemplaza tu app.js completo. Copia este bloque al final del app.js real,
  ajustando nombres si tus variables Firebase tienen otro nombre.
*/

// Si tu app ya tiene import modular de Firestore, usa las mismas variables:
// import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore';

window.LogisticaFoundFlow.configure({
  db,
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  collectionName: 'cases',
  billingProcess: 'facturacion',
  billingAssignedRole: 'facturacion',
  logisticsProcess: 'recepcion_logistica',
  currentUserProvider: () => window.currentUser || window.authUser || {},
  toast: (message, type) => {
    if (typeof window.toast === 'function') return window.toast(message, type);
    if (typeof window.showToast === 'function') return window.showToast(message, type);
    console.log(`[${type || 'ok'}] ${message}`);
  },
  refresh: async () => {
    if (typeof window.renderAll === 'function') return window.renderAll();
    if (typeof window.loadCases === 'function') return window.loadCases();
    if (typeof window.refrescarVistaActual === 'function') return window.refrescarVistaActual();
  }
});

// Reemplazo seguro de botones antiguos si tenían onclick.
window.marcarEncontradoSeguro = (caseId, itemId, button) => {
  return window.LogisticaFoundFlow.markFound({ caseId, itemId, button });
};

window.marcarNoEncontradoSeguro = (caseId, itemId, button, observacion = '') => {
  return window.LogisticaFoundFlow.markNotFound({ caseId, itemId, button, observacion });
};

// Si renderizas HTML dinámico, puedes usar:
// LogisticaFoundFlow.renderMobileButtons({ caseId: pedido.id, itemId: item.id })
// o botones con data attributes y autoBind:
window.LogisticaFoundFlow.autoBind();
