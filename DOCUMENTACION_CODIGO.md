# Documentación del código del Plan de Mejoras

Análisis de los archivos locales realizado el 12 de octubre de 2026. Las líneas citadas corresponden a esta versión. No se modificó la lógica de la aplicación ni se probaron las cuentas o servicios externos.

## 1. Qué hace el proyecto

Es un tablero web del Plan de Mejoras para la Acreditación Andina. Permite consultar actividades, buscar, filtrar, ordenar, exportar CSV, revisar indicadores y detectar inconsistencias. Una cuenta administradora puede iniciar sesión con Microsoft 365 y modificar celdas del Excel institucional.

La interfaz está escrita con HTML, CSS y JavaScript sin un framework. No hay `package.json`, proceso de compilación ni servidor de aplicación en estos archivos. El script de sincronización usa Node.js y módulos de su biblioteca estándar.

Hay dos recorridos de datos:

```text
Consulta pública:
Excel → Power Automate → evento de GitHub → GitHub Actions
      → receive-sync.mjs → plan-data.json → navegador

Edición administrativa:
Navegador → autenticación Microsoft → Microsoft Graph → Excel
      → recorrido de publicación anterior → lectores públicos
```

Guardar en Excel y actualizar la copia pública son operaciones diferentes. El guardado del administrador no escribe directamente en GitHub.

## 2. Responsabilidad de cada archivo

| Archivo | Responsabilidad | Cuándo modificarlo |
|---|---|---|
| `index.html` | Diseño, datos de respaldo, cálculos, vistas, eventos, autenticación y edición | Cambiar interfaz o comportamiento |
| `plan-data.json` | Copia pública de los datos | Inspeccionar datos publicados; una sincronización puede reemplazar cambios manuales |
| `microsoft365.config.json` | Identificación de aplicación, inquilino, Excel, hoja y administradores | Cambiar conexión o identidades autorizadas |
| `scripts/receive-sync.mjs` | Recibir fragmentos y transformar datos del Excel en JSON público | Cambiar importación o normalización |
| `.github/workflows/actualizar-plan.yml` | Ejecutar recepción y publicar mediante commits | Cambiar evento o proceso de sincronización |
| `.gitignore` | Excluir archivos de Git | Revisar persistencia de archivos temporales |
| `logo-ucacue.png` | Imagen institucional | Cambiar logotipo |
| `README.md` | Entrada a las guías | Actualizar introducción |
| `README_GITHUB.md` | Guía de despliegue y acceso | Mantener instrucciones de publicación |
| `AUTOMATIZACION_POWER_AUTOMATE.md` | Procedimiento para el flujo externo | Mantener instrucciones de sincronización |

El README menciona `.nojekyll`, pero ese archivo no aparece en la copia local revisada. El flujo real de Power Automate y el archivo Excel tampoco están incluidos: solo están documentados o referenciados.

## 3. Cómo está organizado index.html

| Líneas aproximadas | Contenido |
|---|---|
| 1–8 | Idioma, metadatos, título y favicon |
| 9–403 | Estilos CSS |
| 405–577 | Cabecera, pestañas, vistas, formularios y mensajes |
| 578 | `seedData`: JSON de respaldo incrustado |
| 580–1592 | Lógica JavaScript |

El JavaScript está dentro de una función que se ejecuta inmediatamente, con `"use strict"`. Esto mantiene sus variables fuera del ámbito global y aplica reglas más estrictas del lenguaje.

El HTML define contenedores, como `kpiGrid` o `activitiesTable`. JavaScript obtiene esos elementos y les coloca contenido cuando llama a las funciones `render...`.

### CSS

Las variables de `:root` centralizan colores, bordes, sombras y radio de esquinas. Por ejemplo, `--brand-red` representa el rojo institucional. Las clases describen componentes: cabecera, tarjetas, tablas, gráficos, formularios y diálogos. Las reglas adaptativas cambian su presentación en pantallas pequeñas.

Para cambiar colores, comenzar por `:root`. Para cambiar un componente, buscar su clase CSS y su función de renderizado. Los gráficos se construyen con HTML y CSS, incluyendo barras y `conic-gradient`; no hay una biblioteca de gráficos.

## 4. Estructura de los datos

El JSON público tiene cinco secciones:

```json
{
  "metadata": { "totalActivities": 118, "totalColumns": 31 },
  "headers": ["ID", "Indicador", "Actividad", "Avance (%)"],
  "originalHeaders": ["ID", "Indicador", "Actividad", "Avance (%)"],
  "holidays": [{ "date": "2026-10-09", "label": "Independencia de Guayaquil" }],
  "records": [{ "_excelRow": 2, "ID": "G-01", "Avance (%)": 0 }]
}
```

Es un ejemplo reducido, no el esquema completo. La copia revisada contiene 118 registros y 31 encabezados.

- `metadata`: procedencia, fecha de generación, totales y observaciones estructurales.
- `headers`: nombres normalizados usados por la aplicación.
- `originalHeaders`: nombres recibidos de la fuente.
- `holidays`: fechas excluidas del cálculo de días hábiles. También contiene entradas descriptivas que no son fechas; conviene separar estas notas.
- `records`: actividades, representadas como objetos con una propiedad por columna.

`_excelRow` vincula el registro con una fila física del Excel. No es el ID de negocio. El código supone encabezados en la fila 1 y actividades desde la fila 2.

Los nombres de columna son parte del contrato entre Excel, JSON y JavaScript. `Avance (%)` y `Avance` son propiedades distintas.

## 5. Arranque, paso a paso

La función de entrada es `init()` en la línea 1575.

1. Antes de `init`, se lee `seedData` con `JSON.parse`.
2. Se definen opciones de columnas y formularios, y se construye `state`.
3. Los registros de respaldo pasan por `normalizeRecord()`.
4. `snapshotBase()` guarda una copia para comparar futuras ediciones.
5. `init()` carga en paralelo `plan-data.json` y `microsoft365.config.json`.
6. `bindEvents()` conecta botones, filtros y formularios con funciones.
7. `registerWebMcp()` registra herramientas opcionales si el navegador ofrece esa API.
8. `readUrlState()` recupera filtros, orden y vista desde la dirección.
9. `renderAll()` dibuja las vistas y actualiza los permisos visibles.
10. Se procesa el retorno de Microsoft o una sesión almacenada.
11. Cada 60 segundos se consulta la copia pública si no hay editor activo ni cambios pendientes.

Si falla la lectura del JSON público, permanece la información de respaldo. Si falla la configuración, la consulta pública sigue disponible, pero el acceso administrativo queda sin configurar.

### state: la memoria de la aplicación

| Propiedad | Contenido |
|---|---|
| `records` | Actividades que se muestran y editan |
| `base` | `Map` de copias originales por fila Excel |
| `dirty` | `Map` de filas y conjuntos de campos pendientes de guardar |
| `search`, `filters`, `sort` | Criterios de consulta |
| `visibleColumns` | `Set` de columnas mostradas |
| `activeView` | Pestaña activa |
| `config` | Configuración Microsoft 365 |
| `graph` | Tokens, archivo, sesión e identidad conectada |
| `remoteColumnIndex` | Relación entre nombre de columna y posición en Excel |
| `syncing`, `editRow` | Operación en curso y fila del formulario |

`Map` permite asociar una clave con un valor; `Set` mantiene valores sin duplicados. `base` y `dirty` son fundamentales para detectar conflictos y saber qué celdas guardar.

## 6. Preparación y cálculos

Funciones auxiliares, líneas 631–723:

| Función | Qué hace |
|---|---|
| `safeJson` | Intenta interpretar JSON sin propagar errores de análisis |
| `esc` | Escapa caracteres especiales antes de insertar textos en HTML |
| `plain` | Convierte a texto y quita espacios exteriores |
| `norm` | Quita acentos y convierte a minúsculas para buscar |
| `normalizeHeader` | Unifica Indicador/Indicadores y asigna nombres a encabezados vacíos |
| `avg`, `unique`, `countBy` | Promedios, valores únicos y agrupaciones |
| `phaseCode` | Extrae F0, F1, etc. del texto de fase |
| `parseDate`, `fmtDate` | Interpretan y presentan fechas |
| `excelDateToIso`, `isoToExcelDate` | Convierten entre serial Excel y fecha ISO |
| `colLetter` | Convierte posiciones 0, 1, 26 en A, B, AA |
| `splitResponsible` | Separa responsables por saltos de línea |
| `toast` | Muestra un mensaje temporal |

### Avance real y esperado

`activityAdvance()` limita el avance mostrado al rango 0–100. `expectedAdvance()` interpreta números hasta 1 como fracciones: `0.5` se muestra como 50%; `50` también se muestra como 50%. Esto implica que `1` se muestra como 100%; la fuente debe usar una convención consistente.

`operationalLevel()` clasifica el avance: 0 es no iniciada; más de 0 y menos de 50 es avance inicial; desde 50 es medio; desde 75 es alto; desde 100 es completada.

El promedio general es una media aritmética de actividades, sin ponderación. Por ejemplo, 0%, 50% y 100% producen 50%.

El avance esperado y el semáforo proceden de la fuente. El tablero no calcula una curva de avance esperado ni actualiza automáticamente el semáforo al editar.

### Vencimiento

`isOverdue()` considera vencida una actividad cuando su fecha final es anterior al día UTC actual y su avance es menor de 100. `isDueSoon()` detecta vencimientos entre hoy y los próximos 30 días, incluidos ambos extremos.

Estas reglas dependen del avance, no del texto de Estado. Una actividad DESCARTADA puede aparecer vencida si tiene avance menor de 100. La comparación UTC puede cambiar de día antes que la fecha local de Ecuador.

### Días hábiles

`businessDays()` recorre desde inicio hasta fin, incluyendo ambos días. Excluye sábados, domingos y fechas presentes en `holidays`. `normalizeRecord()` recalcula `Plazo (días hábiles)` al cargar; puede diferir del valor recibido. El formulario vuelve a calcularlo al editar fechas, pero no escribe este campo calculado en Excel porque es de solo lectura.

## 7. Indicadores y calidad

`aggregateIndicators()` —línea 725— agrupa por el texto de `Indicador`, no por `Código indicador`. Calcula cantidad de actividades, avance promedio, prioridades críticas, códigos distintos, variables y fechas extremas.

Para el nivel de cumplimiento:

1. Toma solamente valoraciones no vacías.
2. Si todas son CUMPLE, el grupo muestra CUMPLE.
3. Si alguna es NO CUMPLE, muestra NO CUMPLE.
4. En los demás casos con valoración, muestra CUMPLE PARCIAL.
5. Si no hay valoraciones, muestra Sin valoración.

Por ello, un grupo puede aparecer CUMPLE aunque algunas actividades estén sin valorar. La valoración diagnóstica no se deduce del avance operativo.

`qualityIssues()` —línea 756— revisa IDs duplicados, encabezados vacíos, observaciones de fórmulas externas, variantes de fases, campos esenciales incompletos, avance fuera de rango, orden de fechas, discordancias entre estado y avance, cumplimiento sin valorar y fórmulas vacías.

Son avisos: no reparan el Excel. Además, como `normalizeRecord()` convierte ciertos avances inválidos a cero antes de revisar calidad, algunos problemas del dato original pueden quedar ocultos.

## 8. Cómo se dibujan las vistas

`renderAll()` llama a las funciones de cada sección:

| Función | Resultado |
|---|---|
| `renderHeader` | Fecha de corte y contadores de pestañas |
| `renderOverview` | KPIs, distribución de avance, alertas y fechas del plan |
| `renderIndicators` | Tarjetas de agrupaciones por indicador |
| `renderActivities` | Filtros, tabla y contador de resultados |
| `renderStatistics` | Distribuciones y gráficos |
| `renderQuality` | Completitud y avisos |
| `renderSync` | Información de configuración y conexión |
| `updateConnectionUI` | Botones y distintivos según permisos y cambios pendientes |

Las vistas generales usan todas las actividades. Los filtros de la tabla no filtran automáticamente las estadísticas ni los indicadores.

La trazabilidad del resumen exige medio de verificación, criterio de aceptación y evidencias. Una cifra en estadísticas cuenta solo medio de verificación y criterio: son métricas distintas.

### Búsqueda, filtros y orden

1. El usuario escribe o cambia un selector.
2. El evento modifica `state.search` o `state.filters`.
3. `filteredRecords()` exige que se cumplan todos los filtros activos.
4. La búsqueda revisa todas las columnas, incluidas las ocultas, usando `norm()`.
5. `sortedRecords()` ordena números o textos con reglas de español.
6. `renderActivities()` reconstruye la tabla.
7. `writeUrlState()` refleja la selección en la URL sin recargar.

Tres clics en una cabecera alternan orden ascendente, descendente y sin orden explícito. Con filtro de vencimiento y sin orden elegido se ordena por fecha final.

`PAGE_SIZE = 25` existe, pero no se usa para dividir resultados: la tabla muestra todos los registros filtrados, fuerza una página y mantiene ocultos los controles de paginación.

### Columnas y exportación

`hiddenColumns` oculta Fase y Organismo en tabla, selección y formulario. `keyColumns` define el botón Solo principales. `mobileColumns` identifica campos destacados en móvil. `readOnlyColumns` bloquea campos calculados o diagnósticos.

`exportCsv()` exporta las filas filtradas y ordenadas con las columnas visibles. Usa punto y coma, BOM UTF-8 y escape de comillas. `csvCell()` intenta neutralizar determinados prefijos de fórmula; no debe interpretarse como garantía completa frente a cualquier entrada.

## 9. Autenticación administrativa, paso a paso

1. `startLogin()` comprueba configuración y genera un verificador PKCE y un valor `state` aleatorio.
2. Guarda ambos en `sessionStorage` y redirige a Microsoft con un desafío SHA-256.
3. Microsoft devuelve un código a la dirección de la aplicación.
4. `handleOauthCallback()` comprueba que el `state` recibido coincida.
5. Intercambia el código y el verificador por tokens.
6. `persistToken()` conserva datos de sesión en `sessionStorage`.
7. `connectWorkbook()` consulta `/me` mediante Graph.
8. `isAuthorizedAdmin()` compara ID, correo o nombre principal con las listas configuradas.
9. Se resuelve el enlace del Excel a identificadores de unidad y archivo.
10. Se intenta crear una sesión de libro con `persistChanges: true`.
11. Si obtiene sesión, establece modo editor y carga datos del Excel.

`graphFetch()` adjunta el token, agrega la sesión de Excel cuando corresponde, renueva el token próximo a expirar y convierte respuestas fallidas en errores.

La lista de administradores bloquea acciones en esta interfaz. Los permisos efectivos del archivo deben estar restringidos en Microsoft 365: el JavaScript público no sustituye los controles del servicio.

`clearAdminSession()` elimina la sesión local, pero no hay un botón de cierre de sesión conectado a esa función en la interfaz revisada.

## 10. Edición y guardado, paso a paso

1. `openEdit()` verifica permisos y encuentra la actividad por `_excelRow`.
2. `fieldControl()` crea controles según tipo: fecha, número, selector, texto o solo lectura.
3. `saveEdit()` lee `FormData` y compara valores con el registro actual.
4. Comprueba ID no vacío y no duplicado, fechas ordenadas y avance entre 0 y 100.
5. Recalcula días hábiles y actualiza el registro en memoria.
6. `markDirty()` registra los campos modificados.
7. Cierra el formulario, redibuja y llama a `syncRow()`.
8. Para cada campo, `syncRow()` obtiene la columna y forma una dirección como `Z2`.
9. Lee la celda remota y la compara con `base`.
10. Si Excel cambió desde la carga, pide confirmación antes de sobrescribir.
11. Envía un `PATCH` con el nuevo valor.
12. Actualiza `base` y elimina ese campo de `dirty`.

Ejemplo: si se cambia el avance de G-01, ubicada en la fila 2, y Avance (%) está en la posición 25 contando desde cero, `colLetter(25)` produce Z y se escribe Z2.

`syncAll()` guarda todas las filas pendientes. Si no hay pendientes, recarga Excel. `refreshFromWorkbook()` usa `usedRange(valuesOnly=true)`, convierte la matriz en objetos, limpia pendientes y actualiza la copia base.

El guardado es por celdas y no es una transacción: unas pueden guardarse antes de que otra falle. Los campos que faltan por guardar quedan pendientes. `saveLocal()` solo actualiza la interfaz; no guarda las ediciones en almacenamiento persistente. Recargar la página puede perder pendientes.

## 11. Herramientas opcionales para agentes

`registerWebMcp()` —línea 1445— comprueba si existe `document.modelContext.registerTool`. Si no existe, retorna y el tablero continúa normalmente.

Registra tres herramientas:

- `get_plan_summary`: cifras generales.
- `search_plan_activities`: hasta 20 coincidencias. Su campo `total` cuenta las devueltas, no todas las posibles.
- `update_plan_activity_tracking`: cambia estado, avance, cumplimiento u observaciones y guarda por `syncRow`, con permisos administrativos.

La actualización por esta vía no ejecuta todas las validaciones del formulario. Antes de ampliarla, conviene compartir una función de validación entre ambos caminos.

## 12. Publicación automática, paso a paso

### Flujo descrito para Power Automate

1. Detecta una modificación del archivo en OneDrive.
2. Lee las filas de la tabla `PlanMejorasAndino`.
3. Convierte las filas a una cadena JSON.
4. Divide la cadena en fragmentos de 18.000 caracteres.
5. Genera `SyncId` y los índices.
6. Envía eventos a GitHub con `sync_id`, `index`, `total` y `chunk`.

Esto describe la guía incluida; no se inspeccionó una ejecución real del flujo.

### Workflow de GitHub

1. Escucha el evento `actualizar-plan`.
2. Obtiene el repositorio.
3. Pasa el contenido del evento a variables de entorno.
4. Ejecuta `node scripts/receive-sync.mjs`.
5. Prepara cambios con Git y realiza un commit.
6. Intenta publicar en `main`.
7. Si el push falla, obtiene la rama actual, restablece su copia local y vuelve a procesar el fragmento, hasta ocho intentos.

### receive-sync.mjs

1. Lee `SYNC_ID`, `CHUNK_INDEX`, `CHUNK_TOTAL` y `CHUNK_DATA`.
2. Valida identificador, índices, máximo de 30 fragmentos y máximo de 60.000 caracteres por fragmento.
3. Escribe el fragmento en `.sync/<syncId>/000.part`, `001.part`, etc.
4. Si no están todos, informa que la recepción está incompleta y termina correctamente.
5. Si están todos, concatena en orden y analiza el JSON.
6. Lee el JSON anterior para reutilizar determinados metadatos y feriados.
7. Acepta un array de objetos de Power Automate o un objeto con matriz `values`.
8. Excluye campos de sistema que empiezan por `@` y `ItemInternalId`.
9. Normaliza encabezados, fechas y avance; asigna `_excelRow`.
10. Calcula totales, fechas extremas e IDs duplicados.
11. Escribe `plan-data.json` y elimina `.sync` completa.

El caso array conserva feriados del JSON previo. El caso matriz usa los proporcionados por la entrada. Ninguno extrae por sí mismo feriados de otra hoja del Excel.

## 13. Problemas encontrados y consecuencias

Estos hallazgos proceden del código local; las condiciones de las cuentas y del despliegue real no fueron verificadas.

| Prioridad | Hallazgo | Consecuencia y cambio a considerar |
|---|---|---|
| Resuelto | Guía y workflow usan ahora el mismo evento `actualizar-plan` | Sin acción pendiente |
| Alta | `.gitignore` excluye `.sync/`, pero el workflow usa `git add -A` | Los fragmentos incompletos no se publican en Git. La siguiente ejecución no los recupera; una carga de varios fragmentos no puede completarse con esta estrategia. Diseñar persistencia entre ejecuciones |
| Alta | Concurrencia agrupada por sync ID e índice | Fragmentos distintos y sincronizaciones distintas pueden ejecutarse simultáneamente. Los reintentos de push no sustituyen una estrategia de ensamblado y orden |
| Alta | Se elimina toda `.sync` al completar una carga | Si se agrega persistencia, una carga podría borrar fragmentos de otra. Limitar limpieza al lote y controlar antigüedad |
| Media | Filas remotas se identifican por posición | Mover, insertar o eliminar filas durante una edición puede cambiar su identidad. Validar el ID antes de escribir |
| Media | Lectura remota supone origen A1 | `recordsFromMatrix()` ignora desplazamientos de `usedRange`. Si el encabezado no está en A1, puede calcular direcciones incorrectas |
| Media | `normalizeRecord()` asigna avance 0 a filas sin datos antes del filtro remoto | Una fila vacía interior puede superar el filtro porque ya tiene un valor 0. Filtrar la matriz original antes de normalizar |
| Media | Firma pública compara únicamente `records` | Cambios exclusivos en feriados, encabezados o metadatos se ignoran. Comparar los componentes relevantes |
| Media | Validación de fechas incompleta | Fechas inválidas no siempre se detectan mediante comparación. Comprobar validez además de orden |
| Media | Cambios pendientes solo en memoria | Una recarga puede perderlos. Agregar aviso al salir o mecanismo de recuperación si se requiere |
| Media | Guardado por celda sin transacción | Puede quedar una edición guardada parcialmente. Mostrar resultados y pendientes con claridad |
| Baja | README afirma que no hay botón de descarga | Sí existe Exportar CSV, aunque no descarga el Excel original. Actualizar la descripción |
| Baja | Paginación declarada pero inactiva | `PAGE_SIZE` y eventos de paginación no tienen efecto real. Implementar o retirar código sobrante |

Otros detalles: la configuración y el enlace del libro se entregan al navegador aunque se presenten parcialmente ocultos en pantalla; las secciones del formulario se dividen por posiciones fijas; el script descarta metadatos no incluidos expresamente, como `tableName`; los avisos de completitud se calculan después de algunas normalizaciones.

## 14. Dónde realizar cambios habituales

| Cambio | Lugar principal | Dependencias que revisar |
|---|---|---|
| Colores y tipografía | CSS de `index.html`, desde línea 9 | Contraste y presentación móvil |
| Títulos y textos | HTML y funciones `render...` | Textos generados dinámicamente |
| Columnas ocultas | `hiddenColumns`, línea 590 | Tabla, formulario, selector y CSV |
| Columnas principales | `keyColumns`, línea 591 | Botón Solo principales |
| Opciones de estados y prioridades | `selectOptions`, línea 598 | Excel, filtros y validaciones |
| Campos de solo lectura | `readOnlyColumns`, línea 597 | Fórmulas de Excel y guardado |
| Plazo de alertas | `isDueSoon`, línea 653 | Etiquetas del filtro y resumen |
| Cálculo de avance | `activityAdvance`, `expectedAdvance`, `avg` | Estadísticas, orden y exportación |
| Agrupación de indicadores | `aggregateIndicators`, línea 725 | Filtros y tarjetas |
| Controles de calidad | `qualityIssues`, línea 756 | Datos originales frente a normalizados |
| Frecuencia de actualización | `setInterval` dentro de `init` | Intervalo actual 60.000 ms |
| Excel, hoja o administradores | `microsoft365.config.json` | Permisos reales y flujo externo |
| Nueva columna | Excel, importador y encabezados de respaldo | Tipos, controles, lectura remota y sección del formulario |
| Importación de fechas | `receive-sync.mjs` y conversores del navegador | Evitar criterios diferentes |
| Automatización | Workflow y guía Power Automate | Evento, persistencia y concurrencia |

Cambiar `selectOptions` agrega opciones del formulario, pero no crea automáticamente reglas de negocio para ellas. Cambiar un encabezado exige revisar todas sus referencias por texto.

Para mantener el proyecto, conviene separar gradualmente CSS, cálculos, vistas y acceso a Graph en archivos distintos, manteniendo primero el comportamiento actual. La prioridad funcional es resolver el recorrido de publicación de fragmentos.

## 15. Procedimiento para modificar y comprobar

1. Identificar el comportamiento que debe cambiar y la función responsable.
2. Revisar si afecta datos, interfaz, Excel o publicación.
3. Trabajar con una copia o rama y, para ediciones reales, un Excel de prueba.
4. Hacer el cambio más pequeño que resuelva el requisito.
5. Servir el directorio por HTTP; por ejemplo, `python -m http.server 8000` y abrir `http://localhost:8000/`.
6. Comprobar carga pública, búsqueda, filtros, orden, columnas y CSV cuando correspondan.
7. Si se modifica cálculo, comparar manualmente un caso conocido, incluido fin de semana o feriado.
8. Si se modifica edición, comprobar permiso, guardado y conflicto sobre el archivo de prueba. El acceso local necesita una redirección permitida en Microsoft.
9. Si se modifica sincronización, comprobar una carga de varios fragmentos, su ensamblado, JSON final y publicación.
10. Actualizar esta documentación y las guías afectadas.

No se incluyó el Excel fuente ni hay pruebas automatizadas de aplicación en esta copia. La revisión de sintaxis y datos no acredita el funcionamiento de Microsoft 365, Power Automate o GitHub Pages.
