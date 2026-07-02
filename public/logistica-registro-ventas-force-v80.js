/*
 * Logistica EI — Hotfix V80
 * Registro de Ventas FORZADO: reemplaza el módulo visual "Ventas Diarias" y corrige el botón Actualizar
 * para cargar TODOS los registros de ventas, sin límite de 2 y sin filtro por día.
 *
 * Alcance seguro:
 * - No modifica flujo de Ventas -> Caja -> Logística -> Facturación.
 * - No toca Encontrado/No encontrado salvo que se cargue junto con V77.
 * - No edita anexos, reportes, corte, alistamiento ni pedidos retenidos.
 * - Solo interviene el panel cuyo texto/selector corresponde a Ventas Diarias / Registro de Ventas.
 */
(function (global) {
  'use strict';

  const VERSION = 'v80-registro-ventas-forzado';
  const DEFAULTS = {
    moduleTitle: 'Registro de Ventas',
    legacyTitleRegex: /ventas\s+diarias/ig,
    collectionName: '',
    collectionCandidates: ['ventas', 'registroVentas', 'registrosVentas', 'sales', 'pedidos', 'orders', 'cases'],
    orderByFieldCandidates: ['createdAt', 'fechaVenta', 'fecha', 'updatedAt', 'actualizadoAt'],
    combineCollections: false,
    maxFirestoreCollectionsToTry: 7,
    noDateFilter: true,
    noLimit: true,
    deduplicate: true,
    excludeDeleted: true,
    patchLegacyFunctions: true,
    captureRefreshButton: true,
    autoPatchDom: true,
    autoRunOnLoad: false,
    // Si el repo usa otra colección real, configurarla en app.js:
    // LogisticaRegistroVentasForceV80.configure({ collectionName: 'cases', db, collection, getDocs, query, orderBy });
    db: null,
    collection: null,
    getDocs: null,
    query: null,
    orderBy: null,
    onSnapshot: null,
    fetcher: null,
    toast: null,
    onRows: null,
    renderMode: 'auto'
  };

  const STATE = {
    config: Object.assign({}, DEFAULTS),
    patchedButtons: new WeakSet(),
    latestRows: [],
    rawRows: [],
    isLoading: false,
    lastError: null,
    lastUpdatedAt: null,
    observer: null,
    domPatchTimer: null,
    lastKnownPanel: null
  };

  const textPatterns = {
    title: /ventas\s+diarias/ig,
    update: /actualizar\s+ventas\s+diarias/ig
  };

  const FIELD = {
    id: ['id', 'pedido', 'pedidoId', 'numeroPedido', 'orderId', 'code', 'codigo', 'radicado', 'consecutivo'],
    date: ['fechaVenta', 'fecha_venta', 'saleDate', 'salesDate', 'fecha', 'createdAt', 'created_at', 'actualizadoAt', 'updatedAt'],
    client: ['cliente', 'client', 'customer', 'razonSocial', 'nombreCliente', 'customerName'],
    advisor: ['asesor', 'vendedor', 'salesAdvisor', 'createdByName', 'createdBy', 'usuarioVentas', 'asesorVentas'],
    value: ['valor', 'total', 'valorTotal', 'subtotal', 'amount', 'ventaTotal', 'totalPedido'],
    invoice: ['factura', 'invoice', 'numeroFactura', 'facturaNumero'],
    oc: ['oc', 'ordenCompra', 'orden_compra', 'purchaseOrder', 'orderPurchase'],
    status: ['status', 'estado', 'estadoVenta', 'currentProcess', 'proceso', 'etapa'],
    source: ['modulo', 'module', 'source', 'sourceModule', 'createdByRole', 'role', 'area', 'origen']
  };

  function configure(options) {
    STATE.config = Object.assign({}, STATE.config, options || {});
    autoDetectFirestore();
    if (STATE.config.patchLegacyFunctions) patchLegacyFunctions();
    if (STATE.config.autoPatchDom) startDomPatch();
    return api;
  }

  function autoDetectFirestore() {
    const c = STATE.config;
    c.db = c.db || global.db || global.firestoreDb || global.firebaseDb || global._db;
    c.collection = c.collection || global.collection;
    c.getDocs = c.getDocs || global.getDocs;
    c.query = c.query || global.query;
    c.orderBy = c.orderBy || global.orderBy;
    c.onSnapshot = c.onSnapshot || global.onSnapshot;
    c.toast = c.toast || global.showToast || global.toast || null;
  }

  function notify(message, type) {
    const toast = STATE.config.toast || global.showToast || global.toast;
    if (typeof toast === 'function') {
      try { toast(message, type || 'info'); return; } catch (_) {}
    }
    if (global.console) console[type === 'error' ? 'error' : 'log'](`[${VERSION}] ${message}`);
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function containsSalesPanelText(el) {
    if (!el) return false;
    const txt = normalizeText(el.textContent || '');
    return txt.includes('ventas diarias') || txt.includes('registro de ventas');
  }

  function textLooksLikeRefresh(el) {
    const txt = normalizeText(el?.textContent || el?.value || el?.ariaLabel || '');
    const id = normalizeText([el?.id, el?.name, el?.className, el?.getAttribute?.('data-action')].join(' '));
    return (
      txt === 'actualizar' ||
      txt.includes('actualizar ventas') ||
      txt.includes('actualizar registro') ||
      id.includes('actualizarventasdiarias') ||
      id.includes('ventasdiarias') ||
      id.includes('daily') ||
      id.includes('sales') ||
      id.includes('registroventas')
    );
  }

  function findPanel() {
    if (!global.document) return null;
    const selectors = [
      '#panelRegistroVentas', '#registroVentasPanel', '#salesRegistryPanel', '#sales-registry-panel', '[data-sales-registry-panel]',
      '#panelVentasDiarias', '#ventasDiariasPanel', '#dailySalesPanel', '#daily-sales-panel', '[data-daily-sales-panel]',
      '.ventas-diarias', '.daily-sales', '.registro-ventas', '.sales-registry'
    ];
    for (const selector of selectors) {
      const found = global.document.querySelector(selector);
      if (found) return found;
    }

    // Búsqueda por texto: sube hasta una tarjeta/sección lógica y no toca toda la app.
    const candidates = Array.from(global.document.querySelectorAll('section, article, main, div, aside'))
      .filter(containsSalesPanelText)
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);

    if (candidates.length) return candidates[0];
    return STATE.lastKnownPanel || null;
  }

  function replaceTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    const before = node.nodeValue || '';
    let after = before.replace(textPatterns.title, 'Registro de Ventas');
    after = after.replace(textPatterns.update, 'Actualizar registro de ventas');
    if (after !== before) node.nodeValue = after;
  }

  function replaceVisibleText(root) {
    if (!global.document) return;
    const base = root || global.document.body;
    if (!base) return;

    if (base.nodeType === 3) {
      replaceTextNode(base);
      return;
    }

    const walker = global.document.createTreeWalker(base, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        return /ventas\s+diarias/i.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceTextNode);

    const panel = findPanel();
    if (panel) {
      panel.dataset.moduleName = 'Registro de Ventas';
      STATE.lastKnownPanel = panel;
    }
  }

  function findRefreshButtons() {
    if (!global.document) return [];
    const panel = findPanel();
    const base = panel || global.document;
    const selectors = [
      '#btnActualizarRegistroVentas', '#btnRefreshSalesRegistry', '[data-refresh-sales-registry]',
      '#btnActualizarVentasDiarias', '[data-refresh-daily-sales]', '[onclick*="VentasDiarias"]', '[onclick*="ventasDiarias"]',
      'button', 'a[role="button"]', 'input[type="button"]'
    ];
    const nodes = new Set();
    selectors.forEach((selector) => {
      try { base.querySelectorAll(selector).forEach((el) => nodes.add(el)); } catch (_) {}
    });

    return Array.from(nodes).filter((el) => {
      if (!textLooksLikeRefresh(el)) return false;
      if (panel && panel.contains(el)) return true;
      const around = el.closest?.('section, article, div, main, aside');
      return containsSalesPanelText(around);
    });
  }

  function bindRefreshButtons() {
    if (!STATE.config.captureRefreshButton) return;
    const buttons = findRefreshButtons();
    buttons.forEach((btn) => {
      if (STATE.patchedButtons.has(btn)) return;
      STATE.patchedButtons.add(btn);
      btn.dataset.registroVentasV80 = 'true';
      if (/ventas\s+diarias/i.test(btn.textContent || '')) btn.textContent = 'Actualizar registro de ventas';
      if (btn.getAttribute && /actualizar/i.test(btn.getAttribute('aria-label') || '')) {
        btn.setAttribute('aria-label', 'Actualizar registro de ventas');
      }
      // Neutraliza inline onclick del panel viejo si existe; queda solo el update completo V80.
      try { btn.onclick = null; } catch (_) {}
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        updateAll({ source: 'button-v80' }).catch((error) => notify(`No se pudo actualizar Registro de Ventas: ${error.message || error}`, 'error'));
      }, true);
    });
  }

  function patchLegacyFunctions() {
    const names = [
      'actualizarPanelVentasDiarias', 'refreshPanelVentasDiarias', 'loadDailySales', 'cargarVentasDiarias',
      'actualizarVentasDiarias', 'renderVentasDiarias', 'actualizarRegistroVentas', 'refreshRegistroVentas', 'loadSalesRegistry'
    ];
    names.forEach((name) => {
      const originalName = `__${name}_original_v80`;
      if (!global[originalName] && typeof global[name] === 'function') global[originalName] = global[name];
      global[name] = function forcedRegistroVentasV80(options) {
        return updateAll(Object.assign({ source: name }, options || {}));
      };
    });
    global.LogisticaRegistroVentasActualizarTodo = function LogisticaRegistroVentasActualizarTodo(options) {
      return updateAll(Object.assign({ source: 'explicit-v80' }, options || {}));
    };
  }

  function startDomPatch() {
    if (!global.document) return api;

    const run = () => {
      replaceVisibleText();
      bindRefreshButtons();
    };

    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    clearInterval(STATE.domPatchTimer);
    let ticks = 0;
    STATE.domPatchTimer = global.setInterval(() => {
      ticks += 1;
      run();
      patchLegacyFunctions();
      if (ticks >= 20) clearInterval(STATE.domPatchTimer);
    }, 500);

    if (global.MutationObserver && !STATE.observer) {
      STATE.observer = new MutationObserver((mutations) => {
        let relevant = false;
        for (const m of mutations) {
          if (m.type === 'childList' || m.type === 'characterData') { relevant = true; break; }
        }
        if (relevant) run();
      });
      const root = global.document.body || global.document.documentElement;
      if (root) STATE.observer.observe(root, { childList: true, subtree: true, characterData: true });
    }

    return api;
  }

  function getFirst(obj, candidates) {
    if (!obj) return undefined;
    for (const k of candidates) {
      if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return undefined;
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'object') {
      if (typeof value.toDate === 'function') return value.toDate();
      if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
      if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
    }
    if (typeof value === 'number') {
      if (value > 100000000000) return new Date(value);
      if (value > 1000000000) return new Date(value * 1000);
      if (value > 25000 && value < 80000) return new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    }
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return null;
      const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
      if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      const ymd = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
      if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  function toISODate(value) {
    const d = parseDate(value);
    if (!d || Number.isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function isDeleted(row) {
    const status = normalizeText(row?.status || row?.estado || '');
    return !!row && (
      row.deleted === true || row.eliminado === true || row.isDeleted === true || row.archived === true || row.archivado === true ||
      status === 'deleted' || status === 'eliminado' || status === 'archivado'
    );
  }

  function stableId(row, index) {
    const explicit = getFirst(row, FIELD.id);
    if (explicit !== undefined) return String(explicit);
    return [toISODate(getFirst(row, FIELD.date)), getFirst(row, FIELD.client) || '', getFirst(row, FIELD.value) || '', index].join('|');
  }

  function dedupe(rows) {
    if (!STATE.config.deduplicate) return rows.slice();
    const seen = new Set();
    return rows.filter((row, index) => {
      const id = stableId(row, index);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function normalizeSnapshot(snapshot) {
    if (!snapshot) return [];
    if (Array.isArray(snapshot)) return snapshot;
    if (Array.isArray(snapshot.docs)) {
      return snapshot.docs.map((docSnap) => Object.assign({ id: docSnap.id }, typeof docSnap.data === 'function' ? docSnap.data() : (docSnap.data || {})));
    }
    if (typeof snapshot.forEach === 'function') {
      const out = [];
      snapshot.forEach((docSnap) => out.push(Object.assign({ id: docSnap.id }, typeof docSnap.data === 'function' ? docSnap.data() : (docSnap.data || {}))));
      return out;
    }
    return [];
  }

  function normalizeRow(row, index) {
    const date = getFirst(row, FIELD.date);
    return {
      __raw: row,
      __id: stableId(row, index),
      fecha: toISODate(date),
      pedido: getFirst(row, FIELD.id) || 'Sin pedido',
      cliente: getFirst(row, FIELD.client) || 'Sin cliente',
      asesor: getFirst(row, FIELD.advisor) || 'Sin asesor',
      valor: getFirst(row, FIELD.value) || 0,
      factura: getFirst(row, FIELD.invoice) || '-',
      oc: getFirst(row, FIELD.oc) || '-',
      estado: getFirst(row, FIELD.status) || '-'
    };
  }

  function sortRows(rows) {
    return rows.slice().sort((a, b) => {
      const da = parseDate(getFirst(a, FIELD.date))?.getTime() || 0;
      const db = parseDate(getFirst(b, FIELD.date))?.getTime() || 0;
      if (da !== db) return db - da;
      return String(stableId(a, 0)).localeCompare(String(stableId(b, 0)));
    });
  }

  function normalizeAndFilter(rows) {
    const source = Array.isArray(rows) ? rows : [];
    const clean = source.filter((row) => !(STATE.config.excludeDeleted && isDeleted(row)));
    return dedupe(sortRows(clean)).map(normalizeRow);
  }

  function readGlobalArrays() {
    const names = ['ventas', 'allVentas', 'ventasData', 'sales', 'salesData', 'registrosVentas', 'registroVentas', 'orders', 'pedidos', 'cases', 'allCases'];
    for (const name of names) {
      if (Array.isArray(global[name]) && global[name].length) return global[name];
    }
    return [];
  }

  async function fetchFirestoreRows(options) {
    const c = STATE.config;
    autoDetectFirestore();
    if (!c.db || !c.collection || !c.getDocs) return [];

    const candidates = [];
    if (options?.collectionName) candidates.push(options.collectionName);
    if (c.collectionName) candidates.push(c.collectionName);
    c.collectionCandidates.forEach((x) => { if (!candidates.includes(x)) candidates.push(x); });

    const all = [];
    let tried = 0;
    for (const name of candidates) {
      if (!name || tried >= c.maxFirestoreCollectionsToTry) continue;
      tried += 1;
      try {
        const colRef = c.collection(c.db, name);
        let snap = null;
        if (c.query && c.orderBy) {
          for (const orderField of c.orderByFieldCandidates) {
            try {
              snap = await c.getDocs(c.query(colRef, c.orderBy(orderField, 'desc')));
              break;
            } catch (_) {}
          }
        }
        if (!snap) snap = await c.getDocs(colRef);
        const rows = normalizeSnapshot(snap).map((r) => Object.assign({ __collection: name }, r));
        if (rows.length) {
          if (!c.combineCollections) return rows;
          all.push(...rows);
        }
      } catch (err) {
        // Se ignoran colecciones sin permiso/no existentes para no romper app.
      }
    }
    return all;
  }

  async function fetchRows(options) {
    if (Array.isArray(options?.sourceRows)) return options.sourceRows;
    if (typeof STATE.config.fetcher === 'function') return normalizeSnapshot(await STATE.config.fetcher(options || {}));
    const globalRows = readGlobalArrays();
    if (globalRows.length) return globalRows;
    return fetchFirestoreRows(options || {});
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return escapeHtml(value);
    try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n); }
    catch (_) { return `$${n.toLocaleString('es-CO')}`; }
  }

  function findTableBody(panel) {
    if (!global.document) return null;
    const selectors = ['#registroVentasTableBody', '#salesRegistryTableBody', '#tbodyRegistroVentas', '[data-sales-registry-tbody]', '#ventasDiariasTableBody', '#dailySalesTableBody', '#tbodyVentasDiarias', '[data-daily-sales-tbody]', 'tbody'];
    for (const s of selectors) {
      const el = (panel || global.document).querySelector?.(s) || global.document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function updateCounters(count, panel) {
    if (!global.document) return;
    const selectors = ['#registroVentasCount', '[data-sales-registry-count]', '#ventasDiariasCount', '#dailySalesCount', '[data-daily-sales-count]'];
    selectors.forEach((s) => {
      try { global.document.querySelectorAll(s).forEach((el) => { el.textContent = String(count); }); } catch (_) {}
    });
    if (panel) panel.dataset.registroVentasCount = String(count);
  }

  function tableRow(row) {
    return `<tr data-sale-id="${escapeHtml(row.__id)}"><td>${escapeHtml(row.fecha)}</td><td>${escapeHtml(row.pedido)}</td><td>${escapeHtml(row.cliente)}</td><td>${escapeHtml(row.asesor)}</td><td>${money(row.valor)}</td><td>${escapeHtml(row.factura)}</td><td>${escapeHtml(row.oc)}</td><td>${escapeHtml(row.estado)}</td></tr>`;
  }

  function card(row) {
    return `<article class="registro-venta-card-v80" data-sale-id="${escapeHtml(row.__id)}"><div class="rv-top"><strong>${escapeHtml(row.pedido)}</strong><span>${escapeHtml(row.estado)}</span></div><div>${escapeHtml(row.cliente)}</div><div class="rv-meta"><span>${escapeHtml(row.fecha)}</span><span>${escapeHtml(row.asesor)}</span><span>${money(row.valor)}</span></div><div class="rv-meta rv-soft"><span>Factura: ${escapeHtml(row.factura)}</span><span>OC: ${escapeHtml(row.oc)}</span></div></article>`;
  }

  function render(rows) {
    if (!global.document) return rows;
    replaceVisibleText();
    const panel = findPanel();
    updateCounters(rows.length, panel);
    const tbody = findTableBody(panel);
    if (tbody) {
      tbody.innerHTML = rows.length ? rows.map(tableRow).join('') : '<tr><td colspan="8">No hay registros de ventas disponibles.</td></tr>';
      return rows;
    }
    if (panel) {
      panel.innerHTML = `<div class="registro-ventas-force-v80"><div class="rv-header"><strong>Registro de Ventas</strong><span>${rows.length} registro${rows.length === 1 ? '' : 's'} cargado${rows.length === 1 ? '' : 's'}</span><button type="button" data-refresh-sales-registry>Actualizar registro de ventas</button></div><div class="rv-list">${rows.length ? rows.map(card).join('') : '<div class="rv-empty">No hay registros de ventas disponibles.</div>'}</div></div>`;
      bindRefreshButtons();
    }
    return rows;
  }

  function setLoading(isLoading) {
    const panel = findPanel();
    if (panel?.classList) panel.classList.toggle('registro-ventas-v80-loading', !!isLoading);
    findRefreshButtons().forEach((btn) => { btn.disabled = !!isLoading; if (isLoading) btn.dataset.oldText = btn.textContent || ''; btn.textContent = isLoading ? 'Actualizando...' : (btn.dataset.oldText || 'Actualizar registro de ventas'); });
  }

  async function updateAll(options) {
    STATE.isLoading = true;
    STATE.lastError = null;
    setLoading(true);
    try {
      const rows = await fetchRows(options || {});
      STATE.rawRows = Array.isArray(rows) ? rows.slice() : [];
      const normalized = normalizeAndFilter(STATE.rawRows);
      STATE.latestRows = normalized;
      STATE.lastUpdatedAt = new Date();
      render(normalized);
      if (typeof STATE.config.onRows === 'function') STATE.config.onRows(normalized, STATE.rawRows);
      notify(`Registro de Ventas actualizado: ${normalized.length} registros cargados.`, 'success');
      return normalized;
    } catch (error) {
      STATE.lastError = error;
      const panel = findPanel();
      if (panel) panel.insertAdjacentHTML('afterbegin', `<div class="rv-error">No se pudo actualizar Registro de Ventas: ${escapeHtml(error.message || error)}</div>`);
      notify(`No se pudo actualizar Registro de Ventas: ${error.message || error}`, 'error');
      throw error;
    } finally {
      STATE.isLoading = false;
      setLoading(false);
    }
  }

  function getState() {
    return {
      version: VERSION,
      latestRows: STATE.latestRows.slice(),
      rawCount: STATE.rawRows.length,
      isLoading: STATE.isLoading,
      lastError: STATE.lastError,
      lastUpdatedAt: STATE.lastUpdatedAt
    };
  }

  const api = { configure, updateAll, forcePatch: startDomPatch, patchLegacyFunctions, replaceVisibleText, bindRefreshButtons, getState, _test: { normalizeAndFilter, normalizeRow, dedupe, sortRows, parseDate, toISODate, stableId, isDeleted } };

  global.LogisticaRegistroVentasForceV80 = api;
  global.LogisticaSalesRegistryPanel = api;
  global.LogisticaDailySalesPanel = api;
  global.actualizarRegistroVentas = function (options) { return updateAll(options || {}); };
  global.actualizarPanelVentasDiarias = function (options) { return updateAll(options || {}); };
  global.actualizarRegistroVentasSeguro = function (options) { return updateAll(options || {}); };

  configure({});

  if (global.document && STATE.config.autoRunOnLoad) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', () => updateAll({ source: 'autorun-v80' }).catch(() => null), { once: true });
    else updateAll({ source: 'autorun-v80' }).catch(() => null);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
