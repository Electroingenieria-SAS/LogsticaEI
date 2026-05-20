# V32 - Alistamiento marcable desde líneas del PDF

Cambios aplicados sobre V31 sin reconstruir desde cero:

- En alistamiento se agrega lista marcable basada en las líneas leídas del PDF.
- Cada línea puede marcarse como Encontrado, Pendiente, No encontrado o Novedad.
- Si se marca No encontrado o Novedad, la app genera solicitud al rol unificado líder/coordinador logístico (`coordinador_logistico`).
- El caso queda en espera hasta que el requerimiento sea resuelto.
- El avance a facturación queda bloqueado si hay líneas pendientes o novedades/no encontrados sin resolver.
- Se conserva la lógica previa de cortes, Drive, despacho, roles unificados, notificaciones, VSM/SIESA y certificado.

No requiere cambio estructural de Firebase. Si se presentan permisos con requerimientos/eventos, publicar el `firestore.rules` incluido.
