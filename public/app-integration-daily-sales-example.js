/*
 * Compatibilidad V79: el antiguo panel "Ventas Diarias" se reemplaza por "Registro de Ventas".
 * Este archivo se conserva para no romper referencias anteriores, pero debe migrarse a
 * app-integration-registro-ventas-example.js.
 */

LogisticaSalesRegistryPanel.configure({
  db,
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  collectionName: 'cases',
  orderByField: 'createdAt',
  sortDescending: true,
  patchLegacyUpdater: true,
  autoSubscribe: false,
  toast: (message, type) => {
    if (typeof showToast === 'function') return showToast(message, type);
    if (typeof toast === 'function') return toast(message, type);
    console.log(`[${type || 'info'}] ${message}`);
  }
});

async function actualizarRegistroVentasCompleto() {
  return LogisticaSalesRegistryPanel.update({});
}
