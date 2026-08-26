# Exhibiciones — Lista

**Fecha:** 2026-08-26
**Estado:** Aprobado, pendiente de plan de implementación
**Sub-proyecto:** 2 de N (primer módulo de negocio real, sobre la Fundación)

## Contexto

La Fundación (spec anterior) dejó el módulo Exhibiciones como placeholder
("Próximamente"). Este spec construye la primera pantalla real de negocio:
la lista de exhibiciones que se muestra al entrar al menú "Exhibiciones".

Referencia visual: captura de la app móvil vieja (.NET + Angular) que el
usuario compartió — se usa solo como referencia de qué información y
acciones van en cada tarjeta, **no** como referencia de estilo. El diseño
visual sigue la paleta y los componentes ya establecidos en `siatc-theme.ts`
(navy `#4C5F80`, tipografía Lato, sin modo oscuro).

**Descubrimiento clave de esta sesión de brainstorming:** la tabla real es
`EXHIBICION.TB_EXHIBICION` (767 filas). Sus columnas `IN_exhibicion_tipo_id`
e `IN_piso_detalle_id` no traen el texto directamente — se traducen vía la
tabla genérica de catálogos `dbo.PV_TABLA` (`VC_tabla = 'EXHIBICION_TIPO'` /
`'EXHIBICION_PISO_DETALLE'`, filtrando `CH_activo = '1'`). Esto se confirmó
leyendo el stored procedure viejo `EXHIBICION.PROC_BANDEJA_EXHIBICION`
(que alimentaba esta misma pantalla en la app anterior) — no se inventó
ningún campo.

`IN_estado_id` (0/1/2) no tiene catálogo en ninguna tabla de la base. Por
la lógica del proc viejo (`WHERE IN_estado_id > 0` para ocultar de la
lista; `CASE WHEN IN_estado_id = 1 THEN ... 'Revisado'` para la acción de
aprobar) se infirió y el usuario confirmó: **0 = Anulado** (oculto),
**1 = Pendiente**, **2 = Aprobado**. Estas dos etiquetas quedan como
constantes en el código — no hay catálogo real que las respalde.

## Alcance

**Incluido:**
- Endpoint `GET /api/exhibiciones` — lista paginada, filtrada y buscable,
  consultando `TB_EXHIBICION` directamente (no el proc viejo — ver
  "Decisiones tomadas")
- Endpoint `GET /api/exhibiciones/opciones-filtro` — los 55 tipos activos +
  9 ubicaciones activas de `PV_TABLA`, para poblar los dropdowns
- Página `ExhibicionesPage` real reemplazando el placeholder de `/exhibiciones`
- Búsqueda por N° de exhibición (con debounce)
- Panel de Filtros: tipo, estado, tienda/sucursal (texto libre), rango de fechas
- Responsive: paginación clásica en desktop (≥1024px, con selector de
  tamaño de página y salto a página), scroll infinito en mobile (<1024px)
- Botones "Ver" / "Checklist" / "Ticket" en cada tarjeta — visibles, pero
  muestran el diálogo "Próximamente" (reusando `DialogContext`) en vez de
  navegar a algo real

**Explícitamente fuera de alcance** (sub-proyectos futuros):
- Pantalla de detalle de una exhibición individual ("Ver")
- Checklist y Tickets reales (ya son placeholders separados en el menú)
- Crear/editar exhibiciones (el botón "+" flotante de la referencia) —
  existe `PROC_GUARDAR_EXHIBICION` listo para reusar cuando se construya
- Filtrado de datos por tienda asignada al usuario (Promotor/Trade/
  Supervisor) — por ahora **todos los usuarios ven las 767 exhibiciones**;
  el filtro por asignación real se agrega cuando esos roles empiecen a
  usar la app de verdad
- Dropdown de tienda/sucursal poblado desde catálogo — por ahora es texto
  libre que busca sobre `VC_cliente_nombre`/`VC_sucursal_nombre`

## Decisiones tomadas (de la sesión de brainstorming)

| Pregunta | Decisión |
|---|---|
| Estados 0/1/2 | 0=Anulado (oculto), 1=Pendiente, 2=Aprobado — inferido de los procs viejos, confirmado por el usuario |
| Alcance de "Ver"/"Checklist"/"Ticket"/"+" | Solo la lista funciona esta vez; esos botones muestran "Próximamente" |
| Quién ve qué exhibiciones | Todos ven todas (767) — sin filtro por tienda asignada por ahora |
| Filtros necesarios | Tipo, Estado, Tienda/Sucursal, Rango de fechas (los 4) |
| Navegación en desktop | Paginación clásica: selector de tamaño de página + salto a página |
| Navegación en mobile | Scroll infinito |
| Reusar `PROC_BANDEJA_EXHIBICION` vs. query nueva | Query nueva — el proc viejo trae hardcodeado el filtro por tienda-asignada que decidimos no usar; forzarlo con un `@VC_usuario` sintético sería más frágil que escribir una consulta limpia |

## Arquitectura

```
Frontend (React)                    Backend (Express)              Azure SQL
┌─────────────────────────┐        ┌──────────────────────┐       ┌─────────────────┐
│ ExhibicionesPage         │        │ routes/exhibiciones.ts│       │ EXHIBICION.      │
│  ├─ FiltrosPanel          │──GET──▶│  GET /                │──────▶│  TB_EXHIBICION   │
│  ├─ ExhibicionCard (×N)   │  /api/ │  GET /opciones-filtro │       │ dbo.PV_TABLA     │
│  └─ Pagination (desktop)  │  exhib-│                        │       │  (EXHIBICION_TIPO│
│     / infinite scroll     │  iciones│  buildExhibicionesQuery│       │   /_PISO_DETALLE)│
│     (mobile)              │        │  (función pura,       │       │                  │
└─────────────────────────┘        │   testeable)          │       └─────────────────┘
                                     └──────────────────────┘
```

Todos los componentes nuevos viven en `src/components/exhibiciones/` —
sienta el patrón de carpeta-por-módulo para cuando Checklist/Tickets se
construyan después.

## Backend

### `GET /api/exhibiciones`

Protegido con `verifyToken` (igual que el resto de rutas). Query params,
todos opcionales salvo paginación:

| Param | Tipo | Notas |
|---|---|---|
| `page` | number | default 1 |
| `pageSize` | number | default 20 (desktop) / 15 (mobile) — lo decide el frontend |
| `search` | string | busca sobre `VC_nro_exhibicion` (prefijo) y `VC_nombre` (contiene) |
| `tipo` | number | `IN_exhibicion_tipo_id` exacto |
| `estado` | number | `IN_estado_id` exacto (1 o 2 — 0 nunca es seleccionable) |
| `tienda` | string | busca sobre `VC_cliente_nombre` o `VC_sucursal_nombre` (contiene) |
| `fechaDesde` / `fechaHasta` | string (ISO date) | sobre `DT_fecha_crea` |

La consulta central usa `LEFT JOIN` (no `INNER JOIN` como el proc viejo)
hacia `PV_TABLA` para tipo y ubicación — si el tipo referenciado ya no está
activo, la fila igual aparece (con `tipoNombre: null`) en vez de
desaparecer silenciosamente de la lista.

```sql
SELECT
  E.IN_exhibicion_id, E.VC_nro_exhibicion, E.VC_nombre,
  E.VC_cliente_nombre, E.VC_sucursal_nombre,
  ET.VC_descripcion AS tipo_nombre,
  EPD.VC_descripcion AS ubicacion_nombre,
  E.IN_estado_id, E.DT_fecha_crea
FROM EXHIBICION.TB_EXHIBICION E
LEFT JOIN dbo.PV_TABLA ET
  ON ET.VC_tabla = 'EXHIBICION_TIPO' AND ET.CH_activo = '1' AND ET.IN_id = E.IN_exhibicion_tipo_id
LEFT JOIN dbo.PV_TABLA EPD
  ON EPD.VC_tabla = 'EXHIBICION_PISO_DETALLE' AND EPD.CH_activo = '1' AND EPD.IN_id = E.IN_piso_detalle_id
WHERE E.IN_estado_id > 0
  [-- + condiciones opcionales según filtros presentes --]
ORDER BY E.VC_nro_exhibicion DESC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
```

Más una consulta `COUNT(*)` gemela (mismo `WHERE`, sin `OFFSET`) para el
total — necesario tanto para la paginación clásica (número de páginas)
como para el indicador de scroll infinito ("mostrando X de Y").

**Función pura testeable:** `buildExhibicionesFilter(query)` en
`server/lib/exhibicionesFilter.ts` — toma los query params ya validados y
devuelve `{ whereClauses: string[], params: Record<string, unknown> }`. El
route handler la usa para armar el `WHERE` de ambas consultas (datos +
count) sin duplicar lógica, y se testea aislada sin tocar la base de datos
(mismo patrón que `server/lib/cors.ts` / `permissions.ts`).

Respuesta:
```ts
{
  items: Array<{
    id: number; nroExhibicion: string; nombre: string; fechaCrea: string;
    clienteNombre: string; sucursalNombre: string;
    tipoNombre: string | null; ubicacionNombre: string | null;
    estadoId: 1 | 2;
  }>;
  total: number; page: number; pageSize: number;
}
```

### `GET /api/exhibiciones/opciones-filtro`

Sin params. Devuelve `{ tipos: [{id, nombre}], ubicaciones: [{id, nombre}] }`
desde `PV_TABLA` (`CH_activo = '1'`). El frontend la llama una sola vez al
abrir el panel de Filtros por primera vez (no en cada request de lista).

Los estados (Pendiente/Aprobado) van hardcodeados en el frontend — no
tiene sentido un endpoint para dos constantes.

## Frontend

- **`ExhibicionesPage.tsx`** — orquesta: estado de filtros/búsqueda/página,
  llama al endpoint, decide entre modo desktop/mobile vía el mismo
  breakpoint `lg:` (1024px) que ya usa `MainLayout` para el sidebar.
- **`ExhibicionCard.tsx`** — una tarjeta: header (N° - nombre (fecha)),
  Tienda/Sucursal, Tipo/Ubicación, badge de estado, y los 3 botones de
  acción (abren el diálogo "Próximamente").
- **`FiltrosPanel.tsx`** — colapsable, se abre con el botón "Filtros";
  carga las opciones de tipo/ubicación la primera vez que se abre.
- **`Pagination.tsx`** — solo se renderiza en desktop; selector de tamaño
  de página (10/20/50) + input de "ir a página". Reutilizable a futuro.
- Scroll infinito en mobile: `IntersectionObserver` sobre un elemento
  centinela al final de la lista, dispara la carga de la página siguiente
  y **agrega** resultados (no reemplaza) al array existente.
- Búsqueda con debounce ~400ms; cualquier cambio de búsqueda o filtro
  reinicia a página 1 / limpia la lista acumulada en mobile.

## Manejo de errores

- Error de red/DB en el endpoint → mismo patrón `safeError()` ya
  establecido (mensaje genérico en producción, detalle real en logs del
  servidor).
- Lista vacía (filtros sin resultados) → estado vacío amigable, no una
  tabla en blanco.
- Falla al cargar una página adicional en scroll infinito → no rompe la
  lista ya cargada; muestra un botón "Reintentar" en el centinela.

## Testing

- `server/lib/exhibicionesFilter.test.ts` — la función pura de armado de
  filtros: cada combinación de params produce el `WHERE`/params esperado,
  incluyendo el caso sin filtros (solo `IN_estado_id > 0`).
- Sin tests de componentes React nuevos — consistente con el resto del
  proyecto, donde solo se testea lógica no-trivial, no JSX puro. La lógica
  de paginación/scroll-infinito vive en hooks pequeños si se extrae
  suficiente complejidad; se evalúa durante la implementación si amerita
  un test propio.
- Verificación manual: build + type-check + prueba en navegador contra la
  base real (login, cargar lista, buscar, filtrar, paginar en desktop,
  scrollear en mobile) — mismo patrón usado en el resto de esta sesión.
