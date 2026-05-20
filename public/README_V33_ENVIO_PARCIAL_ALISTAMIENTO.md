# V33 · Envío parcial desde alistamiento

Cambios:

- En Alistamiento se agrega botón **Crear envío parcial**.
- La lista marcada desde el PDF permite registrar cantidades disponibles para enviar.
- Se crea un caso hijo de envío parcial hacia Facturación.
- El pedido original queda abierto en Alistamiento con saldos pendientes.
- Se conserva la trazabilidad del PDF, líneas, saldos y motivo del envío parcial.
- Si hay novedades, el pedido completo no avanza; pero se puede despachar lo disponible mediante envío parcial.

No requiere cambio estructural de Firebase si ya están publicadas las reglas V31/V32.
