# Cambios V3 · Requerimientos de corte a Ventas y bloqueo por fotos

## Ajustes aplicados

1. Los requerimientos generados desde la APP de corte quedan asignados forzosamente al rol `ventas`.
2. El panel de Ventas muestra los requerimientos enviados desde corte para corregir o aclarar el pedido.
3. El auxiliar de corte conserva acceso únicamente al módulo de corte; se retiró la ruta de requerimientos generales para ese rol.
4. La sincronización local entre corte y trazabilidad ahora procesa tanto cortes guardados como requerimientos de corte.
5. Se reforzó visualmente la restricción de fotos:
   - No se habilita **Iniciar corte** hasta seleccionar/preparar la foto inicial.
   - No se habilita **Finalizar corte** hasta seleccionar/preparar la foto final.
   - No se permite guardar si faltan evidencias inicial o final.
6. Se conserva Firebase principal para usuarios/login y Firebase de corte como repositorio operativo.
7. Se conserva Drive para evidencias, con organización por proceso.

## Motivos de requerimiento de corte

- Cable no disponible en su totalidad para el corte.
- Chipa con cantidad mayor que se puede vender toda.
- Mal registro del pedido.
- Otros.

## Regla operativa

Corte no resuelve ni redirige estos requerimientos internamente. Los envía a Ventas para que el pedido sea ajustado, aclarado o confirmado antes de continuar.
