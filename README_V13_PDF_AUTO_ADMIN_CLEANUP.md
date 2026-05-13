# V13 · PDF automático y limpieza de pruebas

Cambios incluidos:

1. Lectura más exhaustiva del PDF con PDF.js.
2. Autollenado de todos los campos vacíos detectables: pedido, tipo, cliente, NIT/CC, dirección, ciudad, teléfono, asesor, fecha, forma de pago, entrega y observaciones.
3. Detección automática de cables en metros con unidades M, MT, MTS, MTR, MTRS, ML, M/L, METRO y METROS.
4. Creación automática de solicitudes de corte desde el PDF, con referencia, descripción, cantidad y unidad.
5. Panel de Administración con limpieza de pruebas:
   - Excluir/restaurar casos del VSM y KPIs.
   - Eliminar definitivamente casos de prueba para admin/super admin.
6. Los KPIs y exportaciones ignoran los casos marcados como excluidos del VSM.

Importante:
- Si el PDF es escaneado como imagen, PDF.js no puede leer texto; se requerirá OCR o digitación manual.
- Después de subir esta versión, publique también firestore.rules para permitir limpieza de eventos por admin/super admin.
