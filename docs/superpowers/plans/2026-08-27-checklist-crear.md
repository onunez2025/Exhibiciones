# Checklist — Crear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Nuevo CheckList" — create a checklist (12 fixed items across 3 categories) tied to an existing exhibición, reachable from the "Checklist" option on each exhibición's kebab menu.

**Architecture:** Two new backend endpoints on the existing `server/routes/exhibiciones.ts` (a static catalog endpoint and a create endpoint that inserts a header + 12 detail rows inside one transaction), and one new frontend page that reuses the already-shipped exhibición-detail endpoint for read-only context (Tienda/Sucursal/Exhibición) plus the new catalog endpoint to render the 12 items.

**Tech Stack:** Express + TypeScript (`tsx`) · `mssql` · React 19 + `react-i18next` + `react-router-dom` v7 · existing `apiClient`/`SIATC_THEME` conventions.

**Spec:** [docs/superpowers/specs/2026-08-27-checklist-crear-design.md](../specs/2026-08-27-checklist-crear-design.md)

## Global Constraints

- Exactly 12 items, no more, no less — the catalog is `dbo.PV_TABLA` (`VC_tabla = 'EXHIBICION_VISUAL'`, `CH_activo = '1'`), grouped into 3 categories via `VC_tabla = 'EXHIBICION_VISUAL_TIPO'` (linked by `EXHIBICION_VISUAL.VC_filtro = EXHIBICION_VISUAL_TIPO.IN_id`).
- A "No Conforme" item requires a non-empty motivo, max 150 characters (`TB_CHECKLIST_DETALLE.VC_desconforme_motivo` is `VARCHAR(150)`) — validated server-side, not just relied on client-side.
- No photo, no "generar ticket" per item in this version — only Conforme/No Conforme + motivo.
- The checklist number (`IN_checklist_number`) is `YYYYMM` + a sequential within that month, guarded with `WITH (UPDLOCK, HOLDLOCK)` inside a transaction — two simultaneous creations in the same month must never produce the same number.
- The header (`TB_CHECKLIST`) and all 12 detail rows (`TB_CHECKLIST_DETALLE`) insert inside **one transaction** — never a checklist with fewer than 12 lines.
- No editing, no viewing, no approving an existing checklist in this plan — saving navigates straight back to `/exhibiciones/:id` (no checklist-detail page exists yet).
- Every new user-facing string goes through `react-i18next` under a new `checklist_crear.*` namespace — reuse nothing that doesn't already exist verbatim.
- Follow existing conventions: `SIATC_THEME` tokens, `apiClient`, `navigate(path, { viewTransition: true })`, `PAGE_SUBTITLE_VISIBLE` (not `PAGE_SUBTITLE`) for a subtitle that identifies the record rather than describing the page.
- After creating, the page does **not** show a confirmation dialog — it navigates directly back to `/exhibiciones/:id`, matching `ExhibicionCrearPage`'s own established behavior (no `useDialog().alert(...)` call anywhere in that flow either).

---

## Task 1: `agruparCatalogoChecklist` — pure catalog grouping

**Files:**
- Create: `server/lib/checklistCatalogo.ts`
- Test: `server/lib/checklistCatalogo.test.ts`

**Interfaces:**
- Produces: `VisualItemRow` (`{ visualId: number; nombre: string; tipoId: number }`), `VisualTipoRow` (`{ tipoId: number; tipoNombre: string }`), `ChecklistCatalogoItem` (`{ visualCodigo: string; nombre: string }`), `ChecklistCatalogoCategoria` (`{ tipoId: number; tipoNombre: string; items: ChecklistCatalogoItem[] }`), and `agruparCatalogoChecklist(itemsRows: VisualItemRow[], tiposRows: VisualTipoRow[]): ChecklistCatalogoCategoria[]`. Task 3 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/checklistCatalogo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { agruparCatalogoChecklist } from './checklistCatalogo.js';

describe('agruparCatalogoChecklist', () => {
    it('returns one entry per tipo, in tipo order', () => {
        const tipos = [{ tipoId: 1, tipoNombre: 'Visual Etiqueta' }, { tipoId: 2, tipoNombre: 'Visual Exhibiciones' }];
        const items = [
            { visualId: 5, nombre: 'Operativo', tipoId: 2 },
            { visualId: 1, nombre: 'Producto', tipoId: 1 },
        ];
        const result = agruparCatalogoChecklist(items, tipos);
        expect(result).toEqual([
            { tipoId: 1, tipoNombre: 'Visual Etiqueta', items: [{ visualCodigo: '1', nombre: 'Producto' }] },
            { tipoId: 2, tipoNombre: 'Visual Exhibiciones', items: [{ visualCodigo: '5', nombre: 'Operativo' }] },
        ]);
    });

    it('preserves item order within a category', () => {
        const tipos = [{ tipoId: 1, tipoNombre: 'Visual Etiqueta' }];
        const items = [
            { visualId: 1, nombre: 'Producto', tipoId: 1 },
            { visualId: 2, nombre: 'Atributo', tipoId: 1 },
            { visualId: 3, nombre: 'Faltantes', tipoId: 1 },
        ];
        const result = agruparCatalogoChecklist(items, tipos);
        expect(result[0].items.map(i => i.nombre)).toEqual(['Producto', 'Atributo', 'Faltantes']);
    });

    it('gives a category with no matching items an empty array, not a dropped category', () => {
        const tipos = [{ tipoId: 1, tipoNombre: 'Visual Etiqueta' }, { tipoId: 3, tipoNombre: 'Visual POP' }];
        const items = [{ visualId: 1, nombre: 'Producto', tipoId: 1 }];
        const result = agruparCatalogoChecklist(items, tipos);
        expect(result).toHaveLength(2);
        expect(result[1]).toEqual({ tipoId: 3, tipoNombre: 'Visual POP', items: [] });
    });

    it('converts visualId to a string visualCodigo', () => {
        const tipos = [{ tipoId: 1, tipoNombre: 'Visual Etiqueta' }];
        const items = [{ visualId: 12, nombre: 'Faltantes', tipoId: 1 }];
        const result = agruparCatalogoChecklist(items, tipos);
        expect(result[0].items[0].visualCodigo).toBe('12');
    });

    it('returns an empty array for empty tipos', () => {
        expect(agruparCatalogoChecklist([], [])).toEqual([]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/checklistCatalogo.test.ts`
Expected: FAIL — `Cannot find module './checklistCatalogo.js'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/checklistCatalogo.ts`:

```ts
export interface VisualItemRow {
    visualId: number;
    nombre: string;
    tipoId: number;
}

export interface VisualTipoRow {
    tipoId: number;
    tipoNombre: string;
}

export interface ChecklistCatalogoItem {
    visualCodigo: string;
    nombre: string;
}

export interface ChecklistCatalogoCategoria {
    tipoId: number;
    tipoNombre: string;
    items: ChecklistCatalogoItem[];
}

// Arma la estructura anidada (categoría -> ítems) a partir de las dos
// consultas planas a dbo.PV_TABLA — puro, sin tocar la base de datos.
// Preserva el orden de `tiposRows` para las categorías y el orden de
// `itemsRows` (ya viene ordenado por tipoId, IN_id desde la query) para
// los ítems dentro de cada categoría.
export function agruparCatalogoChecklist(itemsRows: VisualItemRow[], tiposRows: VisualTipoRow[]): ChecklistCatalogoCategoria[] {
    return tiposRows.map(tipo => ({
        tipoId: tipo.tipoId,
        tipoNombre: tipo.tipoNombre,
        items: itemsRows
            .filter(item => item.tipoId === tipo.tipoId)
            .map(item => ({ visualCodigo: String(item.visualId), nombre: item.nombre })),
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/checklistCatalogo.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/checklistCatalogo.ts server/lib/checklistCatalogo.test.ts
git commit -m "feat: agruparCatalogoChecklist — pure catalog grouping for the checklist form"
```

---

## Task 2: `validarChecklistItems` — pure server-side validation

**Files:**
- Create: `server/lib/checklistCrear.ts`
- Test: `server/lib/checklistCrear.test.ts`

**Interfaces:**
- Produces: `ChecklistItemInput` (`{ visualCodigo: string; desconforme: boolean; motivo: string | null }`), `ValidacionChecklist` (`{ valido: true; items: ChecklistItemInput[] } | { valido: false; error: string }`), `validarChecklistItems(body: unknown, codigosValidos: string[]): ValidacionChecklist`. Task 4 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/checklistCrear.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validarChecklistItems } from './checklistCrear.js';

const CODIGOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function itemsCompletos(overrides: Record<number, Partial<{ visualCodigo: string; desconforme: boolean; motivo: string | null }>> = {}) {
    return CODIGOS.map((c, i) => ({ visualCodigo: c, desconforme: false, motivo: null, ...(overrides[i] ?? {}) }));
}

describe('validarChecklistItems', () => {
    it('accepts exactly 12 valid items, all conforme', () => {
        const result = validarChecklistItems({ items: itemsCompletos() }, CODIGOS);
        expect(result.valido).toBe(true);
    });

    it('accepts a desconforme item with a trimmed motivo', () => {
        const items = itemsCompletos({ 1: { desconforme: true, motivo: '  Falta stock  ' } });
        const result = validarChecklistItems({ items }, CODIGOS);
        expect(result.valido).toBe(true);
        if (result.valido) {
            expect(result.items[1]).toEqual({ visualCodigo: '2', desconforme: true, motivo: 'Falta stock' });
        }
    });

    it('ignores a motivo sent for a conforme item', () => {
        const items = itemsCompletos({ 0: { motivo: 'no debería importar' } });
        const result = validarChecklistItems({ items }, CODIGOS);
        expect(result.valido).toBe(true);
        if (result.valido) expect(result.items[0].motivo).toBeNull();
    });

    it('rejects a desconforme item with an empty or whitespace-only motivo', () => {
        const items = itemsCompletos({ 0: { desconforme: true, motivo: '   ' } });
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'Los ítems No Conforme necesitan un motivo.' });
    });

    it('rejects a motivo longer than 150 characters', () => {
        const items = itemsCompletos({ 0: { desconforme: true, motivo: 'x'.repeat(151) } });
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'El motivo no puede superar los 150 caracteres.' });
    });

    it('rejects fewer than 12 items', () => {
        const items = itemsCompletos().slice(0, 11);
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'Se esperaban 12 ítems.' });
    });

    it('rejects a code not in the catalog', () => {
        const items = itemsCompletos({ 0: { visualCodigo: '99' } });
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'Ítem de checklist inválido.' });
    });

    it('rejects a duplicated code', () => {
        // El primer ítem repite el código del segundo — código '1' desaparece, '2' se duplica.
        const items = itemsCompletos({ 0: { visualCodigo: '2' } });
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'Ítem de checklist duplicado.' });
    });

    it('rejects a non-object body or a missing items array', () => {
        expect(validarChecklistItems(null, CODIGOS)).toEqual({ valido: false, error: 'Datos inválidos.' });
        expect(validarChecklistItems({}, CODIGOS)).toEqual({ valido: false, error: 'Datos inválidos.' });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/checklistCrear.test.ts`
Expected: FAIL — `Cannot find module './checklistCrear.js'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/checklistCrear.ts`:

```ts
export interface ChecklistItemInput {
    visualCodigo: string;
    desconforme: boolean;
    motivo: string | null;
}

export type ValidacionChecklist =
    | { valido: true; items: ChecklistItemInput[] }
    | { valido: false; error: string };

const MAX_MOTIVO_LENGTH = 150; // TB_CHECKLIST_DETALLE.VC_desconforme_motivo es VARCHAR(150)

// Puro — recibe los códigos válidos ya consultados por el route handler
// (así no toca la base de datos y es testeable aislado). Exige
// exactamente esos códigos, sin duplicados ni ajenos, y motivo
// obligatorio (no vacío, máximo 150 caracteres) para cualquier ítem
// "No Conforme". Un ítem "Conforme" ignora cualquier motivo enviado.
export function validarChecklistItems(body: unknown, codigosValidos: string[]): ValidacionChecklist {
    if (typeof body !== 'object' || body === null || !Array.isArray((body as Record<string, unknown>).items)) {
        return { valido: false, error: 'Datos inválidos.' };
    }
    const itemsRaw = (body as { items: unknown[] }).items;

    if (itemsRaw.length !== codigosValidos.length) {
        return { valido: false, error: `Se esperaban ${codigosValidos.length} ítems.` };
    }

    const vistos = new Set<string>();
    const items: ChecklistItemInput[] = [];

    for (const raw of itemsRaw) {
        if (typeof raw !== 'object' || raw === null) {
            return { valido: false, error: 'Datos inválidos.' };
        }
        const r = raw as Record<string, unknown>;
        const visualCodigo = typeof r.visualCodigo === 'string' ? r.visualCodigo.trim() : '';
        const desconforme = r.desconforme === true;

        if (!codigosValidos.includes(visualCodigo)) {
            return { valido: false, error: 'Ítem de checklist inválido.' };
        }
        if (vistos.has(visualCodigo)) {
            return { valido: false, error: 'Ítem de checklist duplicado.' };
        }
        vistos.add(visualCodigo);

        let motivo: string | null = null;
        if (desconforme) {
            const motivoTrim = typeof r.motivo === 'string' ? r.motivo.trim() : '';
            if (!motivoTrim) {
                return { valido: false, error: 'Los ítems No Conforme necesitan un motivo.' };
            }
            if (motivoTrim.length > MAX_MOTIVO_LENGTH) {
                return { valido: false, error: `El motivo no puede superar los ${MAX_MOTIVO_LENGTH} caracteres.` };
            }
            motivo = motivoTrim;
        }

        items.push({ visualCodigo, desconforme, motivo });
    }

    return { valido: true, items };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/checklistCrear.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/checklistCrear.ts server/lib/checklistCrear.test.ts
git commit -m "feat: validarChecklistItems — server-side validation for creating a checklist"
```

---

## Task 3: `GET /api/exhibiciones/catalogo-checklist`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Consumes: `agruparCatalogoChecklist` (Task 1).
- Produces: `GET /catalogo-checklist` → `{ categorias: ChecklistCatalogoCategoria[] }`.

- [ ] **Step 1: Add the import**

In `server/routes/exhibiciones.ts`, replace:

```ts
import { decodificarFotoBase64 } from '../lib/blobUpload.js';
```

with:

```ts
import { decodificarFotoBase64 } from '../lib/blobUpload.js';
import { agruparCatalogoChecklist } from '../lib/checklistCatalogo.js';
```

- [ ] **Step 2: Add the route**

Add this route directly after `GET /catalogo-componentes` (still before `GET /:id` — literal routes must stay ahead of the `:id` param route, same reasoning as `opciones-crear` and `catalogo-componentes`):

```ts
// Los 12 ítems fijos del checklist viven en dbo.PV_TABLA
// (VC_tabla='EXHIBICION_VISUAL'), agrupados en 3 categorías vía
// dbo.PV_TABLA (VC_tabla='EXHIBICION_VISUAL_TIPO'), relacionadas por
// EXHIBICION_VISUAL.VC_filtro = EXHIBICION_VISUAL_TIPO.IN_id — VC_filtro
// se guarda como texto, de ahí el CONVERT(INT, ...) para que coincida
// con el tipo TypeScript `tipoId: number`.
router.get('/catalogo-checklist', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const [itemsResult, tiposResult] = await Promise.all([
            pool.request().query(`
                SELECT IN_id as visualId, VC_descripcion as nombre, CONVERT(INT, VC_filtro) as tipoId
                FROM dbo.PV_TABLA WHERE VC_tabla = 'EXHIBICION_VISUAL' AND CH_activo = '1'
                ORDER BY VC_filtro, IN_id
            `),
            pool.request().query(`
                SELECT IN_id as tipoId, VC_descripcion as tipoNombre
                FROM dbo.PV_TABLA WHERE VC_tabla = 'EXHIBICION_VISUAL_TIPO' AND CH_activo = '1'
                ORDER BY IN_id
            `),
        ]);
        res.json({ categorias: agruparCatalogoChecklist(itemsResult.recordset, tiposResult.recordset) });
    } catch (err: unknown) {
        console.error('[Exhibiciones] catalogo-checklist error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
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
curl -s http://localhost:3000/api/exhibiciones/catalogo-checklist -H "Authorization: Bearer $TOKEN"
```

Expected: `{"categorias":[...]}` with exactly 3 categories (`Visual Etiqueta`, `Visual Exhibiciones`, `Visual POP`) totaling 12 items across them (4 + 5 + 3), matching the table in the spec exactly (e.g. category 1 has `Producto`, `Atributo`, `Faltantes`, `E.E`).

- [ ] **Step 5: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: GET /api/exhibiciones/catalogo-checklist"
```

---

## Task 4: `POST /api/exhibiciones/:id/checklist`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Consumes: `validarChecklistItems` (Task 2).
- Produces: `POST /:id/checklist` → `201 { id, checklistNumber }`, `400`, or `404`.

- [ ] **Step 1: Add the import**

In `server/routes/exhibiciones.ts`, replace:

```ts
import { agruparCatalogoChecklist } from '../lib/checklistCatalogo.js';
```

with:

```ts
import { agruparCatalogoChecklist } from '../lib/checklistCatalogo.js';
import { validarChecklistItems } from '../lib/checklistCrear.js';
```

- [ ] **Step 2: Add the route**

Add this route directly after `POST /:id/fotos` (still before `POST /:id/aprobar` — order among these POST routes doesn't affect matching since their literal suffixes never collide):

```ts
router.post('/:id/checklist', async (req: Request, res: Response) => {
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

        const codigosResult = await pool.request().query(`
            SELECT IN_id as id FROM dbo.PV_TABLA WHERE VC_tabla = 'EXHIBICION_VISUAL' AND CH_activo = '1'
        `);
        const codigosValidos: string[] = codigosResult.recordset.map((r: { id: number }) => String(r.id));

        const validacion = validarChecklistItems(req.body, codigosValidos);
        if (!validacion.valido) {
            res.status(400).json({ error: validacion.error });
            return;
        }

        const usuario = req.user?.username ?? 'system';
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const cabeceraRequest = new sql.Request(transaction);
            cabeceraRequest.input('exhibicionId', sql.BigInt, id);
            cabeceraRequest.input('usuario', sql.VarChar(50), usuario);

            // WITH (UPDLOCK, HOLDLOCK) — mismo resguardo de carrera que el
            // N° de exhibición: dos creaciones simultáneas en el mismo mes
            // nunca deben generar el mismo IN_checklist_number.
            const cabeceraResult = await cabeceraRequest.query(`
                DECLARE @prefix INT = CONVERT(INT, CONCAT(YEAR(GETDATE()), RIGHT('00' + CONVERT(VARCHAR, MONTH(GETDATE())), 2), '000'))
                DECLARE @sgte INT
                SELECT @sgte = ISNULL(MAX(IN_checklist_number), @prefix) + 1
                FROM EXHIBICION.TB_CHECKLIST WITH (UPDLOCK, HOLDLOCK)
                WHERE CONCAT(YEAR(DT_fecha_crea), RIGHT('00' + CONVERT(VARCHAR, MONTH(DT_fecha_crea)), 2))
                    = CONCAT(YEAR(GETDATE()), RIGHT('00' + CONVERT(VARCHAR, MONTH(GETDATE())), 2))

                INSERT INTO EXHIBICION.TB_CHECKLIST
                    (IN_checklist_number, IN_exhibicion_id, IN_estado_id, VC_usuario_crea, DT_fecha_crea)
                OUTPUT INSERTED.IN_checklist_id as id, INSERTED.IN_checklist_number as checklistNumber
                VALUES (@sgte, @exhibicionId, 1, @usuario, GETDATE())
            `);

            const checklistId = cabeceraResult.recordset[0].id;
            const checklistNumber = cabeceraResult.recordset[0].checklistNumber;

            for (const item of validacion.items) {
                const detalleRequest = new sql.Request(transaction);
                detalleRequest.input('checklistId', sql.BigInt, checklistId);
                detalleRequest.input('visualCodigo', sql.VarChar(20), item.visualCodigo);
                detalleRequest.input('desconforme', sql.Bit, item.desconforme);
                detalleRequest.input('motivo', sql.VarChar(150), item.motivo);
                await detalleRequest.query(`
                    INSERT INTO EXHIBICION.TB_CHECKLIST_DETALLE
                        (IN_checklist_id, VC_visual_codigo, BI_desconforme, VC_desconforme_motivo, IN_estado)
                    VALUES (@checklistId, @visualCodigo, @desconforme, @motivo, 1)
                `);
            }

            await transaction.commit();
            res.status(201).json({ id: checklistId, checklistNumber });
        } catch (txErr) {
            await transaction.rollback().catch(() => {});
            throw txErr;
        }
    } catch (err: unknown) {
        console.error('[Exhibiciones] crear checklist error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification against the real database**

With the backend still running from Task 3, using a real exhibición id (e.g. one from `GET /api/exhibiciones?pageSize=1`) and the 12 codes from Task 3's `catalogo-checklist` response:

```bash
curl -s -X POST http://localhost:3000/api/exhibiciones/<REAL_ID>/checklist \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[
    {"visualCodigo":"1","desconforme":false,"motivo":null},
    {"visualCodigo":"2","desconforme":true,"motivo":"Prueba SDD — falta atributo"},
    {"visualCodigo":"3","desconforme":false,"motivo":null},
    {"visualCodigo":"4","desconforme":false,"motivo":null},
    {"visualCodigo":"5","desconforme":false,"motivo":null},
    {"visualCodigo":"6","desconforme":false,"motivo":null},
    {"visualCodigo":"7","desconforme":false,"motivo":null},
    {"visualCodigo":"8","desconforme":false,"motivo":null},
    {"visualCodigo":"9","desconforme":false,"motivo":null},
    {"visualCodigo":"10","desconforme":false,"motivo":null},
    {"visualCodigo":"11","desconforme":false,"motivo":null},
    {"visualCodigo":"12","desconforme":false,"motivo":null}
  ]}'
```

Expected: `201` with `{"id": <number>, "checklistNumber": <number like 202608XXX>}`. **Anota el `id` devuelto — lo necesitas para limpiarlo en la Task 9.** Then test validation (11 items instead of 12):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/exhibiciones/<REAL_ID>/checklist \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"items":[]}'
```

Expected: `400`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: POST /api/exhibiciones/:id/checklist — race-safe checklist number + all-or-nothing 12 lines"
```

---

## Task 5: Frontend types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `ChecklistCatalogoItem`, `ChecklistCatalogoCategoria`, `ChecklistCatalogoResponse`, `ChecklistItemInput`, `CrearChecklistInput`, `CrearChecklistResponse`. Task 6 imports all of these.

- [ ] **Step 1: Add the types**

Append to `src/types/index.ts` (after the existing `AgregarFotoInput` interface):

```ts
export interface ChecklistCatalogoItem {
    visualCodigo: string;
    nombre: string;
}

export interface ChecklistCatalogoCategoria {
    tipoId: number;
    tipoNombre: string;
    items: ChecklistCatalogoItem[];
}

export interface ChecklistCatalogoResponse {
    categorias: ChecklistCatalogoCategoria[];
}

export interface ChecklistItemInput {
    visualCodigo: string;
    desconforme: boolean;
    motivo: string | null;
}

export interface CrearChecklistInput {
    items: ChecklistItemInput[];
}

export interface CrearChecklistResponse {
    id: number;
    checklistNumber: number;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: frontend types for creating a checklist"
```

---

## Task 6: `ChecklistCrearPage` — the checklist form

**Files:**
- Create: `src/pages/ChecklistCrearPage.tsx`

**Interfaces:**
- Consumes: `ExhibicionDetalle` (existing type), `ChecklistCatalogoResponse`, `CrearChecklistInput`, `CrearChecklistResponse` (Task 5), `apiClient`, `SIATC_THEME`, `cn`.
- Produces: `ChecklistCrearPage` component (default export), no props — mounted on `/exhibiciones/:id/checklist/nueva`. Task 7 wires the route.

- [ ] **Step 1: Create the page**

Create `src/pages/ChecklistCrearPage.tsx`:

```tsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle, Check, X } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { cn } from '../utils/cn.js';
import type { ExhibicionDetalle, ChecklistCatalogoResponse, ChecklistCatalogoCategoria, CrearChecklistInput, CrearChecklistResponse } from '../types/index.js';

interface Respuesta {
    desconforme: boolean;
    motivo: string;
}

export function ChecklistCrearPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [exhibicion, setExhibicion] = useState<ExhibicionDetalle | null>(null);
    const [catalogo, setCatalogo] = useState<ChecklistCatalogoCategoria[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({});
    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');

    useEffect(() => {
        Promise.all([
            apiClient.get<ExhibicionDetalle>(`/exhibiciones/${id}`),
            apiClient.get<ChecklistCatalogoResponse>('/exhibiciones/catalogo-checklist'),
        ])
            .then(([exhibicionData, catalogoData]) => {
                setExhibicion(exhibicionData);
                setCatalogo(catalogoData.categorias);
            })
            .catch(() => setError(t('checklist_crear.error_cargar')))
            .finally(() => setLoading(false));
    }, [id, t]);

    const totalItems = useMemo(() => catalogo?.reduce((acc, cat) => acc + cat.items.length, 0) ?? 0, [catalogo]);

    const puedeGuardar = useMemo(() => {
        if (!catalogo || Object.keys(respuestas).length !== totalItems) return false;
        return !guardando && catalogo.every(cat => cat.items.every(item => {
            const r = respuestas[item.visualCodigo];
            if (!r) return false;
            if (r.desconforme && r.motivo.trim() === '') return false;
            return true;
        }));
    }, [catalogo, respuestas, totalItems, guardando]);

    const setRespuesta = (visualCodigo: string, desconforme: boolean) => {
        setRespuestas(prev => ({ ...prev, [visualCodigo]: { desconforme, motivo: prev[visualCodigo]?.motivo ?? '' } }));
    };

    const setMotivo = (visualCodigo: string, motivo: string) => {
        setRespuestas(prev => ({ ...prev, [visualCodigo]: { desconforme: prev[visualCodigo]?.desconforme ?? true, motivo } }));
    };

    const volver = () => navigate(`/exhibiciones/${id}`, { viewTransition: true });

    const handleGuardar = async () => {
        if (!catalogo) return;
        setGuardando(true);
        setErrorGuardar('');
        try {
            const items = catalogo.flatMap(cat => cat.items.map(item => {
                const r = respuestas[item.visualCodigo];
                return { visualCodigo: item.visualCodigo, desconforme: r.desconforme, motivo: r.desconforme ? r.motivo.trim() : null };
            }));
            await apiClient.post<CrearChecklistResponse>(`/exhibiciones/${id}/checklist`, { items } satisfies CrearChecklistInput);
            navigate(`/exhibiciones/${id}`, { viewTransition: true });
        } catch (err) {
            setErrorGuardar(err instanceof Error ? err.message : t('checklist_crear.error_guardar'));
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
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('checklist_crear.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>{exhibicion?.nroExhibicion ?? ''}</p>
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
                                {t('checklist_crear.volver')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && exhibicion && catalogo && (
                        <div className="max-w-2xl space-y-4">
                            <div className="grid grid-cols-2 gap-3 p-4 bg-card border border-cb-border rounded-xl">
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_crear.campo_tienda')}</p>
                                    <p className="text-sm text-cb-text-primary">{exhibicion.clienteNombre}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_crear.campo_sucursal')}</p>
                                    <p className="text-sm text-cb-text-primary">{exhibicion.sucursalNombre}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_crear.campo_exhibicion')}</p>
                                    <p className="text-sm text-cb-text-primary">{exhibicion.nroExhibicion} - {exhibicion.nombre}</p>
                                </div>
                            </div>

                            {catalogo.map(categoria => (
                                <div key={categoria.tipoId} className="bg-card border border-cb-border rounded-xl overflow-hidden">
                                    <div className="px-4 py-2.5 bg-muted text-xs font-black uppercase tracking-wider text-cb-text-secondary">
                                        {categoria.tipoNombre}
                                    </div>
                                    <div className="divide-y divide-cb-border">
                                        {categoria.items.map(item => {
                                            const r = respuestas[item.visualCodigo];
                                            return (
                                                <div key={item.visualCodigo} className="p-4 space-y-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sm font-semibold text-cb-text-primary">{item.nombre}</span>
                                                        <div className="flex gap-2 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setRespuesta(item.visualCodigo, false)}
                                                                className={cn(
                                                                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors duration-150 cursor-pointer',
                                                                    r && !r.desconforme
                                                                        ? 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30'
                                                                        : 'bg-card text-cb-text-secondary border-cb-border hover:bg-muted'
                                                                )}
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> {t('checklist_crear.conforme')}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setRespuesta(item.visualCodigo, true)}
                                                                className={cn(
                                                                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors duration-150 cursor-pointer',
                                                                    r?.desconforme
                                                                        ? 'bg-rose-500/15 text-rose-700 border-rose-400/30'
                                                                        : 'bg-card text-cb-text-secondary border-cb-border hover:bg-muted'
                                                                )}
                                                            >
                                                                <X className="w-3.5 h-3.5" /> {t('checklist_crear.no_conforme')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {r?.desconforme && (
                                                        <textarea
                                                            value={r.motivo}
                                                            onChange={(e) => setMotivo(item.visualCodigo, e.target.value)}
                                                            placeholder={t('checklist_crear.motivo_placeholder')}
                                                            maxLength={150}
                                                            rows={2}
                                                            autoFocus
                                                            className="block w-full px-3 py-2 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm resize-none"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {errorGuardar && (
                                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {errorGuardar}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleGuardar}
                                disabled={!puedeGuardar}
                                className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                            >
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('checklist_crear.accion_guardar')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChecklistCrearPage;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (missing i18n keys are not TypeScript errors — Task 8 adds them).

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChecklistCrearPage.tsx
git commit -m "feat: ChecklistCrearPage — the Nuevo CheckList form"
```

---

## Task 7: Wire the route and the "Checklist" kebab action

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/ExhibicionesPage.tsx`

**Interfaces:**
- Consumes: `ChecklistCrearPage` (Task 6).

- [ ] **Step 1: Add the route**

In `src/App.tsx`, replace:

```tsx
import { ExhibicionCrearPage } from './pages/ExhibicionCrearPage.js';
```

with:

```tsx
import { ExhibicionCrearPage } from './pages/ExhibicionCrearPage.js';
import { ChecklistCrearPage } from './pages/ChecklistCrearPage.js';
```

Replace:

```tsx
                                <Route path="/exhibiciones/:id" element={<ExhibicionDetallePage />} />
```

with:

```tsx
                                <Route path="/exhibiciones/:id" element={<ExhibicionDetallePage />} />
                                <Route path="/exhibiciones/:id/checklist/nueva" element={<ChecklistCrearPage />} />
```

- [ ] **Step 2: Wire the "Checklist" kebab action**

In `src/pages/ExhibicionesPage.tsx`, replace:

```tsx
    const handleAction = (action: 'ver' | 'checklist' | 'ticket', id: number) => {
        if (action === 'ver') {
            navigate(`/exhibiciones/${id}`, { viewTransition: true });
            return;
        }
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
        if (action === 'checklist') {
            navigate(`/exhibiciones/${id}/checklist/nueva`, { viewTransition: true });
            return;
        }
        alert(t('exhibiciones_lista.proximamente_titulo'), t('exhibiciones_lista.proximamente_mensaje'));
    };
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/ExhibicionesPage.tsx
git commit -m "feat: wire /exhibiciones/:id/checklist/nueva route and the Checklist kebab action"
```

---

## Task 8: i18n keys

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Produces: every `checklist_crear.*` key referenced by Task 6.

- [ ] **Step 1: Add the Spanish keys**

In `public/locales/es.json`, add a new top-level `"checklist_crear"` key (as a sibling of `"exhibicion_crear"`, before the final closing `}` — remember the trailing comma after `"exhibicion_crear": { ... }`'s closing `}`):

```json
    "checklist_crear": {
        "title": "Nuevo Checklist",
        "campo_tienda": "Tienda",
        "campo_sucursal": "Sucursal",
        "campo_exhibicion": "Exhibición",
        "conforme": "Conforme",
        "no_conforme": "No Conforme",
        "motivo_placeholder": "Motivo...",
        "accion_guardar": "Guardar",
        "error_cargar": "No se pudo cargar el checklist.",
        "error_guardar": "No se pudo crear el checklist.",
        "volver": "Volver"
    }
```

- [ ] **Step 2: Add the English keys**

In `public/locales/en.json`, add the equivalent block in the same position:

```json
    "checklist_crear": {
        "title": "New Checklist",
        "campo_tienda": "Store",
        "campo_sucursal": "Branch",
        "campo_exhibicion": "Exhibit",
        "conforme": "Compliant",
        "no_conforme": "Non-Compliant",
        "motivo_placeholder": "Reason...",
        "accion_guardar": "Save",
        "error_cargar": "Couldn't load the checklist.",
        "error_guardar": "Couldn't create the checklist.",
        "volver": "Back"
    }
```

- [ ] **Step 3: Verify both files are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/es.json'))" && node -e "JSON.parse(require('fs').readFileSync('public/locales/en.json'))" && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add public/locales/es.json public/locales/en.json
git commit -m "feat: i18n keys for creating a checklist (es/en)"
```

---

## Task 9: Full verification (tests, build, API-level E2E, cleanup)

**Files:** none (verification only).

**Note on method:** use `curl`/Node scripts for the E2E check, not interactive browser automation — a prior plan's equivalent task stalled for 10 minutes in a browser session and had to be retried. API-level checks exercise the exact same backend logic without that risk.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all test files pass, including the two new suites from Tasks 1 and 2 (5 + 9 = 14 new tests on top of the existing 86 → 100 total).

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` both succeed with no errors.

- [ ] **Step 3: API-level E2E verification**

Start the backend locally (inline env vars, never written to a file):

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" PORT=3000 npx tsx server/index.ts &
```

1. Log in, `GET /api/exhibiciones/catalogo-checklist` — confirm 3 categories, 12 items total.
2. Pick a real exhibición id (e.g. from `GET /api/exhibiciones?pageSize=1`).
3. `POST /:id/checklist` with all 12 codes, one marked `desconforme:true` with a real motivo → confirm `201` with an `id` and a `checklistNumber` matching the current `YYYYMM` prefix (e.g. `202608XXX`). **Note this id for cleanup.**
4. `POST /:id/checklist` again with only 11 items → confirm `400`.
5. `POST /:id/checklist` with a `desconforme:true` item and an empty motivo → confirm `400`.
6. `POST /:id/checklist` with a duplicated `visualCodigo` → confirm `400`.
7. Directly query the database (one-off script, same inline-credential pattern) to confirm the checklist created in step 3 has **exactly 12** rows in `TB_CHECKLIST_DETALLE`, and that the one marked desconforme has the correct `VC_desconforme_motivo`.

Kill the backend process when done.

- [ ] **Step 4: Clean up test data**

Mark the checklist(s) created in Step 3 (and Task 4's manual verification) Anulado — never DELETE, and never touch the exhibición itself (it's real, unrelated to this test):

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" node -e "
const sql = require('mssql');
(async () => {
  const pool = await sql.connect({ server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, options: { encrypt: true, trustServerCertificate: false } });
  await pool.request().query(\`UPDATE EXHIBICION.TB_CHECKLIST SET IN_estado_id = 0 WHERE IN_checklist_id IN (/* pega aquí los ids de checklist de prueba */)\`);
  console.log('listo');
  await pool.close();
})();
"
```

The 12 `TB_CHECKLIST_DETALLE` rows don't need separate cleanup — nothing in this plan queries them independent of their parent checklist's estado.

- [ ] **Step 5: Final commit if anything was adjusted during manual verification**

If Step 3 surfaced anything requiring a fix, fix it, re-run Steps 1-2, and commit with a message describing what was found and fixed.
