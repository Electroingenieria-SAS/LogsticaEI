# Nota sobre Firestore Rules

El hotfix usa campos de actualización que normalmente están permitidos por la regla actual del proyecto porque `validCasePayload()` valida que exista al menos una llave reconocida y el documento conserva campos como `status`, `currentProcess`, `assignedRole`, `visibleRoles`, `targetRoles`, `updatedAt`, `history` y `flowTrace`.

No se incluye reemplazo completo de reglas para evitar dañar permisos existentes.

Si en una versión futura las reglas se vuelven estrictas con `hasOnly`, agregar estas llaves al payload permitido de `cases`:

```txt
foundFlowVersion
foundCompleted
enviadoAFacturacion
sentToBilling
sentToBillingAt
sentToBillingBy
sentToBillingByName
billingStatus
noEncontrado
hasNotFoundItems
```
