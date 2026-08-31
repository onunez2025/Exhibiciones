# Ticket-Crear — diseño

## Contexto y descubrimiento

El botón "Ticket" del menú kebab de una exhibición (`ExhibicionesPage.handleAction`)
hoy cae en el diálogo "Próximamente". No existe ninguna tabla `TICKET` bajo el
esquema `EXHIBICION` — todas las tablas con "TICKET" en el nombre pertenecen a
sistemas no relacionados (call center, SAP FSM, pagos).

Investigando el ERP legacy se encontró `EXHIBICION.WEB_MARKETING_REQUERIMIENTO`:
una tabla de "solicitudes" de un módulo antiguo ("Web Marketing"), con:

- `IN_exhibicion_id` (nullable) — 443 registros históricos (jul-2021 a sep-2023)
  sí estaban ligados a una exhibición concreta.
- `CH_ticket CHAR(1) --'W' | 'M'` — canal de origen (Web vs Móvil), confirmado
  leyendo el comentario del proc legacy `PROC_GUARDAR_WEB_MARKETING_REQUERIMIENTO`.
- Tablas satélite ya existentes y usadas activamente en su momento:
  `WEB_MARKETING_REQUERIMIENTO_DETALLE` (líneas de artículo/componente, 758 filas),
  `WEB_MARKETING_REQUERIMIENTO_FOTO` (728 filas, mismo patrón UUID+Blob que
  `TB_EXHIBICION_FOTO`), `WEB_MARKETING_REQUERIMIENTO_HIST` (historial de estado).
- `EXHIBICION.TB_TIPOS_REQUERIMIENTO` — catálogo de 9 tipos (Mantenimiento,
  Modificación, Muebles, Capacitación, POP, Recojo, Reposición, Folletería,
  Otros), cada uno con SLA en días (Lima/provincia) y `BI_requiere_exhibicion`.
  **Confirmado que ni esta tabla ni la columna `IN_tipo_rq_id` (en
  `WEB_MARKETING_REQUERIMIENTO`) son referenciadas por ningún procedimiento
  existente** — están preparadas pero nunca conectadas a código, igual que pasó
  con el catálogo de checklist antes de Checklist-Crear.

El usuario confirmó con capturas de la app móvil legacy ("Lista de Tickets" /
"Nuevo Ticket" con pestañas Principal/Componentes/Fotos) que el concepto real
detrás de "Ticket" es exactamente esta tabla: una solicitud de servicio
tipificada y ligada a una exhibición.

**Dato clave de riesgo**: la última actividad en `WEB_MARKETING_REQUERIMIENTO`
es de 2023-12-01 — cero actividad en los últimos 3 meses. A diferencia de
Checklist (donde se probó en vivo que la app legacy seguía escribiendo en
paralelo), aquí no hay ningún proceso legacy activo hoy compitiendo por el
mismo número de ticket.

## Alcance de v1 (decidido con el usuario)

- **Solo crear.** Sin listado de tickets ni vista de detalle reutilizable —
  mismo alcance que tuvo Checklist-Crear.
- Fotos adjuntas: **sí, opcionales**.
- Campo condicional "¿cuenta con punto de luz?" + descripción de espacio: **fuera
  de v1** (solo aplica a 1-2 de los 9 tipos; se agrega después si hace falta).
- Selector de "Contactos" de la tienda: **fuera de v1**.
- Componentes del ticket: se eligen **solo entre los componentes YA asignados
  a esa exhibición** (no el catálogo completo de productos) — tiene más
  sentido de negocio para un ticket de mantenimiento/reposición sobre algo que
  ya está instalado.

Quedan fuera de v1, explícitamente: bandeja/listado de tickets, edición o
cambio de estado de un ticket ya creado, aprobaciones (el workflow legacy de
Supervisor → Trade → GV no aplica — el ticket nuevo se crea directo en estado
"Nuevo"), selector de contactos, campos de espacio/capacitación/trade.

## Modelo de datos

Se escribe directamente a las tablas legacy (sin invocar
`PROC_GUARDAR_WEB_MARKETING_REQUERIMIENTO`, que es un formulario genérico de
otro módulo con campos irrelevantes aquí — capacitación, visita trade, espacio
de eventos), poblando solo el subconjunto de columnas relevante, igual que se
hizo con Checklist:

**`EXHIBICION.WEB_MARKETING_REQUERIMIENTO`** (cabecera, INSERT):
| Columna | Valor |
|---|---|
| `VC_organizacion` | `'1301'` (constante — 100% de los datos reales) |
| `VC_sociedad` | `'1300'` (constante) |
| `VC_requerimiento` | generado: `'RSM' + 7 dígitos`, mismo esquema que el proc legacy |
| `IN_exhibicion_id` | de la ruta |
| `IN_tipo_rq_id` | tipo elegido por el usuario (catálogo `TB_TIPOS_REQUERIMIENTO`) |
| `VC_observacion` | motivo (texto libre, máx 200 — límite de la columna) |
| `VC_estado` | `'01'` (Nuevo — catálogo `PV_TABLA.REQUERIMIENTO_ESTADO`) |
| `CH_anulado` | `'N'` |
| `CH_ticket` | `'W'` (canal Web) |
| `VC_cliente_codigo`, `VC_cliente_sucursal`, `VC_cliente_nombre` | copiados de `TB_EXHIBICION` |
| `VC_usuario_crea`, `DT_fecha_crea` | usuario autenticado, `GETDATE()` |

Resto de columnas (capacitación, espacio, trade, contactos, gasto, fechas
programada/ejecución): `NULL`, fuera de alcance de v1.

**Numeración**: mismo patrón de carrera-segura que exhibición/checklist —
`WITH (UPDLOCK, HOLDLOCK)` sobre
`MAX(CONVERT(INT, SUBSTRING(VC_requerimiento, 4, 99))) WHERE prefijo = 'RSM'`.
A diferencia de checklist, es un contador global (nunca se reinicia por mes),
igual que hace el proc legacy. Nota honesta a documentar en el comentario del
código: hoy no hay ningún escritor legacy vivo compitiendo por este número
(última actividad: 2023-12-01), pero si la herramienta "Web Marketing" viejo
alguna vez se reactivara, aplicaría la misma salvedad que con checklist.

**`EXHIBICION.WEB_MARKETING_REQUERIMIENTO_HIST`** (INSERT, una fila, refleja lo
que ya hace el proc legacy al crear): `VC_requerimiento`, `VC_usuario`,
`VC_nombre` (nombre del solicitante), `VC_estado='01'`, `VC_observacion=NULL`.

**`EXHIBICION.WEB_MARKETING_REQUERIMIENTO_DETALLE`** (INSERT, una fila por
componente elegido — batched en un solo INSERT multi-fila, mismo patrón ya
usado en Checklist-Crear):
| Columna | Valor |
|---|---|
| `VC_organizacion` | `'1301'` |
| `VC_requerimiento` | de la cabecera recién creada |
| `VC_tipo` | `'E'` (constante — coincide con el 100% de los datos reales) |
| `VC_posicion` | `''` (constante — coincide con los datos reales) |
| `VC_centro` | `'1301'` (constante) |
| `VC_almacen` | `''` (constante) |
| `VC_articulo_tipo` | `'PRD'` o `'CAR'` según el componente (buscado server-side, nunca confiado del cliente) |
| `VC_articulo_codigo`, `VC_articulo_nombre` | buscados en `TB_EXHIBICION_COMPONENTE`/`WEB_MARKETING_PRODUCTOS` a partir del `componenteId` que manda el cliente — se valida que el componente pertenezca a ESA exhibición y esté activo |
| `VC_articulo_um` | `'UNI'` (constante) |
| `IN_articulo_cantidad` | cantidad elegida por el usuario en el ticket |
| `CH_estado` | `'A'` (constante) |
| `VC_usuario_crea`, `DT_fecha_crea` | usuario autenticado, `GETDATE()` |

**`EXHIBICION.WEB_MARKETING_REQUERIMIENTO_FOTO`** (INSERT, una fila por foto,
después del commit de la cabecera — la subida a Blob es I/O externa y no debe
vivir dentro de la transacción SQL): `VC_requerimiento`, `VC_directorio=''`,
`VC_archivo_nombre` (UUID + extensión), `IN_estado=1`, `VC_usuario_crea`,
`DT_fecha_crea`. Mismo contenedor Blob (`exhibiciones`) que las fotos de
exhibición — asumido por identidad estructural con `TB_EXHIBICION_FOTO`; si
resultara ser otro contenedor, es un cambio de una línea (mismo riesgo ya
aceptado y documentado en Exhibición-Crear, cuya subida real de fotos también
quedó pendiente de verificar con un SAS de escritura real).

## Endpoints nuevos

1. **`GET /api/exhibiciones/tipos-ticket`** — los 9 tipos activos de
   `TB_TIPOS_REQUERIMIENTO`: `{ id, codigo, nombre }[]`.
2. **`POST /api/exhibiciones/:id/tickets`** — body
   `{ tipoId: number, motivo: string, componentes: { componenteId: number, cantidad: number }[] }`.
   Valida que la exhibición exista, que `tipoId` sea un tipo activo, que
   `motivo` no esté vacío (máx 200 caracteres), y que cada `componenteId`
   pertenezca a esa exhibición y esté activo. `componentes` puede ser un
   arreglo vacío (hay tipos, como Capacitación, que no necesitan ninguno);
   cuando no lo es: sin `componenteId` repetidos, y `cantidad` debe ser un
   entero mayor a 0 (misma regla que ya usa `POST /:id/componentes` de
   Exhibición-Crear — sin tope superior, no hay evidencia de que haga falta
   uno). Todo (número,
   cabecera, historial, líneas de componente) en una sola transacción con
   `UPDLOCK/HOLDLOCK`. Devuelve `{ numero: string }` — la tabla no tiene PK
   numérico; `VC_requerimiento` (p.ej. `'RSM0000567'`) es el identificador.
3. **`POST /api/exhibiciones/:id/tickets/:numero/fotos`** — body
   `{ archivoBase64: string, contentType: string }`, mismo patrón que
   `POST /:id/fotos` de Exhibición-Crear (decodificación, límite de 8MB,
   `express.json({limit:'12mb'})` en esa ruta específica). Valida que
   `:numero` exista y pertenezca a `:id`. Devuelve `{ id, url }`.

## Frontend

**`TicketCrearPage.tsx`** — nueva página en `/exhibiciones/:id/tickets/nueva`,
reemplaza el fallback "Próximamente" de la acción `'ticket'` en
`ExhibicionesPage.handleAction` (mismo cambio ya hecho para `'checklist'`).

Misma estructura visual que `ChecklistCrearPage`/`ExhibicionCrearPage`: header
con volver, 3 pestañas locales (sin ruta ni persistencia por pestaña):

- **Principal**: Tienda/Sucursal/Exhibición de solo lectura (de
  `GET /exhibiciones/:id`, ya existente), selector de Tipo de Ticket (de
  `GET /tipos-ticket`), motivo (textarea, máx 200, contador de caracteres).
- **Componentes**: lista de los componentes ya asignados a la exhibición
  (reutiliza `componentes.carcasas`/`componentes.productos` de la misma
  llamada a `GET /exhibiciones/:id`), cada uno con un campo de cantidad
  (0 = no incluido en el ticket). Sin mínimo — 0 componentes es válido.
- **Fotos**: deshabilitada hasta que exista `numero` (después de guardar);
  mismo patrón de subida que `DetalleFotosTab` de Exhibición-Crear.

**Flujo de guardado** (aprendiendo de los 4 hallazgos importantes de la
revisión final de Checklist-Crear):
1. El botón "Guardar" de la pestaña Principal dispara un solo POST con los
   datos de Principal + las cantidades ya elegidas en Componentes (ambos
   viven en el mismo INSERT transaccional, sin I/O externo — no hay razón
   para separarlos en dos llamadas).
2. Al recibir `{ numero }`, se guarda en estado local y se habilita la
   pestaña Fotos.
3. Cada foto subida es una llamada independiente a
   `POST /:id/tickets/:numero/fotos` (igual que Exhibición-Crear) — un fallo
   en una foto no invalida el ticket ya creado.
4. Un botón "Finalizar" muestra una confirmación visible
   (`useDialog().alert()`, mismo patrón agregado a Checklist-Crear en su
   revisión final) y navega de vuelta a `/exhibiciones/:id`.
5. Si el usuario recarga la página a mitad de camino (ticket ya creado, sin
   terminar de subir fotos), se pierde ese estado local — riesgo aceptado
   explícitamente, mismo que ya existe en Exhibición-Crear.

Si `GET /tipos-ticket` devuelve una lista vacía (no debería pasar con datos
sanos), "Guardar" queda deshabilitado — mismo guard ya aplicado en
Checklist-Crear tras su revisión final.

## Manejo de errores

- Carga inicial (exhibición + tipos): mismo patrón ya usado — estado de error
  con botón "Reintentar" que vuelve a consultar (no solo "Volver").
- Guardar cabecera: error de red/servidor se muestra inline sin perder lo ya
  llenado en el formulario.
- Subir foto: error inline en esa foto puntual, sin bloquear las demás ni
  perder el ticket ya creado.

## Testing

Mismo enfoque que en checklist/exhibición-crear: funciones puras testeables
por separado para la validación de la lista de componentes (motivo no vacío,
`componenteId` únicos, cantidad positiva) y para armar la respuesta del
catálogo de tipos; pruebas de integración reales contra la base de datos de
desarrollo para el flujo POST completo (crear → agregar foto), limpiando los
datos de prueba al final (mismo patrón y misma advertencia sobre no usar
automatización de navegador interactiva para esa tarea — usar curl/scripts
Node, lección ya aprendida en Exhibición-Crear).

## Constraints globales

- Nunca escribir la contraseña real de la base de datos ni el SAS token de
  Blob Storage en ningún archivo que se comitee a git.
- `VC_organizacion`/`VC_sociedad`/`VC_centro` son constantes fijas — no se
  agregan como configuración ni input de usuario (no hay evidencia de que
  varíen; si algún día se necesitara multi-organización, es un cambio
  explícito y separado).
- Todo INSERT de líneas dentro de la transacción de cabecera; la subida de
  fotos a Blob ocurre después del commit.
