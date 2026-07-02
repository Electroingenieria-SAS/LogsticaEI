/*
 * Integración sugerida — Hotfix V79 Registro de Ventas
 * Pegar después de inicializar Firebase/Firestore y después de cargar logistica-sales-registry-panel-fix.js.
 * Ajusta collectionName si tu colección real no se llama 'cases'.
 */

LogisticaSalesRegistryPanel.configure({
  db,
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,

  // Cambiar si la app guarda ventas en otra colección: 'ventas', 'pedidos', 'dailySales', etc.
  collectionName: 'cases',

  // Solo ordena. No limita cantidad y no filtra por fecha.
  orderByField: 'createdAt',
  sortDescending: true,

  // Parchea funciones viejas para que "actualizar ventas diarias" ahora cargue TODO el Registro de Ventas.
  patchLegacyUpdater: true,

  // Enciende actualización en tiempo real si el panel debe refrescar solo.
  autoSubscribe: false,

  toast: (message, type) => {
    if (typeof showToast === 'function') return showToast(message, type);
    if (typeof toast === 'function') return toast(message, type);
    console.log(`[${type || 'info'}] ${message}`);
  }
});

// Llamar cuando abras el módulo o cuando el usuario presione Actualizar.
// Carga TODOS los registros de ventas disponibles. No usa filtro por día.
async function actualizarRegistroVentasCompleto() {
  return LogisticaSalesRegistryPanel.update({});
}
