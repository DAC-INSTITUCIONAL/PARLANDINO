# Plan de Mejoras para la Acreditación Andina

Tablero público de consulta conectado al Excel institucional. Cualquier persona
con el enlace de GitHub Pages puede consultar, buscar y filtrar sin iniciar
sesión. La edición exige iniciar sesión con la única cuenta de Microsoft 365
autorizada.

Dirección pública:

`https://borispoveda316.github.io/PMPARLANDINA/`

## Funcionamiento

- `index.html` muestra el tablero y contiene una copia de respaldo de los datos.
- `plan-data.json` contiene la copia pública vigente y se consulta al abrir la
  página; mientras la página permanece abierta, comprueba cambios periódicamente.
- El administrador inicia sesión desde **Administración**. Los cambios guardados
  allí se escriben directamente en el Excel de OneDrive institucional.
- Power Automate detecta cambios del Excel, lee la tabla `PlanMejorasAndino` y
  envía los datos por fragmentos a GitHub.
- GitHub Actions reconstruye `plan-data.json` y GitHub Pages publica la
  actualización automáticamente.

El tablero no ofrece un botón de descarga ni publica un enlace de descarga del
Excel. Como los datos públicos deben llegar al navegador para poder mostrarse,
no es técnicamente posible impedir que alguien copie manualmente información
que ya puede ver.

## Archivos del repositorio

```text
PMPARLANDINA/
├── .github/workflows/actualizar-plan.yml
├── scripts/receive-sync.mjs
├── .nojekyll
├── AUTOMATIZACION_POWER_AUTOMATE.md
├── README_GITHUB.md
├── index.html
├── microsoft365.config.json
└── plan-data.json
```

## Activar GitHub Pages

1. Abre **Settings → Pages**.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)`.
4. Guarda y espera a que GitHub muestre la dirección publicada.

## Configuración de Microsoft Entra ID

La aplicación usa el inquilino, Client ID, enlace del Excel, hoja y Object ID
del administrador definidos en `microsoft365.config.json`.

En el registro de aplicación agrega como URI de redirección SPA:

`https://borispoveda316.github.io/PMPARLANDINA/`

Permisos delegados de Microsoft Graph:

- `User.Read`
- `Files.ReadWrite`

No debe crearse ni publicarse un secreto de cliente en el sitio. El archivo de
Excel debe mantenerse con permiso de edición únicamente para Boris; el enlace
del Excel no debe configurarse como acceso público si se quiere mantenerlo
restringido.

## Sincronización

Sigue `AUTOMATIZACION_POWER_AUTOMATE.md` para crear el flujo que publica los
cambios del Excel en el tablero.
