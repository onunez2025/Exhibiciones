# Exhibición — Crear ("Nueva Exhibición")

**Fecha:** 2026-08-27
**Estado:** Aprobado, pendiente de plan de implementación
**Sub-proyecto:** 4 de N (sobre Fundación + Exhibiciones-Lista + Exhibición-Detalle)

## Contexto

Las dos specs anteriores dejaron la lista y el detalle de solo lectura (más
la acción "Revisado"). Este spec construye el botón "+" de la lista y el
flujo para crear una exhibición nueva, con capturas de referencia de la
app móvil vieja (3 pestañas: Principal / Componentes / Fotos) — igual que
antes, solo como referencia de contenido, no de estilo.

**Descubrimientos de esta sesión de brainstorming** (investigando el
esquema `EXHIBICION` completo y los procs `PROC_LISTAR_CLIENTE`,
`PROC_LISTAR_SUCURSAL`, `PROC_LISTAR_COMPONENTE`):

- La lista de Tienda/Sucursal en la app vieja estaba filtrada por
  asignación al usuario (`TB_PROMOTOR_CLIENTE` / `WEB_MARKETING_PUNTOS_DE_ATENCION`
  / `WEB_MARKETING_CLIENTE_TRADE`, cruzadas con `SEGURIDAD.TB_USUARIO.VC_org_ventas`).
  **Verificado en vivo: ni `admin` ni `supervisor1` (los únicos usuarios de
  esta app) existen en `SEGURIDAD.TB_USUARIO`** — esa lógica de scoping no
  es reusable, igual que se decidió para la lista de exhibiciones.
- El catálogo de componentes (`EXHIBICION.WEB_MARKETING_PRODUCTOS`) tiene
  3 valores de `VC_tipo`: `'PRD'` (216, Producto), `'CAR'` (44, Carcasa) y
  `'MUE'` (28, Mueble) — pero `TB_EXHIBICION_COMPONENTE.IN_tipo` en uso
  real nunca registró el tipo Mueble, solo 1 (Producto) y 2 (Carcasa).
- `TB_EXHIBICION` (767 filas reales) solo usa 34 clientes y 77
  combinaciones cliente+sucursal distintas — mucho más acotado y relevante
  que el maestro SAP completo (`SAP.TB_KNA1`, 15,743 clientes de toda la
  empresa, no específico de exhibiciones).
- `PROC_GUARDAR_EXHIBICION` genera `VC_nro_exhibicion` como `'EXB' +
  MAX(secuencial_actual)+1` con padding a 7 dígitos — sin ningún bloqueo
  de fila, lo que en teoría permite una carrera si dos personas crean al
  mismo tiempo (no se replica esa fragilidad, ver Backend).

## Alcance

**Incluido:**
- Botón "+" en la lista de Exhibiciones → formulario de creación
  (pestaña Principal): Tienda → Sucursal (en cascada), Nombre, Tipo,
  Piso (texto libre), Detalle de ubicación.
- Al guardar, navega a la vista de detalle ya existente (`/exhibiciones/:id`),
  con las pestañas Componentes y Fotos ahora con botones para agregar.
- Agregar un componente (Carcasa o Producto) desde un catálogo con
  búsqueda + cantidad.
- Agregar una foto (sube el archivo real a Blob Storage).

**Explícitamente fuera de alcance** (sub-proyectos futuros o decisiones
deliberadas):
- Editar una exhibición existente (nombre/tipo/ubicación).
- Eliminar un componente o una foto ya agregada — no hay affordance para
  esto en las capturas de referencia tampoco.
- Categoría "Mueble" en componentes.
- Crear para una tienda/sucursal que nunca tuvo una exhibición antes (no
  está en las 77 combinaciones existentes) — se resuelve más adelante si
  hace falta.
- Restringir "agregar componente/foto" según el estado de la exhibición
  (pendiente/aprobada) — por ahora está disponible sin importar el
  estado, igual que "Revisado" no tiene gate de permisos todavía (ver
  spec anterior).

## Decisiones tomadas (de la sesión de brainstorming)

| Pregunta | Decisión |
|---|---|
| Fuente de Tienda/Sucursal | Las 34/77 combinaciones ya usadas en `TB_EXHIBICION` — no el maestro SAP completo ni las tablas de asignación por usuario (rotas para nuestros usuarios) |
| Tipos de componente a ofrecer | Solo Carcasa y Producto — no "Mueble" |
| Alcance crear/editar | Solo crear por ahora |
| Fotos obligatorias | No — se puede guardar sin fotos |
| Campos obligatorios en Principal | Tienda + Sucursal, Nombre, Tipo (Piso y Detalle quedan opcionales) |
| Arquitectura del flujo | "Guardar primero, luego completar" — Principal es el formulario real; al guardar, se navega a la vista de detalle ya construida (reusa casi todo su código) en vez de armar un wizard de 3 pasos con estado en memoria |
| Subida de fotos | Base64 dentro de un POST JSON normal — sin agregar `multer` ni ninguna librería de subida de archivos nueva |

## Arquitectura

```
Frontend (React)                          Backend (Express)                     Azure SQL / Blob
┌───────────────────────────┐           ┌────────────────────────────────┐     ┌───────────────────────┐
│ ExhibicionCrearPage         │──GET────▶│ GET /opciones-crear              │────▶│ TB_EXHIBICION (distinct│
│  (Tienda→Sucursal, Nombre,  │──POST───▶│ POST / (crea, N° autogenerado)   │────▶│  tienda/sucursal)      │
│   Tipo, Piso, Detalle)      │          │                                   │     │ dbo.PV_TABLA           │
└──────────┬──────────────────┘          └────────────────────────────────┘     └───────────────────────┘
           │ navigate(/exhibiciones/:id)
           ▼
┌───────────────────────────┐
│ ExhibicionDetallePage       │──GET────▶ GET /catalogo-componentes ────────────▶ WEB_MARKETING_PRODUCTOS
│  ├─ DetalleComponentesTab   │──POST───▶ POST /:id/componentes ───────────────▶ TB_EXHIBICION_COMPONENTE
│  │   (+ modal Agregar)      │
│  └─ DetalleFotosTab         │──POST───▶ POST /:id/fotos ─────────────────────▶ TB_EXHIBICION_FOTO
│      (+ input file)         │                       │
└───────────────────────────┘                       ▼ PUT (subida real)
                                          Azure Blob Storage (soleblob1/exhibiciones)
```

## Backend

### `GET /api/exhibiciones/opciones-crear`

Protegido con `verifyToken`. Sin params.

```sql
SELECT DISTINCT VC_cliente_codigo, VC_cliente_nombre, VC_sucursal_codigo, VC_sucursal_nombre, VC_direccion
FROM EXHIBICION.TB_EXHIBICION
WHERE VC_cliente_codigo IS NOT NULL AND VC_sucursal_codigo IS NOT NULL
ORDER BY VC_cliente_nombre, VC_sucursal_nombre
```

Más las mismas dos consultas a `dbo.PV_TABLA` (`EXHIBICION_TIPO` /
`EXHIBICION_PISO_DETALLE`) que ya usa `GET /opciones-filtro` — se extrae
un helper compartido `obtenerOpcionesCatalogo(pool)` en vez de duplicar
esas dos queries en los dos endpoints.

Respuesta:
```ts
{
  tiendas: Array<{ clienteCodigo: string; clienteNombre: string; sucursalCodigo: string; sucursalNombre: string; direccion: string | null }>;
  tipos: FiltroOpcion[];
  pisoDetalles: FiltroOpcion[];
}
```

El frontend pide esto una sola vez; "Sucursal" se deriva filtrando
`tiendas` por `clienteCodigo` en el navegador — no hay un segundo
endpoint en cascada.

### `POST /api/exhibiciones`

Body: `{ clienteCodigo, clienteNombre, sucursalCodigo, sucursalNombre, direccion, nombre, tipoId, piso, pisoDetalleId }`
(`direccion`, `piso`, `pisoDetalleId` opcionales/nullable).

Validación server-side (400 si falla): `clienteCodigo`, `sucursalCodigo`,
`nombre` (no vacío tras `trim()`), `tipoId` (numérico) son obligatorios.

El número se genera dentro de una transacción con `WITH (UPDLOCK,
HOLDLOCK)` sobre la lectura del máximo actual — a diferencia del proc
viejo, esto sí evita que dos creaciones simultáneas generen el mismo
`VC_nro_exhibicion`:

```sql
BEGIN TRAN
DECLARE @sgte INT
SELECT @sgte = ISNULL(MAX(CONVERT(INT, SUBSTRING(VC_nro_exhibicion, 4, 99))), 0) + 1
FROM EXHIBICION.TB_EXHIBICION WITH (UPDLOCK, HOLDLOCK)
WHERE SUBSTRING(VC_nro_exhibicion, 1, 3) = 'EXB'

DECLARE @nro VARCHAR(10) = 'EXB' + RIGHT('0000000' + CONVERT(VARCHAR, @sgte), 7)

INSERT INTO EXHIBICION.TB_EXHIBICION
    (VC_nombre, VC_cliente_codigo, VC_cliente_nombre, VC_sucursal_codigo, VC_sucursal_nombre,
     VC_direccion, IN_exhibicion_tipo_id, VC_piso, IN_piso_detalle_id, IN_estado_id,
     VC_usuario_crea, DT_fecha_crea, VC_nro_exhibicion)
OUTPUT INSERTED.IN_exhibicion_id, INSERTED.VC_nro_exhibicion
VALUES (@nombre, @clienteCodigo, @clienteNombre, @sucursalCodigo, @sucursalNombre,
        @direccion, @tipoId, @piso, @pisoDetalleId, 1,
        @usuario, GETDATE(), @nro)
COMMIT
```

`@usuario` sale de `req.user.username` (JWT), igual que en `/aprobar`.
Respuesta `201`: `{ id, nroExhibicion }`.

### `GET /api/exhibiciones/catalogo-componentes`

Protegido con `verifyToken`. Sin params.

```sql
SELECT VC_articulo_codigo as codigo, VC_articulo_nombre2 as nombre
FROM EXHIBICION.WEB_MARKETING_PRODUCTOS WHERE VC_tipo = 'PRD' ORDER BY nombre

SELECT VC_articulo_codigo as codigo, VC_articulo_nombre2 as nombre
FROM EXHIBICION.WEB_MARKETING_PRODUCTOS WHERE VC_tipo = 'CAR' ORDER BY nombre
```

Respuesta: `{ productos: {codigo,nombre}[], carcasas: {codigo,nombre}[] }`.

### `POST /api/exhibiciones/:id/componentes`

Body: `{ tipo: 1 | 2, codigoProducto: string, cantidad: number }`.

Validación: `id` existe (404 si no), `tipo` es 1 o 2, `cantidad` es entero
positivo, y `codigoProducto` existe en `WEB_MARKETING_PRODUCTOS` con el
`VC_tipo` correspondiente (400 "Producto no encontrado" si no) — evita
que una request armada a mano (saltándose el selector) inserte un código
inventado.

```sql
INSERT INTO EXHIBICION.TB_EXHIBICION_COMPONENTE
    (IN_exhibicion_id, VC_codigo_producto, IN_cantidad, IN_tipo, IN_estado, VC_usuario_crea, DT_fecha_crea)
OUTPUT INSERTED.IN_exhibicion_componente_id
VALUES (@id, @codigoProducto, @cantidad, @tipo, 1, @usuario, GETDATE())
```

Respuesta `201`: `{ id, nombre, cantidad }` (mismo shape que
`ExhibicionComponenteItem` — el frontend lo agrega directo a la lista sin
recargar todo el detalle).

### `POST /api/exhibiciones/:id/fotos`

Body: `{ archivoBase64: string, contentType: string, esFotoPrincipal: boolean }`.

Validación: `id` existe (404), `contentType` es uno de
`image/jpeg`/`image/png`/`image/webp` (400 si no — mapea a la extensión
del archivo), el buffer decodificado no supera 8MB (400 "Foto demasiado
grande" si no). Esta ruta necesita un límite de body mayor al global
(`express.json({ limit: '2mb' })` en `server/index.ts`) — se le monta un
`express.json({ limit: '12mb' })` propio, sin tocar el límite global de
las demás rutas.

Pasos:
1. Decodificar `archivoBase64` a `Buffer`.
2. Nombre de archivo: `crypto.randomUUID() + extensión` (mismo patrón que
   ya existe en los datos reales: GUID + extensión, plano en la raíz del
   contenedor).
3. `PUT` a `` `${BLOB_CONTAINER_URL}/${nombreArchivo}?${BLOB_SAS_TOKEN}` ``
   con `x-ms-blob-type: BlockBlob` y el `Content-Type` real — usando el
   `fetch` global de Node, sin SDK de Azure Storage.
4. Si `esFotoPrincipal` es `true`: primero
   `UPDATE EXHIBICION.TB_EXHIBICION_FOTO SET BI_es_foto_principal = 0 WHERE IN_exhibicion_id = @id`
   — así esta ruta nunca deja dos fotos marcadas como principal a la vez
   (a diferencia de los datos históricos, donde sí puede pasar).
5. `INSERT` en `TB_EXHIBICION_FOTO` (estado=1) y responder con
   `buildFotoUrl()` (la misma función pura del sub-proyecto anterior).

Respuesta `201`: `{ id, url, esFotoPrincipal }`.

### Variable de entorno existente que cambia de alcance

`BLOB_SAS_TOKEN` deja de ser un SAS de **solo lectura** — necesita
permiso de **lectura + escritura** (`sp=rw` en vez de `sp=r`) para poder
subir fotos con esta misma variable. Sigue siendo un solo SAS, solo
usado por el backend (nunca llega al navegador), así que el riesgo no
cambia de forma relevante. **Acción pendiente:** regenerar el SAS actual
con permiso de escritura cuando lleguemos a la implementación de esta
parte, y actualizar la variable en EasyPanel — nada de código cambia por
esto, solo el valor de la variable.

## Frontend

- **`ExhibicionCrearPage.tsx`** (ruta `/exhibiciones/nueva`) — carga
  `opciones-crear` al montar. Select de Tienda → Select de Sucursal
  (opciones = `tiendas.filter(t => t.clienteCodigo === tiendaSeleccionada)`,
  se resetea si cambia la tienda) → Nombre (texto) → Select de Tipo →
  Piso (texto, opcional) → Select de Detalle (opcional). Botón "Guardar"
  deshabilitado mientras los 3 campos obligatorios no estén completos;
  al guardar, `POST /`, y `navigate(`/exhibiciones/${id}`, { viewTransition: true })`.
- **`ExhibicionCard.tsx`** / toolbar de `ExhibicionesPage.tsx`: nuevo
  botón "+" (ícono `Plus`) junto a "Filtros", navega a
  `/exhibiciones/nueva`.
- **`DetalleComponentesTab.tsx`**: dos botones nuevos, "Agregar Carcasa" /
  "Agregar Producto", abren un modal chico (reusa
  `SIATC_THEME.COMPONENTS.MODAL_CONTENT` y las clases
  `.modal-overlay-in`/`.modal-content-in` ya existentes) con un buscador
  sobre el catálogo (cargado una vez, filtrado en el navegador) + cantidad.
  Al guardar, `POST /:id/componentes` y agrega el resultado a la lista
  local vía un callback `onComponenteAgregado` que sube hasta
  `ExhibicionDetallePage`.
- **`DetalleFotosTab.tsx`**: botón "Agregar Foto" (`<input type="file"
  accept="image/*">` oculto, disparado por el botón visible) — lee el
  archivo con `FileReader.readAsDataURL()`, separa el prefijo `data:` para
  quedarse con el base64 puro + el `contentType`, `POST /:id/fotos`, y
  agrega la foto resultante a la grilla vía `onFotoAgregada`.
- `ExhibicionDetallePage.tsx` pasa `exhibicionId` y los dos callbacks
  (`onComponenteAgregado`, `onFotoAgregada`) a las pestañas — cada uno
  actualiza el `detalle` local (mismo patrón que `onAprobado` ya usa).

## Manejo de errores

- `POST /` con campos obligatorios faltantes → 400 con mensaje claro; el
  formulario muestra el error inline y no navega.
- `POST /:id/componentes` con código de producto inexistente (request
  armada a mano) → 400, no revienta con un 500 de FK.
- `POST /:id/fotos`: `contentType` no soportado o archivo > 8MB → 400
  antes de intentar subir nada al blob. Si el `PUT` al blob falla (SAS
  vencido, red) → 502 con `safeError()`, el componente muestra el error y
  no inserta la fila en `TB_EXHIBICION_FOTO` (nunca queda un registro
  apuntando a un archivo que no se subió).
- Carrera de dos creaciones simultáneas → resuelta por el `UPDLOCK,
  HOLDLOCK` de la transacción, no por manejo de error (nunca debería
  producirse un número duplicado).

## Testing

- `server/lib/blobUpload.test.ts` (o similar) — función pura que arma el
  nombre de archivo a partir del `contentType` (`image/jpeg` → `.jpg`,
  etc.) y valida el tamaño decodificado, testeada sin red.
- `server/lib/exhibicionCrear.test.ts` — validación de campos
  obligatorios del `POST /` (función pura, mismo patrón que
  `exhibicionesFilter.ts`).
- Sin tests de componentes React nuevos — mismo criterio que los
  sub-proyectos anteriores.
- Verificación manual: crear una exhibición real de prueba de punta a
  punta (Tienda→Sucursal→Nombre→Tipo, guardar, agregar un componente,
  subir una foto real), confirmar que aparece correctamente en la lista y
  en el detalle. No hay endpoint de borrado (fuera de alcance) — al
  terminar, la limpieza es una `UPDATE EXHIBICION.TB_EXHIBICION SET
  IN_estado_id = 0 WHERE IN_exhibicion_id = <id de prueba>` directa (el
  mismo "Anulado" que la lista ya excluye), no un DELETE real.
