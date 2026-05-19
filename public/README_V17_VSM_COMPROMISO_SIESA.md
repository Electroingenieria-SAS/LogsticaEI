# V17 · Flujo de compromiso, SIESA y VSM gerencial

## Cambios del flujo

El flujo operativo queda organizado así:

1. Ventas registra el pedido.
2. Recepción carga y lee el PDF.
3. Compromiso inicial de mercancía.
4. Alistamiento.
5. Corte de cable, si aplica.
6. Ratificación del compromiso antes de facturar.
7. Facturación.
8. Caja / despacho / entrega según corresponda.

## Compromiso inicial

Después de recepción, el usuario responsable debe abrir el módulo **Comprometer mercancía**, revisar el PDF y confirmar:

- PDF corresponde al pedido.
- Referencias y cantidades revisadas.
- Mercancía comprometida/bloqueada en SIESA/ERP.
- Sin devolución ni cancelación pendiente.

Si hay novedad, puede generar requerimiento a Ventas o cancelar el proceso.

## Ratificación del compromiso

Antes de facturar, el sistema exige validar:

- Producto correcto.
- Referencia correcta.
- Cantidad correcta.
- Unidad de medida correcta.
- Cortes finalizados si aplica.
- Sin devolución ni cancelación.

Si hay cortes pendientes, no permite ratificar.

## Corte y SIESA

En el módulo de corte se agregó el campo obligatorio:

- **Bodega / CO SIESA**

No permite iniciar ni registrar el corte sin ese dato. El archivo plano de SIESA sigue exportándose por lotes de 20 cortes finalizados, o antes si el pedido terminó sus cortes y queda un lote menor pendiente.

## VSM y KPIs

Se agregaron los indicadores solicitados:

- Lead Time promedio.
- % VA.
- Tiempo de espera.
- % espera.
- WIP.
- FPY.
- Reproceso.
- No conformidades.
- Cortes finalizados / cortes totales.
- Handoffs.
- Throughput.
- Cumplimiento SLA.
- Pedidos vencidos.
- Tiempo promedio por etapa.
- Cuello de botella principal.
- % requerimientos.
- Tiempo promedio de aprobación.
- % cancelaciones.
- Tasa de disponibilidad.
- Exactitud del pedido.

Todos los porcentajes se calculan con límite máximo de 100%.

## Trazabilidad automática

Cada cambio relevante del proceso agrega registro en `stateHistory`, incluyendo:

- fecha/hora,
- proceso,
- estado,
- responsable,
- tipo de estado,
- motivo o detalle de novedad.

