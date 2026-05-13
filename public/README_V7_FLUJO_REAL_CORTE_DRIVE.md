# V7 - Flujo real de corte, PDF y evidencias Drive

Cambios principales:

1. El PDF cargado en Recepción queda visible para alistamiento y para auditoría mediante enlace de Drive.
2. La lectura del PDF genera automáticamente solicitudes de corte para líneas con unidades en metros: M, MT, MTS, MTR, MTRS, ML, M/L, METRO y METROS.
3. Alistamiento conserva el panel de revisión, pero ya no depende de seleccionar manualmente cada corte detectado por metros.
4. El módulo de corte conserva la lógica completa: disponibilidad del carrete, remanente automático, validación >50, =50 jefe logística, <50 gerencia, reglas de alumbrado, requerimientos a ventas, cronómetro, foto inicial, foto final y registro.
5. La foto inicial se sube a Drive antes de iniciar cronómetro y queda guardada con hora de cargue.
6. La foto final se sube a Drive antes de finalizar y queda guardada con hora de cargue.
7. No se permite iniciar/finalizar/registrar corte sin evidencia real confirmada por Drive.
8. Todas las evidencias se guardan en el mismo Drive por carpetas: año, mes, proceso, responsable, pedido, caso y tipo de evidencia.
9. El botón Subir evidencia usa el mismo Drive para PDF, fotos de despacho, fotos de carro, fotos de corte y cualquier soporte operativo.

Configuración obligatoria:

- Publicar apps-script/Code.gs como Web App.
- Copiar la URL del despliegue.
- Pegarla en firebase-config.js en appSettings.driveUploadUrl.

Sin esa URL, la app bloqueará el registro de evidencias para evitar auditorías incompletas.
