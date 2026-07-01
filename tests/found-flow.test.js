const assert = require('assert');
const Flow = require('../public/logistica-found-flow.js');

Flow.configure({
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
  currentUserProvider: () => ({ uid: 'uid_test', name: 'QA Movil', email: 'qa@app.test' })
});

function baseCase() {
  return {
    id: 'CASE-1',
    status: 'recepcion_logistica',
    currentProcess: 'recepcion_logistica',
    items: [
      { id: 'A', descripcion: 'Cable', estadoBusqueda: 'pendiente' },
      { id: 'B', descripcion: 'Tubo', estadoBusqueda: 'pendiente' },
      { id: 'C', descripcion: 'Etiqueta opcional', required: false, estadoBusqueda: 'pendiente' }
    ],
    history: [],
    flowTrace: []
  };
}

(function testFoundOneDoesNotSendBilling() {
  const result = Flow.buildFoundMutation(baseCase(), ['A'], null, { caseId: 'CASE-1' });
  assert.strictEqual(result.completed, false);
  assert.strictEqual(result.update.enviadoAFacturacion, undefined);
  assert.strictEqual(result.update.items.find(x => x.id === 'A').estadoBusqueda, 'encontrado');
})();

(function testAllFoundSendsBilling() {
  const c = baseCase();
  c.items[0].estadoBusqueda = 'encontrado';
  c.items[0].encontrado = true;
  const result = Flow.buildFoundMutation(c, ['B'], null, { caseId: 'CASE-1' });
  assert.strictEqual(result.completed, true);
  assert.strictEqual(result.update.currentProcess, 'facturacion');
  assert.strictEqual(result.update.enviadoAFacturacion, true);
  assert.strictEqual(result.update.status, 'pendiente_facturacion');
})();

(function testBatchFoundSendsBilling() {
  const result = Flow.buildFoundMutation(baseCase(), ['A', 'B'], null, { caseId: 'CASE-1' });
  assert.strictEqual(result.completed, true);
  assert.strictEqual(result.update.sentToBilling, true);
})();

(function testNotFoundNeverSendsBilling() {
  const result = Flow.buildNotFoundMutation(baseCase(), ['A'], null, { caseId: 'CASE-1', observacion: 'No ubicado' });
  assert.strictEqual(result.completed, false);
  assert.strictEqual(result.update.enviadoAFacturacion, false);
  assert.strictEqual(result.update.currentProcess, 'recepcion_logistica');
  assert.strictEqual(result.update.items.find(x => x.id === 'A').estadoBusqueda, 'no_encontrado');
})();

(function testLineItemsAlternativeKey() {
  const c = {
    lineItems: [
      { id: 'L1', estadoBusqueda: 'pendiente' },
      { id: 'L2', estadoBusqueda: 'encontrado', encontrado: true }
    ]
  };
  const result = Flow.buildFoundMutation(c, ['L1'], null, { caseId: 'CASE-2' });
  assert.strictEqual(result.key, 'lineItems');
  assert.strictEqual(result.completed, true);
})();

(function testMissingItemThrows() {
  assert.throws(() => Flow.buildFoundMutation(baseCase(), ['Z'], null, { caseId: 'CASE-1' }), /No se encontró/);
})();

(function testOptionalItemIgnoredForCompletion() {
  const c = baseCase();
  c.items[0].estadoBusqueda = 'encontrado';
  c.items[0].encontrado = true;
  const result = Flow.buildFoundMutation(c, ['B'], null, { caseId: 'CASE-1' });
  assert.strictEqual(result.completed, true);
})();

console.log('QA OK - LogisticaFoundFlow V77: 7 pruebas superadas.');
