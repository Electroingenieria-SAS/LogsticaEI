# V18 · PDF obligatorio, checklist automático y admin desbloqueado

Cambios aplicados sobre V17 sin reconstruir la arquitectura:

1. Recepción de pedidos queda como primera etapa obligatoria.
2. No se puede pasar a Compromiso inicial si no se carga, lee y guarda en Drive el PDF oficial.
3. El checklist de Recepción se llena automáticamente desde PDF.js: pedido, cliente, forma de pago, líneas, unidades y cortes detectados.
4. Los cortes se generan automáticamente desde líneas en metros detectadas en el PDF.
5. Al pasar a Alistamiento, el checklist base se precarga desde las líneas detectadas y los cortes vinculados.
6. El flujo queda forzado: Recepción → Compromiso inicial → Alistamiento → Ratificación del compromiso → Facturación.
7. Se normalizaron roles para que super_admin, super_administrador, super admin y superadmin puedan abrir VSM y Admin.
8. Se agregó renderAdmin(), exclusión/inclusión de casos del VSM y eliminación administrativa de casos de prueba.
9. Se actualizó cache PWA a V18.

Después de subir a GitHub, publicar también firestore.rules en Firebase y limpiar caché del navegador/PWA.
