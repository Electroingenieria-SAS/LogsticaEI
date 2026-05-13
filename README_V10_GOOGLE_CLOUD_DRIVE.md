# V10 · Evidencias por Google Cloud / Google Drive API

Esta versión elimina Apps Script para las evidencias. La carga vuelve al esquema de Google Cloud que ya usaba la app de corte original.

## Configuración incluida

- OAuth Client ID: `125993982318-gn2177d3muf2iip0co9pf9mii7d12cre.apps.googleusercontent.com`
- Scope: `https://www.googleapis.com/auth/drive.file`
- Carpeta raíz: `EVIDENCIAS_LOGISTICA_ELECTROINGENIERIA`
- Un solo Firebase principal.
- Un solo login principal.
- Corte integrado como módulo completo.

## Importante en Google Cloud

En el OAuth Client ID, agregue como JavaScript origin autorizado la URL exacta donde publica la app, por ejemplo:

- `https://USUARIO.github.io`
- `http://localhost:5000` si prueba localmente

No se usa Apps Script ni `driveUploadUrl`.
