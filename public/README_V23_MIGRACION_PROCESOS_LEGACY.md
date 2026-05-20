# V23 · Migración de procesos legacy de compromiso

Corrección aplicada sobre V22.

## Objetivo
Eliminar de la operación los procesos separados de compromiso de mercancía y ratificación de compromiso.

## Flujo vigente
1. Recepción de pedidos: PDF obligatorio, lectura automática, líneas/cortes automáticos y confirmación de mercancía comprometida.
2. Alistamiento.
3. Corte de cable si aplica.
4. Facturación: al facturar se entiende ratificado el compromiso.
5. Caja / entrega / despacho.

## Migración automática
Si existen casos antiguos en `compromiso_mercancia` o `compromiso_inicial`, la app los mueve a `alistamiento`.
Si existen casos antiguos en `ratificacion_compromiso` o `ratificar_compromiso`, la app los mueve a `facturacion`.

En Admin queda el botón **Corregir procesos legacy** para forzar la corrección manual.
