# V26 · Notificaciones para todo

Cambios aplicados sobre V25/V24/V23 sin reconstruir módulos:

- Notificaciones internas para todos los eventos del flujo.
- Avisos por cambios de etapa, cambios de estado, asignaciones, requerimientos, respuestas, evidencias, fotos de entrega, cortes, cierres, aprobaciones y exportaciones SIESA.
- Escucha en tiempo real de `case_events` para todos los roles, no solo admin/jefe/gerencia.
- Los eventos ahora guardan `visibleRoles`, `targetRole`, `assignedRole`, `sourceRole`, pedido, cliente y proceso para enrutar notificaciones.
- Toast visual + sonido interno + notificación del navegador si el usuario activa permisos.
- Cola corta de notificaciones para no saturar cuando llegan varios eventos a la vez.
- Reglas de Firestore actualizadas para permitir lectura de eventos según rol visible/asignado.

Importante: publicar `firestore.rules` en Firebase para que todos los roles puedan recibir sus eventos.
