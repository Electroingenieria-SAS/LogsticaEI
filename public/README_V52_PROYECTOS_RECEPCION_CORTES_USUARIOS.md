# V52 · Proyectos, recepción de mercancía, usuarios y cortes agrupados

## Cambios funcionales

### 1. Super Admin / Admin · Gestión de usuarios
- El panel **Usuarios** ahora permite cambiar rol operativo.
- Permite activar o inactivar perfiles.
- Permite eliminar el perfil operativo de Firestore desde el aplicativo.
- Se protege el usuario en sesión para evitar autoeliminación o autoinactivación.
- Nota técnica: la eliminación desde el navegador borra el perfil operativo en Firestore. La cuenta de Firebase Authentication debe eliminarse desde Firebase Console o mediante Cloud Function segura.

### 2. Nuevo rol: Líder de recepción
- Se agregó el rol `lider_recepcion` con nombre visible **Líder de recepción**.
- El rol puede acceder al módulo **Recepción mercancía**.
- El Super Admin/Admin también puede acceder al módulo.
- Para habilitar a Mendoza, asignarle este rol desde **Usuarios → Rol**.

### 3. Nuevo módulo: Recepción de mercancía
- Nueva ruta visible: **Recepción mercancía**.
- Colección Firestore: `recepciones_mercancia`.
- Permite registrar ingresos por compra, traslado, devolución, proyecto u otro.
- Incluye documento soporte obligatorio con cargue a Google Drive.
- Incluye chequeos de ingreso: documento, proveedor, cantidades, referencias, estado físico, lote/serial, unidad de medida, soporte y conformidad.
- Permite registrar hallazgos, acción inmediata y reporte a Gerencia/Jefe Logístico vía trazabilidad.
- Permite cerrar ingresos.

### 4. Nuevo módulo: Proyectos
- Nueva ruta visible: **Proyectos**.
- Colección Firestore: `proyectos_pedidos`.
- Solo permite crear solicitudes los lunes y jueves desde la interfaz.
- Registra nombre del proyecto, pedido, cliente, responsable comercial, tipo de entrega, recogida en punto y observaciones.
- Permite enviar el proyecto al flujo operativo como caso normal hacia **Recepción de pedidos**.

### 5. Corte de cable agrupado por tipo de cable
- La bandeja de **Cortes** ahora agrupa por referencia/tipo de cable.
- Cada grupo muestra total de metros sugeridos para prealistamiento.
- Dentro del grupo se despliegan los pedidos asociados.
- Se mantiene el botón para abrir cada corte y operar pedido por pedido.
- Se simplificó la vista para priorizar funcionalidad sobre animaciones.

## Archivos modificados
- `app.js`
- `public/app.js`
- `styles.css`
- `public/styles.css`
- `firestore.rules`
- `public/firestore.rules`
- `index.html`
- `public/index.html`

## Reglas Firestore
Se agregaron permisos para:
- `proyectos_pedidos`
- `recepciones_mercancia`
- `users_deleted_log`
- rol `lider_recepcion`

Después de subir los archivos, publicar reglas:

```bash
firebase deploy --only firestore:rules
```

Y luego hosting:

```bash
firebase deploy --only hosting
```

## Validación local realizada
- Validación sintáctica de JavaScript con `node --check app.js`.
- Sin errores de parseo en `app.js` ni `public/app.js`.
