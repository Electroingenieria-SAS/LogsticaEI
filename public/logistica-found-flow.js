/*
  LogisticaEI Hotfix V77 - Encontrado / No encontrado -> Facturacion segura
  Objetivo: fortalecer el flujo móvil sin tocar módulos estables.
  Autor integración: ChatGPT para Juan Esteban Pérez
  Fecha: 2026-07-01

  Uso seguro:
  1) Cargar este archivo después de Firebase y antes de cerrar body, o importarlo desde app.js.
  2) Configurar con LogisticaFoundFlow.configure({ db, doc, runTransaction, serverTimestamp, collection, toast, refresh }).
  3) Conectar los botones a window.handleEncontradoSeguro(caseId, itemId, this) y window.handleNoEncontradoSeguro(caseId, itemId, this, observacion).
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LogisticaFoundFlow = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = 'v77-encontrado-facturacion-segura';

  const CONFIG = {
    collectionName: 'cases',
    eventCollectionName: 'case_events',
    billingProcess: 'facturacion',
    billingAssignedRole: 'facturacion',
    logisticsProcess: 'recepcion_logistica',
    writeEvents: false,
    maxHistory: 120,
    db: null,
    doc: null,
    collection: null,
    runTransaction: null,
    serverTimestamp: null,
    currentUserProvider: null,
    toast: null,
    refresh: null,
    onError: null
  };

  const inflight = new Set();

  const ITEM_ARRAY_KEYS = [
    'items',
    'lineItems',
    'lineas',
    'detalle',
    'detalles',
    'productos',
    'products',
    'elementos',
    'elements',
    'checklist'
  ];

  const FOUND_STATUSES = new Set([
    'encontrado',
    'found',
    'ok',
    'conforme',
    'ubicado',
    'hallado',
    'completo',
    'finalizado'
  ]);

  const NOT_FOUND_STATUSES = new Set([
    'no_encontrado',
    'no encontrado',
    'not_found',
    'faltante',
    'pendiente',
    'sin_ubicar',
    'sin ubicar',
    'novedad'
  ]);

  function normalizeText(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function topTimestamp() {
    if (typeof CONFIG.serverTimestamp === 'function') {
      return CONFIG.serverTimestamp();
    }
    return nowIso();
  }

  function getUser(userArg) {
    if (userArg) return userArg;
    if (typeof CONFIG.currentUserProvider === 'function') {
      try { return CONFIG.currentUserProvider() || {}; } catch (_) { return {}; }
    }
    if (typeof window !== 'undefined') {
      return window.currentUser || window.authUser || window.user || {};
    }
    return {};
  }

  function userName(user) {
    return user?.displayName || user?.name || user?.nombre || user?.email || user?.uid || 'usuario_app';
  }

  function userUid(user) {
    return user?.uid || user?.id || user?.userId || '';
  }

  function userEmail(user) {
    return user?.email || user?.correo || '';
  }

  function itemIdentity(item) {
    return String(
      item?.id ??
      item?.uid ??
      item?.itemId ??
      item?.lineId ??
      item?.codigo ??
      item?.referencia ??
      item?.sku ??
      item?.documento ??
      item?.numero ??
      ''
    );
  }

  function sameItem(item, targetId) {
    const id = String(targetId ?? '');
    if (!id) return false;
    return itemIdentity(item) === id;
  }

  function isRequiredItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.required === false) return false;
    if (item.requerido === false) return false;
    if (item.aplica === false) return false;
    if (normalizeText(item.estado) === 'anulado') return false;
    if (normalizeText(item.status) === 'anulado') return false;
    if (normalizeText(item.estadoBusqueda) === 'anulado') return false;
    return true;
  }

  function isFoundItem(item) {
    if (!isRequiredItem(item)) return true;
    if (item.encontrado === true || item.found === true || item.isFound === true) return true;
    const fields = [item.estadoBusqueda, item.foundStatus, item.estado, item.status, item.conformity, item.conformidad];
    return fields.some((field) => FOUND_STATUSES.has(normalizeText(field)));
  }

  function isNotFoundItem(item) {
    if (!isRequiredItem(item)) return false;
    if (item.encontrado === false || item.found === false || item.isFound === false) return true;
    const fields = [item.estadoBusqueda, item.foundStatus, item.estado, item.status, item.conformity, item.conformidad];
    return fields.some((field) => NOT_FOUND_STATUSES.has(normalizeText(field)));
  }

  function findItemsArray(caseData, preferredKey) {
    if (!caseData || typeof caseData !== 'object') {
      return { key: 'items', items: [] };
    }

    if (preferredKey && Array.isArray(caseData[preferredKey])) {
      return { key: preferredKey, items: caseData[preferredKey] };
    }

    for (const key of ITEM_ARRAY_KEYS) {
      if (Array.isArray(caseData[key])) {
        return { key, items: caseData[key] };
      }
    }

    return { key: 'items', items: [] };
  }

  function assertItemIds(itemIds) {
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
    const clean = ids.map((id) => String(id ?? '').trim()).filter(Boolean);
    if (!clean.length) {
      throw new Error('No se recibió ningún elemento para marcar.');
    }
    return [...new Set(clean)];
  }

  function appendLimitedHistory(existing, event) {
    const current = Array.isArray(existing) ? existing.slice(-CONFIG.maxHistory + 1) : [];
    current.push(event);
    return current;
  }

  function buildEvent({ action, caseId, itemIds, user, extra }) {
    return {
      id: `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      caseId: String(caseId || ''),
      itemIds: itemIds.map(String),
      at: nowIso(),
      byUid: userUid(user),
      byName: userName(user),
      byEmail: userEmail(user),
      source: 'mobile_found_hotfix_v77',
      ...extra
    };
  }

  function allRequiredFound(items) {
    const required = (Array.isArray(items) ? items : []).filter(isRequiredItem);
    return required.length > 0 && required.every(isFoundItem);
  }

  function buildFoundMutation(caseData, itemIds, userArg, options = {}) {
    const ids = assertItemIds(itemIds);
    const user = getUser(userArg);
    const { key, items } = findItemsArray(caseData, options.itemsKey);

    if (!Array.isArray(items) || !items.length) {
      throw new Error('El pedido no tiene elementos para registrar encontrado.');
    }

    const foundAt = nowIso();
    let matched = 0;
    const updatedItems = items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      if (!ids.some((id) => sameItem(item, id))) return item;
      matched += 1;
      return {
        ...item,
        estadoBusqueda: 'encontrado',
        foundStatus: 'encontrado',
        encontrado: true,
        found: true,
        noEncontrado: false,
        notFound: false,
        encontradoAt: item.encontradoAt || foundAt,
        foundAt: item.foundAt || foundAt,
        encontradoPor: userName(user),
        encontradoPorUid: userUid(user),
        encontradoPorEmail: userEmail(user),
        lastFoundActionVersion: VERSION
      };
    });

    if (!matched) {
      throw new Error('No se encontró el elemento dentro del pedido.');
    }

    const completed = allRequiredFound(updatedItems);
    const event = buildEvent({
      action: completed ? 'pedido_encontrado_enviado_facturacion' : 'item_encontrado',
      caseId: options.caseId,
      itemIds: ids,
      user,
      extra: { completed }
    });

    const update = {
      [key]: updatedItems,
      updatedAt: topTimestamp(),
      lastAction: completed ? 'pedido_encontrado_enviado_facturacion' : 'item_encontrado',
      lastActionBy: userUid(user),
      lastActionByName: userName(user),
      lastActionByEmail: userEmail(user),
      foundFlowVersion: VERSION,
      foundCompleted: completed,
      history: appendLimitedHistory(caseData?.history, event),
      flowTrace: appendLimitedHistory(caseData?.flowTrace, event)
    };

    if (completed) {
      Object.assign(update, {
        status: 'pendiente_facturacion',
        currentProcess: CONFIG.billingProcess,
        assignedRole: CONFIG.billingAssignedRole,
        assignedTo: '',
        assignedUid: '',
        targetRole: CONFIG.billingAssignedRole,
        targetRoles: [CONFIG.billingAssignedRole],
        visibleRoles: [CONFIG.billingAssignedRole, 'admin', 'super_admin', 'jefe_logistica', 'jefe_logistico'],
        billingStatus: 'pendiente_facturacion',
        enviadoAFacturacion: true,
        sentToBilling: true,
        sentToBillingAt: topTimestamp(),
        sentToBillingBy: userUid(user),
        sentToBillingByName: userName(user),
        noEncontrado: false,
        hasNotFoundItems: false
      });
    }

    return { update, completed, matched, key, updatedItems };
  }

  function buildNotFoundMutation(caseData, itemIds, userArg, options = {}) {
    const ids = assertItemIds(itemIds);
    const user = getUser(userArg);
    const { key, items } = findItemsArray(caseData, options.itemsKey);

    if (!Array.isArray(items) || !items.length) {
      throw new Error('El pedido no tiene elementos para registrar no encontrado.');
    }

    const notFoundAt = nowIso();
    let matched = 0;
    const reason = String(options.reason || options.observacion || '').trim();

    const updatedItems = items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      if (!ids.some((id) => sameItem(item, id))) return item;
      matched += 1;
      return {
        ...item,
        estadoBusqueda: 'no_encontrado',
        foundStatus: 'no_encontrado',
        encontrado: false,
        found: false,
        noEncontrado: true,
        notFound: true,
        noEncontradoAt: item.noEncontradoAt || notFoundAt,
        notFoundAt: item.notFoundAt || notFoundAt,
        noEncontradoPor: userName(user),
        noEncontradoPorUid: userUid(user),
        noEncontradoPorEmail: userEmail(user),
        observacionNoEncontrado: reason || item.observacionNoEncontrado || '',
        lastFoundActionVersion: VERSION
      };
    });

    if (!matched) {
      throw new Error('No se encontró el elemento dentro del pedido.');
    }

    const hasNotFound = updatedItems.some(isNotFoundItem);
    const event = buildEvent({
      action: 'item_no_encontrado',
      caseId: options.caseId,
      itemIds: ids,
      user,
      extra: { reason }
    });

    const update = {
      [key]: updatedItems,
      updatedAt: topTimestamp(),
      status: 'revision_no_encontrado',
      currentProcess: CONFIG.logisticsProcess,
      lastAction: 'item_no_encontrado',
      lastActionBy: userUid(user),
      lastActionByName: userName(user),
      lastActionByEmail: userEmail(user),
      foundFlowVersion: VERSION,
      foundCompleted: false,
      enviadoAFacturacion: false,
      sentToBilling: false,
      noEncontrado: true,
      hasNotFoundItems: hasNotFound,
      history: appendLimitedHistory(caseData?.history, event),
      flowTrace: appendLimitedHistory(caseData?.flowTrace, event)
    };

    return { update, completed: false, matched, key, updatedItems };
  }

  function requireFirestore() {
    const missing = [];
    if (!CONFIG.db) missing.push('db');
    if (typeof CONFIG.doc !== 'function') missing.push('doc');
    if (typeof CONFIG.runTransaction !== 'function') missing.push('runTransaction');
    if (missing.length) {
      throw new Error(`Faltan dependencias Firestore para LogisticaFoundFlow: ${missing.join(', ')}`);
    }
  }

  function caseDoc(caseId) {
    return CONFIG.doc(CONFIG.db, CONFIG.collectionName, String(caseId));
  }

  async function runCaseTransaction(caseId, builder) {
    requireFirestore();
    let result = null;
    await CONFIG.runTransaction(CONFIG.db, async (transaction) => {
      const ref = caseDoc(caseId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) {
        throw new Error('El pedido no existe o no está disponible.');
      }
      const caseData = snap.data() || {};
      result = builder(caseData);
      transaction.update(ref, result.update);

      if (CONFIG.writeEvents && typeof CONFIG.collection === 'function') {
        const evRef = CONFIG.doc(CONFIG.collection(CONFIG.db, CONFIG.eventCollectionName));
        transaction.set(evRef, {
          caseId: String(caseId),
          action: result.update.lastAction,
          createdAt: topTimestamp(),
          createdBy: result.update.lastActionBy || '',
          createdByName: result.update.lastActionByName || '',
          source: 'mobile_found_hotfix_v77',
          payload: {
            completed: result.completed,
            matched: result.matched,
            key: result.key
          }
        });
      }
    });
    return result;
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalText) button.dataset.originalText = button.textContent || '';
      button.disabled = true;
      button.classList.add('is-saving');
      button.textContent = label || 'Guardando...';
    } else {
      button.disabled = false;
      button.classList.remove('is-saving');
      if (button.dataset.originalText) button.textContent = button.dataset.originalText;
    }
  }

  function notify(message, type = 'ok') {
    if (typeof CONFIG.toast === 'function') {
      CONFIG.toast(message, type);
      return;
    }
    if (typeof window !== 'undefined' && typeof window.toast === 'function') {
      window.toast(message, type);
      return;
    }
    if (type === 'error') console.error(message);
    else console.log(message);
  }

  async function safeRefresh() {
    if (typeof CONFIG.refresh === 'function') {
      await CONFIG.refresh();
      return;
    }
    if (typeof window !== 'undefined') {
      const candidates = ['refreshApp', 'renderAll', 'loadCases', 'refrescarVistaActual'];
      for (const name of candidates) {
        if (typeof window[name] === 'function') {
          await window[name]();
          return;
        }
      }
    }
  }

  function lockKey(action, caseId, itemIds) {
    return `${action}:${caseId}:${assertItemIds(itemIds).sort().join('|')}`;
  }

  async function markFound(params = {}) {
    const { caseId, itemId, itemIds, button, user, itemsKey } = params;
    const ids = assertItemIds(itemIds || itemId);
    const key = lockKey('found', caseId, ids);
    if (inflight.has(key)) return { ignored: true, reason: 'duplicate_tap' };
    inflight.add(key);
    setButtonBusy(button, true, 'Guardando...');

    try {
      const result = await runCaseTransaction(caseId, (caseData) => buildFoundMutation(caseData, ids, user, { caseId, itemsKey }));
      notify(result.completed ? 'Pedido completo y enviado a Facturación.' : 'Elemento marcado como encontrado.', 'ok');
      await safeRefresh();
      return result;
    } catch (error) {
      notify(error?.message || 'No se pudo guardar Encontrado.', 'error');
      if (typeof CONFIG.onError === 'function') CONFIG.onError(error);
      throw error;
    } finally {
      setButtonBusy(button, false);
      inflight.delete(key);
    }
  }

  async function markNotFound(params = {}) {
    const { caseId, itemId, itemIds, button, user, reason, observacion, itemsKey } = params;
    const ids = assertItemIds(itemIds || itemId);
    const key = lockKey('not_found', caseId, ids);
    if (inflight.has(key)) return { ignored: true, reason: 'duplicate_tap' };
    inflight.add(key);
    setButtonBusy(button, true, 'Guardando...');

    try {
      const result = await runCaseTransaction(caseId, (caseData) => buildNotFoundMutation(caseData, ids, user, { caseId, reason, observacion, itemsKey }));
      notify('Elemento marcado como No encontrado. No se envió a Facturación.', 'ok');
      await safeRefresh();
      return result;
    } catch (error) {
      notify(error?.message || 'No se pudo guardar No encontrado.', 'error');
      if (typeof CONFIG.onError === 'function') CONFIG.onError(error);
      throw error;
    } finally {
      setButtonBusy(button, false);
      inflight.delete(key);
    }
  }

  function configure(options = {}) {
    Object.assign(CONFIG, options || {});
    return api;
  }

  function renderMobileButtons({ caseId, itemId, foundLabel = 'Encontrado', notFoundLabel = 'No encontrado' }) {
    const safeCase = String(caseId ?? '').replace(/"/g, '&quot;');
    const safeItem = String(itemId ?? '').replace(/"/g, '&quot;');
    return `
      <div class="mobile-found-actions" data-found-case-id="${safeCase}" data-found-item-id="${safeItem}">
        <button type="button" class="btn-found" data-found-action="found" data-case-id="${safeCase}" data-item-id="${safeItem}">${foundLabel}</button>
        <button type="button" class="btn-not-found" data-found-action="not_found" data-case-id="${safeCase}" data-item-id="${safeItem}">${notFoundLabel}</button>
      </div>`;
  }

  function autoBind(container) {
    const rootEl = container || (typeof document !== 'undefined' ? document : null);
    if (!rootEl || rootEl.__logisticaFoundBound) return;
    rootEl.__logisticaFoundBound = true;
    rootEl.addEventListener('click', async function (event) {
      const button = event.target.closest?.('[data-found-action]');
      if (!button) return;
      const action = button.dataset.foundAction;
      const caseId = button.dataset.caseId || button.closest('[data-found-case-id]')?.dataset.foundCaseId;
      const itemId = button.dataset.itemId || button.closest('[data-found-item-id]')?.dataset.foundItemId;
      if (!caseId || !itemId) return;
      event.preventDefault();
      if (action === 'found') await markFound({ caseId, itemId, button });
      if (action === 'not_found') await markNotFound({ caseId, itemId, button });
    });
  }

  const api = {
    VERSION,
    configure,
    markFound,
    markNotFound,
    markFoundBatch: (params = {}) => markFound(params),
    autoBind,
    renderMobileButtons,
    buildFoundMutation,
    buildNotFoundMutation,
    allRequiredFound,
    isFoundItem,
    isNotFoundItem,
    _private: { normalizeText, findItemsArray, assertItemIds, isRequiredItem }
  };

  if (typeof window !== 'undefined') {
    window.handleEncontradoSeguro = function (caseId, itemId, button, user) {
      return markFound({ caseId, itemId, button, user });
    };
    window.handleNoEncontradoSeguro = function (caseId, itemId, button, observacion, user) {
      return markNotFound({ caseId, itemId, button, observacion, user });
    };
  }

  return api;
});
