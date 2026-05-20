# V22 · Flujo simplificado sin módulos de compromiso

Cambios aplicados sobre V21, sin reconstruir la arquitectura:

1. Se eliminaron del flujo visible los módulos separados de Compromiso inicial y Ratificación de compromiso.
2. Recepción de pedidos ahora queda como primer paso obligatorio y concentra:
   - carga obligatoria del PDF;
   - lectura automática del PDF con PDF.js;
   - autollenado de campos vacíos;
   - generación automática de cortes en metros;
   - confirmación obligatoria de mercancía comprometida/bloqueada en SIESA/ERP.
3. El flujo operativo queda:
   - Recepción de pedidos;
   - Alistamiento;
   - Corte de cable, si aplica;
   - Facturación;
   - Caja / entrega / despacho.
4. Si hay cortes pendientes, Alistamiento no puede enviar a Facturación hasta que estén registrados.
5. En Facturación se registra la ratificación del compromiso, porque si se factura se entiende que el compromiso quedó validado.
6. VSM e indicadores ya no incluyen los módulos eliminados como etapas activas.
7. Se conservan Drive, PDF obligatorio, corte completo, fotos obligatorias, SIESA, administración, VSM y KPIs de la V21.

QA local realizado:
- app.js raíz y public/app.js sincronizados.
- Sintaxis JavaScript validada con node --check.
- Caché actualizada a V22.
