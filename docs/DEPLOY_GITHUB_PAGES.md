# Despliegue en GitHub Pages

## Ruta recomendada

Como en versiones anteriores el proyecto publicaba la carpeta `public`, se recomienda copiar estos archivos dentro de `public/`:

```txt
logistica-found-flow.js
logistica-found-flow.css
```

Luego confirmar que el `index.html` publicado en GitHub Pages apunte a esos archivos con ruta relativa:

```html
<link rel="stylesheet" href="./logistica-found-flow.css?v=v77-encontrado-facturacion-segura">
<script src="./logistica-found-flow.js?v=v77-encontrado-facturacion-segura"></script>
```

## Control para no subir el archivo equivocado

Antes de hacer push:

1. Revisar que el archivo que se despliega sea el de `public/`.
2. Si existe `app.js` en raíz y `public/app.js`, sincronizar primero el más reciente.
3. No reemplazar `firebase-config.js`.
4. No reemplazar `firestore.rules` salvo que se vaya a publicar reglas nuevas manualmente.
5. No borrar `assets/`, `manifest.json` ni `service-worker.js`.

## Flujo de publicación

```bash
git add public/logistica-found-flow.js public/logistica-found-flow.css public/index.html public/app.js
git commit -m "Hotfix V77: encontrado seguro y envio confiable a facturacion"
git push origin main
```

## Prueba posterior al despliegue

1. Abrir la app en celular.
2. Entrar a un pedido con varios elementos.
3. Marcar solo uno como Encontrado: no debe ir a Facturación.
4. Marcar todos como Encontrado: debe cambiar a Facturación.
5. Reabrir la app: el estado debe persistir.
6. Marcar un pedido de prueba como No encontrado: no debe ir a Facturación.


## Archivos adicionales V79 — Registro de Ventas

Copiar también dentro de `public/`:

```txt
logistica-sales-registry-panel-fix.js
logistica-sales-registry-panel-fix.css
```

En `index.html`:

```html
<link rel="stylesheet" href="./logistica-sales-registry-panel-fix.css?v=v79-registro-ventas-full">
<script src="./logistica-sales-registry-panel-fix.js?v=v79-registro-ventas-full"></script>
```

Prueba posterior:

1. Abrir el módulo antes llamado Ventas Diarias.
2. Confirmar que ahora se lea Registro de Ventas.
3. Presionar Actualizar.
4. Validar que cargue todos los registros, incluyendo fechas anteriores.
5. Validar que no quede limitado a dos registros.
