# Cambios V62 · OC visible y guía por pasos

## Archivos modificados
- `app.js`
- `public/app.js`
- `styles.css`
- `public/styles.css`
- `index.html`
- `public/index.html`
- `service-worker.js`
- `public/service-worker.js`

## Ajustes aplicados

1. **Orden de compra visible en el título del pedido**
   - El título del caso ahora muestra: `Pedido · OC XXXXX` cuando el pedido tenga orden de compra.
   - Aplica en la bandeja de casos, detalle del pedido, notificaciones/resúmenes y recuento de ventas.
   - Se mantiene el pedido como referencia principal, pero la OC queda visible para que Ventas pueda rastrear el origen comercial.

2. **Búsqueda mejorada por OC**
   - El buscador de casos ahora incluye orden de compra, factura, asesor, cliente, estado, entrega solicitada y proceso.
   - Esto evita que Ventas tenga que abrir pedido por pedido para ubicar una OC.

3. **Guía rápida por proceso**
   - En el detalle del caso se agregó una tarjeta superior llamada “Guía rápida del proceso”.
   - Cada proceso muestra 4 pasos claros según la etapa actual: recepción, alistamiento, corte, facturación, caja, despacho local/nacional, cliente recoge y cliente en punto.
   - La guía ayuda a que cada usuario sepa qué debe hacer sin sentirse saturado por toda la información del caso.

4. **Crear pedido en 4 pasos**
   - En Ventas se agregó una guía visual antes del formulario de creación.
   - Explica el orden correcto: pedido + OC, cliente/tipo de entrega, tipo de gestión y observación.

5. **Ajuste visual compacto**
   - Se agregaron estilos para pasos numerados, subtítulo del pedido y chip visual de OC.
   - La información crítica queda arriba y el resto del flujo permanece igual.

6. **Caché actualizado**
   - Nueva versión: `v62-oc-guia-pasos`.
   - Esto fuerza la carga de los archivos nuevos en GitHub/Firebase y evita que el navegador conserve la V61.
