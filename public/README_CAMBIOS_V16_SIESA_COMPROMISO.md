# V16 · Archivo plano SIESA y flujo de compromiso

## Cambios principales

1. Se agregó exportación de archivo plano para cortes finalizados pendientes de actualización en SIESA.
2. Cada corte finalizado queda con `siesaExportStatus: PENDIENTE` hasta exportarse.
3. El botón **Exportar plano SIESA pendiente** aparece en el módulo de corte y en KPIs.
4. La app sugiere/obliga exportación cuando:
   - Hay 20 cortes finalizados pendientes, o
   - Un pedido con cortes queda totalmente finalizado y aún tiene cortes pendientes por exportar.
5. El archivo generado es `.txt` delimitado por `|`, configurable desde `firebase-config.js > appSettings.siesaFlatFile`.
6. Se agregó colección `siesa_exports` para auditoría del lote exportado.
7. Se editó el flujo:
   - Recepción de pedidos
   - Compromiso inicial de mercancía
   - Alistamiento
   - Corte de cable, si aplica
   - Ratificar compromiso antes de facturar
   - Facturación
   - Caja / rutas de entrega
8. En recepción se agregó el parámetro obligatorio: **¿Mercancía comprometida inicialmente en SIESA/ERP?**
9. En compromiso inicial y ratificación se puede cancelar/cerrar por devolución, cancelación o novedad.

## Configuración del plano SIESA

En `firebase-config.js` y `public/firebase-config.js`:

```js
siesaFlatFile: {
  delimiter: "|",
  includeHeader: false,
  movementCode: "CORTE",
  warehouse: "",
  company: "",
  cutBatchSize: 20
}
```

Campos del archivo por línea:

```txt
MOVIMIENTO|EMPRESA|BODEGA|PEDIDO|CORTE|FECHA|REFERENCIA|DESCRIPCION|CANTIDAD|UNIDAD|DISPONIBLE|SOBRANTE|RESPONSABLE|LOTE_EXPORTACION|OBSERVACION
```

Por defecto se genera sin encabezado para no romper importaciones. Si SIESA exige encabezado, cambiar `includeHeader: true`.

## Importante

La estructura exacta de SIESA puede variar por versión, documento, compañía y parametrización. Esta versión deja el exportador parametrizable. Cuando la empresa confirme con soporte/consultor SIESA la estructura exacta del documento de inventario que van a importar, se ajustan columnas, códigos fijos, bodega, centro de operación y tipo de movimiento.

## Reglas Firebase

Publicar también `firestore.rules`, porque se agregó permiso para la colección `siesa_exports`.
