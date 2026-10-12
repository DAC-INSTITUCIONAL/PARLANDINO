# Configuración de la actualización automática

Este procedimiento publica en GitHub Pages una copia pública del plan cada vez
que cambia el Excel institucional. Utiliza la tabla `PlanMejorasAndino` de la
hoja `Plan de Mejoras` y no necesita Office Scripts ni la pestaña
**Automatizar** de Excel.

## Datos de este proyecto

- Archivo: `Plan_de_Mejoras_Acreditacion_Andina_D1514(3).xlsx`
- Hoja: `Plan de Mejoras`
- Tabla: `PlanMejorasAndino`
- Repositorio: `borispoveda316/PMPARLANDINA`
- Rama: `main`

## 1. Crear el flujo

1. Abre [Power Automate](https://make.powerautomate.com/).
2. Selecciona **Crear → Flujo de nube automatizado**.
3. Nombre: `Publicar Plan de Mejoras Andina en GitHub`.
4. Usa el desencadenador de OneDrive para la Empresa **Cuando se modifica un
   archivo (solo propiedades)**.
5. Selecciona la carpeta que contiene el archivo nuevo.
6. En la configuración del desencadenador, activa el control de simultaneidad
   con grado `1`.

## 2. Leer la tabla del Excel

Agrega **Excel Online (Empresa) → Enumerar las filas presentes en una tabla** y
renombra la acción como `ListarFilas`.

| Campo | Valor |
|---|---|
| Ubicación | OneDrive para la Empresa |
| Biblioteca | Documentos |
| Archivo | `Plan_de_Mejoras_Acreditacion_Andina_D1514(3).xlsx` |
| Tabla | `PlanMejorasAndino` |

Selecciona el archivo mediante el explorador de archivos de la acción, no
pegues la URL de SharePoint en el campo **Archivo**. En **Configuración** de la
acción activa **Paginación** con umbral `500`.

## 3. Preparar los fragmentos

Agrega cuatro acciones **Variables → Inicializar variable**:

### `DatosJSON`

- Nombre: `DatosJSON`
- Tipo: **Cadena**
- Expresión:

```text
string(body('ListarFilas')?['value'])
```

### `Fragmentos`

- Nombre: `Fragmentos`
- Tipo: **Matriz**
- Expresión:

```text
chunk(variables('DatosJSON'),18000)
```

### `SyncId`

- Nombre: `SyncId`
- Tipo: **Cadena**
- Expresión:

```text
guid()
```

### `Indices`

- Nombre: `Indices`
- Tipo: **Matriz**
- Expresión:

```text
range(0,length(variables('Fragmentos')))
```

## 4. Enviar los fragmentos a GitHub

1. Agrega **Aplicar a cada uno**.
2. Como salida utiliza:

```text
variables('Indices')
```

3. Dentro del bucle agrega GitHub → **Crear un evento de distribución de
   repositorio**.
4. Autoriza GitHub con la cuenta que administra el repositorio.
5. Completa:

| Campo | Valor |
|---|---|
| Propietario del repositorio | `borispoveda316` |
| Nombre del repositorio | `PMPARLANDINA` |
| Nombre del evento | `actualizar-plan` |

6. En **Carga de eventos**, abre **Expresión** y pega exactamente:

```text
addProperty(addProperty(addProperty(addProperty(json('{}'),'sync_id',variables('SyncId')),'index',item()),'total',length(variables('Fragmentos'))),'chunk',first(skip(variables('Fragmentos'),item())))
```

No agregues comillas alrededor de la expresión. La carga debe quedar como un
objeto, no como texto simple.

## 5. Activar GitHub Pages

En el repositorio abre **Settings → Pages**, selecciona **Deploy from a branch**,
rama `main`, carpeta `/ (root)` y guarda.

## 6. Probar la sincronización

1. Guarda y activa el flujo.
2. Modifica temporalmente una observación en el Excel y guarda.
3. Revisa el historial de ejecuciones de Power Automate.
4. En GitHub abre **Actions** y confirma que finalice correctamente
   **Actualizar datos públicos del plan**.
5. Comprueba que `plan-data.json` reciba el commit de actualización.
6. Abre la página pública en una ventana privada.
7. Revierte la modificación de prueba si corresponde.

El recorrido completo puede tardar algunos minutos entre OneDrive, Power
Automate, GitHub Actions y GitHub Pages.
