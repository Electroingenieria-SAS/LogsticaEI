# V20 - Corrección acceso VSM y Admin

Correcciones aplicadas sobre V19:

- Normalización estricta del rol al iniciar sesión.
- `super_admin`, `super_administrador`, `super admin`, `superadmin`, `Super Admin` y variantes quedan tratados como super admin dentro de la app.
- Alias de ruta: `vsm`, `kpis` e `indicadores` abren `indicators`; `administracion` y `administrador` abren `admin`.
- VSM y Admin quedan visibles para super admin.
- Reglas de Firestore ampliadas para aceptar variantes comunes de rol de super administrador.

Importante: publicar `firestore.rules` en Firebase y limpiar caché/PWA después de subir.
