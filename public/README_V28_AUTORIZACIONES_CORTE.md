# V28 · Autorizaciones internas de corte

Cambios sobre V27:

- Se agrega botón **Abrir autorización de corte** dentro del módulo completo de corte.
- Si el sobrante es **igual a 50 m**, el corte queda bloqueado hasta aprobación de **jefe logístico** o **super admin**.
- Si el sobrante es **menor a 50 m**, el corte queda bloqueado hasta aprobación de **gerencia** o **super admin**.
- Esta autorización es independiente del **requerimiento a Ventas**.
- El requerimiento a Ventas se conserva para problemas como cable no disponible, chipa mayor para vender completa, mal registro del pedido u otros.
- El auxiliar de corte puede solicitar autorización después de registrar metros disponibles y metros a cortar.
- El autorizador puede aprobar o rechazar desde el módulo de aprobaciones o abriendo el corte.
- No permite iniciar cronómetro si la aprobación requerida está pendiente.
- Se conserva V27: lectura PDF por unidades, decisión de corte en recepción, notificaciones, Drive, evidencias, SIESA, VSM y certificado.
