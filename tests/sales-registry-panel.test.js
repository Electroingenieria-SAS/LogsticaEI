const assert = require('assert');
require('../public/logistica-sales-registry-panel-fix.js');

const panel = globalThis.LogisticaSalesRegistryPanel;

async function runSalesRegistryPanelQA() {
  const rows = [
    { id: 'PV-001', fechaVenta: '2026-07-02', cliente: 'Cliente A', asesor: 'Duvan', valor: 100000, estado: 'registrada' },
    { id: 'PV-002', fechaVenta: '2026-07-02', cliente: 'Cliente B', asesor: 'Javier', valor: 200000, estado: 'registrada' },
    { id: 'PV-003', fechaVenta: '2026-07-01', cliente: 'Cliente C', asesor: 'Duvan', valor: 300000, estado: 'registrada' },
    { id: 'PV-004', fechaVenta: '2026-06-29', cliente: 'Cliente D', asesor: 'Javier', valor: 400000, estado: 'registrada' },
    { id: 'PV-005', fechaVenta: '2026-06-15', cliente: 'Cliente E', asesor: 'Duvan', valor: 500000, estado: 'registrada' },
    { id: 'PV-NODATE', cliente: 'Cliente sin fecha', asesor: 'Ventas', valor: 600000, estado: 'registrada' },
    { id: 'PV-DEL', fechaVenta: '2026-07-02', cliente: 'Eliminado', asesor: 'Duvan', valor: 1, eliminado: true }
  ];

  panel.configure({ toast: () => null });

  const result = await panel.update({ sourceRows: rows });
  assert.strictEqual(result.length, 6, 'Debe mostrar todos los registros no eliminados, incluyendo fechas diferentes y registros sin fecha.');
  assert.deepStrictEqual(result.map(r => r.pedido).sort(), ['PV-001', 'PV-002', 'PV-003', 'PV-004', 'PV-005', 'PV-NODATE']);

  const ddmmyyyy = panel._test.toISODate('02/07/2026');
  assert.strictEqual(ddmmyyyy, '2026-07-02', 'Debe soportar formato DD/MM/AAAA.');

  const firestoreLike = panel._test.toISODate({ seconds: 1783000800 });
  assert.ok(/^2026-/.test(firestoreLike), 'Debe soportar timestamps tipo Firestore.');

  const duplicateRows = [
    { id: 'PV-001', fechaVenta: '2026-07-02', cliente: 'Cliente A' },
    { id: 'PV-001', fechaVenta: '2026-07-02', cliente: 'Cliente A' },
    { id: 'PV-002', fechaVenta: '2026-06-01', cliente: 'Cliente B' }
  ];
  const deduped = await panel.update({ sourceRows: duplicateRows });
  assert.strictEqual(deduped.length, 2, 'Debe evitar duplicados por id sin filtrar por fecha.');

  let fetched = 0;
  panel.configure({
    fetcher: async () => {
      fetched += 1;
      return rows;
    }
  });
  const fetchedRows = await panel.update({});
  assert.strictEqual(fetched, 1, 'Debe poder cargar mediante fetcher sin depender de limit.');
  assert.strictEqual(fetchedRows.length, 6, 'El fetcher debe renderizar todos los registros no eliminados.');

  assert.strictEqual(globalThis.LogisticaDailySalesPanel, globalThis.LogisticaSalesRegistryPanel, 'Debe conservar alias viejo para no romper integraciones existentes.');

  console.log('QA OK - LogisticaSalesRegistryPanel V79: 6 pruebas superadas.');
}

if (require.main === module) {
  runSalesRegistryPanelQA().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = runSalesRegistryPanelQA;
