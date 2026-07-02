const assert = require('assert');
require('../public/logistica-registro-ventas-force-v80.js');

const api = globalThis.LogisticaRegistroVentasForceV80;

(async function run() {
  const rows = [
    { id: 'PV-001', fechaVenta: '2026-07-02', cliente: 'A', asesor: 'Uno', valor: 100, estado: 'registrada' },
    { id: 'PV-002', fechaVenta: '2026-07-02', cliente: 'B', asesor: 'Uno', valor: 200, estado: 'registrada' },
    { id: 'PV-003', fechaVenta: '2026-07-01', cliente: 'C', asesor: 'Dos', valor: 300, estado: 'registrada' },
    { id: 'PV-004', fechaVenta: '2026-06-29', cliente: 'D', asesor: 'Dos', valor: 400, estado: 'registrada' },
    { id: 'PV-005', fechaVenta: '2026-05-10', cliente: 'E', asesor: 'Tres', valor: 500, estado: 'registrada' },
    { id: 'PV-006', cliente: 'Sin fecha', asesor: 'Tres', valor: 600, estado: 'registrada' },
    { id: 'PV-DEL', fechaVenta: '2026-07-02', cliente: 'Eliminado', valor: 999, eliminado: true },
    { id: 'PV-002', fechaVenta: '2026-07-02', cliente: 'B repetido', asesor: 'Uno', valor: 200, estado: 'registrada' }
  ];

  api.configure({ autoPatchDom: false, patchLegacyFunctions: true, toast: () => null });
  const result = await api.updateAll({ sourceRows: rows });

  assert.strictEqual(result.length, 6, 'Debe cargar todos los registros no eliminados, sin filtrar por fecha ni limitar a dos.');
  assert.ok(result.some(r => r.pedido === 'PV-005'), 'Debe incluir registros antiguos.');
  assert.ok(result.some(r => r.pedido === 'PV-006'), 'Debe incluir registros sin fecha.');
  assert.ok(!result.some(r => r.pedido === 'PV-DEL'), 'Debe excluir eliminados.');
  assert.strictEqual(result.filter(r => r.pedido === 'PV-002').length, 1, 'Debe deduplicar por ID.');
  assert.strictEqual(typeof globalThis.actualizarPanelVentasDiarias, 'function', 'Debe conservar y reemplazar alias viejo.');

  const legacy = await globalThis.actualizarPanelVentasDiarias({ sourceRows: rows });
  assert.strictEqual(legacy.length, 6, 'La función vieja debe cargar todo el registro, no solo dos.');

  console.log('QA OK - Hotfix V80 Registro de Ventas forzado: 7 pruebas superadas.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
