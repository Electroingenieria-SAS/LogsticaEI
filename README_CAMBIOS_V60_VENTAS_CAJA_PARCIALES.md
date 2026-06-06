# Cambios V60 - Ventas, Caja, parciales y descargas

## Ajustes implementados

1. **Pedidos retenidos desde Ventas**
   - Ventas puede crear un pedido como retenido.
   - El pedido retenido entra directamente a Caja.
   - Caja puede cerrarlo directamente y devolverlo a Recepción de pedidos.
   - Caja también puede enviarlo a gestión del asesor de Ventas; al responder Ventas, el caso vuelve a Caja para verificar pago y continuar.

2. **Orden de compra en Ventas**
   - Se agregó campo de Orden de compra / OC al registro inicial del pedido.
   - La OC queda visible en el detalle del caso y en el recuento de ventas.

3. **Recuento diario y trazabilidad para Ventas**
   - Nuevo módulo `Ventas diaria`.
   - Permite buscar por pedido, OC, factura, cliente, asesor, proceso o estado.
   - Muestra pedidos por asesor con gráfica interna.
   - Permite descargar informe en Excel HTML.
   - Cada pedido abre un popup con información general y anexos.

4. **Anexos descargables**
   - En el detalle de ventas se consolidan PDF, evidencias generales y evidencias de entrega/facturación.
   - Los anexos quedan accesibles con botón de descarga/apertura desde Drive.

5. **Novedad de no entrega**
   - Ventas puede reportar no entrega al cliente.
   - El requerimiento se asigna a Logística / despacho.
   - Permite adjuntar soporte opcional y queda en trazabilidad del pedido.
   - Logística puede cerrar la gestión con evidencia usando el flujo normal de evidencias y respuesta de requerimiento.

6. **Pedidos parciales y reenvío de faltantes**
   - Se conserva la creación de envío parcial desde Alistamiento.
   - Ventas puede reenviar faltantes cuando llegue el saldo pendiente.
   - El faltante entra nuevamente al flujo desde Recepción de pedidos con las líneas pendientes.

7. **Limpieza de archivos**
   - Se eliminaron README antiguos duplicados dentro de `public`.
   - Se eliminaron notas de cambios viejas y archivo `app.github.fix.js` sin referencia activa.
   - Se conservaron `app.js` raíz y `public/app.js` porque la raíz sirve para GitHub Pages y `public` para Firebase Hosting.

## Archivos principales modificados

- `public/app.js`
- `app.js`
- `public/index.html`
- `index.html`
- `public/service-worker.js`
- `service-worker.js`
