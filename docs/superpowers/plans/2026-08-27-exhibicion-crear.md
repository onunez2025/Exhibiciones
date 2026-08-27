# Exhibición — Crear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Nueva Exhibición" create flow — a form to create an exhibición (Tienda/Sucursal/Nombre/Tipo/Piso/Detalle), then reuse the existing detail page to add componentes and fotos to it.

**Architecture:** "Save first, then complete" — a new `ExhibicionCrearPage` POSTs the principal fields and navigates to the already-built `/exhibiciones/:id` detail page, whose Componentes/Fotos tabs gain "Agregar" actions (a search-and-quantity modal for componentes; a native file picker + base64 upload for fotos, with zero new npm dependencies). Five new backend endpoints, all following the existing route file's conventions (LEFT JOIN, `safeError()`, parameterized queries).

**Tech Stack:** Express + TypeScript (`tsx`) · `mssql` · React 19 + `react-i18next` + `react-router-dom` v7 · existing `apiClient`/`SIATC_THEME` conventions · Node's global `fetch` for the Blob Storage upload (no Azure SDK).

**Spec:** [docs/superpowers/specs/2026-08-27-exhibicion-crear-design.md](../specs/2026-08-27-exhibicion-crear-design.md)

## Global Constraints

- Tienda/Sucursal options come from `DISTINCT` combinations already in `EXHIBICION.TB_EXHIBICION` (34/77) — never the full SAP master (`SAP.TB_KNA1`, 15,743 rows) and never the user-scoped legacy tables (`TB_PROMOTOR_CLIENTE` etc. — confirmed incompatible with this app's users).
- Only Carcasa (tipo 2) and Producto (tipo 1) componentes — no "Mueble" (tipo 3/`'MUE'`).
- This plan only creates — no editing an existing exhibición, no deleting a componente or foto once added.
- Fotos are optional — an exhibición can be saved with zero fotos.
- Required fields to create: `clienteCodigo`, `sucursalCodigo`, `nombre`, `tipoId`. `direccion`, `piso`, `pisoDetalleId` are optional/nullable.
- The N° de exhibición generation (`'EXB' + secuencial`) is guarded with `WITH (UPDLOCK, HOLDLOCK)` inside a transaction — two simultaneous creations must never produce the same number (the legacy proc has this race; this rebuild does not).
- Photo uploads travel as base64 inside a normal JSON POST — no `multer` or any new file-upload dependency is added to `package.json`.
- `BLOB_SAS_TOKEN` needs to change from **read-only** to **read+write** permission when this is deployed — this is a manual action for the user in Azure Portal + EasyPanel, not a code change (flagged again at the task that needs it).
- Every new user-facing string goes through `react-i18next` — reuse existing `exhibiciones_lista.filtro_tipo` / `exhibicion_detalle.campo_piso` / `exhibicion_detalle.campo_detalle_ubicacion` / `common.cancel` keys rather than duplicating them; new keys go under `exhibicion_crear.*` and a handful of new `exhibicion_detalle.*` keys.
- Follow existing conventions: `SIATC_THEME` tokens, `apiClient`, `navigate(path, { viewTransition: true })`, the modal visual pattern already used by `DialogContext` (`.modal-overlay-in`/`.modal-content-in`, `SIATC_THEME.TOKENS.MODAL_OVERLAY`, `SIATC_THEME.COMPONENTS.MODAL_CONTENT`) — no click-outside-to-dismiss on the new modal, same as `DialogContext`.

---

## Task 1: `validarExhibicionCrear` — pure field validation

**Files:**
- Create: `server/lib/exhibicionCrear.ts`
- Test: `server/lib/exhibicionCrear.test.ts`

**Interfaces:**
- Produces: `CrearExhibicionInput` (`{ clienteCodigo: string; clienteNombre: string; sucursalCodigo: string; sucursalNombre: string; direccion: string | null; nombre: string; tipoId: number; piso: string | null; pisoDetalleId: number | null }`), `ValidacionCrear` (`{ valido: true; datos: CrearExhibicionInput } | { valido: false; error: string }`), and `validarExhibicionCrear(body: unknown): ValidacionCrear`. Task 4 (`POST /`) imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/exhibicionCrear.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validarExhibicionCrear } from './exhibicionCrear.js';

describe('validarExhibicionCrear', () => {
    const base = {
        clienteCodigo: '0001000001', clienteNombre: 'Cliente Test',
        sucursalCodigo: '3000000001', sucursalNombre: 'Sucursal Test',
        direccion: 'Av. Siempre Viva 123', nombre: 'Exhibición de prueba',
        tipoId: 5, piso: '1', pisoDetalleId: 2,
    };

    it('accepts a fully valid payload and trims strings', () => {
        const result = validarExhibicionCrear({ ...base, nombre: '  Exhibición de prueba  ' });
        expect(result).toEqual({ valido: true, datos: base });
    });

    it('rejects a missing clienteCodigo', () => {
        const result = validarExhibicionCrear({ ...base, clienteCodigo: '' });
        expect(result).toEqual({ valido: false, error: 'Selecciona una tienda y sucursal.' });
    });

    it('rejects a missing sucursalCodigo', () => {
        const result = validarExhibicionCrear({ ...base, sucursalCodigo: undefined });
        expect(result).toEqual({ valido: false, error: 'Selecciona una tienda y sucursal.' });
    });

    it('rejects a missing or whitespace-only nombre', () => {
        expect(validarExhibicionCrear({ ...base, nombre: '' })).toEqual({ valido: false, error: 'El nombre de la exhibición es obligatorio.' });
        expect(validarExhibicionCrear({ ...base, nombre: '   ' })).toEqual({ valido: false, error: 'El nombre de la exhibición es obligatorio.' });
    });

    it('rejects a missing or non-numeric tipoId', () => {
        expect(validarExhibicionCrear({ ...base, tipoId: undefined })).toEqual({ valido: false, error: 'Selecciona un tipo de exhibición.' });
        expect(validarExhibicionCrear({ ...base, tipoId: 'abc' })).toEqual({ valido: false, error: 'Selecciona un tipo de exhibición.' });
    });

    it('treats piso, direccion and pisoDetalleId as optional — null when omitted', () => {
        const { clienteCodigo, clienteNombre, sucursalCodigo, sucursalNombre, nombre, tipoId } = base;
        const result = validarExhibicionCrear({ clienteCodigo, clienteNombre, sucursalCodigo, sucursalNombre, nombre, tipoId });
        expect(result).toEqual({
            valido: true,
            datos: { clienteCodigo, clienteNombre, sucursalCodigo, sucursalNombre, direccion: null, nombre, tipoId, piso: null, pisoDetalleId: null },
        });
    });

    it('rejects a pisoDetalleId that is present but not a valid positive number', () => {
        const result = validarExhibicionCrear({ ...base, pisoDetalleId: 'abc' });
        expect(result).toEqual({ valido: false, error: 'Detalle de ubicación inválido.' });
    });

    it('rejects a non-object body', () => {
        expect(validarExhibicionCrear(null)).toEqual({ valido: false, error: 'Datos inválidos.' });
        expect(validarExhibicionCrear('x')).toEqual({ valido: false, error: 'Datos inválidos.' });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/exhibicionCrear.test.ts`
Expected: FAIL — `Cannot find module './exhibicionCrear.js'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/exhibicionCrear.ts`:

```ts
export interface CrearExhibicionInput {
    clienteCodigo: string;
    clienteNombre: string;
    sucursalCodigo: string;
    sucursalNombre: string;
    direccion: string | null;
    nombre: string;
    tipoId: number;
    piso: string | null;
    pisoDetalleId: number | null;
}

export type ValidacionCrear =
    | { valido: true; datos: CrearExhibicionInput }
    | { valido: false; error: string };

function stringNoVacio(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function stringOpcional(value: unknown): string | null {
    const s = stringNoVacio(value);
    return s || null;
}

// Puro — sin tocar la base de datos — para poder probarlo aislado (mismo
// patrón que exhibicionesFilter.ts). Tienda/Sucursal/Nombre/Tipo son
// obligatorios; Piso, Detalle y Dirección quedan opcionales.
export function validarExhibicionCrear(body: unknown): ValidacionCrear {
    if (typeof body !== 'object' || body === null) {
        return { valido: false, error: 'Datos inválidos.' };
    }
    const b = body as Record<string, unknown>;

    const clienteCodigo = stringNoVacio(b.clienteCodigo);
    const sucursalCodigo = stringNoVacio(b.sucursalCodigo);
    const nombre = stringNoVacio(b.nombre);
    const tipoId = Number(b.tipoId);

    if (!clienteCodigo || !sucursalCodigo) {
        return { valido: false, error: 'Selecciona una tienda y sucursal.' };
    }
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
        datos: {
            clienteCodigo,
            clienteNombre: stringNoVacio(b.clienteNombre),
            sucursalCodigo,
            sucursalNombre: stringNoVacio(b.sucursalNombre),
            direccion: stringOpcional(b.direccion),
            nombre,
            tipoId,
            piso: stringOpcional(b.piso),
            pisoDetalleId,
        },
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/exhibicionCrear.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/exhibicionCrear.ts server/lib/exhibicionCrear.test.ts
git commit -m "feat: validarExhibicionCrear — pure field validation for creating an exhibición"
```

---

## Task 2: `decodificarFotoBase64` — pure photo decode/validate

**Files:**
- Create: `server/lib/blobUpload.ts`
- Test: `server/lib/blobUpload.test.ts`

**Interfaces:**
- Produces: `FotoDecodificada` (`{ buffer: Buffer; extension: string }`), `ResultadoDecodificarFoto` (`{ ok: true; foto: FotoDecodificada } | { ok: false; error: string }`), `decodificarFotoBase64(base64: string, contentType: string, maxBytes: number): ResultadoDecodificarFoto`. Task 7 (`POST /:id/fotos`) imports this.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/blobUpload.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decodificarFotoBase64 } from './blobUpload.js';

// Un PNG mínimo válido en base64 (1x1 px transparente) — suficientemente
// real para probar la ruta feliz sin depender de un archivo externo.
const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('decodificarFotoBase64', () => {
    it('decodes a valid PNG and maps the extension', () => {
        const result = decodificarFotoBase64(PNG_1X1_BASE64, 'image/png', 1024 * 1024);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.foto.extension).toBe('.png');
            expect(result.foto.buffer.length).toBeGreaterThan(0);
        }
    });

    it('maps image/jpeg to .jpg and image/webp to .webp', () => {
        const jpeg = decodificarFotoBase64(PNG_1X1_BASE64, 'image/jpeg', 1024 * 1024);
        const webp = decodificarFotoBase64(PNG_1X1_BASE64, 'image/webp', 1024 * 1024);
        expect(jpeg.ok && jpeg.foto.extension).toBe('.jpg');
        expect(webp.ok && webp.foto.extension).toBe('.webp');
    });

    it('rejects an unsupported content type', () => {
        const result = decodificarFotoBase64(PNG_1X1_BASE64, 'application/pdf', 1024 * 1024);
        expect(result).toEqual({ ok: false, error: 'Formato de imagen no soportado.' });
    });

    it('rejects an empty base64 string', () => {
        const result = decodificarFotoBase64('', 'image/png', 1024 * 1024);
        expect(result).toEqual({ ok: false, error: 'No se recibió ningún archivo.' });
    });

    it('rejects a decoded buffer larger than maxBytes', () => {
        const result = decodificarFotoBase64(PNG_1X1_BASE64, 'image/png', 10);
        expect(result).toEqual({ ok: false, error: 'La foto es demasiado grande (máximo 8MB).' });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/blobUpload.test.ts`
Expected: FAIL — `Cannot find module './blobUpload.js'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/blobUpload.ts`:

```ts
const EXTENSION_POR_CONTENT_TYPE: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

export interface FotoDecodificada {
    buffer: Buffer;
    extension: string;
}

export type ResultadoDecodificarFoto =
    | { ok: true; foto: FotoDecodificada }
    | { ok: false; error: string };

// Decodifica y valida en un solo paso (formato soportado, no vacío, no
// demasiado grande) — puro salvo por Buffer.from (sin red, sin disco), así
// que se puede probar aislado. El mensaje de tamaño queda fijo en "8MB"
// porque hoy solo se llama con ese límite (MAX_FOTO_BYTES en la ruta).
export function decodificarFotoBase64(base64: string, contentType: string, maxBytes: number): ResultadoDecodificarFoto {
    const extension = EXTENSION_POR_CONTENT_TYPE[contentType];
    if (!extension) {
        return { ok: false, error: 'Formato de imagen no soportado.' };
    }
    if (!base64) {
        return { ok: false, error: 'No se recibió ningún archivo.' };
    }

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) {
        return { ok: false, error: 'El archivo no es una imagen válida.' };
    }
    if (buffer.length > maxBytes) {
        return { ok: false, error: 'La foto es demasiado grande (máximo 8MB).' };
    }

    return { ok: true, foto: { buffer, extension } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/blobUpload.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/blobUpload.ts server/lib/blobUpload.test.ts
git commit -m "feat: decodificarFotoBase64 — decode and validate a base64 photo upload"
```

---

## Task 3: `GET /api/exhibiciones/opciones-crear` (+ refactor `/opciones-filtro`)

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Produces: shared helper `obtenerCatalogosPvTabla(pool: sql.ConnectionPool): Promise<{ tipos: {id:number,nombre:string}[]; pisoDetalles: {id:number,nombre:string}[] }>`; `GET /opciones-crear` → `{ tiendas: {clienteCodigo,clienteNombre,sucursalCodigo,sucursalNombre,direccion}[], tipos, pisoDetalles }`. Task 8 (frontend types) mirrors this shape.

- [ ] **Step 1: Extract the shared catalog helper and refactor `/opciones-filtro`**

In `server/routes/exhibiciones.ts`, replace:

```ts
// Catálogo real vive en dbo.PV_TABLA (tabla genérica de parámetros
// compartida por todo el ERP) — no en el esquema EXHIBICION. Confirmado
// leyendo EXHIBICION.PROC_BANDEJA_EXHIBICION, el stored procedure que
// alimentaba esta misma pantalla en la app anterior.
router.get('/opciones-filtro', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const [tipos, ubicaciones] = await Promise.all([
            pool.request().query(`
                SELECT IN_id as id, VC_descripcion as nombre
                FROM dbo.PV_TABLA
                WHERE VC_tabla = 'EXHIBICION_TIPO' AND CH_activo = '1'
                ORDER BY VC_descripcion
            `),
            pool.request().query(`
                SELECT IN_id as id, VC_descripcion as nombre
                FROM dbo.PV_TABLA
                WHERE VC_tabla = 'EXHIBICION_PISO_DETALLE' AND CH_activo = '1'
                ORDER BY VC_descripcion
            `),
        ]);
        res.json({ tipos: tipos.recordset, ubicaciones: ubicaciones.recordset });
    } catch (err: unknown) {
        console.error('[Exhibiciones] opciones-filtro error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

with:

```ts
// Catálogo real vive en dbo.PV_TABLA (tabla genérica de parámetros
// compartida por todo el ERP) — no en el esquema EXHIBICION. Confirmado
// leyendo EXHIBICION.PROC_BANDEJA_EXHIBICION, el stored procedure que
// alimentaba esta misma pantalla en la app anterior. Compartido entre
// /opciones-filtro y /opciones-crear — mismas dos consultas, dos
// consumidores distintos.
async function obtenerCatalogosPvTabla(pool: sql.ConnectionPool) {
    const [tipos, pisoDetalles] = await Promise.all([
        pool.request().query(`
            SELECT IN_id as id, VC_descripcion as nombre
            FROM dbo.PV_TABLA
            WHERE VC_tabla = 'EXHIBICION_TIPO' AND CH_activo = '1'
            ORDER BY VC_descripcion
        `),
        pool.request().query(`
            SELECT IN_id as id, VC_descripcion as nombre
            FROM dbo.PV_TABLA
            WHERE VC_tabla = 'EXHIBICION_PISO_DETALLE' AND CH_activo = '1'
            ORDER BY VC_descripcion
        `),
    ]);
    return { tipos: tipos.recordset, pisoDetalles: pisoDetalles.recordset };
}

router.get('/opciones-filtro', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const { tipos, pisoDetalles } = await obtenerCatalogosPvTabla(pool);
        res.json({ tipos, ubicaciones: pisoDetalles });
    } catch (err: unknown) {
        console.error('[Exhibiciones] opciones-filtro error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

// Tienda/Sucursal para el formulario de creación: las combinaciones que YA
// existen en TB_EXHIBICION (34 clientes / 77 sucursales), no el maestro SAP
// completo (SAP.TB_KNA1, 15,743 clientes de toda la empresa) ni las tablas
// de asignación por usuario de la app vieja (TB_PROMOTOR_CLIENTE, etc. —
// verificado que ningún usuario de esta app existe en SEGURIDAD.TB_USUARIO,
// esa lógica de scoping no es reusable).
router.get('/opciones-crear', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const [{ tipos, pisoDetalles }, tiendasResult] = await Promise.all([
            obtenerCatalogosPvTabla(pool),
            pool.request().query(`
                SELECT DISTINCT
                    VC_cliente_codigo as clienteCodigo, VC_cliente_nombre as clienteNombre,
                    VC_sucursal_codigo as sucursalCodigo, VC_sucursal_nombre as sucursalNombre,
                    VC_direccion as direccion
                FROM EXHIBICION.TB_EXHIBICION
                WHERE VC_cliente_codigo IS NOT NULL AND VC_sucursal_codigo IS NOT NULL
                ORDER BY VC_cliente_nombre, VC_sucursal_nombre
            `),
        ]);
        res.json({ tiendas: tiendasResult.recordset, tipos, pisoDetalles });
    } catch (err: unknown) {
        console.error('[Exhibiciones] opciones-crear error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Run the full test suite (confirms the refactor didn't break anything)**

Run: `npx vitest run`
Expected: all existing tests still pass (this task adds no new test file — it refactors an existing route and adds a new one with no pure logic of its own to unit test).

- [ ] **Step 4: Manual verification against the real database**

Start the backend locally (inline env vars, never written to a file):

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" PORT=3000 npx tsx server/index.ts
```

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"REPLACE_WITH_CURRENT_ADMIN_PASSWORD"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s http://localhost:3000/api/exhibiciones/opciones-filtro -H "Authorization: Bearer $TOKEN" | head -c 300
curl -s http://localhost:3000/api/exhibiciones/opciones-crear -H "Authorization: Bearer $TOKEN" | head -c 500
```

Expected: `/opciones-filtro` still returns `{tipos, ubicaciones}` exactly as before (unchanged shape — confirms the refactor is behavior-preserving). `/opciones-crear` returns `{tiendas, tipos, pisoDetalles}` with `tiendas` containing around 77 entries.

- [ ] **Step 5: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: GET /api/exhibiciones/opciones-crear (+ shared catalog helper)"
```

---

## Task 4: `POST /api/exhibiciones` — create

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Consumes: `validarExhibicionCrear` (Task 1).
- Produces: `POST /` → `201 { id, nroExhibicion }` or `400 { error }`.

- [ ] **Step 1: Add the import**

In `server/routes/exhibiciones.ts`, replace:

```ts
import { mapComponentesRows } from '../lib/exhibicionComponentes.js';
```

with:

```ts
import { mapComponentesRows } from '../lib/exhibicionComponentes.js';
import { validarExhibicionCrear } from '../lib/exhibicionCrear.js';
```

- [ ] **Step 2: Add the route**

Add this route directly above `router.get('/:id', ...)` (i.e. after the `GET /opciones-crear` route added in Task 3, before the `GET /:id` param route):

```ts
router.post('/', async (req: Request, res: Response) => {
    try {
        const validacion = validarExhibicionCrear(req.body);
        if (!validacion.valido) {
            res.status(400).json({ error: validacion.error });
            return;
        }
        const { clienteCodigo, clienteNombre, sucursalCodigo, sucursalNombre, direccion, nombre, tipoId, piso, pisoDetalleId } = validacion.datos;

        const pool = await getDbConnection();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);
            request.input('nombre', sql.VarChar(150), nombre);
            request.input('clienteCodigo', sql.VarChar(10), clienteCodigo);
            request.input('clienteNombre', sql.VarChar(250), clienteNombre);
            request.input('sucursalCodigo', sql.VarChar(10), sucursalCodigo);
            request.input('sucursalNombre', sql.VarChar(250), sucursalNombre);
            request.input('direccion', sql.VarChar(250), direccion);
            request.input('tipoId', sql.Int, tipoId);
            request.input('piso', sql.VarChar(100), piso);
            request.input('pisoDetalleId', sql.Int, pisoDetalleId);
            request.input('usuario', sql.VarChar(50), req.user?.username ?? 'system');

            // WITH (UPDLOCK, HOLDLOCK) — a diferencia del proc viejo
            // (PROC_GUARDAR_EXHIBICION), esto sí evita que dos creaciones
            // simultáneas lean el mismo MAX y generen el mismo N°.
            const result = await request.query(`
                DECLARE @sgte INT
                SELECT @sgte = ISNULL(MAX(CONVERT(INT, SUBSTRING(VC_nro_exhibicion, 4, 99))), 0) + 1
                FROM EXHIBICION.TB_EXHIBICION WITH (UPDLOCK, HOLDLOCK)
                WHERE SUBSTRING(VC_nro_exhibicion, 1, 3) = 'EXB'

                DECLARE @nro VARCHAR(10) = 'EXB' + RIGHT('0000000' + CONVERT(VARCHAR, @sgte), 7)

                INSERT INTO EXHIBICION.TB_EXHIBICION
                    (VC_nombre, VC_cliente_codigo, VC_cliente_nombre, VC_sucursal_codigo, VC_sucursal_nombre,
                     VC_direccion, IN_exhibicion_tipo_id, VC_piso, IN_piso_detalle_id, IN_estado_id,
                     VC_usuario_crea, DT_fecha_crea, VC_nro_exhibicion)
                OUTPUT INSERTED.IN_exhibicion_id as id, INSERTED.VC_nro_exhibicion as nroExhibicion
                VALUES (@nombre, @clienteCodigo, @clienteNombre, @sucursalCodigo, @sucursalNombre,
                        @direccion, @tipoId, @piso, @pisoDetalleId, 1,
                        @usuario, GETDATE(), @nro)
            `);

            await transaction.commit();
            const row = result.recordset[0];
            res.status(201).json({ id: row.id, nroExhibicion: row.nroExhibicion });
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }
    } catch (err: unknown) {
        console.error('[Exhibiciones] crear error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification against the real database**

With the backend still running from Task 3:

```bash
curl -s -X POST http://localhost:3000/api/exhibiciones \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"clienteCodigo":"0001000001","clienteNombre":"CLIENTE PRUEBA","sucursalCodigo":"9999999","sucursalNombre":"SUCURSAL PRUEBA","nombre":"Exhibición de prueba SDD","tipoId":5}'
```

Expected: `201` with `{"id": <number>, "nroExhibicion": "EXB00007XX"}` (the next sequential number). Then test validation:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/exhibiciones \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```

Expected: `400`. **Nota:** este POST de prueba SÍ crea una fila real en producción — anota el `id` devuelto, lo necesitas para limpiarlo en la verificación final (Task 12).

- [ ] **Step 5: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: POST /api/exhibiciones — create with race-safe N° generation"
```

---

## Task 5: `GET /api/exhibiciones/catalogo-componentes`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Produces: `GET /catalogo-componentes` → `{ productos: {codigo,nombre}[], carcasas: {codigo,nombre}[] }`.

- [ ] **Step 1: Add the route**

Add this route directly after the `POST /` route added in Task 4 (still before `GET /:id`):

```ts
// Catálogo completo para el selector "Agregar Carcasa"/"Agregar Producto"
// — solo PRD y CAR (no 'MUE', ver spec). WEB_MARKETING_PRODUCTOS tiene 216
// PRD y 44 CAR — chico, se carga una vez y se filtra en el navegador.
router.get('/catalogo-componentes', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const [productos, carcasas] = await Promise.all([
            pool.request().query(`
                SELECT VC_articulo_codigo as codigo, VC_articulo_nombre2 as nombre
                FROM EXHIBICION.WEB_MARKETING_PRODUCTOS WHERE VC_tipo = 'PRD' ORDER BY nombre
            `),
            pool.request().query(`
                SELECT VC_articulo_codigo as codigo, VC_articulo_nombre2 as nombre
                FROM EXHIBICION.WEB_MARKETING_PRODUCTOS WHERE VC_tipo = 'CAR' ORDER BY nombre
            `),
        ]);
        res.json({ productos: productos.recordset, carcasas: carcasas.recordset });
    } catch (err: unknown) {
        console.error('[Exhibiciones] catalogo-componentes error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification against the real database**

With the backend still running:

```bash
curl -s http://localhost:3000/api/exhibiciones/catalogo-componentes -H "Authorization: Bearer $TOKEN" | node -pe 'const d=JSON.parse(require("fs").readFileSync(0)); `productos: ${d.productos.length}, carcasas: ${d.carcasas.length}`'
```

Expected: `productos: 216, carcasas: 44`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: GET /api/exhibiciones/catalogo-componentes"
```

---

## Task 6: `POST /api/exhibiciones/:id/componentes`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Produces: `POST /:id/componentes` → `201 { id, nombre, cantidad }` (same shape as `ExhibicionComponenteItem`), `404`, or `400`.

- [ ] **Step 1: Add the route**

Add this route directly after the `GET /:id` route (still before `POST /:id/aprobar`, order among these doesn't matter functionally, but keep the file's existing GET-then-POST grouping):

```ts
router.post('/:id/componentes', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const tipo = Number(req.body?.tipo);
        const codigoProducto = typeof req.body?.codigoProducto === 'string' ? req.body.codigoProducto.trim() : '';
        const cantidad = Number(req.body?.cantidad);

        if (tipo !== 1 && tipo !== 2) {
            res.status(400).json({ error: 'Tipo de componente inválido.' });
            return;
        }
        if (!codigoProducto) {
            res.status(400).json({ error: 'Selecciona un producto o carcasa.' });
            return;
        }
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            res.status(400).json({ error: 'La cantidad debe ser un número entero mayor a 0.' });
            return;
        }

        const pool = await getDbConnection();

        const exists = await pool.request().input('id', sql.BigInt, id)
            .query('SELECT 1 FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
        if (exists.recordset.length === 0) {
            res.status(404).json({ error: 'Exhibición no encontrada.' });
            return;
        }

        // Verifica que el código exista en el catálogo con el tipo correcto
        // — evita insertar un código inventado si alguien arma la request a
        // mano en vez de usar el selector.
        const catalogoTipo = tipo === 1 ? 'PRD' : 'CAR';
        const productoResult = await pool.request()
            .input('codigo', sql.VarChar(20), codigoProducto)
            .input('tipo', sql.VarChar(3), catalogoTipo)
            .query(`
                SELECT VC_articulo_nombre2 as nombre
                FROM EXHIBICION.WEB_MARKETING_PRODUCTOS
                WHERE VC_articulo_codigo = @codigo AND VC_tipo = @tipo
            `);
        const producto = productoResult.recordset[0];
        if (!producto) {
            res.status(400).json({ error: 'Producto no encontrado en el catálogo.' });
            return;
        }

        const insertResult = await pool.request()
            .input('exhibicionId', sql.BigInt, id)
            .input('codigo', sql.VarChar(20), codigoProducto)
            .input('cantidad', sql.Int, cantidad)
            .input('tipo', sql.Int, tipo)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                INSERT INTO EXHIBICION.TB_EXHIBICION_COMPONENTE
                    (IN_exhibicion_id, VC_codigo_producto, IN_cantidad, IN_tipo, IN_estado, VC_usuario_crea, DT_fecha_crea)
                OUTPUT INSERTED.IN_exhibicion_componente_id as id
                VALUES (@exhibicionId, @codigo, @cantidad, @tipo, 1, @usuario, GETDATE())
            `);

        res.status(201).json({ id: insertResult.recordset[0].id, nombre: producto.nombre, cantidad });
    } catch (err: unknown) {
        console.error('[Exhibiciones] agregar componente error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification against the real database**

Using the test exhibición id created in Task 4's verification (call it `<TEST_ID>`), and a real product code from the catalog (e.g. query `catalogo-componentes` and pick one `codigo`):

```bash
curl -s -X POST http://localhost:3000/api/exhibiciones/<TEST_ID>/componentes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tipo":1,"codigoProducto":"<UN_CODIGO_PRD_REAL>","cantidad":2}'
```

Expected: `201` with `{"id": <number>, "nombre": "<nombre real>", "cantidad": 2}`. Then test a bad code:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/exhibiciones/<TEST_ID>/componentes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tipo":1,"codigoProducto":"CODIGO-INVENTADO","cantidad":1}'
```

Expected: `400`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: POST /api/exhibiciones/:id/componentes"
```

---

## Task 7: `POST /api/exhibiciones/:id/fotos` (+ route-scoped body limit)

**Files:**
- Modify: `server/routes/exhibiciones.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `decodificarFotoBase64` (Task 2), `buildFotoUrl` (already imported).
- Produces: `POST /:id/fotos` → `201 { id, url, esFotoPrincipal }` (same shape as `ExhibicionFoto`), `404`, `400`, or `502`.

- [ ] **Step 1: Raise the body-size limit for this one route, in `server/index.ts`**

The global `express.json({ limit: '2mb' })` (line 113) is too small for a base64-encoded photo — but it's deliberately small for every other route, so don't raise it globally. In `server/index.ts`, replace:

```ts
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
```

with:

```ts
// Límite más alto SOLO para subir fotos (base64 infla ~33% el tamaño real
// de la imagen) — va ANTES del parser global a propósito: body-parser
// marca la request como ya parseada una vez que la lee, así que el parser
// global de abajo la deja pasar sin volver a aplicar su límite de 2mb más
// chico. Todas las demás rutas siguen limitadas a 2mb.
app.use('/api/exhibiciones/:id/fotos', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
```

- [ ] **Step 2: Add the route in `server/routes/exhibiciones.ts`**

Replace:

```ts
import { buildFotoUrl } from '../lib/exhibicionFotos.js';
```

with:

```ts
import { buildFotoUrl } from '../lib/exhibicionFotos.js';
import { decodificarFotoBase64 } from '../lib/blobUpload.js';
import { randomUUID } from 'crypto';
```

Add this constant near the top of the file, after the `router` declaration:

```ts
const MAX_FOTO_BYTES = 8 * 1024 * 1024; // 8MB — ver decodificarFotoBase64
```

Add this route directly after `POST /:id/componentes` (still before `POST /:id/aprobar`):

```ts
router.post('/:id/fotos', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const exists = await pool.request().input('id', sql.BigInt, id)
            .query('SELECT 1 FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
        if (exists.recordset.length === 0) {
            res.status(404).json({ error: 'Exhibición no encontrada.' });
            return;
        }

        const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType : '';
        const archivoBase64 = typeof req.body?.archivoBase64 === 'string' ? req.body.archivoBase64 : '';
        const esFotoPrincipal = req.body?.esFotoPrincipal === true;

        const resultado = decodificarFotoBase64(archivoBase64, contentType, MAX_FOTO_BYTES);
        if (!resultado.ok) {
            res.status(400).json({ error: resultado.error });
            return;
        }

        const blobContainerUrl = cleanEnv('BLOB_CONTAINER_URL');
        const blobSasToken = cleanEnv('BLOB_SAS_TOKEN');
        const nombreArchivo = `${randomUUID()}${resultado.foto.extension}`;

        const uploadRes = await fetch(`${blobContainerUrl}/${nombreArchivo}?${blobSasToken}`, {
            method: 'PUT',
            headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType },
            body: resultado.foto.buffer,
        });
        if (!uploadRes.ok) {
            const detalle = await uploadRes.text().catch(() => '');
            console.error('[Exhibiciones] subida a blob falló:', uploadRes.status, detalle);
            res.status(502).json({ error: 'No se pudo subir la foto. Intenta de nuevo.' });
            return;
        }

        // Nunca deja dos fotos marcadas como principal a la vez (a
        // diferencia de datos históricos donde sí puede pasar).
        if (esFotoPrincipal) {
            await pool.request().input('id', sql.BigInt, id)
                .query('UPDATE EXHIBICION.TB_EXHIBICION_FOTO SET BI_es_foto_principal = 0 WHERE IN_exhibicion_id = @id');
        }

        const insertResult = await pool.request()
            .input('exhibicionId', sql.BigInt, id)
            .input('nombre', sql.VarChar(200), nombreArchivo)
            .input('extension', sql.VarChar(10), resultado.foto.extension)
            .input('esFotoPrincipal', sql.Bit, esFotoPrincipal)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                INSERT INTO EXHIBICION.TB_EXHIBICION_FOTO
                    (IN_exhibicion_id, VC_directorio, VC_archivo_nombre, VC_extension, IN_estado, VC_usuario_crea, DT_fecha_crea, BI_es_foto_principal)
                OUTPUT INSERTED.IN_exhibicion_foto_id as id
                VALUES (@exhibicionId, '', @nombre, @extension, 1, @usuario, GETDATE(), @esFotoPrincipal)
            `);

        res.status(201).json({
            id: insertResult.recordset[0].id,
            url: buildFotoUrl(blobContainerUrl, blobSasToken, nombreArchivo),
            esFotoPrincipal,
        });
    } catch (err: unknown) {
        console.error('[Exhibiciones] agregar foto error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification against the real database and Blob Storage**

**Esto necesita un SAS con permiso de lectura + escritura** (`sp=rw`), no el de solo lectura ya configurado — genera uno nuevo en Azure Portal (mismo contenedor `exhibiciones`, cuenta `soleblob1`) solo para esta verificación si no tienes ya uno de larga duración con escritura.

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" BLOB_CONTAINER_URL="https://soleblob1.blob.core.windows.net/exhibiciones" BLOB_SAS_TOKEN="$AZURE_BLOB_SAS_RW" PORT=3000 npx tsx server/index.ts
```

```bash
# Un PNG 1x1 real en base64 (el mismo de blobUpload.test.ts) para la prueba
BASE64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
curl -s -X POST http://localhost:3000/api/exhibiciones/<TEST_ID>/fotos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"archivoBase64\":\"$BASE64\",\"contentType\":\"image/png\",\"esFotoPrincipal\":true}"
```

Expected: `201` with `{"id": <number>, "url": "https://soleblob1.blob.core.windows.net/exhibiciones/<guid>.png?...", "esFotoPrincipal": true}`. Abre esa `url` (sin el query de más) en un navegador para confirmar que la imagen realmente se subió y carga.

- [ ] **Step 5: Commit**

```bash
git add server/routes/exhibiciones.ts server/index.ts
git commit -m "feat: POST /api/exhibiciones/:id/fotos — real photo upload to Blob Storage"
```

---

## Task 8: Frontend types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `TiendaOpcion`, `ExhibicionesOpcionesCrear`, `CrearExhibicionInput`, `CrearExhibicionResponse`, `ComponenteCatalogoItem`, `CatalogoComponentesResponse`, `AgregarComponenteInput`, `AgregarFotoInput`. Tasks 9-13 import these.

- [ ] **Step 1: Add the types**

Append to `src/types/index.ts` (after the existing `AprobarExhibicionResponse` interface):

```ts
export interface TiendaOpcion {
    clienteCodigo: string;
    clienteNombre: string;
    sucursalCodigo: string;
    sucursalNombre: string;
    direccion: string | null;
}

export interface ExhibicionesOpcionesCrear {
    tiendas: TiendaOpcion[];
    tipos: FiltroOpcion[];
    pisoDetalles: FiltroOpcion[];
}

export interface CrearExhibicionInput {
    clienteCodigo: string;
    clienteNombre: string;
    sucursalCodigo: string;
    sucursalNombre: string;
    direccion: string | null;
    nombre: string;
    tipoId: number;
    piso: string | null;
    pisoDetalleId: number | null;
}

export interface CrearExhibicionResponse {
    id: number;
    nroExhibicion: string;
}

export interface ComponenteCatalogoItem {
    codigo: string;
    nombre: string;
}

export interface CatalogoComponentesResponse {
    productos: ComponenteCatalogoItem[];
    carcasas: ComponenteCatalogoItem[];
}

export interface AgregarComponenteInput {
    tipo: 1 | 2;
    codigoProducto: string;
    cantidad: number;
}

export interface AgregarFotoInput {
    archivoBase64: string;
    contentType: string;
    esFotoPrincipal: boolean;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: frontend types for creating an exhibición"
```

---

## Task 9: `ExhibicionCrearPage` — the create form

**Files:**
- Create: `src/pages/ExhibicionCrearPage.tsx`

**Interfaces:**
- Consumes: `ExhibicionesOpcionesCrear`, `CrearExhibicionResponse` types (Task 8), `apiClient`, `SIATC_THEME`.
- Produces: `ExhibicionCrearPage` component (default export), no props — mounted on `/exhibiciones/nueva`. Task 10 wires the route.

- [ ] **Step 1: Create the page**

Create `src/pages/ExhibicionCrearPage.tsx`:

```tsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import type { ExhibicionesOpcionesCrear, CrearExhibicionInput, CrearExhibicionResponse } from '../types/index.js';

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

export function ExhibicionCrearPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [opciones, setOpciones] = useState<ExhibicionesOpcionesCrear | null>(null);
    const [loadingOpciones, setLoadingOpciones] = useState(true);
    const [errorOpciones, setErrorOpciones] = useState('');

    const [clienteCodigo, setClienteCodigo] = useState('');
    const [sucursalCodigo, setSucursalCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [piso, setPiso] = useState('');
    const [pisoDetalleId, setPisoDetalleId] = useState('');

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        apiClient.get<ExhibicionesOpcionesCrear>('/exhibiciones/opciones-crear')
            .then(setOpciones)
            .catch(() => setErrorOpciones(t('exhibicion_crear.error_cargar_opciones')))
            .finally(() => setLoadingOpciones(false));
    }, [t]);

    // Una tienda por VC_cliente_codigo — TB_EXHIBICION trae una fila por
    // cada combinación tienda+sucursal, así que una tienda con varias
    // sucursales aparece repetida en `opciones.tiendas`.
    const tiendas = useMemo(() => {
        const vistos = new Set<string>();
        return (opciones?.tiendas ?? []).filter(x => {
            if (vistos.has(x.clienteCodigo)) return false;
            vistos.add(x.clienteCodigo);
            return true;
        });
    }, [opciones]);

    const sucursales = useMemo(
        () => (opciones?.tiendas ?? []).filter(x => x.clienteCodigo === clienteCodigo),
        [opciones, clienteCodigo]
    );

    const puedeGuardar = clienteCodigo !== '' && sucursalCodigo !== '' && nombre.trim() !== '' && tipoId !== '' && !guardando;

    const volver = () => navigate('/exhibiciones', { viewTransition: true });

    const handleGuardar = async () => {
        const sucursal = sucursales.find(s => s.sucursalCodigo === sucursalCodigo);
        const tienda = tiendas.find(x => x.clienteCodigo === clienteCodigo);
        if (!sucursal || !tienda) return;

        setGuardando(true);
        setError('');
        try {
            const data = await apiClient.post<CrearExhibicionResponse>('/exhibiciones', {
                clienteCodigo: tienda.clienteCodigo,
                clienteNombre: tienda.clienteNombre,
                sucursalCodigo: sucursal.sucursalCodigo,
                sucursalNombre: sucursal.sucursalNombre,
                direccion: sucursal.direccion,
                nombre: nombre.trim(),
                tipoId: Number(tipoId),
                piso: piso.trim() || null,
                pisoDetalleId: pisoDetalleId ? Number(pisoDetalleId) : null,
            } satisfies CrearExhibicionInput);
            navigate(`/exhibiciones/${data.id}`, { viewTransition: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('exhibicion_crear.error_guardar'));
        } finally {
            setGuardando(false);
        }
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
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('exhibicion_crear.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>{t('exhibicion_crear.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    {loadingOpciones && (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    )}

                    {!loadingOpciones && errorOpciones && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {errorOpciones}
                        </div>
                    )}

                    {!loadingOpciones && !errorOpciones && opciones && (
                        <div className="max-w-xl space-y-4">
                            <div>
                                <label className={LABEL_CLASS}>{t('exhibicion_crear.campo_tienda')}</label>
                                <select
                                    className={INPUT_CLASS}
                                    value={clienteCodigo}
                                    onChange={(e) => { setClienteCodigo(e.target.value); setSucursalCodigo(''); }}
                                >
                                    <option value="">{t('exhibicion_crear.selecciona')}</option>
                                    {tiendas.map(x => <option key={x.clienteCodigo} value={x.clienteCodigo}>{x.clienteNombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>{t('exhibicion_crear.campo_sucursal')}</label>
                                <select
                                    className={INPUT_CLASS}
                                    value={sucursalCodigo}
                                    onChange={(e) => setSucursalCodigo(e.target.value)}
                                    disabled={!clienteCodigo}
                                >
                                    <option value="">{t('exhibicion_crear.selecciona')}</option>
                                    {sucursales.map(s => <option key={s.sucursalCodigo} value={s.sucursalCodigo}>{s.sucursalNombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>{t('exhibicion_crear.campo_nombre')}</label>
                                <input
                                    type="text"
                                    className={INPUT_CLASS}
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    placeholder={t('exhibicion_crear.campo_nombre_placeholder')}
                                />
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

                            {error && (
                                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleGuardar}
                                disabled={!puedeGuardar}
                                className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                            >
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('exhibicion_crear.accion_guardar')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExhibicionCrearPage;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (missing i18n keys are not TypeScript errors — Task 14 adds them).

- [ ] **Step 3: Commit**

```bash
git add src/pages/ExhibicionCrearPage.tsx
git commit -m "feat: ExhibicionCrearPage — the Nueva Exhibición form"
```

---

## Task 10: Wire the "+" button and the `/exhibiciones/nueva` route

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/ExhibicionesPage.tsx`

**Interfaces:**
- Consumes: `ExhibicionCrearPage` (Task 9).

- [ ] **Step 1: Add the route**

In `src/App.tsx`, replace:

```tsx
import { ExhibicionDetallePage } from './pages/ExhibicionDetallePage.js';
```

with:

```tsx
import { ExhibicionDetallePage } from './pages/ExhibicionDetallePage.js';
import { ExhibicionCrearPage } from './pages/ExhibicionCrearPage.js';
```

Replace:

```tsx
                                <Route path="/exhibiciones/:id" element={<ExhibicionDetallePage />} />
```

with:

```tsx
                                <Route path="/exhibiciones/nueva" element={<ExhibicionCrearPage />} />
                                <Route path="/exhibiciones/:id" element={<ExhibicionDetallePage />} />
```

(React Router ranks a literal segment like `nueva` above a dynamic `:id` regardless of declaration order, but keeping the literal route first reads more clearly.)

- [ ] **Step 2: Add the "+" button to the toolbar**

In `src/pages/ExhibicionesPage.tsx`, replace:

```tsx
import { Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
```

with:

```tsx
import { Search, Filter, RefreshCw, Loader2, Plus } from 'lucide-react';
```

Replace:

```tsx
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => setFiltrosOpen(v => !v)}
                            className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer shrink-0'}
                        >
                            <Filter className="w-4 h-4" /> {t('exhibiciones_lista.filtros')}
                        </button>
```

with:

```tsx
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/exhibiciones/nueva', { viewTransition: true })}
                            className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' gap-1.5 cursor-pointer shrink-0'}
                        >
                            <Plus className="w-4 h-4" /> {t('exhibiciones_lista.accion_nueva')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFiltrosOpen(v => !v)}
                            className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer shrink-0'}
                        >
                            <Filter className="w-4 h-4" /> {t('exhibiciones_lista.filtros')}
                        </button>
```

(`navigate` is already declared in this file — it was added when "Ver" was wired to the detail page.)

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/ExhibicionesPage.tsx
git commit -m "feat: wire /exhibiciones/nueva route and the '+' button"
```

---

## Task 11: `AgregarComponenteModal` component

**Files:**
- Create: `src/components/exhibiciones/AgregarComponenteModal.tsx`

**Interfaces:**
- Consumes: `CatalogoComponentesResponse`, `ComponenteCatalogoItem`, `ExhibicionComponenteItem` types (Task 8 + existing), `apiClient`, `SIATC_THEME`, `cn`.
- Produces: `AgregarComponenteModal` component, props `{ exhibicionId: number; tipo: 1 | 2; onClose: () => void; onAgregado: (tipo: 1 | 2, item: ExhibicionComponenteItem) => void }`. Task 12 renders it.

- [ ] **Step 1: Create the component**

Create `src/components/exhibiciones/AgregarComponenteModal.tsx`:

```tsx
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { apiClient } from '../../services/apiClient.js';
import type { AgregarComponenteInput, CatalogoComponentesResponse, ComponenteCatalogoItem, ExhibicionComponenteItem } from '../../types/index.js';

export interface AgregarComponenteModalProps {
    exhibicionId: number;
    tipo: 1 | 2;
    onClose: () => void;
    onAgregado: (tipo: 1 | 2, item: ExhibicionComponenteItem) => void;
}

// Mismo patrón visual que DialogContext (modal-overlay-in/modal-content-in,
// SIATC_THEME.TOKENS.MODAL_OVERLAY/COMPONENTS.MODAL_CONTENT) — sin cerrar
// al hacer click afuera, igual que ese modal.
export function AgregarComponenteModal({ exhibicionId, tipo, onClose, onAgregado }: AgregarComponenteModalProps) {
    const { t } = useTranslation();
    const [catalogo, setCatalogo] = useState<ComponenteCatalogoItem[] | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [codigoSeleccionado, setCodigoSeleccionado] = useState('');
    const [cantidad, setCantidad] = useState('1');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        apiClient.get<CatalogoComponentesResponse>('/exhibiciones/catalogo-componentes')
            .then(data => setCatalogo(tipo === 1 ? data.productos : data.carcasas))
            .catch(() => setError(t('exhibicion_detalle.error_cargar_catalogo')));
    }, [tipo, t]);

    const filtrados = useMemo(() => {
        if (!catalogo) return [];
        const q = busqueda.trim().toLowerCase();
        const base = q ? catalogo.filter(c => c.nombre.toLowerCase().includes(q)) : catalogo;
        return base.slice(0, 50);
    }, [catalogo, busqueda]);

    const cantidadNum = Number(cantidad);
    const puedeGuardar = codigoSeleccionado !== '' && Number.isInteger(cantidadNum) && cantidadNum > 0 && !guardando;

    const handleAgregar = async () => {
        setGuardando(true);
        setError('');
        try {
            const item = await apiClient.post<ExhibicionComponenteItem>(`/exhibiciones/${exhibicionId}/componentes`, {
                tipo, codigoProducto: codigoSeleccionado, cantidad: cantidadNum,
            } satisfies AgregarComponenteInput);
            onAgregado(tipo, item);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('exhibicion_detalle.error_agregar_componente'));
        } finally {
            setGuardando(false);
        }
    };

    const titulo = tipo === 1 ? t('exhibicion_detalle.accion_agregar_producto') : t('exhibicion_detalle.accion_agregar_carcasa');

    return (
        <div className={cn('fixed inset-0 z-[150] flex items-center justify-center p-4 modal-overlay-in', SIATC_THEME.TOKENS.MODAL_OVERLAY)}>
            <div className={SIATC_THEME.COMPONENTS.MODAL_CONTENT + ' w-full max-w-sm modal-content-in'}>
                <div className="px-6 py-5 border-b border-cb-border flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider">{titulo}</h3>
                    <button type="button" onClick={onClose} className="text-cb-text-secondary hover:text-primary cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cb-neutral">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder={t('exhibicion_detalle.buscar_producto_placeholder')}
                            className="block w-full pl-9 pr-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl outline-none text-sm"
                        />
                    </div>

                    {!catalogo && !error && (
                        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                    )}

                    {catalogo && (
                        <div className="max-h-48 overflow-y-auto custom-scrollbar border border-cb-border rounded-xl divide-y divide-cb-border">
                            {filtrados.length === 0 && (
                                <p className="px-3 py-4 text-sm text-cb-text-secondary text-center">{t('exhibicion_detalle.sin_resultados')}</p>
                            )}
                            {filtrados.map(c => (
                                <button
                                    key={c.codigo}
                                    type="button"
                                    onClick={() => setCodigoSeleccionado(c.codigo)}
                                    className={cn(
                                        'w-full text-left px-3 py-2 text-xs cursor-pointer transition-colors duration-100',
                                        codigoSeleccionado === c.codigo ? 'bg-primary/10 text-primary font-bold' : 'text-cb-text-primary hover:bg-muted'
                                    )}
                                >
                                    {c.nombre}
                                </button>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5">
                            {t('exhibicion_detalle.columna_cantidad')}
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            className="w-24 px-3 py-2 border border-cb-border rounded-xl text-sm outline-none"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className={cn(SIATC_THEME.FORM.FOOTER, 'mt-0')}>
                        <button type="button" onClick={onClose} className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, 'flex-1 cursor-pointer')}>
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleAgregar}
                            disabled={!puedeGuardar}
                            className={cn(SIATC_THEME.COMPONENTS.BUTTON_PRIMARY, 'flex-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed')}
                        >
                            {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('exhibicion_detalle.accion_agregar')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AgregarComponenteModal;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibiciones/AgregarComponenteModal.tsx
git commit -m "feat: AgregarComponenteModal — search + quantity picker"
```

---

## Task 12: Wire "Agregar" into `DetalleComponentesTab`

**Files:**
- Modify: `src/components/exhibiciones/DetalleComponentesTab.tsx`

**Interfaces:**
- Consumes: `AgregarComponenteModal` (Task 11).
- Produces: `DetalleComponentesTabProps` grows to `{ exhibicionId: number; carcasas: ExhibicionComponenteItem[]; productos: ExhibicionComponenteItem[]; onComponenteAgregado: (tipo: 1 | 2, item: ExhibicionComponenteItem) => void }`. Task 14 (`ExhibicionDetallePage`) passes the new props.

- [ ] **Step 1: Add the buttons, modal state, and new props**

In `src/components/exhibiciones/DetalleComponentesTab.tsx`, replace:

```tsx
import { useTranslation } from 'react-i18next';
import type { ExhibicionComponenteItem } from '../../types/index.js';

export interface DetalleComponentesTabProps {
    carcasas: ExhibicionComponenteItem[];
    productos: ExhibicionComponenteItem[];
}
```

with:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { ExhibicionComponenteItem } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { AgregarComponenteModal } from './AgregarComponenteModal.js';

export interface DetalleComponentesTabProps {
    exhibicionId: number;
    carcasas: ExhibicionComponenteItem[];
    productos: ExhibicionComponenteItem[];
    onComponenteAgregado: (tipo: 1 | 2, item: ExhibicionComponenteItem) => void;
}
```

Replace:

```tsx
export function DetalleComponentesTab({ carcasas, productos }: DetalleComponentesTabProps) {
    const { t } = useTranslation();
    return (
        <div className="space-y-4">
            <Grupo titulo={t('exhibicion_detalle.tab_carcasas')} items={carcasas} columnaCantidad={t('exhibicion_detalle.columna_cantidad')} />
            <Grupo titulo={t('exhibicion_detalle.tab_productos')} items={productos} columnaCantidad={t('exhibicion_detalle.columna_cantidad')} />
        </div>
    );
}
```

with:

```tsx
export function DetalleComponentesTab({ exhibicionId, carcasas, productos, onComponenteAgregado }: DetalleComponentesTabProps) {
    const { t } = useTranslation();
    const [modalTipo, setModalTipo] = useState<1 | 2 | null>(null);

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

            <Grupo titulo={t('exhibicion_detalle.tab_carcasas')} items={carcasas} columnaCantidad={t('exhibicion_detalle.columna_cantidad')} />
            <Grupo titulo={t('exhibicion_detalle.tab_productos')} items={productos} columnaCantidad={t('exhibicion_detalle.columna_cantidad')} />

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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: errors expected at this point — `ExhibicionDetallePage.tsx` (Task 14) hasn't been updated yet to pass the new required props. This is fine; Task 14 fixes it. Confirm the error is specifically about missing `exhibicionId`/`onComponenteAgregado` props at the `<DetalleComponentesTab>` call site in `ExhibicionDetallePage.tsx`, not something else.

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibiciones/DetalleComponentesTab.tsx
git commit -m "feat: DetalleComponentesTab — Agregar Carcasa/Producto buttons"
```

---

## Task 13: Wire "Agregar Foto" into `DetalleFotosTab`

**Files:**
- Modify: `src/components/exhibiciones/DetalleFotosTab.tsx`

**Interfaces:**
- Produces: `DetalleFotosTabProps` grows to `{ exhibicionId: number; fotos: ExhibicionFoto[]; onFotoAgregada: (foto: ExhibicionFoto) => void }`. Task 14 passes the new props.

- [ ] **Step 1: Add the upload button, file handling, and new props**

In `src/components/exhibiciones/DetalleFotosTab.tsx`, replace the entire file with:

```tsx
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff, Plus, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';
import type { AgregarFotoInput, ExhibicionFoto } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';

export interface DetalleFotosTabProps {
    exhibicionId: number;
    fotos: ExhibicionFoto[];
    onFotoAgregada: (foto: ExhibicionFoto) => void;
}

// Una URL de foto vencida (SAS expirado) o un blob borrado no debe romper
// el layout de la grilla — se reemplaza por un placeholder en vez de dejar
// un ícono roto del navegador.
function Foto({ url, className }: { url: string; className: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) {
        return (
            <div className={`${className} flex items-center justify-center bg-muted text-cb-text-secondary`}>
                <ImageOff className="w-6 h-6" />
            </div>
        );
    }
    return <img src={url} onError={() => setFailed(true)} className={`${className} object-cover`} alt="" />;
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

export function DetalleFotosTab({ exhibicionId, fotos, onFotoAgregada }: DetalleFotosTabProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [subiendo, setSubiendo] = useState(false);
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

    return (
        <div className="space-y-4">
            <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleArchivoSeleccionado} className="hidden" />
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
                            <Foto url={principal.url} className="w-full max-w-xs rounded-xl border border-cb-border" />
                        </div>
                    )}
                    {resto.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-1.5">{t('exhibicion_detalle.foto_componente')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {resto.map(foto => (
                                    <Foto key={foto.id} url={foto.url} className="aspect-square rounded-xl border border-cb-border" />
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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: errors expected here too (same reason as Task 12 — `ExhibicionDetallePage.tsx` doesn't pass the new props yet; fixed in Task 14).

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibiciones/DetalleFotosTab.tsx
git commit -m "feat: DetalleFotosTab — real photo upload via file picker"
```

---

## Task 14: Wire the new props into `ExhibicionDetallePage`

**Files:**
- Modify: `src/pages/ExhibicionDetallePage.tsx`

**Interfaces:**
- Consumes: `DetalleComponentesTabProps` (Task 12), `DetalleFotosTabProps` (Task 13).

- [ ] **Step 1: Add the two handlers and update the tab render calls**

In `src/pages/ExhibicionDetallePage.tsx`, replace:

```tsx
import type { ExhibicionDetalle } from '../types/index.js';
```

with:

```tsx
import type { ExhibicionDetalle, ExhibicionComponenteItem, ExhibicionFoto } from '../types/index.js';
```

Replace:

```tsx
    const handleAprobado = (estadoId: 1 | 2) => {
        setDetalle(prev => (prev ? { ...prev, estadoId, canAprobar: estadoId === 1 } : prev));
    };
```

with:

```tsx
    const handleAprobado = (estadoId: 1 | 2) => {
        setDetalle(prev => (prev ? { ...prev, estadoId, canAprobar: estadoId === 1 } : prev));
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

    const handleFotoAgregada = (foto: ExhibicionFoto) => {
        setDetalle(prev => (prev ? { ...prev, fotos: [...prev.fotos, foto] } : prev));
    };
```

Replace:

```tsx
                            {tab === 'principal' && <DetallePrincipalTab detalle={detalle} onAprobado={handleAprobado} />}
                            {tab === 'componentes' && <DetalleComponentesTab carcasas={detalle.componentes.carcasas} productos={detalle.componentes.productos} />}
                            {tab === 'fotos' && <DetalleFotosTab fotos={detalle.fotos} />}
```

with:

```tsx
                            {tab === 'principal' && <DetallePrincipalTab detalle={detalle} onAprobado={handleAprobado} />}
                            {tab === 'componentes' && (
                                <DetalleComponentesTab
                                    exhibicionId={detalle.id}
                                    carcasas={detalle.componentes.carcasas}
                                    productos={detalle.componentes.productos}
                                    onComponenteAgregado={handleComponenteAgregado}
                                />
                            )}
                            {tab === 'fotos' && (
                                <DetalleFotosTab exhibicionId={detalle.id} fotos={detalle.fotos} onFotoAgregada={handleFotoAgregada} />
                            )}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors — this resolves the prop-mismatch errors expected at the end of Tasks 12 and 13.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ExhibicionDetallePage.tsx
git commit -m "feat: wire Agregar componente/foto handlers into ExhibicionDetallePage"
```

---

## Task 15: i18n keys

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Produces: `exhibiciones_lista.accion_nueva` and every new `exhibicion_crear.*` / `exhibicion_detalle.*` key referenced by Tasks 9-13.

- [ ] **Step 1: Add the Spanish keys**

In `public/locales/es.json`:

Add `"accion_nueva": "Nueva",` right after `"acciones": "Acciones",` inside the `exhibiciones_lista` block.

Add these new keys inside the existing `exhibicion_detalle` block, right after `"foto_componente": "Foto por componente"` (remember the trailing comma on that line once these follow it):

```json
        "accion_agregar_carcasa": "Agregar Carcasa",
        "accion_agregar_producto": "Agregar Producto",
        "accion_agregar_foto": "Agregar Foto",
        "accion_agregar": "Agregar",
        "buscar_producto_placeholder": "Buscar...",
        "sin_resultados": "Sin resultados.",
        "error_cargar_catalogo": "No se pudo cargar el catálogo.",
        "error_agregar_componente": "No se pudo agregar el componente.",
        "error_agregar_foto": "No se pudo subir la foto."
```

Add a new top-level `"exhibicion_crear"` key (as a sibling of `"exhibicion_detalle"`, before the final closing `}` — remember the trailing comma after `"exhibicion_detalle": { ... }`'s closing `}`):

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
    }
```

- [ ] **Step 2: Add the English keys**

In `public/locales/en.json`, add the equivalent keys in the same positions:

`exhibiciones_lista.accion_nueva`: `"New"`.

Inside `exhibicion_detalle`:

```json
        "accion_agregar_carcasa": "Add Frame",
        "accion_agregar_producto": "Add Product",
        "accion_agregar_foto": "Add Photo",
        "accion_agregar": "Add",
        "buscar_producto_placeholder": "Search...",
        "sin_resultados": "No results.",
        "error_cargar_catalogo": "Couldn't load the catalog.",
        "error_agregar_componente": "Couldn't add the component.",
        "error_agregar_foto": "Couldn't upload the photo."
```

New top-level `exhibicion_crear`:

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
    }
```

- [ ] **Step 3: Verify both files are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/es.json'))" && node -e "JSON.parse(require('fs').readFileSync('public/locales/en.json'))" && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add public/locales/es.json public/locales/en.json
git commit -m "feat: i18n keys for creating an exhibición (es/en)"
```

---

## Task 16: Full verification (tests, build, live browser check, cleanup)

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all test files pass, including the 2 new suites from Tasks 1 and 2 (8 + 5 = 13 new tests on top of the existing 73 → 86 total).

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` both succeed with no errors.

- [ ] **Step 3: Manual end-to-end check against the real database and Blob Storage**

Start backend + frontend locally (inline env vars including the read+write Blob SAS from Task 7 — never written to a file):

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" BLOB_CONTAINER_URL="https://soleblob1.blob.core.windows.net/exhibiciones" BLOB_SAS_TOKEN="$AZURE_BLOB_SAS_RW" PORT=3000 npx tsx server/index.ts &
npx vite --port 5173 &
```

In the browser:
1. Log in, go to "Exhibiciones", click the new "Nueva" button — confirm it navigates to `/exhibiciones/nueva`.
2. Pick a Tienda, confirm Sucursal's options update to only that tienda's sucursales, and that "Guardar" stays disabled until Tienda + Sucursal + Nombre + Tipo are all filled.
3. Fill everything (leave Piso/Detalle empty to confirm they're truly optional), click "Guardar" — confirm it navigates to `/exhibiciones/<new id>` showing the just-created exhibición (with its auto-generated N°, e.g. `EXB00007XX`).
4. On the Componentes tab, click "Agregar Producto" — confirm the modal loads the catalog, search narrows the list, selecting one + a quantity + "Agregar" adds it to the Productos table without a page reload, and the modal closes.
5. Repeat for "Agregar Carcasa".
6. On the Fotos tab, click "Agregar Foto", pick a real image file from disk — confirm it uploads (loading spinner, then appears as "Foto cuerpo entero" since it's the first one), then upload a second photo and confirm it appears under "Foto por componente" instead of replacing the first.
7. Reload the page (`F5`) — confirm everything just added (componentes, fotos) persisted (came back from a fresh `GET /:id`, not just client-side state).
8. Check the browser console for errors.

- [ ] **Step 4: Clean up the test data**

Every manual verification step in this plan created real rows in production (Tasks 4, 6, 7, and this task's own end-to-end pass). There is no delete endpoint (out of scope). Using the ids noted along the way, mark them all Anulado directly:

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" node -e "
const sql = require('mssql');
(async () => {
  const pool = await sql.connect({ server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, options: { encrypt: true, trustServerCertificate: false } });
  await pool.request().query(\`UPDATE EXHIBICION.TB_EXHIBICION SET IN_estado_id = 0 WHERE IN_exhibicion_id IN (/* pega aquí los ids de prueba, separados por coma */)\`);
  console.log('listo');
  await pool.close();
})();
"
```

Confirm afterward that `GET /api/exhibiciones` (the list) no longer shows these test rows.

- [ ] **Step 5: Stop local servers**

```bash
kill %1 %2
```

- [ ] **Step 6: Final commit if anything was adjusted during manual verification**

If Step 3 surfaced anything requiring a fix, fix it, re-run Steps 1-2, and commit with a message describing what was found and fixed.
