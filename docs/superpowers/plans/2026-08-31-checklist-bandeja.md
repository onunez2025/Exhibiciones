# Checklist — Bandeja (Lista + Detalle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Checklist" module (Bandeja / Lista + Detalle de solo lectura) accessible from the main sidebar navigation at `/checklist` and `/checklist/:id`, replacing the current `ComingSoonPage` placeholder.

**Architecture:** A new dedicated backend router `server/routes/checklists.ts` mounted at `/api/checklists` in `server/index.ts` (with pure filter builder `server/lib/checklistsFilter.ts` and pure response grouper `server/lib/checklistDetalle.ts`), plus two new frontend pages (`ChecklistsPage.tsx` with search, filter panel, cards, and desktop pagination / mobile infinite scroll; and `ChecklistDetallePage.tsx` with header summary and the 12 items grouped across their 3 categories).

**Tech Stack:** Express + TypeScript (`tsx`) · `mssql` · React 19 + `react-i18next` + `react-router-dom` v7 · existing `apiClient`/`SIATC_THEME`/`cn` conventions.

**Spec:** [docs/superpowers/specs/2026-08-31-checklist-bandeja-design.md](../specs/2026-08-31-checklist-bandeja-design.md)

## Global Constraints

- Never write the real Azure SQL admin password or the Blob Storage SAS token into any file committed to git.
- The bandeja does not implement promotor/supervisor/trade scoping — it displays all records, matching the rest of the application.
- Pure read-only module: no state change actions, no item-level photo upload, no item-level ticket creation.
- `IN_estado_id > 0` is always enforced so anulados (`IN_estado_id = 0`) are never listed.
- "Conforme" on a checklist header is calculated on the fly: a checklist is Conforme (`true`) if NONE of its active items (`IN_estado = 1`) has `BI_desconforme = 1`.
- Every new user-facing string goes through `react-i18next` under the new `checklist_bandeja.*` namespace.
- Follow existing frontend conventions: `SIATC_THEME` tokens, `apiClient`, `navigate(path, { viewTransition: true })`, `PAGE_SUBTITLE_VISIBLE` / `PAGE_SUBTITLE`, `cn()` for conditional classes.

---

## Task 1: `buildChecklistsFilter` — pure server-side query builder

**Files:**
- Create: `server/lib/checklistsFilter.ts`
- Test: `server/lib/checklistsFilter.test.ts`

**Interfaces:**
- Produces: `ChecklistsQueryParams`, `ChecklistsFilter`, `buildChecklistsFilter(query: ChecklistsQueryParams): ChecklistsFilter`. Task 3 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/checklistsFilter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildChecklistsFilter } from './checklistsFilter.js';

function findParam(params: { name: string; value: unknown }[], name: string) {
    return params.find(p => p.name === name);
}

describe('buildChecklistsFilter', () => {
    it('returns base IN_estado_id > 0 clause when no params are given', () => {
        const result = buildChecklistsFilter({});
        expect(result.whereSql).toBe('C.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('adds search clause matching number or exhibicion name/number', () => {
        const result = buildChecklistsFilter({ search: '202608' });
        expect(result.whereSql).toBe(
            'C.IN_estado_id > 0 AND (CONVERT(VARCHAR, C.IN_checklist_number) LIKE @search OR E.VC_nombre LIKE @searchContains OR E.VC_nro_exhibicion LIKE @search)'
        );
        expect(findParam(result.params, 'search')?.value).toBe('202608%');
        expect(findParam(result.params, 'searchContains')?.value).toBe('%202608%');
    });

    it('trims whitespace from search', () => {
        const result = buildChecklistsFilter({ search: '  pared  ' });
        expect(findParam(result.params, 'search')?.value).toBe('pared%');
        expect(findParam(result.params, 'searchContains')?.value).toBe('%pared%');
    });

    it('ignores empty/whitespace-only search', () => {
        const result = buildChecklistsFilter({ search: '   ' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('adds NOT EXISTS clause when conforme is "si"', () => {
        const result = buildChecklistsFilter({ conforme: 'si' });
        expect(result.whereSql).toBe(
            'C.IN_estado_id > 0 AND NOT EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)'
        );
        expect(result.params).toEqual([]);
    });

    it('adds EXISTS clause when conforme is "no"', () => {
        const result = buildChecklistsFilter({ conforme: 'no' });
        expect(result.whereSql).toBe(
            'C.IN_estado_id > 0 AND EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)'
        );
        expect(result.params).toEqual([]);
    });

    it('ignores invalid conforme values', () => {
        const result = buildChecklistsFilter({ conforme: 'maybe' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0');
    });

    it('adds tienda clause matching cliente or sucursal nombre', () => {
        const result = buildChecklistsFilter({ tienda: 'Saga' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0 AND (E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)');
        expect(findParam(result.params, 'tienda')?.value).toBe('%Saga%');
    });

    it('adds fechaDesde/fechaHasta clauses with fechaHasta set to end of day', () => {
        const result = buildChecklistsFilter({ fechaDesde: '2026-08-01', fechaHasta: '2026-08-31' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0 AND C.DT_fecha_crea >= @fechaDesde AND C.DT_fecha_crea <= @fechaHasta');
        expect(findParam(result.params, 'fechaDesde')?.value).toEqual(new Date('2026-08-01'));
        const hasta = findParam(result.params, 'fechaHasta')?.value as Date;
        expect(hasta.getHours()).toBe(23);
        expect(hasta.getMinutes()).toBe(59);
        expect(hasta.getSeconds()).toBe(59);
    });

    it('ignores invalid dates', () => {
        const result = buildChecklistsFilter({ fechaDesde: 'invalida', fechaHasta: 'tambien-invalida' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('combines all filters into one query', () => {
        const result = buildChecklistsFilter({
            search: 'EXB',
            conforme: 'si',
            tienda: 'Metro',
            fechaDesde: '2026-08-01',
            fechaHasta: '2026-08-31',
        });
        expect(result.whereSql).toBe(
            'C.IN_estado_id > 0' +
            ' AND (CONVERT(VARCHAR, C.IN_checklist_number) LIKE @search OR E.VC_nombre LIKE @searchContains OR E.VC_nro_exhibicion LIKE @search)' +
            ' AND NOT EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)' +
            ' AND (E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)' +
            ' AND C.DT_fecha_crea >= @fechaDesde' +
            ' AND C.DT_fecha_crea <= @fechaHasta'
        );
        expect(result.params.map(p => p.name)).toEqual(['search', 'searchContains', 'tienda', 'fechaDesde', 'fechaHasta']);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/checklistsFilter.test.ts`
Expected: FAIL — cannot find module `./checklistsFilter.js`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/checklistsFilter.ts`:

```ts
import sql from 'mssql';

export interface ChecklistsQueryParams {
    search?: string;
    conforme?: string;
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}

export interface QueryParam {
    name: string;
    type: unknown;
    value: unknown;
}

export interface ChecklistsFilter {
    whereSql: string;
    params: QueryParam[];
}

export function buildChecklistsFilter(query: ChecklistsQueryParams): ChecklistsFilter {
    const clauses: string[] = ['C.IN_estado_id > 0'];
    const params: QueryParam[] = [];

    const search = query.search?.trim();
    if (search) {
        clauses.push('(CONVERT(VARCHAR, C.IN_checklist_number) LIKE @search OR E.VC_nombre LIKE @searchContains OR E.VC_nro_exhibicion LIKE @search)');
        params.push({ name: 'search', type: sql.NVarChar(20), value: `${search}%` });
        params.push({ name: 'searchContains', type: sql.NVarChar(200), value: `%${search}%` });
    }

    if (query.conforme === 'si') {
        clauses.push('NOT EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)');
    } else if (query.conforme === 'no') {
        clauses.push('EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)');
    }

    const tienda = query.tienda?.trim();
    if (tienda) {
        clauses.push('(E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)');
        params.push({ name: 'tienda', type: sql.NVarChar(250), value: `%${tienda}%` });
    }

    if (query.fechaDesde) {
        const d = new Date(query.fechaDesde);
        if (!Number.isNaN(d.getTime())) {
            clauses.push('C.DT_fecha_crea >= @fechaDesde');
            params.push({ name: 'fechaDesde', type: sql.DateTime, value: d });
        }
    }

    if (query.fechaHasta) {
        const d = new Date(query.fechaHasta);
        if (!Number.isNaN(d.getTime())) {
            d.setHours(23, 59, 59, 999);
            clauses.push('C.DT_fecha_crea <= @fechaHasta');
            params.push({ name: 'fechaHasta', type: sql.DateTime, value: d });
        }
    }

    return { whereSql: clauses.join(' AND '), params };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/checklistsFilter.test.ts`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/checklistsFilter.ts server/lib/checklistsFilter.test.ts
git commit -m "feat: buildChecklistsFilter — pure query builder for checklist inbox"
```

---

## Task 2: `agruparChecklistDetalle` — pure server-side detail response builder

**Files:**
- Create: `server/lib/checklistDetalle.ts`
- Test: `server/lib/checklistDetalle.test.ts`

**Interfaces:**
- Produces: `ChecklistDetalleItemRow`, `ChecklistDetalleCategoriaItem`, `ChecklistDetalleCategoria`, `agruparChecklistDetalle(itemsRows: VisualItemRow[], tiposRows: VisualTipoRow[], detalleRows: ChecklistDetalleItemRow[]): ChecklistDetalleCategoria[]`. Task 3 imports these.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/checklistDetalle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { agruparChecklistDetalle } from './checklistDetalle.js';

describe('agruparChecklistDetalle', () => {
    const tipos = [
        { tipoId: 1, tipoNombre: 'Visual Etiqueta' },
        { tipoId: 2, tipoNombre: 'Visual Exhibiciones' },
    ];
    const catalogItems = [
        { visualId: 1, nombre: 'Producto', tipoId: 1 },
        { visualId: 2, nombre: 'Atributo', tipoId: 1 },
        { visualId: 5, nombre: 'Operativo', tipoId: 2 },
    ];

    it('merges catalog structure with checklist responses', () => {
        const detalle = [
            { visualCodigo: '1', desconforme: false, motivo: null },
            { visualCodigo: '2', desconforme: true, motivo: 'Etiqueta rota' },
            { visualCodigo: '5', desconforme: false, motivo: null },
        ];

        const result = agruparChecklistDetalle(catalogItems, tipos, detalle);
        expect(result).toEqual([
            {
                tipoId: 1,
                tipoNombre: 'Visual Etiqueta',
                items: [
                    { visualCodigo: '1', nombre: 'Producto', desconforme: false, motivo: null },
                    { visualCodigo: '2', nombre: 'Atributo', desconforme: true, motivo: 'Etiqueta rota' },
                ],
            },
            {
                tipoId: 2,
                tipoNombre: 'Visual Exhibiciones',
                items: [
                    { visualCodigo: '5', nombre: 'Operativo', desconforme: false, motivo: null },
                ],
            },
        ]);
    });

    it('defaults to conforme (desconforme: false, motivo: null) if an item has no recorded response', () => {
        const detalle = [{ visualCodigo: '1', desconforme: true, motivo: 'Falta precio' }];
        const result = agruparChecklistDetalle(catalogItems, tipos, detalle);
        expect(result[0].items[1]).toEqual({
            visualCodigo: '2',
            nombre: 'Atributo',
            desconforme: false,
            motivo: null,
        });
    });

    it('handles empty categories gracefully', () => {
        const emptyTipos = [{ tipoId: 3, tipoNombre: 'Visual POP' }];
        const result = agruparChecklistDetalle([], emptyTipos, []);
        expect(result).toEqual([{ tipoId: 3, tipoNombre: 'Visual POP', items: [] }]);
    });

    it('returns empty array when types are empty', () => {
        expect(agruparChecklistDetalle([], [], [])).toEqual([]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/checklistDetalle.test.ts`
Expected: FAIL — cannot find module `./checklistDetalle.js`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/checklistDetalle.ts`:

```ts
import type { VisualItemRow, VisualTipoRow } from './checklistCatalogo.js';

export interface ChecklistDetalleItemRow {
    visualCodigo: string;
    desconforme: boolean;
    motivo: string | null;
}

export interface ChecklistDetalleCategoriaItem {
    visualCodigo: string;
    nombre: string;
    desconforme: boolean;
    motivo: string | null;
}

export interface ChecklistDetalleCategoria {
    tipoId: number;
    tipoNombre: string;
    items: ChecklistDetalleCategoriaItem[];
}

export function agruparChecklistDetalle(
    itemsRows: VisualItemRow[],
    tiposRows: VisualTipoRow[],
    detalleRows: ChecklistDetalleItemRow[]
): ChecklistDetalleCategoria[] {
    const respuestasMap = new Map<string, ChecklistDetalleItemRow>();
    for (const d of detalleRows) {
        respuestasMap.set(String(d.visualCodigo), d);
    }

    return tiposRows.map(tipo => ({
        tipoId: tipo.tipoId,
        tipoNombre: tipo.tipoNombre,
        items: itemsRows
            .filter(item => item.tipoId === tipo.tipoId)
            .map(item => {
                const codigo = String(item.visualId);
                const r = respuestasMap.get(codigo);
                return {
                    visualCodigo: codigo,
                    nombre: item.nombre,
                    desconforme: Boolean(r?.desconforme),
                    motivo: r?.motivo ?? null,
                };
            }),
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/checklistDetalle.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/checklistDetalle.ts server/lib/checklistDetalle.test.ts
git commit -m "feat: agruparChecklistDetalle — pure response grouping for checklist detail"
```

---

## Task 3: `GET /api/checklists` & `GET /api/checklists/:id` — backend routes

**Files:**
- Create: `server/routes/checklists.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Produces: `GET /api/checklists` (paginated list) & `GET /api/checklists/:id` (detail). Consumes `buildChecklistsFilter` (Task 1) and `agruparChecklistDetalle` (Task 2).

- [ ] **Step 1: Create `server/routes/checklists.ts`**

Create `server/routes/checklists.ts`:

```ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { getDbConnection } from '../db.js';
import { safeError } from '../lib/security.js';
import { buildChecklistsFilter } from '../lib/checklistsFilter.js';
import type { ChecklistsQueryParams, QueryParam } from '../lib/checklistsFilter.js';
import { agruparChecklistDetalle } from '../lib/checklistDetalle.js';
import type { VisualItemRow, VisualTipoRow } from '../lib/checklistCatalogo.js';

const router = Router();

function bindParams(request: sql.Request, params: QueryParam[]): void {
    for (const p of params) {
        request.input(p.name, p.type as sql.ISqlType, p.value);
    }
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function parseChecklistsQuery(query: Request['query']): ChecklistsQueryParams {
    return {
        search: asString(query.search),
        conforme: asString(query.conforme),
        tienda: asString(query.tienda),
        fechaDesde: asString(query.fechaDesde),
        fechaHasta: asString(query.fechaHasta),
    };
}

router.get('/', async (req: Request, res: Response) => {
    try {
        const filter = buildChecklistsFilter(parseChecklistsQuery(req.query));
        const page = Math.max(1, Math.trunc(Number(req.query.page)) || 1);
        const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(req.query.pageSize)) || 20));
        const offset = (page - 1) * pageSize;

        const pool = await getDbConnection();

        const dataRequest = pool.request();
        bindParams(dataRequest, filter.params);
        dataRequest.input('offset', sql.Int, offset);
        dataRequest.input('pageSize', sql.Int, pageSize);

        const dataResult = await dataRequest.query(`
            SELECT
                C.IN_checklist_id as id,
                C.IN_checklist_number as checklistNumber,
                C.IN_exhibicion_id as exhibicionId,
                E.VC_nro_exhibicion as exhibicionNroExhibicion,
                E.VC_nombre as exhibicionNombre,
                E.VC_cliente_nombre as clienteNombre,
                E.VC_sucursal_nombre as sucursalNombre,
                C.IN_estado_id as estadoId,
                CASE WHEN EXISTS (
                    SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD
                    WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1
                ) THEN 0 ELSE 1 END as conforme,
                C.DT_fecha_crea as fechaCrea
            FROM EXHIBICION.TB_CHECKLIST C
            INNER JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = C.IN_exhibicion_id
            WHERE ${filter.whereSql}
            ORDER BY C.IN_checklist_number DESC, C.IN_checklist_id DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        const countRequest = pool.request();
        bindParams(countRequest, filter.params);
        const countResult = await countRequest.query(`
            SELECT COUNT(*) as total
            FROM EXHIBICION.TB_CHECKLIST C
            INNER JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = C.IN_exhibicion_id
            WHERE ${filter.whereSql}
        `);

        const items = dataResult.recordset.map((r: {
            id: number;
            checklistNumber: number;
            exhibicionId: number;
            exhibicionNroExhibicion: string;
            exhibicionNombre: string;
            clienteNombre: string;
            sucursalNombre: string;
            estadoId: number;
            conforme: number;
            fechaCrea: string;
        }) => ({
            id: Number(r.id),
            checklistNumber: Number(r.checklistNumber),
            exhibicionId: Number(r.exhibicionId),
            exhibicionNroExhibicion: r.exhibicionNroExhibicion,
            exhibicionNombre: r.exhibicionNombre,
            clienteNombre: r.clienteNombre,
            sucursalNombre: r.sucursalNombre,
            estadoId: Number(r.estadoId),
            conforme: r.conforme === 1,
            fechaCrea: r.fechaCrea,
        }));

        res.json({
            items,
            total: countResult.recordset[0].total,
            page,
            pageSize,
        });
    } catch (err: unknown) {
        console.error('[Checklists] list error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de checklist inválido.' });
            return;
        }

        const pool = await getDbConnection();

        const cabeceraResult = await pool.request().input('id', sql.BigInt, id).query(`
            SELECT
                C.IN_checklist_id as id,
                C.IN_checklist_number as checklistNumber,
                C.IN_exhibicion_id as exhibicionId,
                E.VC_nro_exhibicion as exhibicionNroExhibicion,
                E.VC_nombre as exhibicionNombre,
                E.VC_cliente_nombre as clienteNombre,
                E.VC_sucursal_nombre as sucursalNombre,
                C.IN_estado_id as estadoId,
                C.DT_fecha_crea as fechaCrea
            FROM EXHIBICION.TB_CHECKLIST C
            INNER JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = C.IN_exhibicion_id
            WHERE C.IN_checklist_id = @id AND C.IN_estado_id > 0
        `);

        const cabecera = cabeceraResult.recordset[0];
        if (!cabecera) {
            res.status(404).json({ error: 'Checklist no encontrado.' });
            return;
        }

        const [itemsResult, tiposResult, detalleResult] = await Promise.all([
            pool.request().query(`
                SELECT IN_id as visualId, VC_descripcion as nombre, IN_padre_id as tipoId
                FROM dbo.PV_TABLA
                WHERE VC_tabla = 'VISUAL' AND CH_activo = '1' AND IN_id > 0
                ORDER BY IN_padre_id, IN_id
            `),
            pool.request().query(`
                SELECT IN_id as tipoId, VC_descripcion as tipoNombre
                FROM dbo.PV_TABLA
                WHERE VC_tabla = 'TIPO_VISUAL' AND CH_activo = '1'
                ORDER BY IN_id
            `),
            pool.request().input('id', sql.BigInt, id).query(`
                SELECT
                    VC_visual_codigo as visualCodigo,
                    BI_desconforme as desconforme,
                    VC_desconforme_motivo as motivo
                FROM EXHIBICION.TB_CHECKLIST_DETALLE
                WHERE IN_checklist_id = @id AND IN_estado = 1
            `),
        ]);

        const categorias = agruparChecklistDetalle(
            itemsResult.recordset as VisualItemRow[],
            tiposResult.recordset as VisualTipoRow[],
            detalleResult.recordset.map((d: { visualCodigo: string; desconforme: boolean | number; motivo: string | null }) => ({
                visualCodigo: d.visualCodigo,
                desconforme: Boolean(d.desconforme),
                motivo: d.motivo,
            }))
        );

        const conforme = categorias.every(cat => cat.items.every(item => !item.desconforme));

        res.json({
            id: Number(cabecera.id),
            checklistNumber: Number(cabecera.checklistNumber),
            exhibicionId: Number(cabecera.exhibicionId),
            exhibicionNroExhibicion: cabecera.exhibicionNroExhibicion,
            exhibicionNombre: cabecera.exhibicionNombre,
            clienteNombre: cabecera.clienteNombre,
            sucursalNombre: cabecera.sucursalNombre,
            estadoId: Number(cabecera.estadoId),
            conforme,
            fechaCrea: cabecera.fechaCrea,
            categorias,
        });
    } catch (err: unknown) {
        console.error('[Checklists] detalle error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
```

- [ ] **Step 2: Mount router in `server/index.ts`**

In `server/index.ts`, add import:

```ts
import checklistsRouter from './routes/checklists.js';
```

And around line 127, add:
```ts
app.use('/api/exhibiciones', verifyToken, exhibicionesRouter);
app.use('/api/checklists', verifyToken, checklistsRouter);
```

- [ ] **Step 3: Verify build / typecheck**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add server/routes/checklists.ts server/index.ts
git commit -m "feat: GET /api/checklists and GET /api/checklists/:id routes"
```

---

## Task 4: Frontend Types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `ChecklistListItem`, `ChecklistsListResponse`, `ChecklistsFiltros`, `ChecklistDetalleItem`, `ChecklistDetalleCategoria`, `ChecklistDetalle`. Tasks 5-8 import these.

- [ ] **Step 1: Append checklist bandeja types**

Append to `src/types/index.ts`:

```ts
export interface ChecklistListItem {
    id: number;
    checklistNumber: number;
    exhibicionId: number;
    exhibicionNroExhibicion: string;
    exhibicionNombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    estadoId: number;
    conforme: boolean;
    fechaCrea: string;
}

export interface ChecklistsListResponse {
    items: ChecklistListItem[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ChecklistsFiltros {
    conforme?: 'si' | 'no';
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}

export interface ChecklistDetalleItem {
    visualCodigo: string;
    nombre: string;
    desconforme: boolean;
    motivo: string | null;
}

export interface ChecklistDetalleCategoria {
    tipoId: number;
    tipoNombre: string;
    items: ChecklistDetalleItem[];
}

export interface ChecklistDetalle {
    id: number;
    checklistNumber: number;
    exhibicionId: number;
    exhibicionNroExhibicion: string;
    exhibicionNombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    estadoId: number;
    conforme: boolean;
    fechaCrea: string;
    categorias: ChecklistDetalleCategoria[];
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: frontend types for checklist inbox (list and detail)"
```

---

## Task 5: `estadoChecklist` UI utility + unit tests

**Files:**
- Create: `src/utils/estadoChecklist.ts`
- Test: `src/utils/estadoChecklist.test.ts`

**Interfaces:**
- Produces: `getEstadoChecklistEstilo(estadoId: number)`, `getEstadoChecklistLabelKey(estadoId: number)`, `getConformeEstilo(conforme: boolean)`, `getConformeLabelKey(conforme: boolean)`. Tasks 6, 7, 8 consume these.

- [ ] **Step 1: Write the failing unit tests**

Create `src/utils/estadoChecklist.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    getEstadoChecklistEstilo,
    getEstadoChecklistLabelKey,
    getConformeEstilo,
    getConformeLabelKey,
} from './estadoChecklist.js';

describe('estadoChecklist', () => {
    it('returns amber style for estado 1 (Pendiente)', () => {
        const estilo = getEstadoChecklistEstilo(1);
        expect(estilo.badge).toContain('amber');
        expect(estilo.accent).toContain('amber');
        expect(getEstadoChecklistLabelKey(1)).toBe('checklist_bandeja.estado_pendiente');
    });

    it('returns emerald style for estado 2 (Atendido)', () => {
        const estilo = getEstadoChecklistEstilo(2);
        expect(estilo.badge).toContain('emerald');
        expect(estilo.accent).toContain('emerald');
        expect(getEstadoChecklistLabelKey(2)).toBe('checklist_bandeja.estado_atendido');
    });

    it('returns fallback style and empty label key for unknown estado', () => {
        const estilo = getEstadoChecklistEstilo(99);
        expect(estilo.badge).toContain('muted');
        expect(getEstadoChecklistLabelKey(99)).toBe('');
    });

    it('returns green badge for conforme = true', () => {
        const estilo = getConformeEstilo(true);
        expect(estilo.badge).toContain('emerald');
        expect(getConformeLabelKey(true)).toBe('checklist_bandeja.conforme');
    });

    it('returns rose badge for conforme = false', () => {
        const estilo = getConformeEstilo(false);
        expect(estilo.badge).toContain('rose');
        expect(getConformeLabelKey(false)).toBe('checklist_bandeja.no_conforme');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/estadoChecklist.test.ts`
Expected: FAIL — cannot find module `./estadoChecklist.js`.

- [ ] **Step 3: Write implementation**

Create `src/utils/estadoChecklist.ts`:

```ts
export interface EstadoEstilo {
    badge: string;
    accent: string;
}

const ESTADO_ESTILOS: Record<number, EstadoEstilo> = {
    1: { badge: 'bg-amber-500/15 text-amber-700 border-amber-400/30', accent: 'before:bg-amber-400' },
    2: { badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30', accent: 'before:bg-emerald-400' },
};

const ESTADO_FALLBACK: EstadoEstilo = {
    badge: 'bg-muted text-cb-text-secondary border-cb-border',
    accent: 'before:bg-cb-border',
};

export function getEstadoChecklistEstilo(estadoId: number): EstadoEstilo {
    return ESTADO_ESTILOS[estadoId] ?? ESTADO_FALLBACK;
}

export function getEstadoChecklistLabelKey(estadoId: number): string {
    if (estadoId === 1) return 'checklist_bandeja.estado_pendiente';
    if (estadoId === 2) return 'checklist_bandeja.estado_atendido';
    return '';
}

export function getConformeEstilo(conforme: boolean): { badge: string } {
    return conforme
        ? { badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30' }
        : { badge: 'bg-rose-500/15 text-rose-700 border-rose-400/30' };
}

export function getConformeLabelKey(conforme: boolean): string {
    return conforme ? 'checklist_bandeja.conforme' : 'checklist_bandeja.no_conforme';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/estadoChecklist.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/estadoChecklist.ts src/utils/estadoChecklist.test.ts
git commit -m "feat: estadoChecklist — status badge and label resolution for checklists"
```

---

## Task 6: `ChecklistCard` and `ChecklistFiltrosPanel` Components

**Files:**
- Create: `src/components/checklists/ChecklistCard.tsx`
- Create: `src/components/checklists/ChecklistFiltrosPanel.tsx`

**Interfaces:**
- Consumes: `ChecklistListItem`, `ChecklistsFiltros` (Task 4), `SIATC_THEME`, `cn`, `estadoChecklist` (Task 5).
- Produces: `ChecklistCard` & `ChecklistFiltrosPanel` for use in `ChecklistsPage` (Task 7).

- [ ] **Step 1: Create `src/components/checklists/ChecklistCard.tsx`**

Create `src/components/checklists/ChecklistCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { ListChecks, Eye } from 'lucide-react';
import type { ChecklistListItem } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';
import {
    getEstadoChecklistEstilo,
    getEstadoChecklistLabelKey,
    getConformeEstilo,
    getConformeLabelKey,
} from '../../utils/estadoChecklist.js';

export interface ChecklistCardProps {
    checklist: ChecklistListItem;
    onVer: (id: number) => void;
}

function InfoField({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[9px] font-bold text-cb-text-secondary uppercase tracking-wide leading-tight">{label}</p>
            <p className="text-xs text-cb-text-primary leading-tight break-words">{value}</p>
        </div>
    );
}

export function ChecklistCard({ checklist, onVer }: ChecklistCardProps) {
    const { t } = useTranslation();

    const fecha = new Date(checklist.fechaCrea);
    const fechaTexto = Number.isNaN(fecha.getTime())
        ? ''
        : fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
          ' ' + fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    const estadoStyle = getEstadoChecklistEstilo(checklist.estadoId);
    const estadoLabelKey = getEstadoChecklistLabelKey(checklist.estadoId);
    const estadoLabel = estadoLabelKey ? t(estadoLabelKey) : '—';

    const conformeStyle = getConformeEstilo(checklist.conforme);
    const conformeLabel = t(getConformeLabelKey(checklist.conforme));

    return (
        <div
            className={cn(
                'relative border border-cb-border bg-card px-4 py-3 shadow-cb-level-1',
                'hover:shadow-cb-level-2 hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200',
                "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-[inherit]",
                SIATC_THEME.TOKENS.RADIUS.CARD,
                estadoStyle.accent
            )}
        >
            {/* Fila 1: Ícono + N° Checklist + Badges (Conforme + Estado) + Botón Ver */}
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ListChecks className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-primary shrink-0">#{checklist.checklistNumber}</span>
                <span className="text-sm font-semibold text-cb-text-primary truncate flex-1 min-w-0">
                    {checklist.exhibicionNroExhibicion} — {checklist.exhibicionNombre}
                </span>

                <span className={cn('shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', conformeStyle.badge)}>
                    {conformeLabel}
                </span>
                <span className={cn('shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', estadoStyle.badge)}>
                    {estadoLabel}
                </span>

                <button
                    type="button"
                    onClick={() => onVer(checklist.id)}
                    aria-label={t('checklist_bandeja.accion_ver')}
                    title={t('checklist_bandeja.accion_ver')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-cb-text-secondary hover:bg-muted hover:text-primary transition-colors duration-150 active:scale-90 cursor-pointer shrink-0"
                >
                    <Eye className="w-4 h-4" />
                </button>
            </div>

            {fechaTexto && (
                <p className="text-[10px] text-cb-text-secondary mt-1 pl-9">{fechaTexto}</p>
            )}

            {/* Fila 2: Tienda / Sucursal */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 pl-9">
                <InfoField label={t('checklist_bandeja.campo_tienda')} value={checklist.clienteNombre} />
                <InfoField label={t('checklist_bandeja.campo_sucursal')} value={checklist.sucursalNombre} />
            </div>
        </div>
    );
}

export default ChecklistCard;
```

- [ ] **Step 2: Create `src/components/checklists/ChecklistFiltrosPanel.tsx`**

Create `src/components/checklists/ChecklistFiltrosPanel.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import type { ChecklistsFiltros } from '../../types/index.js';

export interface ChecklistFiltrosPanelProps {
    open: boolean;
    filtros: ChecklistsFiltros;
    onApply: (filtros: ChecklistsFiltros) => void;
    onClear: () => void;
}

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

export function ChecklistFiltrosPanel({ open, filtros, onApply, onClear }: ChecklistFiltrosPanelProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ChecklistsFiltros>(filtros);

    useEffect(() => {
        setDraft(filtros);
    }, [filtros]);

    if (!open) return null;

    return (
        <div className="border border-cb-border rounded-2xl p-4 bg-muted/30 space-y-4 enter-fade-up">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label className={LABEL_CLASS}>{t('checklist_bandeja.filtro_conformidad')}</label>
                    <select
                        className={INPUT_CLASS}
                        value={draft.conforme ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, conforme: (e.target.value as 'si' | 'no') || undefined }))}
                    >
                        <option value="">{t('checklist_bandeja.filtro_todos')}</option>
                        <option value="si">{t('checklist_bandeja.conforme')}</option>
                        <option value="no">{t('checklist_bandeja.no_conforme')}</option>
                    </select>
                </div>
                <div>
                    <label className={LABEL_CLASS}>{t('checklist_bandeja.filtro_tienda')}</label>
                    <input
                        type="text"
                        className={INPUT_CLASS}
                        value={draft.tienda ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, tienda: e.target.value || undefined }))}
                        placeholder={t('checklist_bandeja.filtro_tienda_placeholder')}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={LABEL_CLASS}>{t('checklist_bandeja.filtro_fecha_desde')}</label>
                        <input
                            type="date"
                            className={INPUT_CLASS}
                            value={draft.fechaDesde ?? ''}
                            onChange={(e) => setDraft(d => ({ ...d, fechaDesde: e.target.value || undefined }))}
                        />
                    </div>
                    <div>
                        <label className={LABEL_CLASS}>{t('checklist_bandeja.filtro_fecha_hasta')}</label>
                        <input
                            type="date"
                            className={INPUT_CLASS}
                            value={draft.fechaHasta ?? ''}
                            onChange={(e) => setDraft(d => ({ ...d, fechaHasta: e.target.value || undefined }))}
                        />
                    </div>
                </div>
            </div>
            <div className={SIATC_THEME.FORM.FOOTER}>
                <button type="button" onClick={() => onApply(draft)} className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' cursor-pointer'}>
                    {t('checklist_bandeja.filtro_aplicar')}
                </button>
                <button
                    type="button"
                    onClick={() => { setDraft({}); onClear(); }}
                    className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}
                >
                    {t('checklist_bandeja.filtro_limpiar')}
                </button>
            </div>
        </div>
    );
}

export default ChecklistFiltrosPanel;
```

- [ ] **Step 3: Verify build / typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean pass, zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/checklists/ChecklistCard.tsx src/components/checklists/ChecklistFiltrosPanel.tsx
git commit -m "feat: ChecklistCard and ChecklistFiltrosPanel components"
```

---

## Task 7: `ChecklistsPage` — the `/checklist` inbox list page

**Files:**
- Create: `src/pages/ChecklistsPage.tsx`

**Interfaces:**
- Consumes: `ChecklistListItem`, `ChecklistsListResponse`, `ChecklistsFiltros` (Task 4), `ChecklistCard`, `ChecklistFiltrosPanel` (Task 6), `Pagination`, `MobileMenuButton`, `apiClient`, `SIATC_THEME`, `useMediaQuery`.
- Produces: `ChecklistsPage` mounted at `/checklist`.

- [ ] **Step 1: Create `src/pages/ChecklistsPage.tsx`**

Create `src/pages/ChecklistsPage.tsx`:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { MobileMenuButton } from '../components/layout/MobileMenuButton.js';
import { ChecklistCard } from '../components/checklists/ChecklistCard.js';
import { ChecklistFiltrosPanel } from '../components/checklists/ChecklistFiltrosPanel.js';
import { Pagination } from '../components/exhibiciones/Pagination.js';
import type { ChecklistListItem, ChecklistsListResponse, ChecklistsFiltros } from '../types/index.js';

const DEFAULT_PAGE_SIZE = 20;

export function ChecklistsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [filtrosOpen, setFiltrosOpen] = useState(false);
    const [filtros, setFiltros] = useState<ChecklistsFiltros>({});
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    const [items, setItems] = useState<ChecklistListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [loadMoreError, setLoadMoreError] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const requestSeq = useRef(0);
    const fetchPage = useCallback(async (pageToLoad: number, append: boolean) => {
        const seq = ++requestSeq.current;
        if (append) { setLoadingMore(true); setLoadMoreError(false); }
        else { setLoading(true); setError(''); }
        try {
            const params = new URLSearchParams();
            params.set('page', String(pageToLoad));
            params.set('pageSize', String(pageSize));
            if (search) params.set('search', search);
            if (filtros.conforme) params.set('conforme', filtros.conforme);
            if (filtros.tienda) params.set('tienda', filtros.tienda);
            if (filtros.fechaDesde) params.set('fechaDesde', filtros.fechaDesde);
            if (filtros.fechaHasta) params.set('fechaHasta', filtros.fechaHasta);

            const data = await apiClient.get<ChecklistsListResponse>(`/checklists?${params.toString()}`);
            if (seq !== requestSeq.current) return;
            setTotal(data.total);
            setPage(data.page);
            setItems(prev => (append ? [...prev, ...data.items] : data.items));
        } catch (err) {
            if (seq !== requestSeq.current) return;
            console.error('[Checklists] fetch error:', err);
            if (append) setLoadMoreError(true); else setError(t('checklist_bandeja.error_cargar'));
        } finally {
            if (seq === requestSeq.current) {
                if (append) setLoadingMore(false); else setLoading(false);
            }
        }
    }, [pageSize, search, filtros, t]);

    useEffect(() => {
        setItems([]);
        setLoadMoreError(false);
        fetchPage(1, false);
    }, [search, filtros, pageSize, isDesktop]);

    const sentinelRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (isDesktop || loadMoreError || loadingMore) return;
        const el = sentinelRef.current;
        if (!el || items.length >= total) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) fetchPage(page + 1, true);
        }, { rootMargin: '200px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [isDesktop, items.length, total, loadingMore, loadMoreError, page, fetchPage]);

    const handleVer = (id: number) => {
        navigate(`/checklist/${id}`, { viewTransition: true });
    };

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    <MobileMenuButton />
                    <div>
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('checklist_bandeja.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('checklist_bandeja.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => setFiltrosOpen(v => !v)}
                            className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer shrink-0'}
                        >
                            <Filter className="w-4 h-4" /> {t('checklist_bandeja.filtros')}
                        </button>
                        <div className="flex gap-3 flex-1">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                                    <Search className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder={t('checklist_bandeja.search_placeholder')}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchPage(isDesktop ? page : 1, false)}
                                disabled={loading}
                                title={t('checklist_bandeja.reintentar')}
                                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-cb-border text-cb-text-secondary hover:text-primary hover:bg-primary/10 transition-colors duration-150 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                            </button>
                        </div>
                    </div>

                    <ChecklistFiltrosPanel
                        open={filtrosOpen}
                        filtros={filtros}
                        onApply={(f) => setFiltros(f)}
                        onClear={() => setFiltros({})}
                    />

                    {error && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold enter-fade-up">
                            {error}
                        </div>
                    )}

                    {!error && !loading && items.length === 0 && (
                        <p className="text-sm text-cb-text-secondary text-center py-12">{t('checklist_bandeja.vacio')}</p>
                    )}

                    <div className="space-y-3">
                        {items.map(item => (
                            <ChecklistCard key={item.id} checklist={item} onVer={handleVer} />
                        ))}
                    </div>

                    {!isDesktop && items.length < total && (
                        <div ref={sentinelRef} className="flex justify-center py-4">
                            {loadMoreError ? (
                                <button
                                    type="button"
                                    onClick={() => fetchPage(page + 1, true)}
                                    className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}
                                >
                                    {t('checklist_bandeja.reintentar')}
                                </button>
                            ) : (
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            )}
                        </div>
                    )}
                </div>

                {isDesktop && total > 0 && (
                    <div className="px-4 pb-3 pt-1 border-t border-cb-border bg-card shrink-0">
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={(p) => fetchPage(p, false)}
                            onPageSizeChange={(size) => setPageSize(size)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChecklistsPage;
```

- [ ] **Step 2: Verify build / typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean pass, zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChecklistsPage.tsx
git commit -m "feat: ChecklistsPage — list view with search, filters, cards and pagination"
```

---

## Task 8: `ChecklistDetallePage` — the `/checklist/:id` read-only detail view

**Files:**
- Create: `src/pages/ChecklistDetallePage.tsx`

**Interfaces:**
- Consumes: `ChecklistDetalle`, `ChecklistDetalleCategoria` (Task 4), `estadoChecklist` (Task 5), `apiClient`, `SIATC_THEME`, `cn`.
- Produces: `ChecklistDetallePage` component.

- [ ] **Step 1: Create `src/pages/ChecklistDetallePage.tsx`**

Create `src/pages/ChecklistDetallePage.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle, Check, X } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { cn } from '../utils/cn.js';
import {
    getEstadoChecklistEstilo,
    getEstadoChecklistLabelKey,
    getConformeEstilo,
    getConformeLabelKey,
} from '../utils/estadoChecklist.js';
import type { ChecklistDetalle } from '../types/index.js';

export function ChecklistDetallePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [checklist, setChecklist] = useState<ChecklistDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const cargar = useCallback(() => {
        setLoading(true);
        setError('');
        apiClient.get<ChecklistDetalle>(`/checklists/${id}`)
            .then(data => setChecklist(data))
            .catch(() => setError(t('checklist_bandeja.error_cargar_detalle')))
            .finally(() => setLoading(false));
    }, [id, t]);

    useEffect(() => { cargar(); }, [cargar]);

    const volver = () => navigate('/checklist', { viewTransition: true });

    const fecha = checklist ? new Date(checklist.fechaCrea) : null;
    const fechaTexto = fecha && !Number.isNaN(fecha.getTime())
        ? fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
          ' ' + fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        : '';

    const estadoStyle = checklist ? getEstadoChecklistEstilo(checklist.estadoId) : null;
    const estadoLabelKey = checklist ? getEstadoChecklistLabelKey(checklist.estadoId) : '';
    const estadoLabel = estadoLabelKey ? t(estadoLabelKey) : '—';

    const conformeStyle = checklist ? getConformeEstilo(checklist.conforme) : null;
    const conformeLabel = checklist ? t(getConformeLabelKey(checklist.conforme)) : '';

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
                        <div className="flex items-center gap-2">
                            <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>
                                {checklist ? `#${checklist.checklistNumber}` : t('checklist_bandeja.detalle_title')}
                            </h1>
                            {checklist && conformeStyle && (
                                <span className={cn('text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border', conformeStyle.badge)}>
                                    {conformeLabel}
                                </span>
                            )}
                            {checklist && estadoStyle && (
                                <span className={cn('text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border', estadoStyle.badge)}>
                                    {estadoLabel}
                                </span>
                            )}
                        </div>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>{fechaTexto}</p>
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
                            <button type="button" onClick={cargar} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}>
                                {t('checklist_bandeja.reintentar')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && checklist && (
                        <div className="max-w-3xl space-y-4">
                            {/* Resumen de contexto */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-card border border-cb-border rounded-xl">
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_bandeja.campo_tienda')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">{checklist.clienteNombre}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_bandeja.campo_sucursal')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">{checklist.sucursalNombre}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_bandeja.campo_exhibicion')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">{checklist.exhibicionNroExhibicion} — {checklist.exhibicionNombre}</p>
                                </div>
                            </div>

                            {/* Categorías con ítems */}
                            <div className="space-y-4">
                                {checklist.categorias.map(cat => (
                                    <div key={cat.tipoId} className="border border-cb-border rounded-2xl p-4 bg-card space-y-3">
                                        <h2 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">
                                            {cat.tipoNombre}
                                        </h2>
                                        <ul className="divide-y divide-cb-border">
                                            {cat.items.map(item => (
                                                <li key={item.visualCodigo} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sm text-cb-text-primary font-medium">
                                                            {item.nombre}
                                                        </span>
                                                        {item.desconforme ? (
                                                            <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full shrink-0">
                                                                <X className="w-3.5 h-3.5" />
                                                                {t('checklist_bandeja.no_conforme')}
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                                                                <Check className="w-3.5 h-3.5" />
                                                                {t('checklist_bandeja.conforme')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.desconforme && item.motivo && (
                                                        <p className="text-xs text-cb-text-secondary bg-muted/50 p-2 rounded-lg border border-cb-border/60">
                                                            <span className="font-bold text-cb-text-primary">{t('checklist_bandeja.campo_motivo')}: </span>
                                                            {item.motivo}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChecklistDetallePage;
```

- [ ] **Step 2: Verify build / typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: clean pass.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChecklistDetallePage.tsx
git commit -m "feat: ChecklistDetallePage — read-only detail view for a checklist"
```

---

## Task 9: Route wiring in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ChecklistsPage` (Task 7) and `ChecklistDetallePage` (Task 8).

- [ ] **Step 1: Replace ComingSoonPage for checklist with real routes**

In `src/App.tsx`, import the new pages:

```tsx
import { ChecklistsPage } from './pages/ChecklistsPage.js';
import { ChecklistDetallePage } from './pages/ChecklistDetallePage.js';
```

Replace:
```tsx
<Route path="/checklist" element={<ComingSoonPage titleKey="nav.checklist" icon={ListChecks} />} />
```
with:
```tsx
<Route path="/checklist" element={<ChecklistsPage />} />
<Route path="/checklist/:id" element={<ChecklistDetallePage />} />
```

- [ ] **Step 2: Verify build / typecheck**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire /checklist and /checklist/:id routes"
```

---

## Task 10: i18n keys (Spanish & English)

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Produces: `checklist_bandeja.*` namespace with all keys consumed by tasks 5-8.

- [ ] **Step 1: Add Spanish keys to `public/locales/es.json`**

Add `"checklist_bandeja"` block before the final closing brace:

```json
    "checklist_bandeja": {
        "title": "Checklists",
        "subtitle": "Bandeja de checklists registrados",
        "detalle_title": "Detalle de Checklist",
        "filtros": "Filtros",
        "search_placeholder": "Buscar por N° checklist o exhibición...",
        "filtro_todos": "Todos",
        "filtro_conformidad": "Conformidad",
        "filtro_tienda": "Tienda / Sucursal",
        "filtro_tienda_placeholder": "Nombre de tienda o sucursal...",
        "filtro_fecha_desde": "Desde",
        "filtro_fecha_hasta": "Hasta",
        "filtro_aplicar": "Aplicar",
        "filtro_limpiar": "Limpiar",
        "conforme": "Conforme",
        "no_conforme": "No Conforme",
        "estado_pendiente": "Pendiente",
        "estado_atendido": "Atendido",
        "campo_tienda": "Tienda",
        "campo_sucursal": "Sucursal",
        "campo_exhibicion": "Exhibición",
        "campo_motivo": "Motivo",
        "accion_ver": "Ver detalle",
        "error_cargar": "No se pudieron cargar los checklists.",
        "error_cargar_detalle": "No se pudo cargar el detalle del checklist.",
        "reintentar": "Reintentar",
        "vacio": "No se encontraron checklists registrados."
    }
```

- [ ] **Step 2: Add English keys to `public/locales/en.json`**

Add corresponding `"checklist_bandeja"` block in `public/locales/en.json`:

```json
    "checklist_bandeja": {
        "title": "Checklists",
        "subtitle": "Inbox of recorded checklists",
        "detalle_title": "Checklist Detail",
        "filtros": "Filters",
        "search_placeholder": "Search by checklist # or exhibit...",
        "filtro_todos": "All",
        "filtro_conformidad": "Compliance",
        "filtro_tienda": "Store / Branch",
        "filtro_tienda_placeholder": "Store or branch name...",
        "filtro_fecha_desde": "From",
        "filtro_fecha_hasta": "To",
        "filtro_aplicar": "Apply",
        "filtro_limpiar": "Clear",
        "conforme": "Compliant",
        "no_conforme": "Non-Compliant",
        "estado_pendiente": "Pending",
        "estado_atendido": "Resolved",
        "campo_tienda": "Store",
        "campo_sucursal": "Branch",
        "campo_exhibicion": "Exhibit",
        "campo_motivo": "Reason",
        "accion_ver": "View detail",
        "error_cargar": "Couldn't load checklists.",
        "error_cargar_detalle": "Couldn't load checklist detail.",
        "reintentar": "Retry",
        "vacio": "No checklists found."
    }
```

- [ ] **Step 3: Validate JSON format**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/es.json')); JSON.parse(require('fs').readFileSync('public/locales/en.json')); console.log('JSON OK')"`
Expected: `JSON OK`.

- [ ] **Step 4: Commit**

```bash
git add public/locales/es.json public/locales/en.json
git commit -m "feat: i18n keys for checklist inbox and detail (es/en)"
```

---

## Task 11: Full Verification (Tests, Build, API-level E2E)

**Files:** None (verification only).

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all test files pass (112 pre-existing + 20 new tests = 132 tests total).

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` pass with exit code 0.

- [ ] **Step 3: API-level E2E checks with local backend**

Run API-level verification script with node/curl:
1. Log in via `POST /api/auth/login`.
2. `GET /api/checklists` -> returns list with pagination metadata (`items`, `total`, `page`, `pageSize`).
3. `GET /api/checklists?conforme=si` / `?conforme=no` -> filters correctly.
4. `GET /api/checklists/:id` with an existing checklist ID -> returns header + 3 categories with items.
5. `GET /api/checklists/999999` -> returns 404.
6. Verify git status is completely clean.
