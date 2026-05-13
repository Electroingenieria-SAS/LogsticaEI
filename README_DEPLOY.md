# Electroingeniería · despliegue GitHub + Firebase

## Estructura

```text
public/                  app web PWA
firebase.json            configuración de Firebase Hosting
firestore.rules          reglas de Firestore
firestore.indexes.json   índices iniciales
package.json             scripts de despliegue
apps-script/Code.gs      receptor opcional para fotos en Google Drive
```

## Antes de publicar

1. Crear el proyecto en Firebase.
2. Activar Authentication con proveedor Email/Password.
3. Crear Firestore Database.
4. Copiar la configuración web del proyecto en `public/firebase-config.js`.
5. Reemplazar `trazabilidadlog` en `.firebaserc`.

## Comandos principales

```bash
npm install
npx firebase login
npx firebase use trazabilidadlog
npx firebase deploy
```

## GitHub

```bash
git init
git add .
git commit -m "Versión inicial trazabilidad logística"
git branch -M main
git remote add origin URL_DEL_REPOSITORIO
git push -u origin main
```

## Integración automática Firebase + GitHub

Desde la raíz del proyecto:

```bash
npx firebase init hosting:github
```

Seleccionar el repositorio y permitir que Firebase cree los workflows de GitHub Actions.

## Usuarios iniciales

Crear usuarios en Firebase Authentication y luego crear un documento en Firestore:

Colección: `users`

ID del documento: UID del usuario

Ejemplo:

```json
{
  "name": "Coordinador Logístico",
  "email": "logistica@empresa.com",
  "role": "logistica"
}
```

Roles disponibles:

```text
admin
ventas
logistica
alistamiento
facturacion
caja
despacho
inventarios
jefe_logistico
auditoria
gerencia
```

## Prueba local sin Firebase

La app conserva modo local si `public/firebase-config.js` no está configurado. Para prueba rápida:

```bash
cd public
python -m http.server 8080
```

Abrir:

```text
http://localhost:8080
```


## Firebase configurado

Proyecto configurado:

```text
projectId: trazabilidadlog
authDomain: trazabilidadlog.firebaseapp.com
storageBucket: trazabilidadlog.firebasestorage.app
measurementId: G-YN690LB8B2
```

El archivo `public/firebase-config.js` ya quedó actualizado.

El archivo `.firebaserc` ya apunta a:

```json
{
  "projects": {
    "default": "trazabilidadlog"
  }
}
```

Analytics quedó inicializado de forma segura desde `app.js` cuando el entorno lo permita.


## V5 · Gerencia, usuarios y VSM

Incluye:

- Panel `Usuarios` para `admin` y `gerencia`.
- Creación de usuarios desde la app con correo, contraseña temporal y rol.
- Restricción operativa de máximo 2 usuarios con rol `gerencia`.
- Panel `Aprobaciones` para solicitudes prioritarias.
- Ventas puede marcar un pedido como prioridad o salida especial para aprobación de gerencia.
- Gerencia aprueba o rechaza.
- Si aprueba, el caso pasa a logística como prioritario.
- Gerencia ve principalmente VSM, KPIs, autorizaciones y usuarios.
- Dashboard VSM con Lead Time, Cycle Time, VA, NVA, %VA, WIP, espera, throughput, takt, FPY, reproceso, no conformidades, cumplimiento estimado, cuello de botella y radar de tiempo por área.

### Seguridad de creación de usuarios

Esta versión permite crear usuarios desde la app usando Firebase Auth Web SDK y luego crea el perfil en Firestore.

Para una operación 100% blindada en producción, la creación de usuarios debe moverse a un backend seguro con Firebase Admin SDK o Cloud Functions, porque el Admin SDK está diseñado para administración privilegiada desde entornos de servidor seguros.

### Primer usuario

El primer usuario con rol `admin` o `gerencia` debe crearse manualmente en Firebase Authentication y en la colección `users`.

Ejemplo documento `users/{UID}`:

```json
{
  "name": "Gerente General",
  "email": "gerencia@empresa.com",
  "role": "gerencia",
  "isActive": true
}
```


## V5.1 · Corrección pantalla en blanco

Ajustes:

- Renderiza login aunque Firebase tarde en cargar.
- Timeout de carga de módulos Firebase.
- Pantalla de error visible si hay fallo de JavaScript.
- Cache/service worker actualizado para evitar versión vieja.
- Se recomienda desplegar con:

```bash
firebase deploy --only hosting
```

Después de desplegar, abrir la app con Ctrl + F5 o borrar datos del sitio si el navegador conservaba caché.
