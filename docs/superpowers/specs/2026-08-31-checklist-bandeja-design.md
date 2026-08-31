# Checklist — Bandeja (lista + detalle) — diseño

## Contexto

El ítem "Checklist" del menú principal (sidebar) cae hoy en `ComingSoonPage`
("Este módulo está en construcción"). Ya existe el flujo de **crear** un
checklist (`ChecklistCrearPage`, alcanzable solo desde el kebab de una
exhibición puntual), pero ninguna pantalla para **ver** los que ya se
crearon — ni la lista, ni el detalle de uno en particular.

Se investigaron las dos bandejas legacy relacionadas
(`EXHIBICION.PROC_BANDEJA_CHECKLIST` y
`EXHIBICION.PROC_BANDEJA_WEB_MARKETING_REQUERIMIENTO`, esta última para
Tickets) antes de diseñar. Hallazgo clave: **ambas usan un modelo de
permisos por rol** (Promotor/Supervisor/Trade, vía `TB_PROMOTOR_CLIENTE`,
`WEB_MARKETING_PUNTOS_DE_ATENCION`, `WEB_MARKETING_CLIENTE_TRADE`) que
**no existe hoy en la app nueva** — el resto de la app (empezando por la
propia lista de Exhibiciones) no filtra por promotor/tienda asignada, todo
usuario con acceso ve todo. Replicar ese scoping legacy queda fuera de
alcance de este plan (es un proyecto aparte que requiere mapear los roles
nuevos a esas tablas de asignación); esta bandeja sigue la misma lógica que
ya usa el resto de la app: ver todo.

Este plan cubre **solo Checklist**. La bandeja de Tickets es un sub-proyecto
aparte (tiene una complicación propia: la bandeja legacy de "Requerimiento"
filtra por `VC_tipo_servicio`, el catálogo de tipos VIEJO — no por
`IN_tipo_rq_id`/`TB_TIPOS_REQUERIMIENTO`, que es lo que usa Ticket-Crear. Esa
bandeja legacy literalmente no mostraría los tickets nuevos. Se diseñará por
separado).

## Alcance

- **Lista** (`/checklist`, reemplaza el placeholder del sidebar): buscador
  (N° checklist o exhibición), filtros (Conforme/No Conforme, tienda/
  sucursal, rango de fechas), paginación en desktop / scroll infinito en
  mobile — mismo patrón ya usado en `ExhibicionesPage`.
- **Detalle de solo lectura** (`/checklist/:id`): cabecera (N°, fecha,
  tienda, sucursal, exhibición) + los 12 ítems agrupados en sus 3
  categorías, cada uno mostrando Conforme/No Conforme y el motivo si
  aplica. Sin edición, sin cambiar el estado del checklist.

Fuera de alcance explícito:
- Cambiar el estado de un checklist (el proc legacy `PROC_CHECKLIST_CAMBIAR_ESTADO`
  soporta un flujo de aprobación 1→2→3 / 1→0 — no se construye ninguna
  acción para eso aquí; la bandeja es de solo lectura).
- Foto por ítem y "generar ticket" por ítem — `TB_CHECKLIST_DETALLE` tiene
  columnas para ambos (`VC_archivo_nombre`, `BI_desconforme_ticket`),
  heredadas de la app legacy, pero Checklist-Crear nunca las pobló (decisión
  ya tomada en ese plan) y checklists históricos que sí las tengan (creados
  por la app vieja) no las muestran en este detalle — mismo alcance
  consistente entre crear y ver.
- Scoping de datos por promotor/tienda asignada (ver arriba).
- Bandeja de Tickets (sub-proyecto aparte).

## Modelo de datos

`EXHIBICION.TB_CHECKLIST.IN_estado_id` tiene 3 valores reales en producción
hoy: `0` (Anulado — nunca debe listarse, mismo criterio que
`IN_estado_id > 0` en exhibiciones), `1` (Nuevo/Pendiente — el que usa
Checklist-Crear al crear), `2` (Atendido — seteado por el proc legacy
`PROC_CHECKLIST_CAMBIAR_ESTADO`, sin equivalente en la app nueva). No existe
un catálogo `PV_TABLA` para estos estados — las etiquetas se hardcodean en
el frontend, mismo patrón ya usado en `estadoExhibicion.ts` para los estados
de exhibición.

"Conforme"/"No Conforme" de un checklist completo (no de un ítem individual)
se calcula, no se guarda: un checklist es "Conforme" si NINGUNA de sus
líneas activas (`IN_estado = 1`) tiene `BI_desconforme = 1`.

## Backend

**Nuevo router**: `server/routes/checklists.ts`, montado en `/api/checklists`
en `server/index.ts` — se separa de `server/routes/exhibiciones.ts` (que ya
pasa de 800 líneas) porque Checklist deja de ser solo un sub-recurso de una
exhibición puntual y pasa a tener su propia lista/detalle de primer nivel.

**`server/lib/checklistsFilter.ts`** — función pura `buildChecklistsFilter(query)`,
mismo patrón que `buildExhibicionesFilter` (recibe query params ya parseados,
devuelve `{whereSql, params}`, sin tocar la base de datos):
- `search`: `CONVERT(VARCHAR, IN_checklist_number) LIKE` (número parcial) O
  `nombre`/`nro_exhibicion` de la exhibición relacionada con `LIKE`.
- `conforme` (`'si' | 'no'`): `NOT EXISTS`/`EXISTS` sobre
  `TB_CHECKLIST_DETALLE` filtrando `IN_estado = 1 AND BI_desconforme = 1`.
- `tienda`: `LIKE` sobre `VC_cliente_nombre`/`VC_sucursal_nombre` de la
  exhibición relacionada (igual que el filtro de tienda de Exhibiciones).
- `fechaDesde`/`fechaHasta`: sobre `DT_fecha_crea`, mismo tratamiento de
  "fin del día" que ya usa `buildExhibicionesFilter`.
- Siempre incluye `IN_estado_id > 0`.

**`GET /api/checklists`** — lista paginada (mismos query params `page`/
`pageSize` que `GET /api/exhibiciones`, mismo límite de `pageSize` a 100).
Cada item: `{ id, checklistNumber, exhibicionId, exhibicionNroExhibicion,
exhibicionNombre, clienteNombre, sucursalNombre, estadoId, conforme: boolean,
fechaCrea }`. `conforme` se computa con un `OUTER APPLY`/subquery, mismo
enfoque que `PROC_BANDEJA_CHECKLIST` pero sin el join de scoping por rol.

**`GET /api/checklists/:id`** — detalle. Devuelve la cabecera (mismos campos
de tienda/sucursal/exhibición que ya expone `GET /api/exhibiciones/:id`) más
`categorias: { tipoId, tipoNombre, items: { visualCodigo, nombre,
desconforme, motivo }[] }[]` — misma forma que `ChecklistCatalogoCategoria`
ya existente, pero con `desconforme`/`motivo` reales en vez de solo el
catálogo vacío. Se arma con una función pura nueva (o extendiendo
`agruparCatalogoChecklist` con un tercer parámetro opcional de respuestas)
que reutiliza el JOIN ya usado por `GET /api/exhibiciones/catalogo-checklist`
contra `dbo.PV_TABLA`, unido a `TB_CHECKLIST_DETALLE` por
`VC_visual_codigo`. 404 si el checklist no existe o su `IN_estado_id = 0`.

## Frontend

- **`ChecklistsPage.tsx`** en `/checklist` (reemplaza el
  `<ComingSoonPage titleKey="nav.checklist" .../>` actual en `App.tsx`) —
  calco estructural de `ExhibicionesPage.tsx`: buscador + botón refrescar +
  botón filtros en una fila, `ChecklistFiltrosPanel` (mismo patrón que
  `FiltrosPanel`), lista de `ChecklistCard` (N° + fecha, exhibición, tienda/
  sucursal, badge de estado, badge Conforme/No Conforme verde/rojo, botón
  "Ver"), paginación en desktop / scroll infinito en mobile.
- **`ChecklistDetallePage.tsx`** en `/checklist/:id` — cabecera con flecha
  "volver" (a `/checklist`, no a la exhibición — es una vista de la bandeja,
  no del flujo de una exhibición puntual) + N° y fecha; contexto de tienda/
  sucursal/exhibición; las 3 categorías con sus ítems, cada uno mostrando un
  badge Conforme (verde) o No Conforme (rojo) + el motivo en texto si
  aplica. Sin ningún botón de acción — puramente de lectura.
- Ambas páginas usan `SIATC_THEME`, `apiClient`, `navigate(path, { viewTransition: true })`
  y el namespace i18n `checklist_bandeja.*` — nuevo, no reutiliza
  `checklist_crear.*` ni `exhibiciones_lista.*` aunque el patrón visual sea
  el mismo (evita acoplar los textos de dos pantallas con propósitos
  distintos).

## Manejo de errores

Mismo patrón ya establecido: estado de carga con spinner, estado de error
con botón "Reintentar" que vuelve a consultar (no un "Volver" que abandona
la pantalla), vacío ("No se encontraron checklists...") cuando la lista
filtrada no tiene resultados.

## Testing

Función pura `buildChecklistsFilter` con la misma cobertura de casos que ya
tiene `exhibicionesFilter.test.ts` (cada filtro solo, combinados, sin
filtros, fechas inválidas ignoradas). Función pura de armado de detalle
(agrupación + respuestas) con casos equivalentes a
`checklistCatalogo.test.ts` más el caso de una respuesta desconforme con
motivo. Verificación manual E2E contra la base real (curl/scripts Node, no
automatización de navegador interactiva) usando checklists reales ya
existentes en la base (creados en planes anteriores o por la app legacy).

## Constraints globales

- Nunca escribir la contraseña real de la base de datos ni el SAS token de
  Blob Storage en ningún archivo que se comitee a git.
- La bandeja no implementa scoping por promotor/tienda asignada — ve todo,
  igual que el resto de la app hoy. Si se necesita ese scoping más adelante,
  es un proyecto aparte.
- Sin acciones de cambio de estado, sin foto por ítem, sin "generar ticket"
  por ítem — puramente de lectura.
