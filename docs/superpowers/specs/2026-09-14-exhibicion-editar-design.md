# Exhibición — Editar

**Fecha:** 2026-09-14
**Estado:** Aprobado, pendiente de plan de implementación
**Sub-proyecto:** extiende Exhibición-Crear (2026-08-27) — esa spec dejó
"Editar una exhibición existente" explícitamente fuera de alcance; este
documento lo construye.

## Contexto

Pedido del usuario sobre la vista de lista de Exhibiciones: agregar una
opción "Editar" al menú de 3 puntos de cada tarjeta. Hoy esa función no
existe en ningún lado del código — ni página, ni endpoint backend, ni
ruta. Tampoco existe `PUT`/`DELETE` para exhibición, componentes ni
fotos: todo lo que hay es `POST` (crear/agregar).

**Descubrimientos de esta sesión de brainstorming** (leyendo
`server/routes/exhibiciones.ts`, `types/index.ts` y el esquema real vía
`INFORMATION_SCHEMA.COLUMNS`):

- Las 3 tablas SÍ tienen columnas de auditoría de modificación —
  `VC_usuario_modi` y `DT_fecha_modi` (nombre abreviado, no
  `_modifica`; se me pasó en la primera lectura del esquema y `POST
  /:id/aprobar` ya las usa). Los 3 endpoints nuevos las llenan igual que
  `/aprobar`, además de un registro en `TB_AUDIT_LOG` vía `logAudit()`
  para mantener el mismo rastro que atender/anular de checklists y
  tickets.
- `POST /:id/aprobar` ya resuelve la condición de carrera "¿sigue
  Pendiente?" con un único `UPDATE ... WHERE IN_estado_id = 1` (sin
  `SELECT` previo) — los 3 endpoints nuevos siguen ese mismo patrón en
  vez de separar lectura y escritura.
- `TB_EXHIBICION_COMPONENTE.IN_estado` y `TB_EXHIBICION_FOTO.IN_estado`
  ya son soft-delete: `GET /:id` ya filtra `IN_estado = 1` (componentes)
  e `IN_estado > 0` (fotos). Quitar un componente o foto es entonces un
  `UPDATE ... SET IN_estado = 0`, el mismo patrón que ya usa el resto de
  la app — no hace falta un `DELETE` real de la fila ni borrar el blob
  del Storage.
- `GET /api/exhibiciones/:id` hoy solo devuelve `tipoNombre` y
  `pisoDetalleNombre` (los textos ya resueltos vía `LEFT JOIN` a
  `PV_TABLA`), no los IDs crudos (`IN_exhibicion_tipo_id`,
  `IN_piso_detalle_id`). El formulario de editar necesita los IDs para
  pre-seleccionar los `<select>` — el endpoint necesita agregarlos.
- La spec de Crear dejó la exhibición poder guardarse con **0
  componentes y 0 fotos** (se agregan después, opcionales). No existe
  ninguna regla de "mínimo 1" en el código actual — por lo tanto quitar
  el último componente o la última foto durante la edición tampoco
  necesita bloquearse; sería una regla inventada que no es consistente
  con cómo ya funciona crear.
- Las rutas de `/api/exhibiciones` no tienen `checkPermission` granular
  en ningún verbo (crear, aprobar, agregar componente/foto) — solo
  `verifyToken` a nivel de router. Los endpoints nuevos siguen el mismo
  criterio, sin agregar un permiso que el resto de la familia no tiene.

## Alcance

**Incluido:**
- Opción "Editar" en el menú de 3 puntos de `ExhibicionCard`, visible
  **solo si `estadoId === 1`** (Pendiente) — no aparece en exhibiciones
  Aprobadas.
- Página `/exhibiciones/:id/editar`, calcada de `ExhibicionCrearPage`:
  formulario pre-cargado de Nombre, Tipo y Ubicación (Piso + Detalle).
- Reusar `DetalleComponentesTab` y `DetalleFotosTab` (ya manejan
  "agregar") extendiéndolos con un botón "Quitar"/"Eliminar" opcional
  por ítem, activo solo en esta página.
- 3 endpoints backend nuevos: `PUT /:id` (datos básicos), `DELETE
  /:id/componentes/:componenteId`, `DELETE /:id/fotos/:fotoId` — los
  tres devuelven 409 si la exhibición ya no está Pendiente.
- `GET /:id` gana `tipoId` y `pisoDetalleId` en la respuesta (además de
  los nombres ya resueltos que sigue devolviendo igual).

**Explícitamente fuera de alcance:**
- Editar Tienda/Sucursal — ver spec de Crear, esos campos nunca
  estuvieron en el pedido del usuario ("nombre, tipo, ubicación").
- Reemplazar una foto ya subida (solo agregar/quitar, no "reemplazar en
  el mismo slot").
- Marcar/desmarcar manualmente cuál foto es la "principal" desde esta
  pantalla — sigue siendo automático (la primera foto activa que quede
  después de agregar/quitar), mismo criterio YAGNI que ya usa
  `DetalleFotosTab`.
- Bloquear quitar el último componente/foto — ver hallazgo arriba, no
  es una regla real de la app.
- Cualquier permiso granular nuevo — sigue el mismo criterio
  (`verifyToken` solamente) que el resto de `/api/exhibiciones`.

## Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| Campos editables | Nombre, Tipo, Ubicación (Piso + Detalle) — no Tienda/Sucursal |
| Componentes y fotos | También editables: agregar (ya existe) + quitar (nuevo) |
| Restricción por estado | Solo mientras la exhibición está Pendiente (`estadoId === 1`) — igual que Atender/Anular en checklists/tickets |
| UI | Página dedicada `/exhibiciones/:id/editar` (Opción B), no un modo-edición dentro de la vista de Detalle de solo lectura |
| Quitar componente/foto | Soft-delete (`IN_estado = 0`), sin mínimo de 1 — consistente con que crear ya permite 0 de cada uno |
| Guardado | Nombre/Tipo/Ubicación se guardan con un botón "Guardar cambios" explícito; agregar/quitar componente y foto son acciones instantáneas (mismo patrón que ya usa la vista de Detalle) |

## Arquitectura

```
Frontend (React)                              Backend (Express)                          Azure SQL
┌────────────────────────────┐             ┌──────────────────────────────────┐        ┌────────────────────────┐
│ ExhibicionEditarPage         │──GET──────▶│ GET /:id (+tipoId, +pisoDetalleId) │───────▶│ TB_EXHIBICION           │
│  (Nombre, Tipo, Ubicación)   │──GET──────▶│ GET /opciones-crear (catálogo)     │───────▶│ dbo.PV_TABLA            │
│  botón "Guardar cambios"     │──PUT──────▶│ PUT /:id (409 si no Pendiente)      │───────▶│ UPDATE TB_EXHIBICION    │
├────────────────────────────┤             ├──────────────────────────────────┤        ├────────────────────────┤
│ DetalleComponentesTab        │──POST─────▶│ POST /:id/componentes (ya existe)  │───────▶│ INSERT TB_EXHIBICION_   │
│  (+ botón "Quitar" nuevo)    │──DELETE───▶│ DELETE /:id/componentes/:cId        │───────▶│  COMPONENTE (IN_estado) │
├────────────────────────────┤             ├──────────────────────────────────┤        ├────────────────────────┤
│ DetalleFotosTab              │──POST─────▶│ POST /:id/fotos (ya existe)         │───────▶│ INSERT TB_EXHIBICION_   │
│  (+ botón "Eliminar" nuevo)  │──DELETE───▶│ DELETE /:id/fotos/:fId              │───────▶│  FOTO (IN_estado)       │
└────────────────────────────┘             └──────────────────────────────────┘        └────────────────────────┘
```

## Backend

### `GET /api/exhibiciones/:id` — cambio

Agrega `E.IN_exhibicion_tipo_id as tipoId` y `E.IN_piso_detalle_id as
pisoDetalleId` al `SELECT` de `principalResult` (junto a los `tipoNombre`
/`pisoDetalleNombre` que ya devuelve), y los pasa al JSON de respuesta.
`ExhibicionDetalle` (frontend) gana `tipoId: number` y `pisoDetalleId:
number | null`.

### `server/lib/exhibicionEditar.ts` (nuevo) — `validarExhibicionEditar`

Función pura, mismo patrón que `validarExhibicionCrear` pero sin
Tienda/Sucursal:

```ts
export interface EditarExhibicionInput {
    nombre: string;
    tipoId: number;
    piso: string | null;
    pisoDetalleId: number | null;
}

export type ValidacionEditar =
    | { valido: true; datos: EditarExhibicionInput }
    | { valido: false; error: string };

export function validarExhibicionEditar(body: unknown): ValidacionEditar {
    // nombre (no vacío tras trim), tipoId (numérico > 0) obligatorios;
    // piso y pisoDetalleId opcionales — misma lógica que
    // validarExhibicionCrear para estos 4 campos.
}
```

### `PUT /api/exhibiciones/:id`

Body: `{ nombre, tipoId, piso, pisoDetalleId }`.

1. `id` inválido → 400. `validarExhibicionEditar` falla → 400.
2. `UPDATE EXHIBICION.TB_EXHIBICION SET VC_nombre = @nombre,
   IN_exhibicion_tipo_id = @tipoId, VC_piso = @piso, IN_piso_detalle_id
   = @pisoDetalleId, VC_usuario_modi = @usuario, DT_fecha_modi =
   GETDATE() WHERE IN_exhibicion_id = @id AND IN_estado_id = 1` — mismo
   patrón atómico que `/aprobar` (guardia de estado en el propio
   `WHERE`, sin `SELECT` previo).
3. `rowsAffected[0] === 0` → un segundo `SELECT 1 FROM TB_EXHIBICION
   WHERE IN_exhibicion_id = @id` distingue 404 "Exhibición no
   encontrada" de 409 "La exhibición ya no está pendiente y no se puede
   editar." (mismo bloque de desambiguación que `/aprobar`).
4. `logAudit(req, 'EXHIBICION_EDITADA', 'TB_EXHIBICION', String(id))`.
5. Responde `200` con el mismo shape que `GET /:id` (vuelve a construir
   la respuesta con los valores recién guardados) — así el frontend no
   necesita un segundo `GET` tras guardar.

### `DELETE /api/exhibiciones/:id/componentes/:componenteId`

1. `UPDATE EXHIBICION.TB_EXHIBICION_COMPONENTE SET IN_estado = 0,
   VC_usuario_modi = @usuario, DT_fecha_modi = GETDATE() WHERE
   IN_exhibicion_componente_id = @componenteId AND IN_exhibicion_id =
   @id AND IN_estado = 1 AND EXISTS (SELECT 1 FROM
   EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id AND
   IN_estado_id = 1)` — un solo `UPDATE` atómico: el `EXISTS` gatea por
   el estado de la exhibición (tabla distinta) en el mismo `WHERE`, sin
   leer primero. El `AND IN_exhibicion_id = @id` evita que alguien arme
   un request a mano y borre un componente de OTRA exhibición.
2. `rowsAffected[0] === 0` → desambigua con un `SELECT` (exhibición no
   existe → 404 "Exhibición no encontrada"; existe pero no está
   Pendiente → 409 "La exhibición ya no está pendiente."; existe,
   Pendiente, pero el componente no matcheó → 404 "Componente no
   encontrado.").
3. `logAudit(req, 'EXHIBICION_COMPONENTE_QUITADO', 'TB_EXHIBICION_COMPONENTE', String(componenteId))`.
4. Responde `204`.

### `DELETE /api/exhibiciones/:id/fotos/:fotoId`

Mismo patrón atómico (`UPDATE ... WHERE ... AND EXISTS (...)`) sobre
`TB_EXHIBICION_FOTO`. El blob en Azure Storage **no se borra** — mismo
criterio que anular checklist/ticket, que tampoco revierten nada fuera
de la fila; queda un archivo huérfano en el contenedor, aceptado (ya
pasa con las fotos históricas duplicadas como "principal" que dejó
`PROC_GUARDAR_EXHIBICION`). `logAudit(req, 'EXHIBICION_FOTO_ELIMINADA',
'TB_EXHIBICION_FOTO', String(fotoId))`. Responde `204`.

## Frontend

- **`server` → `types/index.ts`**: `ExhibicionDetalle` gana `tipoId:
  number` y `pisoDetalleId: number | null`. Nuevos tipos
  `EditarExhibicionInput` (espejo de `CrearExhibicionInput` sin
  tienda/sucursal).
- **`ExhibicionEditarPage.tsx`** (nueva, ruta
  `/exhibiciones/:id/editar`) — carga `GET /:id` y `GET
  /opciones-crear` en paralelo al montar. Si `estadoId !== 1`, muestra
  un mensaje ("Esta exhibición ya no está pendiente") con botón volver,
  sin renderizar el formulario. Si no:
  - Formulario de Nombre/Tipo/Piso/Detalle pre-llenado (mismos
    `<select>`/`<input>` que `ExhibicionCrearPage`, sin los dos de
    Tienda/Sucursal). Botón "Guardar cambios" → `PUT /:id`, actualiza el
    estado local con la respuesta, muestra un check de éxito (no
    navega — el usuario puede seguir editando componentes/fotos debajo).
  - Debajo, `<DetalleComponentesTab>` y `<DetalleFotosTab>` reusados tal
    cual, pasándoles los componentes/fotos ya cargados.
- **`DetalleComponentesTab.tsx`**: nueva prop opcional
  `onComponenteQuitado?: (id: number) => void`. Cuando está presente,
  cada `<li>` de `Grupo` muestra un botón "Quitar" (ícono `X`) que llama
  `DELETE /:id/componentes/:id` y, si sale bien, dispara el callback
  para sacarlo de la lista local. `ExhibicionDetallePage` no pasa esta
  prop → sin cambio de comportamiento ahí.
- **`DetalleFotosTab.tsx`**: mismo patrón, nueva prop opcional
  `onFotoEliminada?: (id: number) => void`, botón "Eliminar" superpuesto
  en cada `<Foto>` (esquina superior derecha, mismo estilo que los
  overlays ya usados en las tarjetas de tickets/checklists).
- **`ExhibicionCard.tsx`**: cuarta opción en el menú ("Editar", ícono
  `Pencil`), condicionada a `exhibicion.estadoId === 1`. `onAction` gana
  el literal `'editar'`.
- **`ExhibicionesPage.tsx`**: `handleAction` — caso `'editar'` navega a
  `/exhibiciones/${id}/editar`.
- **`App.tsx`**: nueva ruta `/exhibiciones/:id/editar` →
  `ExhibicionEditarPage`, mismo wrapper de autenticación que las demás
  (sin `RequirePermission` adicional, consistente con que el resto de
  `/exhibiciones` tampoco lo tiene).
- **i18n**: namespace `exhibicion_editar` (title, subtitle, botón
  guardar, mensajes de éxito/error, "ya no está pendiente") + 1 key
  nueva en `exhibiciones_lista` (`accion_editar`) + 2 keys nuevas
  compartidas en `exhibicion_detalle` (`accion_quitar`,
  `accion_eliminar_foto`) — en `es.json` y `en.json`, verificado con el
  mismo script de diff de keys que ya se usó antes.

## Manejo de errores

- `PUT /:id` / `DELETE .../componentes/:id` / `DELETE .../fotos/:id`
  contra una exhibición que otra persona aprobó mientras el usuario
  tenía la página de editar abierta → 409, mensaje mostrado inline, sin
  aplicar el cambio local (el frontend no asume éxito de forma
  optimista).
- `DELETE` de un componente/foto que ya fue quitado por otra pestaña →
  404 "no encontrado" — mensaje inline, la fila igual se saca de la
  lista local (ya no existe de todos modos).
- `PUT /:id` con `nombre` vacío o `tipoId` inválido → 400 antes de tocar
  la base — igual que `POST /`.

## Testing

- `server/lib/exhibicionEditar.test.ts` — validación de
  `validarExhibicionEditar` (función pura, TDD, mismo patrón que
  `exhibicionCrear.test.ts`).
- Sin tests de componentes React nuevos — mismo criterio que el resto
  del proyecto (cero tests de integración de rutas o UI en todo el
  repo).
- Verificación manual de punta a punta: editar nombre/tipo/ubicación de
  una exhibición de prueba Pendiente, quitar y volver a agregar un
  componente, quitar y volver a agregar una foto, confirmar que el
  botón "Editar" desaparece del menú una vez que la exhibición pasa a
  Aprobada, y confirmar que golpear `PUT`/`DELETE` a mano contra una
  exhibición Aprobada responde 409.
