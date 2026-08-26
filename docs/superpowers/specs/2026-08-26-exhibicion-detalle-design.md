# Exhibición — Vista Detalle ("Ver")

**Fecha:** 2026-08-26
**Estado:** Aprobado, pendiente de plan de implementación
**Sub-proyecto:** 3 de N (sobre Fundación + Exhibiciones-Lista)

## Contexto

La lista de Exhibiciones (spec anterior) dejó la acción "Ver" del menú ⋮
de cada tarjeta mostrando el diálogo "Próximamente". Este spec construye
esa pantalla real: el detalle de una exhibición individual, con 3
pestañas (Principal / Componentes / Fotos), tal como en la app móvil
vieja (capturas de referencia del usuario — solo como referencia de qué
información va en cada pestaña, no de estilo visual).

**Descubrimientos de esta sesión de brainstorming** (leyendo los stored
procedures viejos `PROC_OBTENER_EXHIBICION`, `PROC_OBTENER_COMPONENTE`,
`PROC_OBTENER_FOTO` y `PROC_EXHIBICION_CAMBIAR_ESTADO`):

- Los componentes de una exhibición viven en
  `EXHIBICION.TB_EXHIBICION_COMPONENTE`. `IN_tipo` distingue **1 =
  Producto, 2 = Carcasa** — confirmado por el `JOIN` del proc viejo
  (`IN_tipo=1` → `WEB_MARKETING_PRODUCTOS.VC_tipo='PRD'`; `IN_tipo=2` →
  `VC_tipo='CAR'`). El nombre real del artículo (ej. "CAMPANA EXT.SOLE
  NVA.LAZIO 90CM.1M.INOX") sale de esa tabla, no de
  `TB_EXHIBICION_COMPONENTE` — ahí solo está el código.
- Las fotos viven en `EXHIBICION.TB_EXHIBICION_FOTO`
  (`VC_archivo_nombre`, `BI_es_foto_principal`). El proc viejo devuelve
  esos campos crudos — la URL final se armaba en el código de la app
  vieja, no en SQL. **Verificado en vivo con el usuario**: el archivo
  vive en Azure Blob Storage, cuenta `soleblob1`, contenedor
  `exhibiciones` (no `exhibicionesv2`, que también existe pero es otra
  cosa), como blob plano en la raíz nombrado exactamente
  `VC_archivo_nombre` (ya incluye la extensión). Confirmado cargando una
  foto real (200 OK, imagen válida) con un SAS temporal que el usuario
  generó para la prueba.
- El botón "Revisado" es una aprobación: `PROC_EXHIBICION_CAMBIAR_ESTADO`
  solo permite la transición **estado 1 (Pendiente) → 2 (Aprobado)**
  (`@CH_tipo = 'APR'`). La rama de "Anular" (`DES`) existe en el proc
  pero `PROC_OBTENER_EXHIBICION` trae `IN_permitir_anular` hardcodeado en
  `0` — nunca se ofrecía en la UI vieja tampoco.

## Alcance

**Incluido:**
- Endpoint `GET /api/exhibiciones/:id` — detalle completo (principal +
  componentes + fotos) en una sola respuesta.
- Endpoint `POST /api/exhibiciones/:id/aprobar` — ejecuta la transición
  1→2, validada en servidor.
- Página `ExhibicionDetallePage` con 3 pestañas (switch local, sin
  sub-rutas): Principal, Componentes, Fotos.
- Botón "Revisado" real en la pestaña Principal — visible solo cuando
  `estadoId === 1`, deshabilitado mientras la petición está en curso.
- Navegación real: "Ver" en el menú ⋮ de `ExhibicionCard` navega a
  `/exhibiciones/:id` en vez de abrir "Próximamente".

**Explícitamente fuera de alcance** (sub-proyectos futuros):
- Editar cualquier campo de la exhibición (nombre, tipo, ubicación).
- Agregar/quitar/editar componentes o subir fotos nuevas.
- "Anular" — deshabilitado también en el proc viejo, no se construye.
- Lightbox/zoom de fotos — se muestran inline; si hace falta ampliarlas
  se evalúa después (YAGNI).
- Checklist y Tickets — son otro módulo del menú lateral, no pestañas de
  esta vista.

## Decisiones tomadas (de la sesión de brainstorming)

| Pregunta | Decisión |
|---|---|
| Fuente de las fotos | Azure Blob Storage, cuenta `soleblob1`, contenedor `exhibiciones`, blobs planos nombrados por `VC_archivo_nombre` |
| Alcance del botón "Revisado" | Acción real (no "Próximamente") — transición de estado 1→2 |
| Un endpoint combinado vs. 3 por pestaña | Un solo `GET /:id` — el dataset es chico (pocos componentes/fotos por exhibición), así el cambio de pestaña es instantáneo sin spinners repetidos |
| Credencial de Blob Storage en el backend | SAS de larga duración (solo lectura) para el contenedor, como variable de entorno — no la cuenta/clave completa; mismo tratamiento que `DB_PASSWORD` (nunca en el repo) |

## Arquitectura

```
Frontend (React)                       Backend (Express)                  Azure SQL / Blob
┌──────────────────────────┐         ┌───────────────────────────┐       ┌──────────────────────┐
│ ExhibicionDetallePage      │──GET──▶│ GET /:id                   │──────▶│ TB_EXHIBICION         │
│  ├─ TabsPrincipal           │  /api/ │  (principal+componentes+  │       │ TB_EXHIBICION_        │
│  ├─ TabsComponentes         │ exhib- │   fotos en una respuesta) │       │  COMPONENTE            │
│  └─ TabsFotos               │ iciones│                            │       │ TB_EXHIBICION_FOTO     │
│     (botón "Revisado")      │──POST─▶│ POST /:id/aprobar          │──────▶│ WEB_MARKETING_PRODUCTOS│
└──────────────────────────┘        └───────────────────────────┘       │ dbo.PV_TABLA            │
                                                    │                     └──────────────────────┘
                                                    ▼ URL de foto = BLOB_CONTAINER_URL + archivo + SAS
                                          Azure Blob Storage (soleblob1/exhibiciones)
```

## Backend

### `GET /api/exhibiciones/:id`

Protegido con `verifyToken`. Sin query params.

**Principal** — mismo patrón `LEFT JOIN` (no `INNER JOIN` como el proc
viejo) hacia `PV_TABLA`, consistente con el endpoint de lista:

```sql
SELECT
  E.IN_exhibicion_id, E.VC_nro_exhibicion, E.VC_nombre,
  E.VC_cliente_nombre, E.VC_sucursal_nombre,
  E.VC_piso, ET.VC_descripcion AS tipo_nombre, EPD.VC_descripcion AS piso_detalle_nombre,
  E.IN_estado_id, E.DT_fecha_crea
FROM EXHIBICION.TB_EXHIBICION E
LEFT JOIN dbo.PV_TABLA ET
  ON ET.VC_tabla = 'EXHIBICION_TIPO' AND ET.CH_activo = '1' AND ET.IN_id = E.IN_exhibicion_tipo_id
LEFT JOIN dbo.PV_TABLA EPD
  ON EPD.VC_tabla = 'EXHIBICION_PISO_DETALLE' AND EPD.CH_activo = '1' AND EPD.IN_id = E.IN_piso_detalle_id
WHERE E.IN_exhibicion_id = @id
```

Si no hay fila → 404.

**Componentes**:

```sql
SELECT C.IN_tipo, P.VC_articulo_nombre2 AS nombre, C.IN_cantidad
FROM EXHIBICION.TB_EXHIBICION_COMPONENTE C
LEFT JOIN EXHIBICION.WEB_MARKETING_PRODUCTOS P
  ON P.VC_articulo_codigo = C.VC_codigo_producto
  AND P.VC_tipo = CASE C.IN_tipo WHEN 1 THEN 'PRD' WHEN 2 THEN 'CAR' END
WHERE C.IN_exhibicion_id = @id AND C.IN_estado = 1
ORDER BY nombre
```

`LEFT JOIN` (no `INNER` como el proc viejo) — si un código de producto no
tiene match en el catálogo, la fila igual aparece con `nombre: null` en
vez de desaparecer silenciosamente. El route handler separa el resultado
en `carcasas` (`IN_tipo = 2`) y `productos` (`IN_tipo = 1`).

**Fotos**:

```sql
SELECT VC_archivo_nombre, BI_es_foto_principal
FROM EXHIBICION.TB_EXHIBICION_FOTO
WHERE IN_exhibicion_id = @id AND IN_estado > 0
ORDER BY BI_es_foto_principal DESC, IN_exhibicion_foto_id ASC
```

El route handler arma la URL de cada foto:
`` `${cleanEnv('BLOB_CONTAINER_URL')}/${archivoNombre}?${cleanEnv('BLOB_SAS_TOKEN')}` ``
— función pura `buildFotoUrl(containerUrl, sasToken, archivoNombre)` en
`server/lib/exhibicionFotos.ts`, testeada sin tocar red ni base de datos.

**Función pura testeable** `mapComponentesRows(rows)` en
`server/lib/exhibicionComponentes.ts` — separa un array plano de filas en
`{ carcasas: [...], productos: [...] }`, testeada aislada (mismo patrón
que `exhibicionesFilter.ts`).

Respuesta:
```ts
{
  id: number; nroExhibicion: string; nombre: string; fechaCrea: string;
  clienteNombre: string; sucursalNombre: string;
  tipoNombre: string | null; piso: string | null; pisoDetalleNombre: string | null;
  estadoId: 0 | 1 | 2;
  canAprobar: boolean; // estadoId === 1
  componentes: {
    carcasas: Array<{ nombre: string | null; cantidad: number }>;
    productos: Array<{ nombre: string | null; cantidad: number }>;
  };
  fotos: Array<{ url: string; esFotoPrincipal: boolean }>;
}
```

### `POST /api/exhibiciones/:id/aprobar`

Protegido con `verifyToken`. Sin body. Server-side:
1. Lee `IN_estado_id` actual de la exhibición.
2. Si no es `1` → 409 (`{ error: 'La exhibición ya no está pendiente.' }`)
   — evita doble-click/carrera dejando el mensaje explícito en vez de un
   500 genérico.
3. Si es `1` → `UPDATE ... SET IN_estado_id = 2, VC_usuario_modi =
   @usuario, DT_fecha_modi = GETDATE()` (usuario sale del JWT vía
   `verifyToken`, no del body — no confiar en el cliente para el
   auditor).
4. Responde `{ estadoId: 2 }`.

No se reusa `PROC_EXHIBICION_CAMBIAR_ESTADO` directamente (mismo criterio
que con `PROC_BANDEJA_EXHIBICION` en la lista): el proc trae la rama
"DES"/anular que no aplica acá, y una `UPDATE` de una sola transición es
más simple y clara que parametrizar un proc con casos que no se usan.

### Variables de entorno nuevas

```
BLOB_CONTAINER_URL=https://soleblob1.blob.core.windows.net/exhibiciones
BLOB_SAS_TOKEN=REPLACE_WITH_REAL_SAS_TOKEN
```

`BLOB_SAS_TOKEN` es un SAS de **larga duración, solo lectura**, generado
por el usuario en Azure Portal para el contenedor `exhibiciones` — nunca
se escribe en el repo (mismo tratamiento que `DB_PASSWORD`). Tiene fecha
de expiración; cuando venza, se regenera y se actualiza la variable en
EasyPanel sin tocar código.

## Frontend

- **`ExhibicionDetallePage.tsx`** (ruta `/exhibiciones/:id`) — carga el
  detalle completo al montar, header con flecha "←" (vuelve a la lista) +
  N° de exhibición, switch de pestañas local (`useState`).
- **`DetallePrincipalTab.tsx`** — los campos de la captura de referencia
  (tienda, sucursal, tipo, piso, detalle de piso) + badge de estado +
  botón "Revisado" (visible solo si `canAprobar`, `disabled` mientras
  la petición está en curso, actualiza el estado local al responder sin
  recargar toda la página).
- **`DetalleComponentesTab.tsx`** — dos listas (Carcasas / Productos),
  cada fila nombre + cantidad; sección vacía si el array correspondiente
  está vacío (igual que la captura de referencia, que mostraba
  "Carcasas" sin filas cuando no aplicaba).
- **`DetalleFotosTab.tsx`** — la foto con `esFotoPrincipal` más grande
  arriba ("Foto cuerpo entero"), el resto en grilla ("Foto por
  componente"). Sin fotos → estado vacío, no un layout roto.
- `ExhibicionCard.tsx`: `onAction('ver')` pasa de abrir el diálogo
  "Próximamente" a `navigate(`/exhibiciones/${id}`)`.

## Manejo de errores

- `GET /:id` con id inexistente → 404 con mensaje claro; la página
  muestra un estado de error con botón para volver a la lista (no un
  crash ni una pantalla en blanco).
- Fotos que fallan al cargar (URL vencida, blob borrado) → `onError` en
  el `<img>` reemplaza por un placeholder "Foto no disponible", no rompe
  el layout de la grilla.
- `POST /:id/aprobar` fallido (409 por carrera, o error de red) →
  mensaje inline en la pestaña Principal, el botón vuelve a estar
  habilitado; no se asume éxito optimista.

## Testing

- `server/lib/exhibicionComponentes.test.ts` — `mapComponentesRows`:
  separa carcasas/productos, maneja arrays vacíos, preserva orden.
- `server/lib/exhibicionFotos.test.ts` — `buildFotoUrl`: arma la URL
  correctamente, incluyendo casos de borde (nombre de archivo con
  caracteres especiales si aplica).
- Sin tests de componentes React nuevos — mismo criterio que en
  Exhibiciones-Lista.
- Verificación manual: build + type-check + prueba en navegador contra
  la base real (abrir una exhibición con y sin componentes/fotos,
  aprobar una pendiente, verificar que una ya aprobada no muestra el
  botón).
