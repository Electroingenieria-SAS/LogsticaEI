# QA real en la app publicada — V80 Registro de Ventas

## Antes de probar

- Confirmar que GitHub Pages publica `public/`.
- Confirmar que `index.html` contiene `logistica-registro-ventas-force-v80.js`.
- Confirmar en DevTools > Network que el archivo carga con HTTP 200.
- Confirmar en consola:

```js
typeof LogisticaRegistroVentasForceV80
```

Debe responder:

```txt
"object"
```

## Prueba funcional

1. Abrir módulo Registro de Ventas.
2. Confirmar que no diga Ventas Diarias.
3. Presionar Actualizar.
4. Confirmar que la consola no muestre error.
5. Confirmar número de registros:

```js
LogisticaRegistroVentasForceV80.getState().latestRows.length
```

6. Comparar con la cantidad real esperada en la colección de ventas/cases.
7. Validar que no filtre por fecha del día.
8. Validar que no quede limitado a dos registros.
