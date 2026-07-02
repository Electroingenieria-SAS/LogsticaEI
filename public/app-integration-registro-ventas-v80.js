/*
 * Integración recomendada V80.
 * Pegar después de inicializar Firebase/Firestore y después del app.js principal.
 */
LogisticaRegistroVentasForceV80.configure({
  db,
  collection,
  getDocs,
  query,
  orderBy,
  // Usar la colección real. Si en tu app los registros de venta están en cases, dejar cases.
  collectionName: 'cases',
  collectionCandidates: ['cases', 'ventas', 'pedidos', 'orders'],
  patchLegacyFunctions: true,
  captureRefreshButton: true,
  autoPatchDom: true,
  autoRunOnLoad: false,
  toast: (message, type) => {
    if (typeof showToast === 'function') return showToast(message, type);
    if (typeof toast === 'function') return toast(message, type);
    console.log(`[${type || 'info'}] ${message}`);
  }
});

// Llamada manual desde cualquier botón si se requiere:
async function actualizarRegistroVentasCompleto() {
  return LogisticaRegistroVentasForceV80.updateAll({ source: 'manual' });
}
