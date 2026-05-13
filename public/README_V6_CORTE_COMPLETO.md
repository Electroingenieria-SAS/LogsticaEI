# V6 · Corte de cable completo integrado

Esta versión integra el módulo de corte con la misma lógica operativa de la app original, pero dentro del Firebase principal y sin login independiente.

## Incluye

- Auxiliar de corte entra desde el login principal.
- El pedido/corte se toma desde las solicitudes creadas por alistamiento.
- Formulario completo: tipo de pedido, pedido, referencia, metros a cortar, disponibilidad, sobrante automático, condición, responsable, requerimiento a Ventas, observación, estado calculado, medición, cronómetro, foto inicial, foto final y registro final.
- Regla de remanente para ventas: >50 sigue, =50 aprueba jefe logístico, <50 aprueba gerencia.
- Regla de alumbrado: >=15 sigue, <15 jefe logístico, <10 gerencia.
- No inicia cronómetro sin foto inicial.
- No finaliza sin foto final.
- El corte queda en estado pendiente de registro después de finalizar y debe registrarse para pasar al siguiente módulo.
- Requerimientos generados desde corte se asignan a Ventas.
- Cuando todos los cortes de un pedido quedan finalizados, el pedido pasa a Comprometer mercancía.
- KPIs y Excel conservan cortes, tiempos, requerimientos y VSM.
