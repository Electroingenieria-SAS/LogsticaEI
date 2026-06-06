# V63 · Sonidos de notificación y feedback visual de cargue

## Archivos modificados
- `app.js`
- `public/app.js`
- `styles.css`
- `public/styles.css`
- `index.html`
- `public/index.html`
- `service-worker.js`
- `public/service-worker.js`

## Assets nuevos
- `assets/sounds/universfield-new-notification-051-494246.mp3`
- `assets/sounds/te-llego-un-requerimiento.mp3`
- `assets/sounds/te-llego-un-reporte.mp3`
- `assets/sounds/tu-pedido-lleva-mas.mp3`
- `assets/sounds/tienes-un-nuevo-pedido.mp3`
- `assets/sounds/han-cerrado-tu-pedido.mp3`
- `assets/feedback/art-spinning-sticker.gif`
- `assets/feedback/hands-up-ok-gauss.gif`

Los mismos assets también se agregaron en `public/assets/...` para Firebase Hosting.

## Cambios aplicados
1. Toda notificación general reproduce `universfield-new-notification-051-494246.mp3`.
2. Los requerimientos reproducen el sonido general y luego `te-llego-un-requerimiento.mp3`.
3. Los reportes reproducen el sonido general y luego `te-llego-un-reporte.mp3`.
4. Los recordatorios de pedido vencido o en espera reproducen `tu-pedido-lleva-mas.mp3`.
5. Los pedidos nuevos reproducen el sonido general y luego `tienes-un-nuevo-pedido.mp3`.
6. Los cierres correctos reproducen el sonido general y luego `han-cerrado-tu-pedido.mp3`.
7. Al subir cualquier evidencia a Drive aparece el popup con `art-spinning-sticker.gif`.
8. Cuando Drive confirma el cargue aparece el popup de confirmación con `hands-up-ok-gauss.gif`.
9. Se actualizó la caché PWA a `ei-trazabilidad-v63-sonidos-feedback-cargue`.
10. Se actualizó el versionado de `index.html` para evitar que GitHub o Firebase carguen la V62.
