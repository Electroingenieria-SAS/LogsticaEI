# V19 QA - Correcciones de lectura PDF y cortes automáticos

Correcciones aplicadas después de prueba QA:

- La lectura del PDF ya no mezcla líneas consecutivas que ya tienen cantidad/unidad, para evitar cortes falsos.
- Una línea solo se convierte en corte si la referencia/descripción específica parece cable, conductor o alambre.
- Se evita crear duplicados por lectura combinada usando referencia + cantidad + unidad.
- Se conserva PDF obligatorio en recepción, flujo recepción → compromiso inicial → alistamiento → ratificación, VSM/Admin para super admin y funcionalidad anterior de evidencias, corte y SIESA.
