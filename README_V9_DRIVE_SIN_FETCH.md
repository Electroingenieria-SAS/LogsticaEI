# V9 - Drive sin fetch directo

Esta versión corrige el error `Failed to fetch` al subir evidencias a Google Drive desde GitHub Pages.

Cambio técnico:
- La app ya no sube evidencias con `fetch()` directo al Apps Script.
- Usa un formulario oculto + iframe + `postMessage`, para evitar bloqueos CORS del navegador.
- El Apps Script debe actualizarse con el nuevo `apps-script/Code.gs` y volver a desplegarse como Web App.

Pasos obligatorios:
1. Reemplace el código del proyecto de Apps Script con `apps-script/Code.gs`.
2. Haga una nueva implementación Web App.
3. Mantenga acceso: Anyone / Cualquiera.
4. Pegue la URL `/exec` si cambia.
5. Suba esta versión completa a GitHub.
6. Limpie caché / service worker.
