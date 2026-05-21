# V50 - PDF universal + cortes por unidad M

- Lector PDF.js por columnas con fallback textual.
- Extrae solo Referencia, Descripción, Cantidad, U.M. y Ubicación.
- Mantiene todas las líneas detectadas del PDF.
- Si la U.M. es M, MT, MTR, MTS, ML o METROS, la línea queda como candidata de corte.
- En recepción se debe decidir: Enviar a corte o No cortar / carreto completo.
- Si la plantilla cambia y el lector estricto no detecta nada, usa lector anterior como respaldo y mantiene edición manual.
