# V25 - Actualización automática y notificaciones

Cambios:

- Escucha en tiempo real de Firestore para casos visibles según rol.
- Refresco silencioso de respaldo cada 25 segundos.
- Notificación interna cuando un caso cambia de estado, proceso o asignación.
- Notificación del navegador si el usuario activa permisos.
- Si el usuario está llenando un formulario, la app no borra lo digitado; muestra aviso para actualizar la vista.
- No requiere cambio de estructura en Firebase.

Recomendación:

1. Subir versión completa.
2. Limpiar caché/PWA.
3. Activar notificaciones desde el botón visible en la app.
