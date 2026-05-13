# V4 · Firebase principal unificado

Esta versión elimina la dependencia operativa del Firebase separado de corte.

## Decisión aplicada

- Un solo login: el login principal.
- Un solo Firebase: `trazabilidadlog`.
- Una sola colección de usuarios: `users`.
- El auxiliar de corte ingresa con rol `auxiliar_corte` y entra directo a su bandeja de cortes.
- La carpeta `corte-control/` queda solo como redirección informativa al login principal.
- El Drive queda unificado con carpetas por año, mes, proceso, responsable, pedido y caso.

## Flujo de corte

1. Ventas registra el pedido.
2. Recepción carga el PDF.
3. Alistamiento define qué líneas requieren corte.
4. El auxiliar de corte ve las solicitudes en su módulo.
5. Para iniciar corte debe subir foto inicial.
6. Solo después se inicia el cronómetro.
7. Para finalizar corte debe subir foto final.
8. El tiempo queda guardado dentro del caso en `cutRequests` y alimenta KPIs VSM.
9. Si hay novedad, el requerimiento de corte se envía al panel de Ventas.

## Requerimientos de corte hacia Ventas

Motivos configurados:

- Cable no disponible en su totalidad para el corte.
- Chipa con cantidad mayor que se puede vender toda.
- Mal registro del pedido.
- Otros.

## KPIs y dashboard

El panel de indicadores queda disponible solo para:

- `jefe_logistica`
- `gerencia`
- `admin`

Incluye filtros por fecha y macroproceso, VSM, VA/NVA, WIP, FPY, reproceso, cortes finalizados, requerimientos y exportación a Excel `.xls` con tablas de dashboard, VSM, casos y cortes.

## Reglas Firestore

Puedes mantener las reglas actuales de la app principal siempre que incluyan el rol `auxiliar_corte`. Ya no necesitas publicar reglas del Firebase de corte separado para operar el módulo.

## Drive

Configura `window.appSettings.driveUploadUrl` en `firebase-config.js` con la URL publicada del Apps Script. La estructura será:

```text
EVIDENCIAS_TRAZABILIDAD_LOGISTICA/
  Año/
    Mes/
      Proceso/
        Responsable/
          Pedido/
            Caso/
              Archivo
```
