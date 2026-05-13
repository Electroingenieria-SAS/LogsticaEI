# V14 - Corrección permisos de eliminación y panel de Ventas para Super Admin

## Cambios

1. Se actualizan las reglas de Firestore para permitir eliminación administrativa a:
   - `admin`
   - `super_admin`
   - `super_administrador`

2. Se agrega permiso de eliminación para colecciones auxiliares usadas por la limpieza:
   - `cases`
   - `requirements`
   - `evidences`
   - `case_events`
   - `kpis`
   - `system_config`
   - cualquier documento auxiliar mediante regla recursiva de delete solo para admin/super admin.

3. El Super Admin ahora ve el panel de Ventas / Crear pedido.

4. `canCreate()` permite crear pedido a:
   - ventas
   - admin
   - super_admin
   - super_administrador

5. Si una eliminación falla por reglas no publicadas, la app ya no se queda en pantalla de error general; muestra una alerta y conserva el panel administrativo.

## Obligatorio

Publicar el archivo `firestore.rules` en Firebase Console o mediante Firebase CLI.

Si no se publican estas reglas, la app puede seguir mostrando `Missing or insufficient permissions` al eliminar pruebas.
