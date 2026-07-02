/*
 * Logistica EI — Hotfix V79
 * Registro de Ventas: actualización de TODOS los registros sin límite oculto ni filtro por día.
 * Objetivo: reemplazar el antiguo concepto de "Ventas Diarias" por "Registro de Ventas".
 * Este módulo NO toca ventas, caja, logística, encontrado, facturación, anexos ni reportes.
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    collectionName: 'cases',
    panelSelectors: [
      '#panelRegistroVentas',
      '#registroVentasPanel',
      '#salesRegistryPanel',
      '#sales-registry-panel',
      '[data-sales-registry-panel]',
      // compatibilidad con el panel anterior para no romper index.html existente
      '#panelVentasDiarias',
      '#ventasDiariasPanel',
      '#dailySalesPanel',
      '#daily-sales-panel',
      '[data-daily-sales-panel]'
    ],
    tableBodySelectors: [
      '#registroVentasTableBody',
      '#salesRegistryTableBody',
      '#tbodyRegistroVentas',
      '[data-sales-registry-tbody]',
      // compatibilidad con tabla anterior
      '#ventasDiariasTableBody',
      '#dailySalesTableBody',
      '#tbodyVentasDiarias',
      '[data-daily-sales-tbody]'
    ],
    counterSelectors: [
      '#registroVentasCount',
      '#salesRegistryCount',
      '[data-sales-registry-count]',
      // compatibilidad con contador anterior
      '#ventasDiariasCount',
      '#dailySalesCount',
      '[data-daily-sales-count]'
    ],
    titleSelectors: [
      '#ventasDiariasTitle',
      '#dailySalesTitle',
      '[data-sales-registry-title]',
      '[data-daily-sales-title]'
    ],
    refreshButtonSelectors: [
      '#btnActualizarRegistroVentas',
      '#btnRefreshSalesRegistry',
      '[data-refresh-sales-registry]',
      '#btnActualizarVentasDiarias',
      '[data-refresh-daily-sales]'
    ],
    loadingClass: 'registro-ventas-loading',
    emptyMessage: 'No hay registros de ventas disponibles.',
    errorMessage: 'No se pudo actualizar el registro de ventas.',
    noLimit: true,
    showAllRecords: true,
    patchLegacyUpdater: false,
    autoSubscribe: false,
    dateFieldCandidates: [
      'fechaVenta',
      'fecha_venta',
      'saleDate',
      'salesDate',
      'fecha',
      'createdAt',
      'created_at',
      'actualizadoAt',
      'updatedAt'
    ],
    idFieldCandidates: ['id', 'pedido', 'pedidoId', 'numeroPedido', 'orderId', 'code', 'codigo', 'radicado'],
    clientFieldCandidates: ['cliente', 'client', 'customer', 'razonSocial', 'nombreCliente'],
    advisorFieldCandidates: ['asesor', 'vendedor', 'salesAdvisor', 'createdByName', 'createdBy', 'usuarioVentas'],
    valueFieldCandidates: ['valor', 'total', 'valorTotal', 'subtotal', 'amount', 'ventaTotal'],
    invoiceFieldCandidates: ['factura', 'invoice', 'numeroFactura'],
    ocFieldCandidates: ['oc', 'ordenCompra', 'orden_compra', 'purchaseOrder'],
    statusFieldCandidates: ['status', 'estado', 'estadoVenta', 'currentProcess', 'proceso'],
    excludeDeleted: true,
    deduplicate: true,
    sortDescending: true,
    toast: null,
    refreshHook: null,
    currentDateProvider: () => new Date(),
    registryFilter: null
  };

  const STATE = {
    config: Object.assign({}, DEFAULTS),
    unsubscribe: null,
    latestRows: [],
    isLoading: false,
    lastError: null,
    lastUpdatedAt: null
  };

  function mergeConfig(next) {
    STATE.config = Object.assign({}, STATE.config, next || {});
    return STATE.config;
  }

  function configure(options) {
    const config = mergeConfig(options || {});

    renameVisibleTitles();
    bindRefreshButtons();

    if (config.patchLegacyUpdater) {
      patchLegacyUpdater();
    }

    if (config.autoSubscribe) {
      subscribe({});
    }

    return api;
  }

  function patchLegacyUpdater() {
    // Conserva nombre nuevo y alias viejo. El alias viejo queda apuntando a TODOS los registros.
    if (!global.__actualizarPanelVentasDiariasOriginal && typeof global.actualizarPanelVentasDiarias === 'function') {
      global.__actualizarPanelVentasDiariasOriginal = global.actualizarPanelVentasDiarias;
    }

    global.actualizarRegistroVentas = function actualizarRegistroVentasV79(options) {
      return update(options || {});
    };

    global.refreshRegistroVentas = function refreshRegistroVentasV79(options) {
      return update(options || {});
    };

    global.actualizarPanelVentasDiarias = function actualizarPanelVentasDiariasV79(options) {
      return update(options || {});
    };

    global.refreshPanelVentasDiarias = function refreshPanelVentasDiariasV79(options) {
      return update(options || {});
    };
  }

  function toISODate(value) {
    const parsed = parseDate(value);
    if (!parsed) return '';
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseDate(value) {
    if (!value) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    if (typeof value === 'object') {
      if (typeof value.toDate === 'function') {
        const d = value.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      }
      if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
      if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
    }

    if (typeof value === 'number') {
      if (value > 100000000000) return new Date(value);
      if (value > 1000000000) return new Date(value * 1000);
      if (value > 25000 && value < 80000) {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(excelEpoch.getTime() + value * 86400000);
      }
    }

    if (typeof value === 'string') {
      const clean = value.trim();
      if (!clean) return null;

      const ddmmyyyy = clean.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
      if (ddmmyyyy) {
        const [, dd, mm, yyyy] = ddmmyyyy;
        return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      }

      const yyyymmdd = clean.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
      if (yyyymmdd) {
        const [, yyyy, mm, dd] = yyyymmdd;
        return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      }

      const d = new Date(clean);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  function getFirst(obj, candidates) {
    if (!obj || !Array.isArray(candidates)) return undefined;
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        return obj[key];
      }
    }
    return undefined;
  }

  function getSaleDate(row) {
    return getFirst(row, STATE.config.dateFieldCandidates);
  }

  function isDeleted(row) {
    return row && (
      row.deleted === true ||
      row.eliminado === true ||
      row.isDeleted === true ||
      row.archived === true ||
      row.archivado === true ||
      row.estado === 'eliminado' ||
      row.status === 'deleted'
    );
  }

  function rowMatchesRegistry(row) {
    if (STATE.config.excludeDeleted && isDeleted(row)) return false;
    if (typeof STATE.config.registryFilter === 'function') return !!STATE.config.registryFilter(row);
    // Cambio clave V79: NO filtra por fecha. Se muestran todos los registros de ventas disponibles.
    return true;
  }

  function makeStableId(row, index) {
    const explicit = getFirst(row, STATE.config.idFieldCandidates);
    if (explicit !== undefined) return String(explicit);

    const client = getFirst(row, STATE.config.clientFieldCandidates) || '';
    const date = toISODate(getSaleDate(row)) || '';
    const value = getFirst(row, STATE.config.valueFieldCandidates) || '';
    return `${date}|${client}|${value}|${index}`;
  }

  function dedupeRows(rows) {
    if (!STATE.config.deduplicate) return rows;
    const seen = new Set();
    return rows.filter((row, index) => {
      const key = makeStableId(row, index);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeRow(row, index) {
    const id = makeStableId(row, index);
    return {
      __raw: row,
      __id: id,
      fecha: toISODate(getSaleDate(row)) || '-',
      pedido: getFirst(row, STATE.config.idFieldCandidates) || 'Sin pedido',
      cliente: getFirst(row, STATE.config.clientFieldCandidates) || 'Sin cliente',
      asesor: getFirst(row, STATE.config.advisorFieldCandidates) || 'Sin asesor',
      valor: getFirst(row, STATE.config.valueFieldCandidates) || 0,
      factura: getFirst(row, STATE.config.invoiceFieldCandidates) || '',
      oc: getFirst(row, STATE.config.ocFieldCandidates) || '',
      estado: getFirst(row, STATE.config.statusFieldCandidates) || ''
    };
  }

  function sortRows(rows) {
    const multiplier = STATE.config.sortDescending ? -1 : 1;
    return rows.slice().sort((a, b) => {
      const da = parseDate(getSaleDate(a))?.getTime() || 0;
      const db = parseDate(getSaleDate(b))?.getTime() || 0;
      if (da !== db) return (da - db) * multiplier;
      return String(makeStableId(a, 0)).localeCompare(String(makeStableId(b, 0)));
    });
  }

  function normalizeSnapshot(snapshot) {
    if (!snapshot) return [];
    if (Array.isArray(snapshot)) return snapshot;

    if (Array.isArray(snapshot.docs)) {
      return snapshot.docs.map((docSnap) => {
        const data = typeof docSnap.data === 'function' ? docSnap.data() : (docSnap.data || {});
        return Object.assign({ id: docSnap.id }, data || {});
      });
    }

    if (typeof snapshot.forEach === 'function') {
      const rows = [];
      snapshot.forEach((docSnap) => {
        const data = typeof docSnap.data === 'function' ? docSnap.data() : (docSnap.data || {});
        rows.push(Object.assign({ id: docSnap.id }, data || {}));
      });
      return rows;
    }

    return [];
  }

  async function fetchRows(options) {
    const config = STATE.config;

    if (Array.isArray(options?.sourceRows)) return options.sourceRows;

    if (typeof config.fetcher === 'function') {
      const result = await config.fetcher(options || {});
      return normalizeSnapshot(result);
    }

    if (!config.db || !config.collection) throw new Error('Falta configurar Firestore: db y collection.');

    const colRef = config.collection(config.db, options?.collectionName || config.collectionName);

    // Corrección principal: NO se usa limit(), NO se usa slice(), NO se filtra por fecha.
    if (config.getDocs) {
      let ref = colRef;
      if (config.query && config.orderBy && config.orderByField) {
        ref = config.query(colRef, config.orderBy(config.orderByField, config.sortDescending ? 'desc' : 'asc'));
      }
      const snap = await config.getDocs(ref);
      return normalizeSnapshot(snap);
    }

    throw new Error('Falta configurar getDocs o fetcher para cargar el registro de ventas.');
  }

  async function update(options) {
    STATE.isLoading = true;
    STATE.lastError = null;
    setLoading(true);
    renameVisibleTitles();

    try {
      const rawRows = await fetchRows(options || {});
      const filtered = dedupeRows(sortRows(rawRows.filter(rowMatchesRegistry)));
      const normalized = filtered.map(normalizeRow);

      STATE.latestRows = normalized;
      STATE.lastUpdatedAt = new Date();
      render(normalized, {});

      if (typeof STATE.config.refreshHook === 'function') STATE.config.refreshHook(normalized);
      return normalized;
    } catch (error) {
      STATE.lastError = error;
      renderError(error);
      notify(STATE.config.errorMessage, 'error');
      throw error;
    } finally {
      STATE.isLoading = false;
      setLoading(false);
    }
  }

  function subscribe(options) {
    const config = STATE.config;
    if (STATE.unsubscribe) {
      STATE.unsubscribe();
      STATE.unsubscribe = null;
    }

    if (!config.db || !config.collection || !config.onSnapshot) return update(options || {});

    const colRef = config.collection(config.db, options?.collectionName || config.collectionName);
    let ref = colRef;
    if (config.query && config.orderBy && config.orderByField) {
      ref = config.query(colRef, config.orderBy(config.orderByField, config.sortDescending ? 'desc' : 'asc'));
    }

    STATE.unsubscribe = config.onSnapshot(ref, (snapshot) => {
      const rawRows = normalizeSnapshot(snapshot);
      const filtered = dedupeRows(sortRows(rawRows.filter(rowMatchesRegistry)));
      const normalized = filtered.map(normalizeRow);
      STATE.latestRows = normalized;
      STATE.lastUpdatedAt = new Date();
      render(normalized, {});
    }, (error) => {
      STATE.lastError = error;
      renderError(error);
      notify(STATE.config.errorMessage, 'error');
    });

    return STATE.unsubscribe;
  }

  function findFirst(selectors) {
    if (!global.document || !Array.isArray(selectors)) return null;
    for (const selector of selectors) {
      const el = global.document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function forEachSelector(selectors, callback) {
    if (!global.document || !Array.isArray(selectors)) return;
    for (const selector of selectors) {
      global.document.querySelectorAll(selector).forEach(callback);
    }
  }

  function renameVisibleTitles() {
    forEachSelector(STATE.config.titleSelectors, (el) => { el.textContent = 'Registro de Ventas'; });
    const panel = findFirst(STATE.config.panelSelectors);
    if (panel && panel.dataset) panel.dataset.moduleName = 'Registro de Ventas';
  }

  function bindRefreshButtons() {
    forEachSelector(STATE.config.refreshButtonSelectors, (btn) => {
      if (btn.dataset && btn.dataset.salesRegistryBound === 'true') return;
      if (btn.dataset) btn.dataset.salesRegistryBound = 'true';
      btn.addEventListener('click', () => update({}));
      if (/ventas\s+diarias/i.test(btn.textContent || '')) btn.textContent = 'Actualizar registro de ventas';
    });
  }

  function setLoading(isLoading) {
    const panel = findFirst(STATE.config.panelSelectors);
    if (!panel || !panel.classList) return;
    panel.classList.toggle(STATE.config.loadingClass, !!isLoading);
  }

  function updateCounters(count) {
    forEachSelector(STATE.config.counterSelectors, (el) => { el.textContent = String(count); });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMoney(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return escapeHtml(value);
    try {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    } catch (_err) {
      return `$${n.toLocaleString('es-CO')}`;
    }
  }

  function render(rows) {
    updateCounters(rows.length);
    renameVisibleTitles();

    const tbody = findFirst(STATE.config.tableBodySelectors);
    if (tbody) {
      tbody.innerHTML = rows.length ? rows.map(rowToTable).join('') : emptyRow();
      return;
    }

    const panel = findFirst(STATE.config.panelSelectors);
    if (!panel) return;

    panel.innerHTML = rows.length ? `
      <div class="registro-ventas-header">
        <strong>Registro de Ventas</strong>
        <span>${rows.length} registro${rows.length === 1 ? '' : 's'} cargado${rows.length === 1 ? '' : 's'}</span>
      </div>
      <div class="registro-ventas-lista">
        ${rows.map(rowToCard).join('')}
      </div>
    ` : `<div class="registro-ventas-empty">${escapeHtml(STATE.config.emptyMessage)}</div>`;
  }

  function rowToTable(row) {
    return `
      <tr data-sale-id="${escapeHtml(row.__id)}">
        <td>${escapeHtml(row.fecha)}</td>
        <td>${escapeHtml(row.pedido)}</td>
        <td>${escapeHtml(row.cliente)}</td>
        <td>${escapeHtml(row.asesor)}</td>
        <td>${formatMoney(row.valor)}</td>
        <td>${escapeHtml(row.factura || '-')}</td>
        <td>${escapeHtml(row.oc || '-')}</td>
        <td>${escapeHtml(row.estado || '-')}</td>
      </tr>
    `;
  }

  function emptyRow() {
    return `<tr class="registro-ventas-empty-row"><td colspan="8">${escapeHtml(STATE.config.emptyMessage)}</td></tr>`;
  }

  function rowToCard(row) {
    return `
      <article class="registro-venta-card" data-sale-id="${escapeHtml(row.__id)}">
        <div class="registro-venta-card-top">
          <strong>${escapeHtml(row.pedido)}</strong>
          <span>${escapeHtml(row.estado || 'Sin estado')}</span>
        </div>
        <div class="registro-venta-cliente">${escapeHtml(row.cliente)}</div>
        <div class="registro-venta-meta">
          <span>${escapeHtml(row.fecha)}</span>
          <span>${escapeHtml(row.asesor)}</span>
          <span>${formatMoney(row.valor)}</span>
        </div>
        <div class="registro-venta-meta secundaria">
          <span>Factura: ${escapeHtml(row.factura || '-')}</span>
          <span>OC: ${escapeHtml(row.oc || '-')}</span>
        </div>
      </article>
    `;
  }

  function renderError(error) {
    const panel = findFirst(STATE.config.panelSelectors);
    const tbody = findFirst(STATE.config.tableBodySelectors);
    const msg = `${STATE.config.errorMessage}${error?.message ? ` ${error.message}` : ''}`;
    updateCounters(0);

    if (tbody) {
      tbody.innerHTML = `<tr class="registro-ventas-error-row"><td colspan="8">${escapeHtml(msg)}</td></tr>`;
      return;
    }

    if (panel) panel.innerHTML = `<div class="registro-ventas-error">${escapeHtml(msg)}</div>`;
  }

  function notify(message, type) {
    const toast = STATE.config.toast || global.toast || global.showToast;
    if (typeof toast === 'function') toast(message, type || 'info');
  }

  function getState() {
    return {
      latestRows: STATE.latestRows.slice(),
      isLoading: STATE.isLoading,
      lastError: STATE.lastError,
      lastUpdatedAt: STATE.lastUpdatedAt
    };
  }

  const api = {
    configure,
    update,
    subscribe,
    patchLegacyUpdater,
    getState,
    _test: {
      toISODate,
      parseDate,
      rowMatchesRegistry,
      normalizeRow,
      dedupeRows,
      sortRows,
      normalizeSnapshot,
      makeStableId
    }
  };

  global.LogisticaSalesRegistryPanel = api;
  // Alias temporal para integraciones viejas: evita romper llamadas existentes.
  global.LogisticaDailySalesPanel = api;
  global.actualizarRegistroVentasSeguro = function actualizarRegistroVentasSeguro(options) { return update(options || {}); };
  global.actualizarPanelVentasDiariasSeguro = function actualizarPanelVentasDiariasSeguro(options) { return update(options || {}); };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
