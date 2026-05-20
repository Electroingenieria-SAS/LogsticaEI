# V40 · PDF SIESA robusto

Esta versión corrige la extracción de líneas del pedido desde PDF para evitar que la descripción se mezcle con Bodega o Ubicación.

Campos extraídos y mostrados:

- Referencia
- Descripción
- Cantidad
- U.M.
- Ubicación

La lógica usa la tabla visual del PDF y prioriza la fila completa. Si falla el lector, se conserva la edición manual con botón Editar, Agregar línea y Eliminar línea.

Ejemplo validado con `4055-1(1).pdf`:

- 3122522 · FUSIBLE HILO 15KV TIPO K 1A · 36 · UND · R20103
- 3122522 · FUSIBLE HILO 15KV TIPO K 1A · 36 · UND · R30101
- 3930020 · CONTACTOR 32A AC3 220VAC CHINT NC1-3210 00936 · 18 · UND ·
- 4322435 · CINTA TEMFLEX 3M 18MM X 18MTS NEGRO · 180 · UND · P20239
- 3122523 · FUSIBLE HILO 15KV TIPO K 2A · 36 · UND · R20104
- 3122523 · FUSIBLE HILO 15KV TIPO K 2A · 36 · UND · R30101
- 3212364 · EMPALME DERIVACION GEL GHFC1 6-2AWG 14-8AWG TYCO 1989145-1 · 288 · UND · B10901
