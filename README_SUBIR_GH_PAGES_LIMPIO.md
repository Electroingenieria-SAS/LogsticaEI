# V135 GitHub Pages limpio

Este paquete es una salida de publicación limpia para evitar que el despliegue arrastre carpetas de desarrollo, pruebas, docs, zips o duplicados.

Uso recomendado:
1. Crear una rama nueva `gh-pages-clean` o usar `gh-pages`.
2. Subir SOLO el contenido de esta carpeta a la raíz de esa rama.
3. En GitHub: Settings > Pages > Deploy from a branch > rama `gh-pages` o `gh-pages-clean` > /root.
4. No usar workflow de Actions para publicar esta app estática.

Incluye la corrección V135 de Alistamiento unificado, `app.js`, `index.html`, `service-worker.js`, activos, estilos, manifest, Firebase config, corte-control y VSM.

No incluye docs, tests, paquetes hotfix viejos ni carpeta public duplicada.
