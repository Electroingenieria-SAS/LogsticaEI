# Electroingeniería · Trazabilidad Logística

Versión preparada para publicar con GitHub Pages.

## Arquitectura

```text
GitHub Pages = publicación de la app
Firebase Authentication = login
Cloud Firestore = base de datos
Google Drive / Apps Script = evidencias fotográficas opcionales
```

## Estructura correcta para GitHub Pages

Los archivos principales deben quedar en la raíz del repositorio:

```text
index.html
app.js
styles.css
firebase-config.js
manifest.json
service-worker.js
assets/
```

No deben quedar dentro de `public/` para esta versión.

## Cómo subir a GitHub

1. Entra al repositorio.
2. Clic en `Add file`.
3. Clic en `Upload files`.
4. Arrastra todo el contenido de esta carpeta.
5. Clic en `Commit changes`.

## Activar GitHub Pages

En el repositorio:

```text
Settings
↓
Pages
↓
Build and deployment
↓
Source: Deploy from a branch
↓
Branch: main
↓
Folder: / root
↓
Save
```

La app debe abrir desde una URL parecida a:

```text
https://TU_USUARIO.github.io/NOMBRE_REPOSITORIO/
```

## Firebase sigue siendo necesario

En Firebase Console debe estar activo:

```text
Authentication
Email/Password
Firestore Database
Colección users
Documento users/UID del primer usuario
```

## Primer usuario

Crear primero el usuario en Firebase Authentication.

Luego en Firestore:

```text
users / UID_DEL_USUARIO
```

Campos:

```json
{
  "name": "Juanes Pérez",
  "email": "correo@empresa.com",
  "role": "admin",
  "isActive": true,
  "createdAt": "2026-05-09T20:00:00.000Z"
}
```

## Roles válidos

```text
admin
gerencia
ventas
logistica
alistamiento
facturacion
caja
despacho
inventarios
jefe_logistico
auditoria
```

## Importante

Esta versión no necesita `firebase deploy` para publicarse.  
Solo requiere GitHub Pages para publicar los archivos estáticos.

Firebase se usa únicamente como backend de datos y autenticación.


## Corrección pantalla de error `Unexpected token 'async'`

Esta versión usa `app.github.fix.js` para romper caché anterior de GitHub Pages o service worker.

Después de subir los archivos:

1. Espera 1 a 2 minutos.
2. Abre la URL con `?v=fix2`.
3. Presiona `Ctrl + F5`.

Ejemplo:

```text
https://TU_USUARIO.github.io/TU_REPOSITORIO/?v=fix2
```

Si todavía carga una versión anterior, en el navegador:

```text
F12 → Application → Storage → Clear site data
```

o abre en una ventana incógnita.
