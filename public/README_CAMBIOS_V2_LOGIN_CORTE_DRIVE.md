# Cambios V2 · Login por módulo, corte integrado y Drive por proceso

## 1. Usuarios

La administración de usuarios queda centralizada en la primera aplicación, `trazabilidadlog`.

Roles incluidos:

- `ventas`
- `coordinador_logistico`
- `lider_logistico`
- `aux_logistica`
- `auxiliar_corte`
- `jefe_logistica`
- `gerencia`
- `admin`

El rol `auxiliar_corte` entra directamente a la bandeja de cortes y no ve ventas, recepción, alistamiento ni KPIs globales.

## 2. Acceso por módulo

- Ventas: solo crea pedidos y responde requerimientos asignados.
- Recepción: carga PDF del pedido y verifica documento.
- Alistamiento: verifica líneas y define cuáles pasan a corte.
- Auxiliar de corte: solo ve cortes pendientes, en proceso y requerimientos asociados a corte.
- Jefe logístico, gerencia y admin: ven KPIs consolidados y trazabilidad general.

## 3. Corte integrado

Desde alistamiento se crean solicitudes de corte. Al abrir un corte:

1. La app principal guarda el usuario activo en sesión local.
2. Abre `corte-control/index.html` en modo integrado.
3. El formulario de corte recibe automáticamente pedido, cliente, referencia, metros y disponibilidad.
4. El auxiliar ejecuta el corte, toma tiempos y sube evidencias.
5. Al guardar, el resultado vuelve al caso principal y actualiza el estado del corte.

El Firebase de corte se conserva como repositorio de registros de corte. Para el modo integrado se agregó una regla de escritura por registros con origen `trazabilidadlog`.

## 4. Requerimientos desde corte

El auxiliar de corte puede generar requerimientos hacia el módulo general con estos motivos:

- Cable no disponible en su totalidad para el corte.
- Chipa con cantidad mayor que se puede vender toda.
- Mal registro del pedido.
- Otros.

Cuando se genera el requerimiento desde la app de corte, también se notifica a la app principal mediante el puente de integración y queda visible en el módulo `Requerimientos`.

## 5. Drive por proceso

La app principal ahora permite subir evidencias por proceso desde el detalle del caso.

La estructura de Drive para trazabilidad queda así:

```text
EVIDENCIAS_TRAZABILIDAD_LOGISTICA
└── Año
    └── Mes
        └── Proceso
            └── Responsable
                └── Pedido
                    └── Caso
                        └── Archivo
```

La app de corte usa el mismo enfoque operativo en Drive:

```text
EVIDENCIAS_LOGISTICA
└── Corte
    └── Responsable
        └── Mes
            └── Pedido
                └── Corte
                    ├── foto inicial
                    └── foto final
```

## 6. Archivos importantes modificados

- `app.js`
- `firestore.rules`
- `apps-script/Code.gs`
- `corte-control/index.html`
- `corte-control/firestore.rules`
- Copias equivalentes dentro de `public/`

## 7. Pendiente de despliegue

Después de subir esta versión debes publicar:

1. La app principal.
2. Las reglas de Firestore de la app principal.
3. Las reglas de Firestore de la app de corte.
4. El Apps Script de Drive de trazabilidad si vas a usar la carga de evidencias por proceso.

