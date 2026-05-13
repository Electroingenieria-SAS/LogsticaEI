# V15 - Corrección guardar PDF y carga de evidencias

Correcciones principales:

1. Se agregó la función faltante `mergePdfExtractionIntoCase`, que causaba `ReferenceError` al guardar el PDF.
2. El PDF leído ahora autollenará únicamente campos vacíos del caso.
3. Las líneas detectadas del PDF se fusionan sin duplicar y generan cortes automáticos.
4. Se actualizó la versión de `index.html` para evitar que GitHub Pages siga cargando `app.js` V13.
5. Se reforzó el `service-worker.js` para no romper la app con errores de caché cuando cambia la red.
6. Se agregó `mobile-web-app-capable` para evitar la advertencia móvil.

Después de subir a GitHub, limpiar caché o desregistrar el Service Worker anterior.
