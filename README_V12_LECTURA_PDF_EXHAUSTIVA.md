# V12 - Lectura exhaustiva del PDF y cortes automáticos

Esta versión mejora el flujo de Recepción de pedidos:

1. El PDF se visualiza en un iframe solo como vista previa.
2. La lectura real del contenido se realiza con PDF.js, no con el iframe.
3. La app extrae automáticamente datos generales del pedido:
   - número de pedido;
   - tipo PVC/PVN/PVR/PVE/ventas;
   - cliente;
   - NIT/CC;
   - dirección;
   - ciudad;
   - teléfono;
   - asesor/vendedor;
   - forma de pago;
   - fecha del pedido;
   - tipo de entrega probable;
   - observaciones.
4. La app detecta líneas del pedido con unidades en metros:
   - M;
   - MT;
   - MTS;
   - MTR;
   - MTRS;
   - ML;
   - M/L;
   - METRO;
   - METROS.
5. Todo lo detectado en metros se crea automáticamente como corte pendiente.
6. El PDF queda disponible durante todo el proceso desde Drive.
7. Los datos extraídos se guardan en el caso para que alistamiento, corte, despacho y auditoría los puedan consultar.

Nota operativa: si el PDF es una imagen escaneada sin texto real, PDF.js no puede extraer contenido. En ese caso se necesita OCR o digitación manual.
