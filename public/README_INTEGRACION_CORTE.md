# Trazabilidad logística integrada con control de corte

## Flujo operativo

1. **Ventas** crea el pedido registrando únicamente el número o nombre del pedido y el tipo: PVC, PVN, ventas u otro.
2. **Recepción de pedidos** carga el PDF oficial del pedido, lee número, cliente, forma de pago y líneas de producto.
3. **Recepción** valida el documento y envía el caso a **Alistamiento**.
4. **Alistamiento** verifica físicamente las líneas, decide cuáles requieren corte y crea solicitudes de corte vinculadas al pedido.
5. La **app de corte** se abre desde la trazabilidad con pedido, referencia y metros ya diligenciados.
6. La app de corte conserva su Firebase propio, su Drive propio y sus reglas de remanente, aprobación, cronómetro, foto inicial y foto final.
7. Al guardar el corte, la app de corte notifica a la app de trazabilidad por `postMessage` y además deja un respaldo local en `localStorage` para sincronización manual.
8. La trazabilidad actualiza el estado del corte, el consecutivo, duración, responsable y enlaces de evidencia si existen.
9. El caso continúa a compromiso de mercancía, facturación, caja o despacho según el flujo normal.

## Estructura de carpetas

- `/index.html`, `/app.js`, `/styles.css`: aplicación principal de trazabilidad.
- `/corte-control/index.html`: aplicación de corte integrada.
- `/public/`: copia compatible con Firebase Hosting.
- `/public/corte-control/`: copia de la aplicación de corte para despliegue Firebase.

## Firebase y Drive

- Se conserva Firebase de trazabilidad: `trazabilidadlog`.
- Se conserva Firebase de corte: `control-corte-cable`.
- Las evidencias de corte se guardan en Drive de corte.
- Las fotos quedan separadas por carpeta de responsable y luego por mes.

## Sincronización de cortes

Cuando el corte se abre desde trazabilidad, se envía un paquete con:

- `caseId`
- `cutId`
- `pedido`
- `tipoPedido`
- `referencia`
- `metrosSolicitados`
- `disponibleAntes`
- `cliente`

Al guardar el corte, se devuelve:

- consecutivo de corte
- estado
- duración
- responsable
- enlace de foto inicial
- enlace de foto final

Si la ventana principal no estaba abierta, use el botón **Sincronizar cortes** dentro del caso de trazabilidad.
