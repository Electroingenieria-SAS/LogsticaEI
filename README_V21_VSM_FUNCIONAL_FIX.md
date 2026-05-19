# V21 - Corrección funcional del módulo VSM

Correcciones aplicadas:

- Se corrigió el error real que impedía abrir VSM: faltaba la función `bars()` usada por el dashboard.
- Se restauraron funciones de drawer/modal (`drawer`, `modal`, `closeDrawer`) que varios módulos usaban para abrir formularios.
- Se agregó protección al clic de rutas para mostrar error visible si algún módulo falla.
- Se actualizó caché/versionado a V21.
- Se conserva la lógica previa: PDF obligatorio, cortes automáticos, compromiso inicial, alistamiento, ratificación de compromiso, SIESA, Drive y roles.

Prueba QA realizada: sintaxis JS OK, funciones VSM requeridas presentes, rutas VSM/Admin disponibles para super admin/admin/gerencia/jefe logística.
