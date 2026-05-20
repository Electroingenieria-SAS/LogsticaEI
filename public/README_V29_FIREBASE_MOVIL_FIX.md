# V29 · Corrección de conexión Firebase en celular

Esta versión mantiene la V28 y agrega una inicialización más tolerante para móviles:

- Carga de Firebase con reintento automático si el SDK tarda en estar disponible.
- Relectura de `firebase-config.js` si el celular carga una versión incompleta por caché.
- Persistencia local de Firebase Auth para iOS/Android.
- Botón "Reintentar conexión" en login.
- Botón "Limpiar caché del celular" para borrar caché PWA y registrar de nuevo el service worker.
- Caché actualizada a V29.

Si en celular aparece "Firebase no conectó":
1. Abrir la app.
2. Tocar "Limpiar caché del celular".
3. Esperar recarga.
4. Ingresar nuevamente.

No cambia reglas de Firestore ni estructura de Firebase.
