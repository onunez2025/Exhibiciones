# Exhibición — Editar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user edit an existing Pendiente exhibición — its Nombre/Tipo/Ubicación, plus quitar (soft-delete) componentes and fotos already added — from a new dedicated page reached via the "Editar" option on the list's kebab menu.

**Architecture:** A new `ExhibicionEditarPage` at `/exhibiciones/:id/editar`, structurally cloned from `ExhibicionCrearPage`, that loads the existing `GET /:id` + `GET /opciones-crear` and reuses the already-built `DetalleComponentesTab`/`DetalleFotosTab` (extended with an optional "quitar" callback each) below its own Nombre/Tipo/Ubicación form. Three new backend endpoints follow the exact atomic-`UPDATE`-with-state-guard pattern `POST /:id/aprobar` already uses — no separate read-then-write, no permission check beyond the router's existing `verifyToken`.

**Tech Stack:** Express + TypeScript (`tsx`) · `mssql` · React 19 + `react-i18next` + `react-router-dom` v7 · existing `apiClient`/`SIATC_THEME` conventions.

**Spec:** [docs/superpowers/specs/2026-09-14-exhibicion-editar-design.md](../specs/2026-09-14-exhibicion-editar-design.md)

## Global Constraints

- Editable fields: Nombre, Tipo, Piso, Detalle de ubicación. Tienda/Sucursal are **not** editable — out of scope.
- Editing (the form, and quitar componente/foto) is only allowed while `estadoId === 1` (Pendiente) — every write endpoint enforces this server-side with an atomic `UPDATE ... WHERE IN_estado_id = 1`, same pattern as `POST /:id/aprobar`. The frontend also hides the "Editar" menu option and the page itself once the exhibición isn't Pendiente — but the server-side guard is the one that actually matters.
- Quitar componente/foto is a soft-delete (`IN_estado = 0`) — never a real `DELETE`, never touches the Blob Storage file. No "minimum 1" rule — creating an exhibición already allows 0 componentes/fotos.
- `TB_EXHIBICION`, `TB_EXHIBICION_COMPONENTE`, `TB_EXHIBICION_FOTO` all have `VC_usuario_modi`/`DT_fecha_modi` — every write here sets both, exactly like `/aprobar` does.
- No new `checkPermission` — `/api/exhibiciones` has none on any existing verb (crear, aprobar, agregar componente/foto), these new endpoints don't add one either.
- Every new user-facing string goes through `react-i18next`. New keys live under `exhibicion_editar.*`; two new shared keys go under `exhibicion_detalle.*` (`accion_quitar`, `accion_eliminar_foto`) since `DetalleComponentesTab`/`DetalleFotosTab` are shared with the read-only detail view; one new key under `exhibiciones_lista.*` (`accion_editar`).
- Follow existing conventions: `SIATC_THEME` tokens, `apiClient`, `navigate(path, { viewTransition: true })`. Small inline "quitar" icon buttons use the same rose/danger color already used for error blocks (`text-rose-600`, `hover:bg-rose-500/10`) — not `SIATC_THEME.COMPONENTS.BUTTON_DANGER`, which is sized for a full button, not a row action.
- `DetalleComponentesTab`/`DetalleFotosTab` keep working exactly as before for `ExhibicionDetallePage` — the new "quitar" callbacks are optional props; when omitted (as `ExhibicionDetallePage` will keep doing), no quitar/eliminar affordance renders.

---

## Task 1: `validarExhibicionEditar` — pure field validation

**Files:**
- Create: `server/lib/exhibicionEditar.ts`
- Test: `server/lib/exhibicionEditar.test.ts`

**Interfaces:**
- Produces: `EditarExhibicionInput` (`{ nombre: string; tipoId: number; piso: string | null; pisoDetalleId: number | null }`), `ValidacionEditar` (`{ valido: true; datos: EditarExhibicionInput } | { valido: false; error: string }`), and `validarExhibicionEditar(body: unknown): ValidacionEditar`. Task 3 (`PUT /:id`) imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/exhibicionEditar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validarExhibicionEditar } from './exhibicionEditar.js';

describe('validarExhibicionEditar', () => {
    const base = { nombre: 'Exhibición editada', tipoId: 5, piso: '2', pisoDetalleId: 3 };

    it('accepts a fully valid payload and trims the name', () => {
        const result = validarExhibicionEditar({ ...base, nombre: '  Exhibición editada  ' });
        expect(result).toEqual({ valido: true, datos: base });
    });

    it('rejects a missing or whitespace-only nombre', () => {
        expect(validarExhibicionEditar({ ...base, nombre: '' })).toEqual({ valido: false, error: 'El nombre de la exhibición es obligatorio.' });
        expect(validarExhibicionEditar({ ...base, nombre: '   ' })).toEqual({ valido: false, error: 'El nombre de la exhibición es obligatorio.' });
    });

    it('rejects a missing or non-numeric tipoId', () => {
        expect(validarExhibicionEditar({ ...base, tipoId: undefined })).toEqual({ valido: false, error: 'Selecciona un tipo de exhibición.' });
        expect(validarExhibicionEditar({ ...base, tipoId: 'abc' })).toEqual({ valido: false, error: 'Selecciona un tipo de exhibición.' });
    });

    it('treats piso and pisoDetalleId as optional — null when omitted', () => {
        const result = validarExhibicionEditar({ nombre: base.nombre, tipoId: base.tipoId });
        expect(result).toEqual({
            valido: true,
            datos: { nombre: base.nombre, tipoId: base.tipoId, piso: null, pisoDetalleId: null },
        });
    });

    it('rejects a pisoDetalleId that is present but not a valid positive number', () => {
        const result = validarExhibicionEditar({ ...base, pisoDetalleId: 'abc' });
        expect(result).toEqual({ valido: false, error: 'Detalle de ubicación inválido.' });
    });

    it('rejects a non-object body', () => {
        expect(validarExhibicionEditar(null)).toEqual({ valido: false, error: 'Datos inválidos.' });
        expect(validarExhibicionEditar('x')).toEqual({ valido: false, error: 'Datos inválidos.' });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/exhibicionEditar.test.ts`
Expected: FAIL — `Cannot find module './exhibicionEditar.js'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/exhibicionEditar.ts`:

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

function stringNoVacio(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function stringOpcional(value: unknown): string | null {
    const s = stringNoVacio(value);
    return s || null;
}

// Puro — mismo patrón que validarExhibicionCrear, pero sin
// Tienda/Sucursal (esos campos no son editables, ver spec). Nombre y
// tipoId son obligatorios; Piso y Detalle quedan opcionales.
export function validarExhibicionEditar(body: unknown): ValidacionEditar {
    if (typeof body !== 'object' || body === null) {
        return { valido: false, error: 'Datos inválidos.' };
    }
    const b = body as Record<string, unknown>;

    const nombre = stringNoVacio(b.nombre);
    const tipoId = Number(b.tipoId);

    if (!nombre) {
        return { valido: false, error: 'El nombre de la exhibición es obligatorio.' };
    }
    if (!Number.isFinite(tipoId) || tipoId <= 0) {
        return { valido: false, error: 'Selecciona un tipo de exhibición.' };
    }

    let pisoDetalleId: number | null = null;
    if (b.pisoDetalleId !== undefined && b.pisoDetalleId !== null && b.pisoDetalleId !== '') {
        pisoDetalleId = Number(b.pisoDetalleId);
        if (!Number.isFinite(pisoDetalleId) || pisoDetalleId <= 0) {
            return { valido: false, error: 'Detalle de ubicación inválido.' };
        }
    }

    return {
        valido: true,
        datos: { nombre, tipoId, piso: stringOpcional(b.piso), pisoDetalleId },
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/exhibicionEditar.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/exhibicionEditar.ts server/lib/exhibicionEditar.test.ts
git commit -m "feat: validarExhibicionEditar — pure field validation for editing an exhibición"
```

---

## Task 2: `GET /api/exhibiciones/:id` gains `tipoId` and `pisoDetalleId`

**Files:**
- Modify: `server/routes/exhibiciones.ts:325-402`

**Interfaces:**
- Produces: `GET /:id` response gains `tipoId: number` and `pisoDetalleId: number | null` alongside the existing `tipoNombre`/`pisoDetalleNombre`. Task 6 (frontend `ExhibicionDetalle` type) and Task 10 (`ExhibicionEditarPage`) depend on this.

- [ ] **Step 1: Add the two columns to the `principalResult` query**

In `server/routes/exhibiciones.ts`, inside `router.get('/:id', ...)`, replace:

```ts
                SELECT
                    E.IN_exhibicion_id as id,
                    E.VC_nro_exhibicion as nroExhibicion,
                    E.VC_nombre as nombre,
                    E.VC_cliente_nombre as clienteNombre,
                    E.VC_sucursal_nombre as sucursalNombre,
                    E.VC_piso as piso,
                    ET.VC_descripcion as tipoNombre,
                    EPD.VC_descripcion as pisoDetalleNombre,
                    E.IN_estado_id as estadoId,
                    E.DT_fecha_crea as fechaCrea
                FROM EXHIBICION.TB_EXHIBICION E
```

with:

```ts
                SELECT
                    E.IN_exhibicion_id as id,
                    E.VC_nro_exhibicion as nroExhibicion,
                    E.VC_nombre as nombre,
                    E.VC_cliente_nombre as clienteNombre,
                    E.VC_sucursal_nombre as sucursalNombre,
                    E.VC_piso as piso,
                    E.IN_exhibicion_tipo_id as tipoId,
                    ET.VC_descripcion as tipoNombre,
                    E.IN_piso_detalle_id as pisoDetalleId,
                    EPD.VC_descripcion as pisoDetalleNombre,
                    E.IN_estado_id as estadoId,
                    E.DT_fecha_crea as fechaCrea
                FROM EXHIBICION.TB_EXHIBICION E
```

- [ ] **Step 2: Pass the two new fields through in the JSON response**

Replace:

```ts
        res.json({
            id: principalRow.id,
            nroExhibicion: principalRow.nroExhibicion,
            nombre: principalRow.nombre,
            clienteNombre: principalRow.clienteNombre,
            sucursalNombre: principalRow.sucursalNombre,
            piso: principalRow.piso,
            tipoNombre: principalRow.tipoNombre,
            pisoDetalleNombre: principalRow.pisoDetalleNombre,
            estadoId: principalRow.estadoId,
            fechaCrea: principalRow.fechaCrea,
            canAprobar: principalRow.estadoId === 1,
            componentes: mapComponentesRows(componentesResult.recordset),
```

with:

```ts
        res.json({
            id: principalRow.id,
            nroExhibicion: principalRow.nroExhibicion,
            nombre: principalRow.nombre,
            clienteNombre: principalRow.clienteNombre,
            sucursalNombre: principalRow.sucursalNombre,
            piso: principalRow.piso,
            tipoId: principalRow.tipoId,
            tipoNombre: principalRow.tipoNombre,
            pisoDetalleId: principalRow.pisoDetalleId,
            pisoDetalleNombre: principalRow.pisoDetalleNombre,
            estadoId: principalRow.estadoId,
            fechaCrea: principalRow.fechaCrea,
            canAprobar: principalRow.estadoId === 1,
            componentes: mapComponentesRows(componentesResult.recordset),
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification against the real database**

Start the backend locally (inline env vars, never written to a file):

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" PORT=3000 npx tsx server/index.ts
```

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"REPLACE_WITH_CURRENT_ADMIN_PASSWORD"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s http://localhost:3000/api/exhibiciones/1205 -H "Authorization: Bearer $TOKEN" | node -pe 'const d=JSON.parse(require("fs").readFileSync(0)); `tipoId=${d.tipoId} tipoNombre=${d.tipoNombre} pisoDetalleId=${d.pisoDetalleId} pisoDetalleNombre=${d.pisoDetalleNombre}`'
```

Expected: `tipoId` and `pisoDetalleId` are numbers (or `pisoDetalleId=null` if that exhibición never had one set) that make sense next to the already-known `tipoNombre`/`pisoDetalleNombre` text — not `undefined`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: GET /api/exhibiciones/:id — expose raw tipoId/pisoDetalleId for editing"
```

---

## Task 3: `PUT /api/exhibiciones/:id`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Consumes: `validarExhibicionEditar` (Task 1), `logAudit` (already imported).
- Produces: `PUT /:id` → `200` with the same shape as `GET /:id`, `400`, `404`, or `409`. Task 10 (`ExhibicionEditarPage`) calls this.

- [ ] **Step 1: Add the import**

Replace:

```ts
import { validarExhibicionCrear } from '../lib/exhibicionCrear.js';
```

with:

```ts
import { validarExhibicionCrear } from '../lib/exhibicionCrear.js';
import { validarExhibicionEditar } from '../lib/exhibicionEditar.js';
```

- [ ] **Step 2: Add the route**

Add this route directly after `router.get('/:id', ...)` (before `router.post('/:id/componentes', ...)`):

```ts
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const validacion = validarExhibicionEditar(req.body);
        if (!validacion.valido) {
            res.status(400).json({ error: validacion.error });
            return;
        }
        const { nombre, tipoId, piso, pisoDetalleId } = validacion.datos;

        const pool = await getDbConnection();

        // UPDATE con guardia de estado en el mismo WHERE — mismo patrón
        // que POST /:id/aprobar: una sola escritura atómica, sin SELECT
        // previo, así dos ediciones (o una edición y una aprobación)
        // concurrentes no pueden pisarse.
        const updateResult = await pool.request()
            .input('id', sql.BigInt, id)
            .input('nombre', sql.VarChar(150), nombre)
            .input('tipoId', sql.Int, tipoId)
            .input('piso', sql.VarChar(100), piso)
            .input('pisoDetalleId', sql.Int, pisoDetalleId)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                UPDATE EXHIBICION.TB_EXHIBICION
                SET VC_nombre = @nombre, IN_exhibicion_tipo_id = @tipoId,
                    VC_piso = @piso, IN_piso_detalle_id = @pisoDetalleId,
                    VC_usuario_modi = @usuario, DT_fecha_modi = GETDATE()
                WHERE IN_exhibicion_id = @id AND IN_estado_id = 1
            `);

        if (updateResult.rowsAffected[0] === 0) {
            const existsResult = await pool.request()
                .input('id', sql.BigInt, id)
                .query('SELECT 1 FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
            if (existsResult.recordset.length === 0) {
                res.status(404).json({ error: 'Exhibición no encontrada.' });
            } else {
                res.status(409).json({ error: 'La exhibición ya no está pendiente y no se puede editar.' });
            }
            return;
        }

        await logAudit(req, 'EXHIBICION_EDITADA', 'TB_EXHIBICION', String(id));

        const tipoResult = await pool.request()
            .input('tipoId', sql.Int, tipoId)
            .query(`SELECT VC_descripcion as nombre FROM dbo.PV_TABLA WHERE VC_tabla = 'EXHIBICION_TIPO' AND CH_activo = '1' AND IN_id = @tipoId`);
        const pisoDetalleResult = pisoDetalleId
            ? await pool.request()
                .input('pisoDetalleId', sql.Int, pisoDetalleId)
                .query(`SELECT VC_descripcion as nombre FROM dbo.PV_TABLA WHERE VC_tabla = 'EXHIBICION_PISO_DETALLE' AND CH_activo = '1' AND IN_id = @pisoDetalleId`)
            : null;

        res.json({
            id,
            nombre,
            tipoId,
            tipoNombre: tipoResult.recordset[0]?.nombre ?? null,
            piso,
            pisoDetalleId,
            pisoDetalleNombre: pisoDetalleResult?.recordset[0]?.nombre ?? null,
        });
    } catch (err: unknown) {
        console.error('[Exhibiciones] editar error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification against the real database**

Using a Pendiente test exhibición id (create one via `POST /` if you don't already have one from a previous plan's verification — call it `<TEST_ID>`):

```bash
curl -s -X PUT http://localhost:3000/api/exhibiciones/<TEST_ID> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Exhibición editada SDD","tipoId":5,"piso":"3","pisoDetalleId":null}'
```

Expected: `200` with `{"id": <TEST_ID>, "nombre": "Exhibición editada SDD", "tipoId": 5, "tipoNombre": "<algo>", "piso": "3", "pisoDetalleId": null, "pisoDetalleNombre": null}`. Then confirm the 409 guard against an Aprobada exhibición (pick any `id` you know is already Aprobada, or aprobar `<TEST_ID>` first and retry the same PUT):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3000/api/exhibiciones/<UNA_EXHIBICION_APROBADA> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"no debería aplicar","tipoId":5}'
```

Expected: `409`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: PUT /api/exhibiciones/:id — edit nombre/tipo/ubicación while Pendiente"
```

---

## Task 4: `DELETE /api/exhibiciones/:id/componentes/:componenteId`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Produces: `DELETE /:id/componentes/:componenteId` → `204`, `404`, or `409`. Task 8 (`DetalleComponentesTab`) calls this.

- [ ] **Step 1: Add the route**

Add this route directly after `router.post('/:id/componentes', ...)` (before `router.post('/:id/fotos', ...)`):

```ts
router.delete('/:id/componentes/:componenteId', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const componenteId = Number(req.params.componenteId);
        if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(componenteId) || componenteId <= 0) {
            res.status(400).json({ error: 'Id inválido.' });
            return;
        }

        const pool = await getDbConnection();

        // Un solo UPDATE atómico: el EXISTS gatea por el estado de la
        // exhibición (tabla distinta) en el mismo WHERE, sin leer primero
        // — mismo espíritu que el guard de PUT /:id, extendido a un JOIN
        // implícito. AND IN_exhibicion_id = @id evita borrar un
        // componente de otra exhibición con un request armado a mano.
        const updateResult = await pool.request()
            .input('id', sql.BigInt, id)
            .input('componenteId', sql.BigInt, componenteId)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                UPDATE EXHIBICION.TB_EXHIBICION_COMPONENTE
                SET IN_estado = 0, VC_usuario_modi = @usuario, DT_fecha_modi = GETDATE()
                WHERE IN_exhibicion_componente_id = @componenteId
                  AND IN_exhibicion_id = @id
                  AND IN_estado = 1
                  AND EXISTS (
                      SELECT 1 FROM EXHIBICION.TB_EXHIBICION
                      WHERE IN_exhibicion_id = @id AND IN_estado_id = 1
                  )
            `);

        if (updateResult.rowsAffected[0] === 0) {
            const estadoResult = await pool.request().input('id', sql.BigInt, id)
                .query('SELECT IN_estado_id FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
            const exhibicion = estadoResult.recordset[0];
            if (!exhibicion) {
                res.status(404).json({ error: 'Exhibición no encontrada.' });
            } else if (exhibicion.IN_estado_id !== 1) {
                res.status(409).json({ error: 'La exhibición ya no está pendiente y no se puede editar.' });
            } else {
                res.status(404).json({ error: 'Componente no encontrado.' });
            }
            return;
        }

        await logAudit(req, 'EXHIBICION_COMPONENTE_QUITADO', 'TB_EXHIBICION_COMPONENTE', String(componenteId));
        res.status(204).send();
    } catch (err: unknown) {
        console.error('[Exhibiciones] quitar componente error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification against the real database**

Using `<TEST_ID>` from Task 3 (still Pendiente) — first add a componente to have something to remove (reuse a real `codigoProducto` from `GET /catalogo-componentes`, same as the Crear plan's Task 6 verification):

```bash
COMPONENTE_ID=$(curl -s -X POST http://localhost:3000/api/exhibiciones/<TEST_ID>/componentes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tipo":1,"codigoProducto":"<UN_CODIGO_PRD_REAL>","cantidad":1}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')

curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/exhibiciones/<TEST_ID>/componentes/$COMPONENTE_ID \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `204`. Confirm it's gone from `GET /:id` (`componentes` no longer lists it), and confirm removing it again returns `404`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/exhibiciones/<TEST_ID>/componentes/$COMPONENTE_ID \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `404`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: DELETE /api/exhibiciones/:id/componentes/:componenteId"
```

---

## Task 5: `DELETE /api/exhibiciones/:id/fotos/:fotoId`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Produces: `DELETE /:id/fotos/:fotoId` → `204`, `404`, or `409`. Task 9 (`DetalleFotosTab`) calls this.

- [ ] **Step 1: Add the route**

Add this route directly after `router.post('/:id/fotos', ...)` (before `router.post('/:id/checklist', ...)`):

```ts
router.delete('/:id/fotos/:fotoId', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const fotoId = Number(req.params.fotoId);
        if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(fotoId) || fotoId <= 0) {
            res.status(400).json({ error: 'Id inválido.' });
            return;
        }

        const pool = await getDbConnection();

        // Mismo patrón atómico que quitar componente. No borra el blob
        // en Azure Storage — mismo criterio que anular checklist/ticket,
        // que tampoco revierten nada fuera de la fila (ver spec).
        const updateResult = await pool.request()
            .input('id', sql.BigInt, id)
            .input('fotoId', sql.BigInt, fotoId)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                UPDATE EXHIBICION.TB_EXHIBICION_FOTO
                SET IN_estado = 0, VC_usuario_modi = @usuario, DT_fecha_modi = GETDATE()
                WHERE IN_exhibicion_foto_id = @fotoId
                  AND IN_exhibicion_id = @id
                  AND IN_estado = 1
                  AND EXISTS (
                      SELECT 1 FROM EXHIBICION.TB_EXHIBICION
                      WHERE IN_exhibicion_id = @id AND IN_estado_id = 1
                  )
            `);

        if (updateResult.rowsAffected[0] === 0) {
            const estadoResult = await pool.request().input('id', sql.BigInt, id)
                .query('SELECT IN_estado_id FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
            const exhibicion = estadoResult.recordset[0];
            if (!exhibicion) {
                res.status(404).json({ error: 'Exhibición no encontrada.' });
            } else if (exhibicion.IN_estado_id !== 1) {
                res.status(409).json({ error: 'La exhibición ya no está pendiente y no se puede editar.' });
            } else {
                res.status(404).json({ error: 'Foto no encontrada.' });
            }
            return;
        }

        await logAudit(req, 'EXHIBICION_FOTO_ELIMINADA', 'TB_EXHIBICION_FOTO', String(fotoId));
        res.status(204).send();
    } catch (err: unknown) {
        console.error('[Exhibiciones] eliminar foto error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification against the real database and confirm the blob survives**

Using `<TEST_ID>` and a real read+write `BLOB_SAS_TOKEN` (same as the Crear plan's Task 7 verification), add a photo, note its `url`, then remove it:

```bash
BASE64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
FOTO_RESPONSE=$(curl -s -X POST http://localhost:3000/api/exhibiciones/<TEST_ID>/fotos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"archivoBase64\":\"$BASE64\",\"contentType\":\"image/png\",\"esFotoPrincipal\":false}")
echo "$FOTO_RESPONSE"
FOTO_ID=$(echo "$FOTO_RESPONSE" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
FOTO_URL=$(echo "$FOTO_RESPONSE" | node -pe 'JSON.parse(require("fs").readFileSync(0)).url')

curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/exhibiciones/<TEST_ID>/fotos/$FOTO_ID \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `204`. Confirm it no longer appears in `GET /:id`'s `fotos` array, but the blob itself still opens in a browser at `$FOTO_URL` (minus the query string) — proving the file wasn't deleted, only the DB row soft-deleted.

- [ ] **Step 4: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: DELETE /api/exhibiciones/:id/fotos/:fotoId"
```

---

## Task 6: Frontend types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `ExhibicionDetalle` gains `tipoId: number` and `pisoDetalleId: number | null`. New `EditarExhibicionInput` and `EditarExhibicionResponse`. Task 10 imports these.

- [ ] **Step 1: Update `ExhibicionDetalle` and add `EditarExhibicionInput`**

In `src/types/index.ts`, replace:

```ts
export interface ExhibicionDetalle {
    id: number;
    nroExhibicion: string;
    nombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    piso: string | null;
    tipoNombre: string | null;
    pisoDetalleNombre: string | null;
    estadoId: 1 | 2;
    fechaCrea: string;
    canAprobar: boolean;
    componentes: ExhibicionComponentesAgrupados;
    fotos: ExhibicionFoto[];
}
```

with:

```ts
export interface ExhibicionDetalle {
    id: number;
    nroExhibicion: string;
    nombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    piso: string | null;
    tipoId: number;
    tipoNombre: string | null;
    pisoDetalleId: number | null;
    pisoDetalleNombre: string | null;
    estadoId: 1 | 2;
    fechaCrea: string;
    canAprobar: boolean;
    componentes: ExhibicionComponentesAgrupados;
    fotos: ExhibicionFoto[];
}

export interface EditarExhibicionInput {
    nombre: string;
    tipoId: number;
    piso: string | null;
    pisoDetalleId: number | null;
}

// Shape real de la respuesta de PUT /:id — un subconjunto de
// ExhibicionDetalle (sin estadoId/canAprobar/componentes/fotos/etc.,
// que esa ruta no toca ni recalcula). Tiparlo como ExhibicionDetalle
// completo sería engañoso: el objeto real no trae esos campos.
export interface EditarExhibicionResponse {
    id: number;
    nombre: string;
    tipoId: number;
    tipoNombre: string | null;
    piso: string | null;
    pisoDetalleId: number | null;
    pisoDetalleNombre: string | null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: frontend types for editing an exhibición"
```

---

## Task 7: i18n keys

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Produces: new `exhibicion_editar` namespace; `exhibiciones_lista.accion_editar`; `exhibicion_detalle.accion_quitar` and `exhibicion_detalle.accion_eliminar_foto`. Tasks 8, 9, 10, 11 use these.

- [ ] **Step 1: Add `exhibiciones_lista.accion_editar` — `es.json`**

Replace:

```json
        "accion_ver": "Ver",
        "accion_checklist": "Checklist",
        "accion_ticket": "Ticket",
```

with:

```json
        "accion_ver": "Ver",
        "accion_checklist": "Checklist",
        "accion_ticket": "Ticket",
        "accion_editar": "Editar",
```

- [ ] **Step 2: Same key — `en.json`**

Replace:

```json
        "accion_ver": "View",
        "accion_checklist": "Checklist",
        "accion_ticket": "Ticket",
```

with:

```json
        "accion_ver": "View",
        "accion_checklist": "Checklist",
        "accion_ticket": "Ticket",
        "accion_editar": "Edit",
```

- [ ] **Step 3: Add the two shared `exhibicion_detalle` keys — `es.json`**

Replace:

```json
        "error_agregar_foto": "No se pudo subir la foto.",
        "error_foto_grande": "La foto es demasiado grande (máximo 8MB)."
    },
```

with:

```json
        "error_agregar_foto": "No se pudo subir la foto.",
        "error_foto_grande": "La foto es demasiado grande (máximo 8MB).",
        "accion_quitar": "Quitar",
        "accion_eliminar_foto": "Eliminar foto",
        "error_quitar_componente": "No se pudo quitar el componente.",
        "error_eliminar_foto": "No se pudo eliminar la foto."
    },
```

- [ ] **Step 4: Same keys — `en.json`**

Replace:

```json
        "error_agregar_foto": "Couldn't upload the photo.",
        "error_foto_grande": "The photo is too large (max 8MB)."
    },
```

with:

```json
        "error_agregar_foto": "Couldn't upload the photo.",
        "error_foto_grande": "The photo is too large (max 8MB).",
        "accion_quitar": "Remove",
        "accion_eliminar_foto": "Delete photo",
        "error_quitar_componente": "Couldn't remove the component.",
        "error_eliminar_foto": "Couldn't delete the photo."
    },
```

- [ ] **Step 5: Add the new `exhibicion_editar` namespace — `es.json`**

Replace:

```json
    "exhibicion_crear": {
        "title": "Nueva Exhibición",
        "subtitle": "Crea una exhibición nueva",
        "campo_tienda": "Tienda",
        "campo_sucursal": "Sucursal",
        "campo_nombre": "Nombre de Exhibición",
        "campo_nombre_placeholder": "Nombre",
        "selecciona": "Selecciona...",
        "accion_guardar": "Guardar",
        "error_cargar_opciones": "No se pudieron cargar las opciones del formulario.",
        "error_guardar": "No se pudo crear la exhibición."
    },
```

with:

```json
    "exhibicion_crear": {
        "title": "Nueva Exhibición",
        "subtitle": "Crea una exhibición nueva",
        "campo_tienda": "Tienda",
        "campo_sucursal": "Sucursal",
        "campo_nombre": "Nombre de Exhibición",
        "campo_nombre_placeholder": "Nombre",
        "selecciona": "Selecciona...",
        "accion_guardar": "Guardar",
        "error_cargar_opciones": "No se pudieron cargar las opciones del formulario.",
        "error_guardar": "No se pudo crear la exhibición."
    },
    "exhibicion_editar": {
        "title": "Editar Exhibición",
        "subtitle": "Actualiza los datos, componentes y fotos",
        "campo_nombre": "Nombre de Exhibición",
        "accion_guardar": "Guardar cambios",
        "guardado_ok": "Los cambios se guardaron correctamente.",
        "error_cargar": "No se pudo cargar la exhibición.",
        "error_cargar_opciones": "No se pudieron cargar las opciones del formulario.",
        "error_guardar": "No se pudieron guardar los cambios.",
        "no_pendiente_titulo": "Esta exhibición ya no está pendiente",
        "no_pendiente_mensaje": "Solo se pueden editar exhibiciones que aún no fueron aprobadas.",
        "seccion_componentes": "Componentes",
        "seccion_fotos": "Fotos"
    },
```

- [ ] **Step 6: Same namespace — `en.json`**

Replace:

```json
    "exhibicion_crear": {
        "title": "New Exhibit",
        "subtitle": "Create a new exhibit",
        "campo_tienda": "Store",
        "campo_sucursal": "Branch",
        "campo_nombre": "Exhibit Name",
        "campo_nombre_placeholder": "Name",
        "selecciona": "Select...",
        "accion_guardar": "Save",
        "error_cargar_opciones": "Couldn't load the form options.",
        "error_guardar": "Couldn't create the exhibit."
    },
```

with:

```json
    "exhibicion_crear": {
        "title": "New Exhibit",
        "subtitle": "Create a new exhibit",
        "campo_tienda": "Store",
        "campo_sucursal": "Branch",
        "campo_nombre": "Exhibit Name",
        "campo_nombre_placeholder": "Name",
        "selecciona": "Select...",
        "accion_guardar": "Save",
        "error_cargar_opciones": "Couldn't load the form options.",
        "error_guardar": "Couldn't create the exhibit."
    },
    "exhibicion_editar": {
        "title": "Edit Exhibit",
        "subtitle": "Update the details, components and photos",
        "campo_nombre": "Exhibit Name",
        "accion_guardar": "Save changes",
        "guardado_ok": "Changes saved successfully.",
        "error_cargar": "Couldn't load the exhibit.",
        "error_cargar_opciones": "Couldn't load the form options.",
        "error_guardar": "Couldn't save the changes.",
        "no_pendiente_titulo": "This exhibit is no longer pending",
        "no_pendiente_mensaje": "Only exhibits that haven't been approved yet can be edited.",
        "seccion_componentes": "Components",
        "seccion_fotos": "Photos"
    },
```

- [ ] **Step 7: Verify both files stay symmetric**

Run:

```bash
node -e "
const es = require('./public/locales/es.json');
const en = require('./public/locales/en.json');
function flatten(obj, prefix = '') {
    return Object.entries(obj).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null ? flatten(v, prefix + k + '.') : [prefix + k]
    );
}
const esKeys = new Set(flatten(es));
const enKeys = new Set(flatten(en));
const onlyEs = [...esKeys].filter(k => !enKeys.has(k));
const onlyEn = [...enKeys].filter(k => !esKeys.has(k));
console.log('only in es.json:', onlyEs);
console.log('only in en.json:', onlyEn);
"
```

Expected: both arrays empty.

- [ ] **Step 8: Commit**

```bash
git add public/locales/es.json public/locales/en.json
git commit -m "feat: i18n keys for editing an exhibición (es/en)"
```

---

## Task 8: `DetalleComponentesTab` gains an optional "Quitar" action

**Files:**
- Modify: `src/components/exhibiciones/DetalleComponentesTab.tsx`

**Interfaces:**
- Consumes: `apiClient.delete` (already exists in `src/services/apiClient.ts`).
- Produces: new optional prop `onComponenteQuitado?: (id: number) => void` on `DetalleComponentesTabProps`. When present, each row shows a "Quitar" button that calls `DELETE /exhibiciones/:exhibicionId/componentes/:id` and, on success, invokes the callback. Task 10 (`ExhibicionEditarPage`) passes this prop; `ExhibicionDetallePage` (Task 11 doesn't touch it) keeps omitting it, so its behavior is unchanged.

- [ ] **Step 1: Add the prop, the delete handler, and the button**

Replace the whole file `src/components/exhibiciones/DetalleComponentesTab.tsx` with:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';
import type { ExhibicionComponenteItem } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { AgregarComponenteModal } from './AgregarComponenteModal.js';

export interface DetalleComponentesTabProps {
    exhibicionId: number;
    carcasas: ExhibicionComponenteItem[];
    productos: ExhibicionComponenteItem[];
    onComponenteAgregado: (tipo: 1 | 2, item: ExhibicionComponenteItem) => void;
    onComponenteQuitado?: (id: number) => void;
}

function Grupo({
    titulo, items, columnaCantidad, onQuitar, quitandoId,
}: {
    titulo: string;
    items: ExhibicionComponenteItem[];
    columnaCantidad: string;
    onQuitar?: (id: number) => void;
    quitandoId: number | null;
}) {
    const { t } = useTranslation();
    return (
        <div>
            <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-t-xl text-xs font-black uppercase tracking-wider text-cb-text-secondary">
                <span>{titulo}</span>
                <span>{columnaCantidad}</span>
            </div>
            {items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-cb-text-secondary text-center border border-t-0 border-cb-border rounded-b-xl">—</p>
            ) : (
                <ul className="border border-t-0 border-cb-border rounded-b-xl divide-y divide-cb-border">
                    {items.map(item => (
                        <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                            <span className="text-cb-text-primary">{item.nombre ?? '—'}</span>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold text-cb-text-primary">{item.cantidad}</span>
                                {onQuitar && (
                                    <button
                                        type="button"
                                        onClick={() => onQuitar(item.id)}
                                        disabled={quitandoId === item.id}
                                        title={t('exhibicion_detalle.accion_quitar')}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                                    >
                                        {quitandoId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function DetalleComponentesTab({ exhibicionId, carcasas, productos, onComponenteAgregado, onComponenteQuitado }: DetalleComponentesTabProps) {
    const { t } = useTranslation();
    const [modalTipo, setModalTipo] = useState<1 | 2 | null>(null);
    const [quitandoId, setQuitandoId] = useState<number | null>(null);
    const [errorQuitar, setErrorQuitar] = useState('');

    const handleQuitar = async (id: number) => {
        setQuitandoId(id);
        setErrorQuitar('');
        try {
            await apiClient.delete(`/exhibiciones/${exhibicionId}/componentes/${id}`);
            onComponenteQuitado?.(id);
        } catch (err) {
            setErrorQuitar(err instanceof Error ? err.message : t('exhibicion_detalle.error_quitar_componente'));
        } finally {
            setQuitandoId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <button type="button" onClick={() => setModalTipo(2)} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <Plus className="w-4 h-4" /> {t('exhibicion_detalle.accion_agregar_carcasa')}
                </button>
                <button type="button" onClick={() => setModalTipo(1)} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <Plus className="w-4 h-4" /> {t('exhibicion_detalle.accion_agregar_producto')}
                </button>
            </div>

            {errorQuitar && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorQuitar}
                </div>
            )}

            <Grupo
                titulo={t('exhibicion_detalle.tab_carcasas')}
                items={carcasas}
                columnaCantidad={t('exhibicion_detalle.columna_cantidad')}
                onQuitar={onComponenteQuitado ? handleQuitar : undefined}
                quitandoId={quitandoId}
            />
            <Grupo
                titulo={t('exhibicion_detalle.tab_productos')}
                items={productos}
                columnaCantidad={t('exhibicion_detalle.columna_cantidad')}
                onQuitar={onComponenteQuitado ? handleQuitar : undefined}
                quitandoId={quitandoId}
            />

            {modalTipo !== null && (
                <AgregarComponenteModal
                    exhibicionId={exhibicionId}
                    tipo={modalTipo}
                    onClose={() => setModalTipo(null)}
                    onAgregado={onComponenteAgregado}
                />
            )}
        </div>
    );
}

export default DetalleComponentesTab;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Verify `ExhibicionDetallePage` still builds and behaves unchanged**

Run: `npm run build`
Expected: build succeeds — `ExhibicionDetallePage.tsx` calls `<DetalleComponentesTab exhibicionId={...} carcasas={...} productos={...} onComponenteAgregado={...} />` without `onComponenteQuitado`, which is optional, so no change needed there and no "Quitar" button renders on that read-only page.

- [ ] **Step 4: Commit**

```bash
git add src/components/exhibiciones/DetalleComponentesTab.tsx
git commit -m "feat: DetalleComponentesTab — optional 'Quitar' action per componente"
```

---

## Task 9: `DetalleFotosTab` gains an optional "Eliminar" action

**Files:**
- Modify: `src/components/exhibiciones/DetalleFotosTab.tsx`

**Interfaces:**
- Consumes: `apiClient.delete`.
- Produces: new optional prop `onFotoEliminada?: (id: number) => void`. When present, each photo shows a small circular "X" overlay button (top-right corner) that calls `DELETE /exhibiciones/:exhibicionId/fotos/:id` and, on success, invokes the callback. Task 10 passes this prop; `ExhibicionDetallePage` keeps omitting it.

- [ ] **Step 1: Add the prop, delete handler, and overlay button**

Replace the whole file `src/components/exhibiciones/DetalleFotosTab.tsx` with:

```tsx
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff, Plus, Loader2, X, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';
import type { AgregarFotoInput, ExhibicionFoto } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';

export interface DetalleFotosTabProps {
    exhibicionId: number;
    fotos: ExhibicionFoto[];
    onFotoAgregada: (foto: ExhibicionFoto) => void;
    onFotoEliminada?: (id: number) => void;
}

// Una URL de foto vencida (SAS expirado) o un blob borrado no debe romper
// el layout de la grilla — se reemplaza por un placeholder en vez de dejar
// un ícono roto del navegador.
function Foto({
    foto, className, onEliminar, eliminando,
}: {
    foto: ExhibicionFoto;
    className: string;
    onEliminar?: (id: number) => void;
    eliminando: boolean;
}) {
    const { t } = useTranslation();
    const [failed, setFailed] = useState(false);
    return (
        <div className="relative">
            {failed ? (
                <div className={`${className} flex items-center justify-center bg-muted text-cb-text-secondary`}>
                    <ImageOff className="w-6 h-6" />
                </div>
            ) : (
                <img src={foto.url} onError={() => setFailed(true)} className={`${className} object-cover`} alt="" />
            )}
            {onEliminar && (
                <button
                    type="button"
                    onClick={() => onEliminar(foto.id)}
                    disabled={eliminando}
                    title={t('exhibicion_detalle.accion_eliminar_foto')}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-rose-600 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                >
                    {eliminando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                </button>
            )}
        </div>
    );
}

// Convierte un File a base64 + contentType leyendo el data: URL que arma
// FileReader y separando el prefijo — API estándar del navegador, sin
// librerías nuevas.
function leerArchivoComoBase64(file: File): Promise<{ base64: string; contentType: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const resultado = reader.result as string;
            const [prefijo, base64] = resultado.split(',');
            const match = /data:(.*);base64/.exec(prefijo);
            resolve({ base64, contentType: match ? match[1] : file.type });
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export function DetalleFotosTab({ exhibicionId, fotos, onFotoAgregada, onFotoEliminada }: DetalleFotosTabProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [subiendo, setSubiendo] = useState(false);
    const [eliminandoId, setEliminandoId] = useState<number | null>(null);
    const [error, setError] = useState('');

    const principal = fotos.find(f => f.esFotoPrincipal);
    const resto = fotos.filter(f => !f.esFotoPrincipal);

    // La primera foto que se sube queda como "principal" automáticamente
    // (no hay un toggle manual en esta primera versión — mantiene el
    // formulario simple, YAGNI).
    const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // permite volver a elegir el mismo archivo después
        if (!file) return;

        if (file.size > 8 * 1024 * 1024) {
            setError(t('exhibicion_detalle.error_foto_grande'));
            return;
        }

        setSubiendo(true);
        setError('');
        try {
            const { base64, contentType } = await leerArchivoComoBase64(file);
            const foto = await apiClient.post<ExhibicionFoto>(`/exhibiciones/${exhibicionId}/fotos`, {
                archivoBase64: base64,
                contentType,
                esFotoPrincipal: !principal,
            } satisfies AgregarFotoInput);
            onFotoAgregada(foto);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('exhibicion_detalle.error_agregar_foto'));
        } finally {
            setSubiendo(false);
        }
    };

    const handleEliminar = async (id: number) => {
        setEliminandoId(id);
        setError('');
        try {
            await apiClient.delete(`/exhibiciones/${exhibicionId}/fotos/${id}`);
            onFotoEliminada?.(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('exhibicion_detalle.error_eliminar_foto'));
        } finally {
            setEliminandoId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleArchivoSeleccionado} className="hidden" />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={subiendo}
                    className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                >
                    {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {t('exhibicion_detalle.accion_agregar_foto')}
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {fotos.length === 0 ? (
                <p className="text-sm text-cb-text-secondary text-center py-8">{t('exhibicion_detalle.sin_fotos')}</p>
            ) : (
                <>
                    {principal && (
                        <div>
                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-1.5">{t('exhibicion_detalle.foto_principal')}</p>
                            <Foto
                                foto={principal}
                                className="w-full max-w-xs rounded-xl border border-cb-border"
                                onEliminar={onFotoEliminada ? handleEliminar : undefined}
                                eliminando={eliminandoId === principal.id}
                            />
                        </div>
                    )}
                    {resto.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-1.5">{t('exhibicion_detalle.foto_componente')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {resto.map(foto => (
                                    <Foto
                                        key={foto.id}
                                        foto={foto}
                                        className="aspect-square rounded-xl border border-cb-border"
                                        onEliminar={onFotoEliminada ? handleEliminar : undefined}
                                        eliminando={eliminandoId === foto.id}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default DetalleFotosTab;
```

Note the `Foto` component's signature changed from `{ url, className }` to `{ foto, className, onEliminar, eliminando }` — it needs `foto.id` for the delete button, not just the `url` string.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Verify `ExhibicionDetallePage` still builds and behaves unchanged**

Run: `npm run build`
Expected: build succeeds — `ExhibicionDetallePage.tsx`'s `<DetalleFotosTab exhibicionId={...} fotos={...} onFotoAgregada={...} />` call omits `onFotoEliminada`, so no delete overlay renders there.

- [ ] **Step 4: Commit**

```bash
git add src/components/exhibiciones/DetalleFotosTab.tsx
git commit -m "feat: DetalleFotosTab — optional 'Eliminar' action per foto"
```

---

## Task 10: `ExhibicionEditarPage` — the edit form

**Files:**
- Create: `src/pages/ExhibicionEditarPage.tsx`

**Interfaces:**
- Consumes: `ExhibicionDetalle`, `ExhibicionesOpcionesCrear`, `EditarExhibicionInput` types (Task 6), `apiClient`, `SIATC_THEME`, `DetalleComponentesTab`/`DetalleFotosTab` (Tasks 8-9, with the new optional props wired).
- Produces: `ExhibicionEditarPage` component (default export), no props — mounted on `/exhibiciones/:id/editar`. Task 12 wires the route.

- [ ] **Step 1: Create the page**

Create `src/pages/ExhibicionEditarPage.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { DetalleComponentesTab } from '../components/exhibiciones/DetalleComponentesTab.js';
import { DetalleFotosTab } from '../components/exhibiciones/DetalleFotosTab.js';
import type {
    ExhibicionDetalle, ExhibicionesOpcionesCrear, EditarExhibicionInput, EditarExhibicionResponse,
    ExhibicionComponenteItem, ExhibicionFoto,
} from '../types/index.js';

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

export function ExhibicionEditarPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [detalle, setDetalle] = useState<ExhibicionDetalle | null>(null);
    const [opciones, setOpciones] = useState<ExhibicionesOpcionesCrear | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorCargar, setErrorCargar] = useState('');

    const [nombre, setNombre] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [piso, setPiso] = useState('');
    const [pisoDetalleId, setPisoDetalleId] = useState('');

    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');
    const [guardadoOk, setGuardadoOk] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        setErrorCargar('');
        try {
            const [detalleData, opcionesData] = await Promise.all([
                apiClient.get<ExhibicionDetalle>(`/exhibiciones/${id}`),
                apiClient.get<ExhibicionesOpcionesCrear>('/exhibiciones/opciones-crear'),
            ]);
            setDetalle(detalleData);
            setOpciones(opcionesData);
            setNombre(detalleData.nombre);
            setTipoId(String(detalleData.tipoId));
            setPiso(detalleData.piso ?? '');
            setPisoDetalleId(detalleData.pisoDetalleId ? String(detalleData.pisoDetalleId) : '');
        } catch {
            setErrorCargar(t('exhibicion_editar.error_cargar'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => { cargar(); }, [cargar]);

    const volver = () => navigate(`/exhibiciones/${id}`, { viewTransition: true });

    const puedeGuardar = nombre.trim() !== '' && tipoId !== '' && !guardando;

    const handleGuardar = async () => {
        if (!id) return;
        setGuardando(true);
        setErrorGuardar('');
        setGuardadoOk(false);
        try {
            const actualizado = await apiClient.put<EditarExhibicionResponse>(`/exhibiciones/${id}`, {
                nombre: nombre.trim(),
                tipoId: Number(tipoId),
                piso: piso.trim() || null,
                pisoDetalleId: pisoDetalleId ? Number(pisoDetalleId) : null,
            } satisfies EditarExhibicionInput);
            setDetalle(prev => (prev ? { ...prev, ...actualizado } : prev));
            setGuardadoOk(true);
        } catch (err) {
            setErrorGuardar(err instanceof Error ? err.message : t('exhibicion_editar.error_guardar'));
        } finally {
            setGuardando(false);
        }
    };

    const handleComponenteAgregado = (tipo: 1 | 2, item: ExhibicionComponenteItem) => {
        setDetalle(prev => {
            if (!prev) return prev;
            const componentes = tipo === 1
                ? { ...prev.componentes, productos: [...prev.componentes.productos, item] }
                : { ...prev.componentes, carcasas: [...prev.componentes.carcasas, item] };
            return { ...prev, componentes };
        });
    };

    const handleComponenteQuitado = (itemId: number) => {
        setDetalle(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                componentes: {
                    carcasas: prev.componentes.carcasas.filter(c => c.id !== itemId),
                    productos: prev.componentes.productos.filter(p => p.id !== itemId),
                },
            };
        });
    };

    const handleFotoAgregada = (foto: ExhibicionFoto) => {
        setDetalle(prev => (prev ? { ...prev, fotos: [...prev.fotos, foto] } : prev));
    };

    const handleFotoEliminada = (fotoId: number) => {
        setDetalle(prev => (prev ? { ...prev, fotos: prev.fotos.filter(f => f.id !== fotoId) } : prev));
    };

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={volver}
                        className="p-2 -ml-2 text-muted-foreground hover:bg-white hover:text-primary rounded-xl transition-colors duration-150 active:scale-90 cursor-pointer"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('exhibicion_editar.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>{t('exhibicion_editar.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    {loading && (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    )}

                    {!loading && errorCargar && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {errorCargar}
                        </div>
                    )}

                    {!loading && !errorCargar && detalle && detalle.estadoId !== 1 && (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <AlertCircle className="w-8 h-8 text-amber-500" />
                            <p className="text-sm font-bold text-cb-text-primary">{t('exhibicion_editar.no_pendiente_titulo')}</p>
                            <p className="text-xs text-cb-text-secondary max-w-xs">{t('exhibicion_editar.no_pendiente_mensaje')}</p>
                            <button type="button" onClick={volver} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}>
                                {t('exhibicion_detalle.volver_lista')}
                            </button>
                        </div>
                    )}

                    {!loading && !errorCargar && detalle && detalle.estadoId === 1 && opciones && (
                        <>
                            <div className="max-w-xl space-y-4">
                                <div>
                                    <label className={LABEL_CLASS}>{t('exhibicion_editar.campo_nombre')}</label>
                                    <input type="text" className={INPUT_CLASS} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_tipo')}</label>
                                    <select className={INPUT_CLASS} value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                                        <option value="">{t('exhibicion_crear.selecciona')}</option>
                                        {opciones.tipos.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>{t('exhibicion_detalle.campo_piso')}</label>
                                    <input type="text" className={INPUT_CLASS} value={piso} onChange={(e) => setPiso(e.target.value)} />
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>{t('exhibicion_detalle.campo_detalle_ubicacion')}</label>
                                    <select className={INPUT_CLASS} value={pisoDetalleId} onChange={(e) => setPisoDetalleId(e.target.value)}>
                                        <option value="">{t('exhibicion_crear.selecciona')}</option>
                                        {opciones.pisoDetalles.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                    </select>
                                </div>

                                {errorGuardar && (
                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {errorGuardar}
                                    </div>
                                )}
                                {guardadoOk && (
                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        {t('exhibicion_editar.guardado_ok')}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleGuardar}
                                    disabled={!puedeGuardar}
                                    className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                                >
                                    {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {t('exhibicion_editar.accion_guardar')}
                                </button>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">{t('exhibicion_editar.seccion_componentes')}</h2>
                                <DetalleComponentesTab
                                    exhibicionId={detalle.id}
                                    carcasas={detalle.componentes.carcasas}
                                    productos={detalle.componentes.productos}
                                    onComponenteAgregado={handleComponenteAgregado}
                                    onComponenteQuitado={handleComponenteQuitado}
                                />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">{t('exhibicion_editar.seccion_fotos')}</h2>
                                <DetalleFotosTab
                                    exhibicionId={detalle.id}
                                    fotos={detalle.fotos}
                                    onFotoAgregada={handleFotoAgregada}
                                    onFotoEliminada={handleFotoEliminada}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExhibicionEditarPage;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ExhibicionEditarPage.tsx
git commit -m "feat: ExhibicionEditarPage — edit nombre/tipo/ubicación, componentes, fotos"
```

---

## Task 11: `ExhibicionCard` — "Editar" option in the kebab menu

**Files:**
- Modify: `src/components/exhibiciones/ExhibicionCard.tsx`

**Interfaces:**
- Produces: `ExhibicionCardProps.onAction` gains the `'editar'` literal. The menu item only renders when `exhibicion.estadoId === 1`. Task 12 (`ExhibicionesPage`) handles the new action.

- [ ] **Step 1: Widen the `onAction` type and import `Pencil`**

Replace:

```tsx
import { Eye, ListChecks, Ticket, Image as ImageIcon, Store, Tag, MapPin, MoreVertical } from 'lucide-react';
```

with:

```tsx
import { Eye, ListChecks, Ticket, Pencil, Image as ImageIcon, Store, Tag, MapPin, MoreVertical } from 'lucide-react';
```

Replace:

```tsx
export interface ExhibicionCardProps {
    exhibicion: Exhibicion;
    onAction: (action: 'ver' | 'checklist' | 'ticket') => void;
}
```

with:

```tsx
export interface ExhibicionCardProps {
    exhibicion: Exhibicion;
    onAction: (action: 'ver' | 'checklist' | 'ticket' | 'editar') => void;
}
```

- [ ] **Step 2: Widen `handleAction`'s parameter type**

Replace:

```tsx
    const handleAction = (action: 'ver' | 'checklist' | 'ticket') => {
```

with:

```tsx
    const handleAction = (action: 'ver' | 'checklist' | 'ticket' | 'editar') => {
```

- [ ] **Step 3: Add the "Editar" menu item, only for Pendiente**

Replace:

```tsx
                            <button type="button" onClick={() => handleAction('ticket')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-cb-text-primary hover:bg-muted transition-colors duration-100 cursor-pointer">
                                <Ticket className="w-3.5 h-3.5 text-cb-text-secondary" /> {t('exhibiciones_lista.accion_ticket')}
                            </button>
                        </div>
```

with:

```tsx
                            <button type="button" onClick={() => handleAction('ticket')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-cb-text-primary hover:bg-muted transition-colors duration-100 cursor-pointer">
                                <Ticket className="w-3.5 h-3.5 text-cb-text-secondary" /> {t('exhibiciones_lista.accion_ticket')}
                            </button>
                            {exhibicion.estadoId === 1 && (
                                <button type="button" onClick={() => handleAction('editar')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-cb-text-primary hover:bg-muted transition-colors duration-100 cursor-pointer">
                                    <Pencil className="w-3.5 h-3.5 text-cb-text-secondary" /> {t('exhibiciones_lista.accion_editar')}
                                </button>
                            )}
                        </div>
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: **fails** — `ExhibicionesPage.tsx`'s `handleAction` still types its `action` parameter as `'ver' | 'checklist' | 'ticket'`, narrower than what `ExhibicionCard` now calls it with. This is expected; Task 12 fixes it.

- [ ] **Step 5: Commit**

```bash
git add src/components/exhibiciones/ExhibicionCard.tsx
git commit -m "feat: ExhibicionCard — 'Editar' menu option, visible only while Pendiente"
```

---

## Task 12: Wire the route and the list's `handleAction`

**Files:**
- Modify: `src/pages/ExhibicionesPage.tsx:129-143`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ExhibicionEditarPage` (Task 10).

- [ ] **Step 1: Widen and extend `handleAction` in `ExhibicionesPage.tsx`**

Replace:

```tsx
    const handleAction = (action: 'ver' | 'checklist' | 'ticket', id: number) => {
        if (action === 'ver') {
            navigate(`/exhibiciones/${id}`, { viewTransition: true });
            return;
        }
        if (action === 'checklist') {
            navigate(`/exhibiciones/${id}/checklist/nueva`, { viewTransition: true });
            return;
        }
        if (action === 'ticket') {
            navigate(`/exhibiciones/${id}/tickets/nuevo`, { viewTransition: true });
            return;
        }
        alert(t('exhibiciones_lista.proximamente_titulo'), t('exhibiciones_lista.proximamente_mensaje'));
    };
```

with:

```tsx
    const handleAction = (action: 'ver' | 'checklist' | 'ticket' | 'editar', id: number) => {
        if (action === 'ver') {
            navigate(`/exhibiciones/${id}`, { viewTransition: true });
            return;
        }
        if (action === 'checklist') {
            navigate(`/exhibiciones/${id}/checklist/nueva`, { viewTransition: true });
            return;
        }
        if (action === 'ticket') {
            navigate(`/exhibiciones/${id}/tickets/nuevo`, { viewTransition: true });
            return;
        }
        if (action === 'editar') {
            navigate(`/exhibiciones/${id}/editar`, { viewTransition: true });
            return;
        }
        alert(t('exhibiciones_lista.proximamente_titulo'), t('exhibiciones_lista.proximamente_mensaje'));
    };
```

- [ ] **Step 2: Add the route in `App.tsx`**

Replace:

```tsx
import { ExhibicionCrearPage } from './pages/ExhibicionCrearPage.js';
```

with:

```tsx
import { ExhibicionCrearPage } from './pages/ExhibicionCrearPage.js';
import { ExhibicionEditarPage } from './pages/ExhibicionEditarPage.js';
```

Replace:

```tsx
                                <Route path="/exhibiciones/:id" element={<ExhibicionDetallePage />} />
```

with:

```tsx
                                <Route path="/exhibiciones/:id" element={<ExhibicionDetallePage />} />
                                <Route path="/exhibiciones/:id/editar" element={<ExhibicionEditarPage />} />
```

- [ ] **Step 3: Verify the whole app compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors — this resolves the type mismatch left open at the end of Task 11.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new ones from Task 1.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ExhibicionesPage.tsx src/App.tsx
git commit -m "feat: wire /exhibiciones/:id/editar route and the Editar kebab action"
```

---

## Task 13: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the full app locally**

Terminal 1 (backend):

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" BLOB_CONTAINER_URL="https://soleblob1.blob.core.windows.net/exhibiciones" BLOB_SAS_TOKEN="$AZURE_BLOB_SAS_RW" PORT=3000 npx tsx server/index.ts
```

Terminal 2 (frontend):

```bash
npm run dev
```

- [ ] **Step 2: Full click-through in the browser**

1. Log in, go to Exhibiciones.
2. Find (or create, via "+") a Pendiente exhibición. Open its kebab menu — confirm **Ver, Checklist, Ticket, Editar** all appear.
3. Click Editar → lands on `/exhibiciones/:id/editar` with Nombre/Tipo/Piso/Detalle pre-filled with the real current values.
4. Change the Nombre, click "Guardar cambios" — confirm the success message appears and the field keeps the new value after a page refresh (`GET /:id` reflects it).
5. In the Componentes section, add a componente (reuses the existing modal), confirm it appears in the list immediately, then click its "Quitar" (X) button — confirm it disappears immediately with no error.
6. In the Fotos section, add a photo, confirm it appears, then hover it and click the X overlay — confirm it disappears immediately.
7. Go back to the list, open the same exhibición's detail page (`Ver`, not Editar) — confirm the removed componente/foto do **not** reappear there (soft-delete took effect), and confirm the ones still present render correctly.
8. Approve this exhibición ("Revisado" in the Principal tab of the detail view). Go back to the list — confirm the kebab menu for this exhibición **no longer shows "Editar"**.
9. Try navigating directly to `/exhibiciones/:id/editar` for this now-Aprobada exhibición (paste the URL) — confirm the page shows the "ya no está pendiente" message instead of a form.
10. Switch the language toggle (ES ↔ EN) while on the Editar page — confirm every label translates, no raw i18n keys visible.

- [ ] **Step 3: Confirm the 409 guard server-side one more time, end-to-end**

With the browser still open to the now-Aprobada exhibición's `/editar` URL from Step 2.9, open the browser devtools Network tab and manually re-trigger a save (or use `curl` with the same `$TOKEN` as earlier tasks) — confirm the request gets `409`, not a silently-accepted write.

- [ ] **Step 4: Clean up test data**

If Step 2 created a brand-new test exhibición (rather than reusing one from an earlier plan's verification), note its `id` and leave it — this app has no real delete, and an extra Aprobada test row is consistent with how every previous plan in this repo has left its own test data (see `2026-08-27-exhibicion-crear.md` Task 12's note on this).

No commit for this task — it's verification only.
