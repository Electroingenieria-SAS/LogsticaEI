# V41 - Lector PDF SIESA completo

Corrige la extracción para no quedarse con solo dos líneas.

Campos objetivo por línea:
- Referencia
- Descripción completa
- Cantidad
- U.M.
- Ubicación

El lector usa dos estrategias:
1. Bloques PDF.js tipo `UND $6.0003122522 PARQUE` + descripción en líneas siguientes.
2. Filas visuales donde la referencia aparece al inicio.

Se conserva edición por botón y toda la funcionalidad anterior.
