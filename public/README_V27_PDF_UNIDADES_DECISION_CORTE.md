# V27 · PDF con todas las unidades y decisión de corte en recepción

Cambios:

- El lector PDF ahora intenta extraer líneas del pedido en múltiples unidades: M, MT, MTR, METROS, KG, KLS, UND, UNIDADES, CAJA, ROLLO, PAR, KIT, LITROS, entre otras.
- Las líneas no cable, por ejemplo KG o UND, quedan como líneas normales de alistamiento.
- Los cables en metros quedan como candidatos de corte.
- En Recepción, por cada candidato de corte, el usuario decide:
  - Enviar a corte.
  - No cortar, porque se entrega carreto completo.
- Alistamiento visualiza todas las líneas detectadas y la decisión tomada en recepción.
- Solo las líneas marcadas como “Enviar a corte” generan solicitudes reales para el módulo de corte.
- Se conserva V26: notificaciones, Drive, evidencias, entrega obligatoria, certificado y VSM.

Nota: si el PDF es escaneado como imagen, PDF.js no puede extraer texto sin OCR.
