# V11 - Evidencias Drive para todos los módulos

Esta versión mantiene un solo Firebase principal y usa Google Cloud / Google Drive API para las evidencias.

## Cambio principal

La opción **Subir evidencia a Drive** queda disponible para todos los módulos operativos del caso, según permisos del usuario. Ya no es exclusiva de corte ni de recepción.

## Procesos soportados

- Recepción de pedidos
- Alistamiento
- Corte de cable
- Comprometer mercancía
- Facturación
- Caja
- Entrega cliente en punto
- Cliente recoge
- Despacho local
- Despacho nacional
- Cierre despacho nacional
- Requerimientos
- Auditoría

## Tipos de evidencia

- PDF / documento del pedido
- Foto alistamiento
- Foto soporte corte
- Foto despacho / carro / cargue
- Soporte de entrega
- Guía / transporte
- Soporte caja / pago
- Soporte facturación
- Novedad operativa
- Soporte de requerimiento
- Soporte auditoría

## Ruta Drive

EVIDENCIAS_LOGISTICA_ELECTROINGENIERIA / Año / Mes / Proceso / Responsable / Pedido / Caso / Tipo de evidencia

## Auditoría

Cada evidencia queda registrada dentro del caso y también en la colección `evidences`, con URL de Drive, fecha, usuario, proceso, tipo de evidencia y descripción.
