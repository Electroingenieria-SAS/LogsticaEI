# V5 - Solución a Missing or insufficient permissions

Esta versión corrige el error que aparecía al iniciar el módulo de corte:

`Missing or insufficient permissions.`

## Causa principal

La app estaba usando una sesión guardada en `sessionStorage` antes de que Firebase Auth terminara de restaurar la sesión real. En ese momento Firestore recibía la consulta sin `request.auth`, por eso las reglas respondían sin permisos.

Además, si se publicaban reglas por rol, la app intentaba consultar todos los casos al iniciar. Firestore no filtra documentos después de leerlos: la consulta debe coincidir con las reglas.

## Correcciones aplicadas

1. La app ya no carga datos desde una sesión local falsa.
2. Ahora espera `auth.onAuthStateChanged` antes de consultar Firestore.
3. El usuario se valida contra `/users/{uid}` antes de entrar al panel.
4. El auxiliar de corte consulta casos con `hasCuts == true`.
5. Los roles operativos consultan sus casos por `assignedRole` y `createdBy`.
6. Jefe logística, gerencia y admin pueden consultar todo.
7. Se actualizó `firestore.rules` para el esquema de un solo Firebase.
8. Se cambió la versión del service worker a V5 para evitar caché viejo.

## Pasos obligatorios después de subir a GitHub

1. Publicar las reglas `firestore.rules` en Firebase.
2. Confirmar que el usuario tenga documento en `/users/{uid}` con:
   - `role: "auxiliar_corte"` para corte
   - `isActive: true`
3. En el navegador abrir:
   - DevTools → Application → Service Workers → Unregister
   - Application → Storage → Clear site data
4. Volver a cargar la página con Ctrl + F5.

## Roles para KPIs globales

Solo ven KPIs globales:

- `jefe_logistica`
- `gerencia`
- `admin`
- `super_admin`

## Corte

Corte ya es un módulo interno del Firebase principal. No usa Firebase separado ni login propio.
