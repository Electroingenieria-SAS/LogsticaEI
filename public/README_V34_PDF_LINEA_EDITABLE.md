# V34 · Lectura estricta del PDF por línea y edición manual

Cambios:

- La extracción de líneas del PDF ahora es más estricta y evita unir filas vecinas, reduciendo mezclas entre productos, valores y textos del pedido.
- Recepción puede revisar y editar las líneas detectadas antes de guardar: referencia, descripción, cantidad, unidad, decisión de corte y observación.
- Recepción puede quitar líneas mal detectadas y agregar líneas manuales cuando el PDF venga mal generado o PDF.js no pueda leer correctamente la tabla.
- Solo las líneas validadas en esta tabla pasan a Alistamiento.
- Los cables en metros siguen permitiendo decidir: enviar a corte o no cortar porque se entrega carreto completo.
- Conserva envío parcial, alistamiento marcable, notificaciones, Drive, VSM, SIESA, autorizaciones de corte, roles y despachos.

QA básico:

- Sintaxis app.js validada.
- app.js raíz y public/app.js sincronizados.
- service-worker actualizado a V34.
