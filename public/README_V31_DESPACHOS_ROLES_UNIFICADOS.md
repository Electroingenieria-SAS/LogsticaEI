# V31 · Despachos y roles logísticos unificados

Cambios principales:

- Se reemplazan las tres fotos anteriores de entrega por un bloque operativo más ajustado al despacho:
  1. PDF / soporte de despacho opcional.
  2. Foto de mercancía rotulada obligatoria.
  3. Guía de transportadora / soporte final obligatoria.
- Al subir la foto de mercancía rotulada, se registra el fin operativo de logística y el caso queda en estado `espera_transportadora`.
- Al subir la guía de transportadora o soporte final, el despacho se cierra automáticamente como `cerrado_conforme`.
- No se permite subir la guía antes de subir la foto de mercancía rotulada.
- Se unifican funcionalmente los roles `lider_logistico` y `coordinador_logistico` como un solo rol operativo de logística/despacho.
- En creación de usuarios se oculta `lider_logistico` para que los nuevos usuarios se creen como `coordinador_logistico`.
- Las reglas de Firestore permiten que usuarios existentes con `lider_logistico` y `coordinador_logistico` trabajen como equivalentes.

Se conserva lo anterior de V30: autorización interna de corte, PDF/unidades, Drive, notificaciones, VSM, SIESA, certificado y evidencias.
