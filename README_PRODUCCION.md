# Electroingeniería · Trazabilidad Logística · Producción GitHub + Firebase

Esta versión es de producción para GitHub Pages con Firebase como backend.

## No incluye

- No carga datos demo.
- No usa modo local.
- No usa módulos JavaScript.
- No usa async/await.

## Incluye

- Login obligatorio con Firebase Authentication.
- Base de datos en Cloud Firestore.
- Paneles por rol.
- Ventas crea pedidos y los envía a logística.
- Lectura opcional de PDF S-FT-33.
- Requerimientos y esperas.
- Aprobaciones de gerencia.
- Creación de usuarios por admin/gerencia.
- Máximo 2 usuarios con rol gerencia.
- Macroprocesos:
  - S-PR-2 Recepción de pedidos
  - S-PR-4 Alistamiento
  - S-PR-5 Facturación
  - S-PR-5 Caja
  - S-PR-6 Despacho
  - S-PR-24 Inventarios
- VSM gerencial:
  - Lead Time
  - Cycle Time
  - VA / NVA
  - % VA
  - WIP
  - Espera
  - Reproceso
  - FPY
  - Throughput
  - Handoffs
  - Cuello de botella

## Cómo publicar en GitHub Pages

Sube todo el contenido de esta carpeta a la raíz del repositorio:

```text
index.html
app.js
styles.css
firebase-config.js
assets/
.nojekyll
firestore.rules
README_PRODUCCION.md
```

En GitHub:

```text
Settings → Pages → Deploy from a branch → main → / root → Save
```

## Primer usuario obligatorio

Crear manualmente en Firebase Authentication.

Luego crear en Firestore:

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

## Reglas

El archivo `firestore.rules` se deja como referencia. Si usas GitHub Pages, debes copiar esas reglas manualmente en Firebase Console o desplegarlas una vez con Firebase CLI.


## PWA / Service Worker funcional

Esta versión sí incluye service worker funcional:

- Permite instalar la app en iPhone/Android como PWA.
- Cachea el shell visual de la app.
- Usa `network-first` para `index.html`, `app.js`, `styles.css` y `firebase-config.js`, evitando versiones viejas pegadas.
- Usa `cache-first` para logo e íconos.
- No intercepta Firebase ni CDN externos.
- Incluye limpieza de cachés antiguas.
- En Administración se agregó botón `Actualizar caché PWA`.

### Para publicar una actualización

Sube todos los archivos a GitHub y abre la URL con versión:

```text
https://TU_USUARIO.github.io/TU_REPOSITORIO/?v=pwa1
```

Si no actualiza:

```text
Administración → Actualizar caché PWA
```
