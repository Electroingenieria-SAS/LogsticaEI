# Hotfix V79 — Registro de Ventas

## Cambio solicitado

El módulo deja de llamarse **Ventas Diarias** y pasa a llamarse **Registro de Ventas**.

Al presionar **Actualizar**, debe cargar **TODOS los registros de ventas**, no solo los del día y no solo dos registros.

## Corrección aplicada

Se agrega `logistica-sales-registry-panel-fix.js`, que:

- No usa `limit(2)`.
- No usa `.slice(0, 2)`.
- No filtra por fecha del día.
- Carga todos los registros disponibles de la colección configurada.
- Excluye registros eliminados/archivados.
- Deduplica por ID/pedido/radicado.
- Ordena por fecha de creación o campo configurado.
- Renombra visualmente títulos detectados de Ventas Diarias a Registro de Ventas.
- Mantiene alias de compatibilidad para no romper llamadas viejas como `actualizarPanelVentasDiarias()`.

## Instalación en `index.html`

Antes de `</head>`:

```html
<link rel="stylesheet" href="./logistica-sales-registry-panel-fix.css?v=v79-registro-ventas-full">
```

Antes de `</body>`, después de Firebase/app.js:

```html
<script src="./logistica-sales-registry-panel-fix.js?v=v79-registro-ventas-full"></script>
```

## Configuración en `app.js`

```js
LogisticaSalesRegistryPanel.configure({
  db,
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  collectionName: 'cases',
  orderByField: 'createdAt',
  patchLegacyUpdater: true
});
```

Si la colección real no es `cases`, cambiar `collectionName` por `ventas`, `pedidos`, `dailySales` o el nombre real.

## QA manual requerido en la app real

1. Abrir el módulo antes llamado Ventas Diarias.
2. Confirmar que el título visible ahora sea Registro de Ventas.
3. Presionar Actualizar.
4. Validar que cargue ventas de diferentes fechas, no solo del día actual.
5. Validar que cargue más de dos registros.
6. Validar en celular y PC.
7. Validar que no se afecten encontrado, facturación, caja, logística, anexos ni reportes.
