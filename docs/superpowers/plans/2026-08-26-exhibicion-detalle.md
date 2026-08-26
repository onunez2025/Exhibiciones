# Exhibición — Vista Detalle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real "Ver" detail page for a single exhibición (3 tabs: Principal / Componentes / Fotos, with a working "Revisado" approve action), replacing the "Próximamente" dialog currently opened by the ⋮ menu's "Ver" option.

**Architecture:** One combined `GET /api/exhibiciones/:id` backend endpoint returns principal fields + grouped componentes + resolved foto URLs in a single response (tabs are a pure client-side switch over already-fetched data). A separate `POST /api/exhibiciones/:id/aprobar` does the one supported state transition (1→2), guarded atomically in SQL. New React page `ExhibicionDetallePage` at route `/exhibiciones/:id`, composed of three small tab components.

**Tech Stack:** Express + TypeScript (`tsx`) · `mssql` · React 19 + `react-i18next` + `react-router-dom` v7 · existing `apiClient`/`SIATC_THEME`/`useDialog` conventions.

**Spec:** [docs/superpowers/specs/2026-08-26-exhibicion-detalle-design.md](../specs/2026-08-26-exhibicion-detalle-design.md)

## Global Constraints

- `GET /api/exhibiciones/:id` returns principal + componentes + fotos in **one** response — no separate per-tab endpoints; tab switching must not trigger a new fetch.
- `LEFT JOIN` (not `INNER JOIN` like the old procs) to `dbo.PV_TABLA` and to `EXHIBICION.WEB_MARKETING_PRODUCTOS` — a missing catalog/product match must make a field `null`, never make the row disappear.
- `POST /api/exhibiciones/:id/aprobar` only ever performs the 1→2 transition, guarded **atomically** (`UPDATE ... WHERE IN_estado_id = 1`, checking `rowsAffected`) — never trust a client-supplied estado, never read-then-write non-atomically.
- Two new env vars, `BLOB_CONTAINER_URL` and `BLOB_SAS_TOKEN` — real values are **never** written into any file that gets committed to git (same rule already followed for `DB_PASSWORD`).
- No editing of exhibición fields, no photo upload, no add/remove of componentes, no "Anular" — explicitly out of scope this round (see spec).
- Every new user-facing string goes through `react-i18next` — new keys live under `exhibicion_detalle.*` in both `public/locales/es.json` and `en.json`; reuse the existing `exhibiciones_lista.campo_tienda` / `campo_sucursal` / `campo_tipo` / `estado_pendiente` / `estado_aprobado` keys rather than duplicating them.
- Follow existing conventions: `SIATC_THEME` tokens for layout/typography/buttons, `safeError()`/`cleanEnv()` on the backend, `apiClient` on the frontend, `navigate(path, { viewTransition: true })` for programmatic navigation (matches `LoginPage.tsx`/`Sidebar.tsx`).

---

## Task 1: `mapComponentesRows` — pure componentes grouping function

**Files:**
- Create: `server/lib/exhibicionComponentes.ts`
- Test: `server/lib/exhibicionComponentes.test.ts`

**Interfaces:**
- Produces: `ComponenteRow` (`{ id: number; tipo: number; nombre: string | null; cantidad: number }`), `ComponenteItem` (`{ id: number; nombre: string | null; cantidad: number }`), `ComponentesAgrupados` (`{ carcasas: ComponenteItem[]; productos: ComponenteItem[] }`), and `mapComponentesRows(rows: ComponenteRow[]): ComponentesAgrupados`. Task 3 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/exhibicionComponentes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapComponentesRows } from './exhibicionComponentes.js';

describe('mapComponentesRows', () => {
    it('returns empty carcasas/productos for an empty input', () => {
        expect(mapComponentesRows([])).toEqual({ carcasas: [], productos: [] });
    });

    it('groups tipo=1 rows into productos and tipo=2 rows into carcasas', () => {
        const result = mapComponentesRows([
            { id: 1, tipo: 1, nombre: 'Campana A', cantidad: 2 },
            { id: 2, tipo: 2, nombre: 'Carcasa X', cantidad: 1 },
            { id: 3, tipo: 1, nombre: 'Campana B', cantidad: 3 },
        ]);
        expect(result.productos).toEqual([
            { id: 1, nombre: 'Campana A', cantidad: 2 },
            { id: 3, nombre: 'Campana B', cantidad: 3 },
        ]);
        expect(result.carcasas).toEqual([
            { id: 2, nombre: 'Carcasa X', cantidad: 1 },
        ]);
    });

    it('preserves the input order within each group', () => {
        const result = mapComponentesRows([
            { id: 5, tipo: 1, nombre: 'Z', cantidad: 1 },
            { id: 6, tipo: 1, nombre: 'A', cantidad: 1 },
        ]);
        expect(result.productos.map(p => p.nombre)).toEqual(['Z', 'A']);
    });

    it('ignores rows with an unrecognized tipo instead of throwing', () => {
        const result = mapComponentesRows([
            { id: 7, tipo: 3, nombre: 'Raro', cantidad: 1 },
        ]);
        expect(result).toEqual({ carcasas: [], productos: [] });
    });

    it('keeps nombre as null when the product catalog has no match', () => {
        const result = mapComponentesRows([
            { id: 8, tipo: 1, nombre: null, cantidad: 1 },
        ]);
        expect(result.productos).toEqual([{ id: 8, nombre: null, cantidad: 1 }]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/exhibicionComponentes.test.ts`
Expected: FAIL — `Cannot find module './exhibicionComponentes.js'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `server/lib/exhibicionComponentes.ts`:

```ts
export interface ComponenteRow {
    id: number;
    tipo: number;
    nombre: string | null;
    cantidad: number;
}

export interface ComponenteItem {
    id: number;
    nombre: string | null;
    cantidad: number;
}

export interface ComponentesAgrupados {
    carcasas: ComponenteItem[];
    productos: ComponenteItem[];
}

// IN_tipo: 1 = Producto, 2 = Carcasa — confirmado leyendo el JOIN del proc
// viejo EXHIBICION.PROC_OBTENER_COMPONENTE (tipo 1 -> WEB_MARKETING_PRODUCTOS
// con VC_tipo='PRD', tipo 2 -> VC_tipo='CAR'). Puro, sin tocar la base de
// datos, para poder probarlo aislado (mismo patrón que exhibicionesFilter.ts).
export function mapComponentesRows(rows: ComponenteRow[]): ComponentesAgrupados {
    const carcasas: ComponenteItem[] = [];
    const productos: ComponenteItem[] = [];
    for (const row of rows) {
        const item: ComponenteItem = { id: row.id, nombre: row.nombre, cantidad: row.cantidad };
        if (row.tipo === 1) productos.push(item);
        else if (row.tipo === 2) carcasas.push(item);
        // tipo distinto de 1/2 no debería ocurrir (ver proc viejo), pero se
        // ignora en vez de romper toda la respuesta si aparece.
    }
    return { carcasas, productos };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/exhibicionComponentes.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/exhibicionComponentes.ts server/lib/exhibicionComponentes.test.ts
git commit -m "feat: mapComponentesRows — groups exhibición componentes into carcasas/productos"
```

---

## Task 2: `buildFotoUrl` — pure Blob Storage URL builder

**Files:**
- Create: `server/lib/exhibicionFotos.ts`
- Test: `server/lib/exhibicionFotos.test.ts`

**Interfaces:**
- Produces: `buildFotoUrl(containerUrl: string, sasToken: string, archivoNombre: string): string`. Task 3 imports this.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/exhibicionFotos.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildFotoUrl } from './exhibicionFotos.js';

describe('buildFotoUrl', () => {
    it('joins container URL, filename, and SAS token', () => {
        const url = buildFotoUrl(
            'https://soleblob1.blob.core.windows.net/exhibiciones',
            'sp=r&se=2027-01-01T00:00:00Z&sig=abc',
            'ddd35740-30c2-4fa5-970e-c0a28a89d92d.jpg'
        );
        expect(url).toBe(
            'https://soleblob1.blob.core.windows.net/exhibiciones/ddd35740-30c2-4fa5-970e-c0a28a89d92d.jpg?sp=r&se=2027-01-01T00:00:00Z&sig=abc'
        );
    });

    it('strips a trailing slash from the container URL', () => {
        const url = buildFotoUrl('https://acc.blob.core.windows.net/cont/', 'sig=abc', 'a.jpg');
        expect(url).toBe('https://acc.blob.core.windows.net/cont/a.jpg?sig=abc');
    });

    it('strips a leading "?" from the SAS token if present', () => {
        const url = buildFotoUrl('https://acc.blob.core.windows.net/cont', '?sig=abc', 'a.jpg');
        expect(url).toBe('https://acc.blob.core.windows.net/cont/a.jpg?sig=abc');
    });

    it('omits the "?" entirely when the SAS token is empty (local/dev without one configured)', () => {
        const url = buildFotoUrl('https://acc.blob.core.windows.net/cont', '', 'a.jpg');
        expect(url).toBe('https://acc.blob.core.windows.net/cont/a.jpg');
    });

    it('URL-encodes special characters in the filename', () => {
        const url = buildFotoUrl('https://acc.blob.core.windows.net/cont', 'sig=abc', 'foto con espacio.jpg');
        expect(url).toBe('https://acc.blob.core.windows.net/cont/foto%20con%20espacio.jpg?sig=abc');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/exhibicionFotos.test.ts`
Expected: FAIL — `Cannot find module './exhibicionFotos.js'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/exhibicionFotos.ts`:

```ts
// Arma la URL pública de una foto de exhibición en Azure Blob Storage. Puro
// — sin red — para poder probarlo aislado. Verificado en vivo contra el
// storage real: cuenta soleblob1, contenedor "exhibiciones" (no
// "exhibicionesv2", que también existe pero es otro contenedor), blobs
// planos en la raíz nombrados exactamente por VC_archivo_nombre.
export function buildFotoUrl(containerUrl: string, sasToken: string, archivoNombre: string): string {
    const base = containerUrl.replace(/\/+$/, '');
    const sas = sasToken.replace(/^\?/, '');
    const nombreCodificado = encodeURIComponent(archivoNombre);
    return sas ? `${base}/${nombreCodificado}?${sas}` : `${base}/${nombreCodificado}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/exhibicionFotos.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/exhibicionFotos.ts server/lib/exhibicionFotos.test.ts
git commit -m "feat: buildFotoUrl — Azure Blob Storage URL builder for exhibición fotos"
```

---

## Task 3: `GET /api/exhibiciones/:id` — combined detail endpoint

**Files:**
- Modify: `server/routes/exhibiciones.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `mapComponentesRows` (Task 1), `buildFotoUrl` (Task 2), `cleanEnv`/`safeError` from `server/lib/security.js` (already imports `safeError` — add `cleanEnv` to that import).
- Produces: `GET /:id` → `{ id, nroExhibicion, nombre, clienteNombre, sucursalNombre, piso, tipoNombre, pisoDetalleNombre, estadoId, fechaCrea, canAprobar, componentes: { carcasas, productos }, fotos: [{id, url, esFotoPrincipal}] }` or 404. Task 5 (frontend types) mirrors this shape exactly.

- [ ] **Step 1: Add imports**

In `server/routes/exhibiciones.ts`, replace:

```ts
import { safeError } from '../lib/security.js';
```

with:

```ts
import { safeError, cleanEnv } from '../lib/security.js';
```

Add below the existing `import type { ExhibicionesQueryParams, QueryParam } from '../lib/exhibicionesFilter.js';` line:

```ts
import { mapComponentesRows } from '../lib/exhibicionComponentes.js';
import { buildFotoUrl } from '../lib/exhibicionFotos.js';
```

- [ ] **Step 2: Add the endpoint**

Add this route above `export default router;` (after the existing `GET /` list route):

```ts
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();

        // Sin filtro de estado acá a propósito — a diferencia de la lista
        // (que oculta estado 0/Anulado), el detalle es una vista de solo
        // lectura por id: no tiene sentido devolver 404 para un registro que
        // sí existe solo porque está anulado.
        const principalResult = await pool.request()
            .input('id', sql.BigInt, id)
            .query(`
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
                LEFT JOIN dbo.PV_TABLA ET
                    ON ET.VC_tabla = 'EXHIBICION_TIPO' AND ET.CH_activo = '1' AND ET.IN_id = E.IN_exhibicion_tipo_id
                LEFT JOIN dbo.PV_TABLA EPD
                    ON EPD.VC_tabla = 'EXHIBICION_PISO_DETALLE' AND EPD.CH_activo = '1' AND EPD.IN_id = E.IN_piso_detalle_id
                WHERE E.IN_exhibicion_id = @id
            `);

        const principalRow = principalResult.recordset[0];
        if (!principalRow) {
            res.status(404).json({ error: 'Exhibición no encontrada.' });
            return;
        }

        const componentesResult = await pool.request()
            .input('id', sql.BigInt, id)
            .query(`
                SELECT
                    C.IN_exhibicion_componente_id as id,
                    C.IN_tipo as tipo,
                    P.VC_articulo_nombre2 as nombre,
                    C.IN_cantidad as cantidad
                FROM EXHIBICION.TB_EXHIBICION_COMPONENTE C
                LEFT JOIN EXHIBICION.WEB_MARKETING_PRODUCTOS P
                    ON P.VC_articulo_codigo = C.VC_codigo_producto
                    AND P.VC_tipo = CASE C.IN_tipo WHEN 1 THEN 'PRD' WHEN 2 THEN 'CAR' END
                WHERE C.IN_exhibicion_id = @id AND C.IN_estado = 1
                ORDER BY nombre
            `);

        const fotosResult = await pool.request()
            .input('id', sql.BigInt, id)
            .query(`
                SELECT
                    IN_exhibicion_foto_id as id,
                    VC_archivo_nombre as archivoNombre,
                    BI_es_foto_principal as esFotoPrincipal
                FROM EXHIBICION.TB_EXHIBICION_FOTO
                WHERE IN_exhibicion_id = @id AND IN_estado > 0
                ORDER BY BI_es_foto_principal DESC, IN_exhibicion_foto_id ASC
            `);

        const blobContainerUrl = cleanEnv('BLOB_CONTAINER_URL');
        const blobSasToken = cleanEnv('BLOB_SAS_TOKEN');

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
            fotos: fotosResult.recordset.map((f: { id: number; archivoNombre: string; esFotoPrincipal: boolean }) => ({
                id: f.id,
                url: buildFotoUrl(blobContainerUrl, blobSasToken, f.archivoNombre),
                esFotoPrincipal: f.esFotoPrincipal,
            })),
        });
    } catch (err: unknown) {
        console.error('[Exhibiciones] detalle error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 3: Add the new env vars to `.env.example`**

In `.env.example`, add this block after the existing `# ─── CORS ...` section:

```
# ─── Azure Blob Storage (fotos de exhibiciones) ────────────────────────────────
# BLOB_SAS_TOKEN es un SAS de solo lectura, larga duración, generado en Azure
# Portal para el contenedor "exhibiciones" (cuenta soleblob1) — nunca la
# cuenta/clave completa. Igual que DB_PASSWORD: nunca el valor real acá.
BLOB_CONTAINER_URL=https://soleblob1.blob.core.windows.net/exhibiciones
BLOB_SAS_TOKEN=REPLACE_WITH_REAL_SAS_TOKEN
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 5: Manual verification against the real database**

Start the backend locally (inline env vars, never written to a file — same pattern used throughout this project), including a temporary SAS token for this manual check only:

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" BLOB_CONTAINER_URL="https://soleblob1.blob.core.windows.net/exhibiciones" BLOB_SAS_TOKEN="$AZURE_BLOB_SAS" PORT=3000 npx tsx server/index.ts
```

In another terminal, log in and call the endpoint for a known exhibición id (e.g. `1205`, the one with photos found during brainstorming):

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"REPLACE_WITH_CURRENT_ADMIN_PASSWORD"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s http://localhost:3000/api/exhibiciones/1205 -H "Authorization: Bearer $TOKEN"
```

Expected: JSON with `nroExhibicion`, `componentes.productos` containing at least one item, and `fotos` containing a `url` that, opened in a browser, loads a real image. Also check a nonexistent id:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/exhibiciones/999999999 -H "Authorization: Bearer $TOKEN"
```

Expected: `404`.

- [ ] **Step 6: Commit**

```bash
git add server/routes/exhibiciones.ts .env.example
git commit -m "feat: GET /api/exhibiciones/:id — combined detail endpoint"
```

---

## Task 4: `POST /api/exhibiciones/:id/aprobar`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Produces: `POST /:id/aprobar` → `{ estadoId: 2 }` on success, 404 if not found, 409 if not currently estado 1.

- [ ] **Step 1: Add the endpoint**

Add this route above `export default router;` (after the `GET /:id` route added in Task 3):

```ts
router.post('/:id/aprobar', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();

        // UPDATE con guardia de estado en el mismo WHERE (no lectura previa
        // + escritura separada) — así dos aprobaciones concurrentes nunca
        // pueden pisarse: solo una puede matchear IN_estado_id = 1.
        const updateResult = await pool.request()
            .input('id', sql.BigInt, id)
            .input('usuario', sql.NVarChar(50), req.user?.username ?? 'system')
            .query(`
                UPDATE EXHIBICION.TB_EXHIBICION
                SET IN_estado_id = 2, VC_usuario_modi = @usuario, DT_fecha_modi = GETDATE()
                WHERE IN_exhibicion_id = @id AND IN_estado_id = 1
            `);

        if (updateResult.rowsAffected[0] === 0) {
            const existsResult = await pool.request()
                .input('id', sql.BigInt, id)
                .query('SELECT 1 FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
            if (existsResult.recordset.length === 0) {
                res.status(404).json({ error: 'Exhibición no encontrada.' });
            } else {
                res.status(409).json({ error: 'La exhibición ya no está pendiente de revisión.' });
            }
            return;
        }

        res.json({ estadoId: 2 });
    } catch (err: unknown) {
        console.error('[Exhibiciones] aprobar error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification against the real database**

With the backend still running from Task 3:

```bash
# Encuentra una exhibición con estadoId=1 primero (ej. via GET /api/exhibiciones?estado=1&pageSize=1)
curl -s -X POST http://localhost:3000/api/exhibiciones/<ID_PENDIENTE>/aprobar -H "Authorization: Bearer $TOKEN"
```

Expected: `{"estadoId":2}`. Then repeat the exact same call:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/exhibiciones/<ID_PENDIENTE>/aprobar -H "Authorization: Bearer $TOKEN"
```

Expected: `409` (already approved). **Importante:** este cambio de estado es real en la base de producción — usar un id de prueba del que se pueda avisar al usuario, o revertirlo manualmente después con una consulta directa si hace falta (`UPDATE EXHIBICION.TB_EXHIBICION SET IN_estado_id = 1 WHERE IN_exhibicion_id = <ID_PENDIENTE>`).

- [ ] **Step 4: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: POST /api/exhibiciones/:id/aprobar — approve a pending exhibición"
```

---

## Task 5: Frontend types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `ExhibicionComponenteItem`, `ExhibicionComponentesAgrupados`, `ExhibicionFoto`, `ExhibicionDetalle`, `AprobarExhibicionResponse`. Tasks 7-10 import these.

- [ ] **Step 1: Add the types**

Append to `src/types/index.ts` (after the existing `ExhibicionesFiltros` interface):

```ts
export interface ExhibicionComponenteItem {
    id: number;
    nombre: string | null;
    cantidad: number;
}

export interface ExhibicionComponentesAgrupados {
    carcasas: ExhibicionComponenteItem[];
    productos: ExhibicionComponenteItem[];
}

export interface ExhibicionFoto {
    id: number;
    url: string;
    esFotoPrincipal: boolean;
}

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

export interface AprobarExhibicionResponse {
    estadoId: 1 | 2;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: frontend types for the exhibición detail view"
```

---

## Task 6: Shared estado styling helper (+ refactor `ExhibicionCard`)

**Files:**
- Create: `src/utils/estadoExhibicion.ts`
- Test: `src/utils/estadoExhibicion.test.ts`
- Modify: `src/components/exhibiciones/ExhibicionCard.tsx`

**Interfaces:**
- Produces: `EstadoEstilo` (`{ badge: string; accent: string }`), `getEstadoEstilo(estadoId: number): EstadoEstilo`, `getEstadoLabelKey(estadoId: number): string` (an i18n key, or `''` if unknown). Task 7 (`DetallePrincipalTab`) uses both.

`ExhibicionCard.tsx` currently hardcodes this same badge/accent/label mapping inline — extracting it here means the list card and the new detail tab render an identical estado badge without duplicating the color logic.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/estadoExhibicion.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getEstadoEstilo, getEstadoLabelKey } from './estadoExhibicion.js';

describe('getEstadoEstilo', () => {
    it('returns the amber style for estado 1 (Pendiente)', () => {
        expect(getEstadoEstilo(1).accent).toBe('before:bg-amber-400');
    });

    it('returns the emerald style for estado 2 (Aprobado)', () => {
        expect(getEstadoEstilo(2).accent).toBe('before:bg-emerald-400');
    });

    it('returns a neutral fallback for an unrecognized estado', () => {
        expect(getEstadoEstilo(0)).toEqual({ badge: 'bg-muted text-cb-text-secondary border-cb-border', accent: 'before:bg-cb-border' });
        expect(getEstadoEstilo(99)).toEqual(getEstadoEstilo(0));
    });
});

describe('getEstadoLabelKey', () => {
    it('returns the pendiente key for estado 1', () => {
        expect(getEstadoLabelKey(1)).toBe('exhibiciones_lista.estado_pendiente');
    });

    it('returns the aprobado key for estado 2', () => {
        expect(getEstadoLabelKey(2)).toBe('exhibiciones_lista.estado_aprobado');
    });

    it('returns an empty string for an unrecognized estado', () => {
        expect(getEstadoLabelKey(0)).toBe('');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/estadoExhibicion.test.ts`
Expected: FAIL — `Cannot find module './estadoExhibicion.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/estadoExhibicion.ts`:

```ts
// Estados de una exhibición: 1 = Pendiente, 2 = Aprobado (0 = Anulado nunca
// llega hasta acá salvo acceso directo por URL a la vista de detalle). No
// hay catálogo real en la base para estos dos valores (ver spec de
// Exhibiciones-Lista) — son constantes de UI compartidas entre la tarjeta
// de la lista y la vista de detalle.
export interface EstadoEstilo {
    badge: string;
    accent: string;
}

const ESTADO_ESTILOS: Record<1 | 2, EstadoEstilo> = {
    1: { badge: 'bg-amber-500/15 text-amber-700 border-amber-400/30', accent: 'before:bg-amber-400' },
    2: { badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30', accent: 'before:bg-emerald-400' },
};

const ESTADO_ESTILO_FALLBACK: EstadoEstilo = { badge: 'bg-muted text-cb-text-secondary border-cb-border', accent: 'before:bg-cb-border' };

export function getEstadoEstilo(estadoId: number): EstadoEstilo {
    return estadoId === 1 || estadoId === 2 ? ESTADO_ESTILOS[estadoId] : ESTADO_ESTILO_FALLBACK;
}

// Devuelve la clave de i18n (namespace exhibiciones_lista, ya usado por la
// lista) o '' si el estado no es 1 ni 2 — quien llama decide el fallback
// visual ('—').
export function getEstadoLabelKey(estadoId: number): string {
    if (estadoId === 1) return 'exhibiciones_lista.estado_pendiente';
    if (estadoId === 2) return 'exhibiciones_lista.estado_aprobado';
    return '';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/estadoExhibicion.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Refactor `ExhibicionCard.tsx` to use the shared helper**

In `src/components/exhibiciones/ExhibicionCard.tsx`, replace:

```tsx
import type { Exhibicion } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';
```

with:

```tsx
import type { Exhibicion } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';
import { getEstadoEstilo, getEstadoLabelKey } from '../../utils/estadoExhibicion.js';
```

Replace:

```tsx
// Colores de estado semánticos (ámbar/verde) — no son "decoración", son la
// convención universal de pendiente/aprobado.
const ESTADO_STYLES: Record<1 | 2, { badge: string; accent: string }> = {
    1: { badge: 'bg-amber-500/15 text-amber-700 border-amber-400/30', accent: 'before:bg-amber-400' },
    2: { badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30', accent: 'before:bg-emerald-400' },
};
// Si el backend alguna vez trae un estado que no es 1 ni 2 (no hay
// constraint en la base que lo impida, ver spec), no queremos que se
// muestre como "Aprobado" por accidente — degradamos a un estilo neutro.
const FALLBACK_ESTADO_STYLE = { badge: 'bg-muted text-cb-text-secondary border-cb-border', accent: 'before:bg-cb-border' };
```

with nothing (delete these lines entirely — the logic now lives in `estadoExhibicion.ts`).

Replace:

```tsx
    const isKnownEstado = exhibicion.estadoId === 1 || exhibicion.estadoId === 2;
    const estadoStyle = isKnownEstado ? ESTADO_STYLES[exhibicion.estadoId] : FALLBACK_ESTADO_STYLE;
    const estadoLabel = exhibicion.estadoId === 1
        ? t('exhibiciones_lista.estado_pendiente')
        : exhibicion.estadoId === 2
            ? t('exhibiciones_lista.estado_aprobado')
            : '—';
```

with:

```tsx
    const estadoStyle = getEstadoEstilo(exhibicion.estadoId);
    const estadoLabelKey = getEstadoLabelKey(exhibicion.estadoId);
    const estadoLabel = estadoLabelKey ? t(estadoLabelKey) : '—';
```

Every other usage of `estadoStyle.accent` / `estadoStyle.badge` / `estadoLabel` in the file stays unchanged — same names, same shape.

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors, no "declared but never used" for the removed constants.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all tests still pass (this refactor changes no runtime behavior).

- [ ] **Step 8: Commit**

```bash
git add src/utils/estadoExhibicion.ts src/utils/estadoExhibicion.test.ts src/components/exhibiciones/ExhibicionCard.tsx
git commit -m "refactor: extract estado badge styling into a shared helper"
```

---

## Task 7: `DetallePrincipalTab` component

**Files:**
- Create: `src/components/exhibiciones/DetallePrincipalTab.tsx`

**Interfaces:**
- Consumes: `ExhibicionDetalle`, `AprobarExhibicionResponse` types (Task 5), `getEstadoEstilo`/`getEstadoLabelKey` (Task 6), `apiClient`, `SIATC_THEME`.
- Produces: `DetallePrincipalTab` component, props `{ detalle: ExhibicionDetalle; onAprobado: (estadoId: 1 | 2) => void }`. Task 10 (`ExhibicionDetallePage`) renders it and updates its own `detalle` state from `onAprobado`.

- [ ] **Step 1: Create the component**

Create `src/components/exhibiciones/DetallePrincipalTab.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { getEstadoEstilo, getEstadoLabelKey } from '../../utils/estadoExhibicion.js';
import { cn } from '../../utils/cn.js';
import type { ExhibicionDetalle, AprobarExhibicionResponse } from '../../types/index.js';

export interface DetallePrincipalTabProps {
    detalle: ExhibicionDetalle;
    onAprobado: (estadoId: 1 | 2) => void;
}

function Campo({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm text-cb-text-primary">{value}</p>
        </div>
    );
}

export function DetallePrincipalTab({ detalle, onAprobado }: DetallePrincipalTabProps) {
    const { t } = useTranslation();
    const [aprobando, setAprobando] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const estadoStyle = getEstadoEstilo(detalle.estadoId);
    const estadoLabelKey = getEstadoLabelKey(detalle.estadoId);

    const handleAprobar = async () => {
        setAprobando(true);
        setError('');
        try {
            const data = await apiClient.post<AprobarExhibicionResponse>(`/exhibiciones/${detalle.id}/aprobar`);
            setSuccess(true);
            onAprobado(data.estadoId);
        } catch (err) {
            // El backend manda un mensaje ya en español y seguro de mostrar
            // (409 "ya no está pendiente", o el genérico de safeError) — a
            // diferencia de la lista, acá sí se muestra err.message directo.
            setError(err instanceof Error ? err.message : t('exhibicion_detalle.error_aprobar'));
        } finally {
            setAprobando(false);
        }
    };

    return (
        <div className="space-y-4">
            <span className={cn('inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border', estadoStyle.badge)}>
                {estadoLabelKey ? t(estadoLabelKey) : '—'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label={t('exhibiciones_lista.campo_tienda')} value={detalle.clienteNombre} />
                <Campo label={t('exhibiciones_lista.campo_sucursal')} value={detalle.sucursalNombre} />
                <Campo label={t('exhibicion_detalle.campo_nombre')} value={detalle.nombre} />
                <Campo label={t('exhibiciones_lista.campo_tipo')} value={detalle.tipoNombre ?? '—'} />
                <Campo label={t('exhibicion_detalle.campo_piso')} value={detalle.piso ?? '—'} />
                <Campo label={t('exhibicion_detalle.campo_detalle_ubicacion')} value={detalle.pisoDetalleNombre ?? '—'} />
            </div>

            {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {t('exhibicion_detalle.aprobado_ok')}
                </div>
            )}

            {detalle.canAprobar && (
                <button
                    type="button"
                    onClick={handleAprobar}
                    disabled={aprobando}
                    className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'}
                >
                    {aprobando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {t('exhibicion_detalle.accion_revisado')}
                </button>
            )}
        </div>
    );
}

export default DetallePrincipalTab;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (missing i18n keys are not TypeScript errors — Task 11 adds them).

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibiciones/DetallePrincipalTab.tsx
git commit -m "feat: DetallePrincipalTab — principal tab with the real Revisado action"
```

---

## Task 8: `DetalleComponentesTab` component

**Files:**
- Create: `src/components/exhibiciones/DetalleComponentesTab.tsx`

**Interfaces:**
- Consumes: `ExhibicionComponenteItem` type (Task 5).
- Produces: `DetalleComponentesTab` component, props `{ carcasas: ExhibicionComponenteItem[]; productos: ExhibicionComponenteItem[] }`. Task 10 renders it with `detalle.componentes.carcasas` / `detalle.componentes.productos`.

- [ ] **Step 1: Create the component**

Create `src/components/exhibiciones/DetalleComponentesTab.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import type { ExhibicionComponenteItem } from '../../types/index.js';

export interface DetalleComponentesTabProps {
    carcasas: ExhibicionComponenteItem[];
    productos: ExhibicionComponenteItem[];
}

function Grupo({ titulo, items, columnaCantidad }: { titulo: string; items: ExhibicionComponenteItem[]; columnaCantidad: string }) {
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
                        <li key={item.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                            <span className="text-cb-text-primary">{item.nombre ?? '—'}</span>
                            <span className="font-bold text-cb-text-primary shrink-0 ml-3">{item.cantidad}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function DetalleComponentesTab({ carcasas, productos }: DetalleComponentesTabProps) {
    const { t } = useTranslation();
    return (
        <div className="space-y-4">
            <Grupo titulo={t('exhibicion_detalle.tab_carcasas')} items={carcasas} columnaCantidad={t('exhibicion_detalle.columna_cantidad')} />
            <Grupo titulo={t('exhibicion_detalle.tab_productos')} items={productos} columnaCantidad={t('exhibicion_detalle.columna_cantidad')} />
        </div>
    );
}

export default DetalleComponentesTab;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibiciones/DetalleComponentesTab.tsx
git commit -m "feat: DetalleComponentesTab — carcasas/productos tables"
```

---

## Task 9: `DetalleFotosTab` component

**Files:**
- Create: `src/components/exhibiciones/DetalleFotosTab.tsx`

**Interfaces:**
- Consumes: `ExhibicionFoto` type (Task 5).
- Produces: `DetalleFotosTab` component, props `{ fotos: ExhibicionFoto[] }`. Task 10 renders it with `detalle.fotos`.

- [ ] **Step 1: Create the component**

Create `src/components/exhibiciones/DetalleFotosTab.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import type { ExhibicionFoto } from '../../types/index.js';

export interface DetalleFotosTabProps {
    fotos: ExhibicionFoto[];
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

export function DetalleFotosTab({ fotos }: DetalleFotosTabProps) {
    const { t } = useTranslation();
    const principal = fotos.find(f => f.esFotoPrincipal);
    const resto = fotos.filter(f => !f.esFotoPrincipal);

    if (fotos.length === 0) {
        return <p className="text-sm text-cb-text-secondary text-center py-12">{t('exhibicion_detalle.sin_fotos')}</p>;
    }

    return (
        <div className="space-y-4">
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
        </div>
    );
}

export default DetalleFotosTab;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibiciones/DetalleFotosTab.tsx
git commit -m "feat: DetalleFotosTab — foto principal + grilla, con fallback si falla la carga"
```

---

## Task 10: `ExhibicionDetallePage` — orchestration

**Files:**
- Create: `src/pages/ExhibicionDetallePage.tsx`

**Interfaces:**
- Consumes: `DetallePrincipalTab` (Task 7), `DetalleComponentesTab` (Task 8), `DetalleFotosTab` (Task 9), `ExhibicionDetalle` type (Task 5), `apiClient`, `SIATC_THEME`, `useParams`/`useNavigate` from `react-router-dom`.
- Produces: `ExhibicionDetallePage` component (default export), no props — mounted on the `/exhibiciones/:id` route. Task 12 imports it.

- [ ] **Step 1: Create the page**

Create `src/pages/ExhibicionDetallePage.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { DetallePrincipalTab } from '../components/exhibiciones/DetallePrincipalTab.js';
import { DetalleComponentesTab } from '../components/exhibiciones/DetalleComponentesTab.js';
import { DetalleFotosTab } from '../components/exhibiciones/DetalleFotosTab.js';
import type { ExhibicionDetalle } from '../types/index.js';

type TabKey = 'principal' | 'componentes' | 'fotos';

export function ExhibicionDetallePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [tab, setTab] = useState<TabKey>('principal');
    const [detalle, setDetalle] = useState<ExhibicionDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await apiClient.get<ExhibicionDetalle>(`/exhibiciones/${id}`);
            setDetalle(data);
        } catch {
            setError(t('exhibicion_detalle.error_cargar'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => { cargar(); }, [cargar]);

    const handleAprobado = (estadoId: 1 | 2) => {
        setDetalle(prev => (prev ? { ...prev, estadoId, canAprobar: estadoId === 1 } : prev));
    };

    const volver = () => navigate('/exhibiciones', { viewTransition: true });

    const TABS: { key: TabKey; label: string }[] = [
        { key: 'principal', label: t('exhibicion_detalle.tab_principal') },
        { key: 'componentes', label: t('exhibicion_detalle.tab_componentes') },
        { key: 'fotos', label: t('exhibicion_detalle.tab_fotos') },
    ];

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    {/* Flecha "volver", no el hamburger de MobileMenuButton —
                        esta es una vista drill-down, no un módulo del menú. */}
                    <button
                        type="button"
                        onClick={volver}
                        className="p-2 -ml-2 text-muted-foreground hover:bg-white hover:text-primary rounded-xl transition-colors duration-150 active:scale-90 cursor-pointer"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{detalle?.nroExhibicion ?? t('exhibicion_detalle.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{detalle?.nombre ?? ''}</p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    {loading && (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex flex-col items-center gap-3 py-16">
                            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                            <button type="button" onClick={volver} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}>
                                {t('exhibicion_detalle.volver_lista')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && detalle && (
                        <>
                            <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
                                {TABS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setTab(key)}
                                        className={
                                            tab === key
                                                ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-card text-primary shadow-sm cursor-pointer'
                                                : 'px-3.5 py-1.5 rounded-lg text-xs font-bold text-cb-text-secondary hover:text-primary transition-colors duration-150 cursor-pointer'
                                        }
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {tab === 'principal' && <DetallePrincipalTab detalle={detalle} onAprobado={handleAprobado} />}
                            {tab === 'componentes' && <DetalleComponentesTab carcasas={detalle.componentes.carcasas} productos={detalle.componentes.productos} />}
                            {tab === 'fotos' && <DetalleFotosTab fotos={detalle.fotos} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExhibicionDetallePage;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ExhibicionDetallePage.tsx
git commit -m "feat: ExhibicionDetallePage — tabs, loading/error states, back navigation"
```

---

## Task 11: i18n keys

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Produces: every `exhibicion_detalle.*` key referenced by Tasks 7-10.

- [ ] **Step 1: Add the Spanish keys**

In `public/locales/es.json`, add a new top-level `"exhibicion_detalle"` key (as a sibling of `"exhibiciones_lista"`, before the final closing `}`— remember the trailing comma after `"exhibiciones_lista": { ... }`'s closing `}`):

```json
    "exhibicion_detalle": {
        "title": "Exhibición",
        "tab_principal": "Principal",
        "tab_componentes": "Componentes",
        "tab_fotos": "Fotos",
        "tab_carcasas": "Carcasas",
        "tab_productos": "Productos",
        "columna_cantidad": "Cantidad",
        "campo_nombre": "Nombre de exhibición",
        "campo_piso": "Piso",
        "campo_detalle_ubicacion": "Detalle",
        "accion_revisado": "Revisado",
        "aprobado_ok": "Se aprobó correctamente.",
        "error_aprobar": "No se pudo aprobar la exhibición.",
        "error_cargar": "No se pudo cargar la exhibición.",
        "volver_lista": "Volver a la lista",
        "sin_fotos": "No hay fotos registradas para esta exhibición.",
        "foto_principal": "Foto cuerpo entero",
        "foto_componente": "Foto por componente"
    }
```

- [ ] **Step 2: Add the English keys**

In `public/locales/en.json`, add the equivalent block in the same position:

```json
    "exhibicion_detalle": {
        "title": "Exhibit",
        "tab_principal": "Main",
        "tab_componentes": "Components",
        "tab_fotos": "Photos",
        "tab_carcasas": "Frames",
        "tab_productos": "Products",
        "columna_cantidad": "Quantity",
        "campo_nombre": "Exhibit name",
        "campo_piso": "Floor",
        "campo_detalle_ubicacion": "Detail",
        "accion_revisado": "Reviewed",
        "aprobado_ok": "Approved successfully.",
        "error_aprobar": "Couldn't approve the exhibit.",
        "error_cargar": "Couldn't load the exhibit.",
        "volver_lista": "Back to list",
        "sin_fotos": "No photos registered for this exhibit.",
        "foto_principal": "Full body photo",
        "foto_componente": "Photo by component"
    }
```

- [ ] **Step 3: Verify both files are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/es.json'))" && node -e "JSON.parse(require('fs').readFileSync('public/locales/en.json'))" && echo OK`
Expected: `OK` (no `SyntaxError`).

- [ ] **Step 4: Commit**

```bash
git add public/locales/es.json public/locales/en.json
git commit -m "feat: i18n keys for the exhibición detail view (es/en)"
```

---

## Task 12: Wire routing and the "Ver" action

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/ExhibicionesPage.tsx`

**Interfaces:**
- Consumes: `ExhibicionDetallePage` (Task 10).

- [ ] **Step 1: Add the route**

In `src/App.tsx`, replace:

```tsx
import { ExhibicionesPage } from './pages/ExhibicionesPage.js';
```

with:

```tsx
import { ExhibicionesPage } from './pages/ExhibicionesPage.js';
import { ExhibicionDetallePage } from './pages/ExhibicionDetallePage.js';
```

Replace:

```tsx
                                <Route path="/exhibiciones" element={<ExhibicionesPage />} />
```

with:

```tsx
                                <Route path="/exhibiciones" element={<ExhibicionesPage />} />
                                <Route path="/exhibiciones/:id" element={<ExhibicionDetallePage />} />
```

- [ ] **Step 2: Wire "Ver" to navigate instead of opening the dialog**

In `src/pages/ExhibicionesPage.tsx`, replace:

```tsx
import { Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useDialog } from '../context/DialogContext.js';
```

with:

```tsx
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useDialog } from '../context/DialogContext.js';
```

Replace:

```tsx
    const { t } = useTranslation();
    const { alert } = useDialog();
    const isDesktop = useMediaQuery('(min-width: 1024px)');
```

with:

```tsx
    const { t } = useTranslation();
    const { alert } = useDialog();
    const navigate = useNavigate();
    const isDesktop = useMediaQuery('(min-width: 1024px)');
```

Replace:

```tsx
    const handleAction = (action: 'ver' | 'checklist' | 'ticket') => {
        void action;
        alert(t('exhibiciones_lista.proximamente_titulo'), t('exhibiciones_lista.proximamente_mensaje'));
    };
```

with:

```tsx
    const handleAction = (action: 'ver' | 'checklist' | 'ticket', id: number) => {
        if (action === 'ver') {
            navigate(`/exhibiciones/${id}`, { viewTransition: true });
            return;
        }
        alert(t('exhibiciones_lista.proximamente_titulo'), t('exhibiciones_lista.proximamente_mensaje'));
    };
```

Replace:

```tsx
                        {items.map(item => (
                            <ExhibicionCard key={item.id} exhibicion={item} onAction={handleAction} />
                        ))}
```

with:

```tsx
                        {items.map(item => (
                            <ExhibicionCard key={item.id} exhibicion={item} onAction={(action) => handleAction(action, item.id)} />
                        ))}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/ExhibicionesPage.tsx
git commit -m "feat: wire /exhibiciones/:id route and the real 'Ver' navigation"
```

---

## Task 13: Full verification (tests, build, live browser check)

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all test files pass, including the 5 new suites from Tasks 1, 2, and 6 (5 + 5 + 6 = 16 new tests on top of the existing 57 → 73 total).

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` both succeed with no errors.

- [ ] **Step 3: Manual end-to-end check against the real database**

Start backend + frontend locally (inline env vars, including a temporary Blob SAS for this check — never written to a file):

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" BLOB_CONTAINER_URL="https://soleblob1.blob.core.windows.net/exhibiciones" BLOB_SAS_TOKEN="$AZURE_BLOB_SAS" PORT=3000 npx tsx server/index.ts &
npx vite --port 5173 &
```

In the browser (or via the Claude Browser tool):
1. Log in, go to "Exhibiciones", open the ⋮ menu on any card, click "Ver" — confirm it navigates to `/exhibiciones/<id>` (not the "Próximamente" dialog) and the header shows the real N° and nombre.
2. On the Principal tab, confirm Tienda/Sucursal/Tipo/Piso/Detalle match what the list showed, and the estado badge color matches the card's.
3. If the exhibición is Pendiente, confirm the "Revisado" button is visible; click it and confirm the badge flips to Aprobado, a success message appears, and the button disappears — without a full page reload.
4. Click "Revisado" is gone now — reload the page (`F5`) and confirm the approval persisted (estado still Aprobado after a fresh fetch).
5. Switch to Componentes — confirm Carcasas/Productos show real names and quantities (or "—" if a group is empty), matching the reference screenshots' shape.
6. Switch to Fotos — confirm the "Foto cuerpo entero" image actually loads (not a broken-image icon), and any additional photos appear in the grid.
7. Click the back arrow — confirm it returns to `/exhibiciones` with the list still in its previous scroll/filter state.
8. Navigate directly to a nonexistent id (e.g. `/exhibiciones/999999999`) — confirm the error state + "Volver a la lista" button appear instead of a crash.
9. Check the browser console for errors.

- [ ] **Step 4: Stop local servers**

```bash
kill %1 %2
```

- [ ] **Step 5: Final commit if anything was adjusted during manual verification**

If Step 3 surfaced anything requiring a fix, fix it, re-run Steps 1-2, and commit with a message describing what was found and fixed.
