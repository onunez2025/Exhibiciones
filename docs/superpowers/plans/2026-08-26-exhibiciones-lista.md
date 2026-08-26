# Exhibiciones — Lista Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real "Lista de Exhibiciones" page (backend endpoints + frontend UI) that replaces the current "Próximamente" placeholder at `/exhibiciones`.

**Architecture:** New Express route module queries `EXHIBICION.TB_EXHIBICION` directly (LEFT JOIN to the generic catalog `dbo.PV_TABLA` for tipo/ubicación text), paginated server-side. New React page under `src/components/exhibiciones/` fetches it, with desktop classic-pagination vs. mobile infinite-scroll behind one shared `useMediaQuery` breakpoint check.

**Tech Stack:** Express + TypeScript (`tsx`) · `mssql` · React 19 + `react-i18next` · existing `apiClient`/`SIATC_THEME`/`DialogContext` from the Fundación.

**Spec:** [docs/superpowers/specs/2026-08-26-exhibiciones-lista-design.md](../specs/2026-08-26-exhibiciones-lista-design.md)

## Global Constraints

- Server-side pagination only — never fetch all 767+ rows to the client.
- `LEFT JOIN` (not `INNER JOIN`) to `dbo.PV_TABLA` — a row with an inactive/missing tipo must still appear in the list, with `tipoNombre: null`.
- `IN_estado_id > 0` always applied — estado 0 (Anulado) never appears in the list.
- No data-scoping by assigned tienda/promotor this round — every authenticated user sees all matching rows.
- "Ver" / "Checklist" / "Ticket" buttons on each card open the existing "Próximamente" dialog (`useDialog().alert(...)`) — no dead links, no new routes for them.
- Every new user-facing string goes through `react-i18next` (`t('exhibiciones_lista.*')`) in both `public/locales/es.json` and `en.json` — no hardcoded Spanish/English strings in components.
- Follow existing conventions: `SIATC_THEME` tokens for layout/typography/buttons, `safeError()` for error responses, `cleanEnv()`-free (no new env vars needed here).

---

## Task 1: `buildExhibicionesFilter` — pure filter-building function

**Files:**
- Create: `server/lib/exhibicionesFilter.ts`
- Test: `server/lib/exhibicionesFilter.test.ts`

**Interfaces:**
- Produces: `ExhibicionesQueryParams` (input type), `QueryParam` (`{ name: string; type: unknown; value: unknown }`), `ExhibicionesFilter` (`{ whereSql: string; params: QueryParam[] }`), and the function `buildExhibicionesFilter(query: ExhibicionesQueryParams): ExhibicionesFilter`. Task 3 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/exhibicionesFilter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildExhibicionesFilter } from './exhibicionesFilter.js';

function findParam(params: { name: string; value: unknown }[], name: string) {
    return params.find(p => p.name === name);
}

describe('buildExhibicionesFilter', () => {
    it('returns only the base estado filter when no params are given', () => {
        const result = buildExhibicionesFilter({});
        expect(result.whereSql).toBe('E.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('adds a search clause matching prefix on nro and contains on nombre', () => {
        const result = buildExhibicionesFilter({ search: 'EXB0000003' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0 AND (E.VC_nro_exhibicion LIKE @search OR E.VC_nombre LIKE @searchContains)');
        expect(findParam(result.params, 'search')?.value).toBe('EXB0000003%');
        expect(findParam(result.params, 'searchContains')?.value).toBe('%EXB0000003%');
    });

    it('trims whitespace from search before building the clause', () => {
        const result = buildExhibicionesFilter({ search: '  lineal  ' });
        expect(findParam(result.params, 'search')?.value).toBe('lineal%');
    });

    it('ignores an empty/whitespace-only search', () => {
        const result = buildExhibicionesFilter({ search: '   ' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('adds an exact tipo filter when tipo is a valid number', () => {
        const result = buildExhibicionesFilter({ tipo: '49' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0 AND E.IN_exhibicion_tipo_id = @tipo');
        expect(findParam(result.params, 'tipo')?.value).toBe(49);
    });

    it('ignores a non-numeric tipo', () => {
        const result = buildExhibicionesFilter({ tipo: 'abc' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0');
    });

    it('adds an estado filter only for the valid values 1 or 2', () => {
        const result1 = buildExhibicionesFilter({ estado: '1' });
        expect(result1.whereSql).toContain('E.IN_estado_id = @estado');
        expect(findParam(result1.params, 'estado')?.value).toBe(1);

        const result0 = buildExhibicionesFilter({ estado: '0' });
        expect(result0.whereSql).toBe('E.IN_estado_id > 0');

        const result9 = buildExhibicionesFilter({ estado: '9' });
        expect(result9.whereSql).toBe('E.IN_estado_id > 0');
    });

    it('adds a tienda clause matching cliente or sucursal nombre', () => {
        const result = buildExhibicionesFilter({ tienda: 'San Miguel' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0 AND (E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)');
        expect(findParam(result.params, 'tienda')?.value).toBe('%San Miguel%');
    });

    it('adds fechaDesde/fechaHasta clauses for valid ISO dates, ignoring invalid ones', () => {
        const result = buildExhibicionesFilter({ fechaDesde: '2021-01-01', fechaHasta: '2021-12-31' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0 AND E.DT_fecha_crea >= @fechaDesde AND E.DT_fecha_crea <= @fechaHasta');
        expect(findParam(result.params, 'fechaDesde')?.value).toEqual(new Date('2021-01-01'));

        const bad = buildExhibicionesFilter({ fechaDesde: 'not-a-date' });
        expect(bad.whereSql).toBe('E.IN_estado_id > 0');
    });

    it('sets fechaHasta to the end of that day so the whole day is included', () => {
        const result = buildExhibicionesFilter({ fechaHasta: '2021-07-12' });
        const value = findParam(result.params, 'fechaHasta')?.value as Date;
        expect(value.getHours()).toBe(23);
        expect(value.getMinutes()).toBe(59);
    });

    it('combines every filter together in one WHERE clause', () => {
        const result = buildExhibicionesFilter({
            search: 'EXB', tipo: '6', estado: '2', tienda: 'Plaza', fechaDesde: '2021-01-01', fechaHasta: '2021-12-31',
        });
        expect(result.whereSql).toBe(
            'E.IN_estado_id > 0' +
            ' AND (E.VC_nro_exhibicion LIKE @search OR E.VC_nombre LIKE @searchContains)' +
            ' AND E.IN_exhibicion_tipo_id = @tipo' +
            ' AND E.IN_estado_id = @estado' +
            ' AND (E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)' +
            ' AND E.DT_fecha_crea >= @fechaDesde' +
            ' AND E.DT_fecha_crea <= @fechaHasta'
        );
        expect(result.params.map(p => p.name)).toEqual(
            ['search', 'searchContains', 'tipo', 'estado', 'tienda', 'fechaDesde', 'fechaHasta']
        );
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/exhibicionesFilter.test.ts`
Expected: FAIL — `Cannot find module './exhibicionesFilter.js'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `server/lib/exhibicionesFilter.ts`:

```ts
import sql from 'mssql';

export interface ExhibicionesQueryParams {
    search?: string;
    tipo?: string;
    estado?: string;
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}

export interface QueryParam {
    name: string;
    // Valor de mssql (ej. sql.Int, sql.NVarChar(20)) — tipado unknown aquí
    // para no acoplar este módulo puro al tipo exacto de la librería;
    // quien lo consume (Task 3) lo castea a sql.ISqlType al hacer .input().
    type: unknown;
    value: unknown;
}

export interface ExhibicionesFilter {
    whereSql: string;
    params: QueryParam[];
}

// Arma el WHERE + params de la lista de exhibiciones a partir de query
// params ya parseados (todos opcionales). Puro — sin tocar la base de
// datos — para poder probarlo sin una conexión real. IN_estado_id > 0
// siempre está presente: el estado 0 (Anulado) nunca debe aparecer en la
// lista, sin importar qué más se filtre.
export function buildExhibicionesFilter(query: ExhibicionesQueryParams): ExhibicionesFilter {
    const clauses: string[] = ['E.IN_estado_id > 0'];
    const params: QueryParam[] = [];

    const search = query.search?.trim();
    if (search) {
        clauses.push('(E.VC_nro_exhibicion LIKE @search OR E.VC_nombre LIKE @searchContains)');
        params.push({ name: 'search', type: sql.NVarChar(20), value: `${search}%` });
        params.push({ name: 'searchContains', type: sql.NVarChar(200), value: `%${search}%` });
    }

    if (query.tipo !== undefined) {
        const tipoNum = Number(query.tipo);
        if (Number.isFinite(tipoNum)) {
            clauses.push('E.IN_exhibicion_tipo_id = @tipo');
            params.push({ name: 'tipo', type: sql.Int, value: tipoNum });
        }
    }

    if (query.estado !== undefined) {
        const estadoNum = Number(query.estado);
        if (estadoNum === 1 || estadoNum === 2) {
            clauses.push('E.IN_estado_id = @estado');
            params.push({ name: 'estado', type: sql.Int, value: estadoNum });
        }
    }

    const tienda = query.tienda?.trim();
    if (tienda) {
        clauses.push('(E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)');
        params.push({ name: 'tienda', type: sql.NVarChar(250), value: `%${tienda}%` });
    }

    if (query.fechaDesde) {
        const d = new Date(query.fechaDesde);
        if (!Number.isNaN(d.getTime())) {
            clauses.push('E.DT_fecha_crea >= @fechaDesde');
            params.push({ name: 'fechaDesde', type: sql.DateTime, value: d });
        }
    }

    if (query.fechaHasta) {
        const d = new Date(query.fechaHasta);
        if (!Number.isNaN(d.getTime())) {
            // Fin del día — si no, "hasta el 12/07" excluiría todo lo creado
            // ese mismo día después de medianoche.
            d.setHours(23, 59, 59, 999);
            clauses.push('E.DT_fecha_crea <= @fechaHasta');
            params.push({ name: 'fechaHasta', type: sql.DateTime, value: d });
        }
    }

    return { whereSql: clauses.join(' AND '), params };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/exhibicionesFilter.test.ts`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.app.json` (frontend project — should be untouched/clean) and confirm the backend compiles as part of the full build later (Task 3 exercises it directly). For now just confirm vitest's own transform didn't flag a type error in the test run output.

- [ ] **Step 6: Commit**

```bash
git add server/lib/exhibicionesFilter.ts server/lib/exhibicionesFilter.test.ts
git commit -m "feat: buildExhibicionesFilter — WHERE/params builder for the exhibiciones list"
```

---

## Task 2: `GET /api/exhibiciones/opciones-filtro`

**Files:**
- Create: `server/routes/exhibiciones.ts`
- Modify: `server/index.ts:17-19` (import) and `server/index.ts:118` (mount)

**Interfaces:**
- Consumes: `getDbConnection()` from `server/db.ts` (already exists — returns `Promise<sql.ConnectionPool>`), `safeError()` from `server/lib/security.ts`, `verifyToken` from `server/middleware/auth.ts`.
- Produces: default-exported Express `Router` mounted at `/api/exhibiciones`; `GET /opciones-filtro` → `{ tipos: {id:number,nombre:string}[], ubicaciones: {id:number,nombre:string}[] }`.

- [ ] **Step 1: Create the route file with just this endpoint**

Create `server/routes/exhibiciones.ts`:

```ts
// server/routes/exhibiciones.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDbConnection } from '../db.js';
import { safeError } from '../lib/security.js';

const router = Router();

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

export default router;
```

- [ ] **Step 2: Mount the router in `server/index.ts`**

Replace line 17-19:

```ts
import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
// TODO (sub-proyectos futuros): import tus routers de módulo aquí
```

with:

```ts
import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
import exhibicionesRouter from './routes/exhibiciones.js';
import { verifyToken } from './middleware/auth.js';
```

Replace line 118:

```ts
// TODO (sub-proyectos futuros): app.use('/api/exhibiciones', verifyToken, exhibicionesRouter);
```

with:

```ts
app.use('/api/exhibiciones', verifyToken, exhibicionesRouter);
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json` — this only checks the frontend project; for the backend, run the full build check used elsewhere in this project:

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -50` (or simply run the full `npm run build`, which runs `tsc -b` across the whole repo including `server/`)

Expected: no errors mentioning `exhibiciones.ts` or `index.ts`.

- [ ] **Step 4: Manual verification against the real database**

Start the backend locally (same pattern used throughout this session — env vars passed inline, never written to a file):

```bash
# AZURE_SQL_PASSWORD debe estar ya exportado en el shell donde se corre esto
# — nunca escribir la contraseña real en este archivo (queda commiteado a git).
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" PORT=3000 npx tsx server/index.ts
```

In another terminal, log in to get a token — use whatever the current
`admin` password is at execution time (check the most recent password
reset in this session's history, or reset it again via the same
`bcrypt.hash()` + `UPDATE EXHIBICION.TB_USUARIOS` approach used earlier
this session if it's unknown) — then call the endpoint:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"REPLACE_WITH_CURRENT_ADMIN_PASSWORD"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s http://localhost:3000/api/exhibiciones/opciones-filtro -H "Authorization: Bearer $TOKEN" | head -c 500
```

Expected: JSON with `tipos` (55 entries) and `ubicaciones` (9 entries), each `{id, nombre}`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/exhibiciones.ts server/index.ts
git commit -m "feat: GET /api/exhibiciones/opciones-filtro"
```

---

## Task 3: `GET /api/exhibiciones` — paginated list

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Consumes: `buildExhibicionesFilter`, `ExhibicionesQueryParams`, `QueryParam` from `server/lib/exhibicionesFilter.ts` (Task 1).
- Produces: `GET /` → `{ items: {id,nroExhibicion,nombre,clienteNombre,sucursalNombre,tipoNombre,ubicacionNombre,estadoId,fechaCrea}[], total: number, page: number, pageSize: number }`. Task 4 (frontend types) mirrors this shape exactly.

- [ ] **Step 1: Add the list endpoint**

Add to the top of `server/routes/exhibiciones.ts` (alongside the existing imports):

```ts
import sql from 'mssql';
import { buildExhibicionesFilter } from '../lib/exhibicionesFilter.js';
import type { ExhibicionesQueryParams, QueryParam } from '../lib/exhibicionesFilter.js';
```

Add this helper and route, above `export default router;`:

```ts
function bindParams(request: sql.Request, params: QueryParam[]): void {
    for (const p of params) {
        request.input(p.name, p.type as sql.ISqlType, p.value);
    }
}

router.get('/', async (req: Request, res: Response) => {
    try {
        const filter = buildExhibicionesFilter(req.query as ExhibicionesQueryParams);
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
                E.IN_exhibicion_id as id,
                E.VC_nro_exhibicion as nroExhibicion,
                E.VC_nombre as nombre,
                E.VC_cliente_nombre as clienteNombre,
                E.VC_sucursal_nombre as sucursalNombre,
                ET.VC_descripcion as tipoNombre,
                EPD.VC_descripcion as ubicacionNombre,
                E.IN_estado_id as estadoId,
                E.DT_fecha_crea as fechaCrea
            FROM EXHIBICION.TB_EXHIBICION E
            LEFT JOIN dbo.PV_TABLA ET
                ON ET.VC_tabla = 'EXHIBICION_TIPO' AND ET.CH_activo = '1' AND ET.IN_id = E.IN_exhibicion_tipo_id
            LEFT JOIN dbo.PV_TABLA EPD
                ON EPD.VC_tabla = 'EXHIBICION_PISO_DETALLE' AND EPD.CH_activo = '1' AND EPD.IN_id = E.IN_piso_detalle_id
            WHERE ${filter.whereSql}
            ORDER BY E.VC_nro_exhibicion DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        const countRequest = pool.request();
        bindParams(countRequest, filter.params);
        const countResult = await countRequest.query(`
            SELECT COUNT(*) as total
            FROM EXHIBICION.TB_EXHIBICION E
            WHERE ${filter.whereSql}
        `);

        res.json({
            items: dataResult.recordset,
            total: countResult.recordset[0].total,
            page,
            pageSize,
        });
    } catch (err: unknown) {
        console.error('[Exhibiciones] list error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build` (runs `tsc -b` across the repo, then `vite build`).
Expected: build succeeds, no type errors.

- [ ] **Step 3: Manual verification against the real database**

With the backend still running from Task 2 (restart it if needed with the same inline env vars):

```bash
curl -s "http://localhost:3000/api/exhibiciones?page=1&pageSize=3" -H "Authorization: Bearer $TOKEN"
```

Expected: `{"items":[...3 items...],"total":<a number ~700+>,"page":1,"pageSize":3}`, each item has `nroExhibicion` like `"EXB0000XXX"` and non-null `tipoNombre`/`ubicacionNombre` for most rows (some may be `null` if their tipo/piso is inactive — that's correct, not a bug).

Then test a filter:

```bash
curl -s "http://localhost:3000/api/exhibiciones?search=EXB0000003" -H "Authorization: Bearer $TOKEN"
```

Expected: exactly the "lineal de Campana" exhibition from the reference screenshot.

- [ ] **Step 4: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: GET /api/exhibiciones — paginated, filtered list"
```

---

## Task 4: Frontend types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `Exhibicion`, `ExhibicionesListResponse`, `FiltroOpcion`, `ExhibicionesFiltroOpciones`, `ExhibicionesFiltros` — every later frontend task imports these from `../types/index.js` (or `../../types/index.js` from `components/exhibiciones/`).

- [ ] **Step 1: Add the types**

Append to `src/types/index.ts` (after the existing `User` interface):

```ts
export interface Exhibicion {
    id: number;
    nroExhibicion: string;
    nombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    tipoNombre: string | null;
    ubicacionNombre: string | null;
    estadoId: 1 | 2;
    fechaCrea: string;
}

export interface ExhibicionesListResponse {
    items: Exhibicion[];
    total: number;
    page: number;
    pageSize: number;
}

export interface FiltroOpcion {
    id: number;
    nombre: string;
}

export interface ExhibicionesFiltroOpciones {
    tipos: FiltroOpcion[];
    ubicaciones: FiltroOpcion[];
}

export interface ExhibicionesFiltros {
    tipo?: number;
    estado?: 1 | 2;
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (this file has no consumers yet, so it can only fail on its own syntax).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: frontend types for the exhibiciones list"
```

---

## Task 5: `useMediaQuery` hook

**Files:**
- Create: `src/hooks/useMediaQuery.ts`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean`. Task 9 (`ExhibicionesPage`) calls `useMediaQuery('(min-width: 1024px)')` to decide desktop-pagination vs. mobile-infinite-scroll — 1024px matches the `lg:` breakpoint `MainLayout` already uses for the sidebar drawer.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useMediaQuery.ts`:

```ts
import { useState, useEffect } from 'react';

// Puente entre un breakpoint CSS y una decisión de JS (qué modo de
// navegación usar en la lista de exhibiciones). Tailwind's `lg:` ya
// decide esto para el layout del sidebar en CSS puro; acá necesitamos
// saberlo en JS porque paginación clásica vs. scroll infinito son
// comportamientos de datos distintos, no solo estilos distintos.
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = () => setMatches(mql.matches);
        handler();
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return matches;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMediaQuery.ts
git commit -m "feat: useMediaQuery hook"
```

---

## Task 6: `ExhibicionCard` component

**Files:**
- Create: `src/components/exhibiciones/ExhibicionCard.tsx`

**Interfaces:**
- Consumes: `Exhibicion` type (Task 4).
- Produces: `ExhibicionCard` component, props `{ exhibicion: Exhibicion; onAction: (action: 'ver' | 'checklist' | 'ticket') => void }`. Task 9 renders one per item and passes a handler that opens the "Próximamente" dialog.

- [ ] **Step 1: Create the component**

Create `src/components/exhibiciones/ExhibicionCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { Eye, ListChecks, Ticket } from 'lucide-react';
import type { Exhibicion } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';

export interface ExhibicionCardProps {
    exhibicion: Exhibicion;
    onAction: (action: 'ver' | 'checklist' | 'ticket') => void;
}

const ESTADO_BADGE: Record<1 | 2, string> = {
    1: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    2: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
};

export function ExhibicionCard({ exhibicion, onAction }: ExhibicionCardProps) {
    const { t } = useTranslation();
    const fecha = new Date(exhibicion.fechaCrea);
    const fechaTexto = Number.isNaN(fecha.getTime())
        ? ''
        : fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
          ' ' + fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const estadoLabel = exhibicion.estadoId === 1
        ? t('exhibiciones_lista.estado_pendiente')
        : t('exhibiciones_lista.estado_aprobado');

    return (
        <div className="border border-cb-border rounded-2xl p-4 space-y-3 bg-card">
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-cb-text-primary">
                    {exhibicion.nroExhibicion} - {exhibicion.nombre}
                    {fechaTexto && <span className="font-normal text-cb-text-secondary"> ({fechaTexto})</span>}
                </p>
                <span className={cn('shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border', ESTADO_BADGE[exhibicion.estadoId])}>
                    {estadoLabel}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">{t('exhibiciones_lista.campo_tienda')}</p>
                    <p className="text-cb-text-primary truncate">{exhibicion.clienteNombre}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">{t('exhibiciones_lista.campo_sucursal')}</p>
                    <p className="text-cb-text-primary truncate">{exhibicion.sucursalNombre}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">{t('exhibiciones_lista.campo_tipo')}</p>
                    <p className="text-cb-text-primary truncate">{exhibicion.tipoNombre ?? '—'}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">{t('exhibiciones_lista.campo_ubicacion')}</p>
                    <p className="text-cb-text-primary truncate">{exhibicion.ubicacionNombre ?? '—'}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => onAction('ver')} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <Eye className="w-4 h-4" /> {t('exhibiciones_lista.accion_ver')}
                </button>
                <button type="button" onClick={() => onAction('checklist')} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <ListChecks className="w-4 h-4" /> {t('exhibiciones_lista.accion_checklist')}
                </button>
                <button type="button" onClick={() => onAction('ticket')} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <Ticket className="w-4 h-4" /> {t('exhibiciones_lista.accion_ticket')}
                </button>
            </div>
        </div>
    );
}

export default ExhibicionCard;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: errors about missing i18n keys are NOT type errors (i18next keys aren't statically checked here) — expect no TypeScript errors. It's fine that `t('exhibiciones_lista.*')` keys don't exist yet (Task 10 adds them); at runtime `react-i18next` falls back to the key itself, it won't crash.

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibiciones/ExhibicionCard.tsx
git commit -m "feat: ExhibicionCard component"
```

---

## Task 7: `FiltrosPanel` component

**Files:**
- Create: `src/components/exhibiciones/FiltrosPanel.tsx`

**Interfaces:**
- Consumes: `ExhibicionesFiltros`, `ExhibicionesFiltroOpciones` types (Task 4), `apiClient` (`src/services/apiClient.ts`).
- Produces: `FiltrosPanel` component, props `{ open: boolean; filtros: ExhibicionesFiltros; onApply: (f: ExhibicionesFiltros) => void; onClear: () => void }`. Task 9 owns the `open` boolean and the `filtros` state, and re-renders the list whenever `onApply`/`onClear` fire.

- [ ] **Step 1: Create the component**

Create `src/components/exhibiciones/FiltrosPanel.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import type { ExhibicionesFiltros, ExhibicionesFiltroOpciones } from '../../types/index.js';

export interface FiltrosPanelProps {
    open: boolean;
    filtros: ExhibicionesFiltros;
    onApply: (filtros: ExhibicionesFiltros) => void;
    onClear: () => void;
}

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

export function FiltrosPanel({ open, filtros, onApply, onClear }: FiltrosPanelProps) {
    const { t } = useTranslation();
    const [opciones, setOpciones] = useState<ExhibicionesFiltroOpciones | null>(null);
    const [draft, setDraft] = useState<ExhibicionesFiltros>(filtros);

    useEffect(() => {
        if (open && !opciones) {
            apiClient.get<ExhibicionesFiltroOpciones>('/exhibiciones/opciones-filtro')
                .then(setOpciones)
                .catch(() => setOpciones({ tipos: [], ubicaciones: [] }));
        }
    }, [open, opciones]);

    useEffect(() => {
        setDraft(filtros);
    }, [filtros]);

    if (!open) return null;

    return (
        <div className="border border-cb-border rounded-2xl p-4 bg-muted/30 space-y-4 enter-fade-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_tipo')}</label>
                    <select
                        className={INPUT_CLASS}
                        value={draft.tipo ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, tipo: e.target.value ? Number(e.target.value) : undefined }))}
                    >
                        <option value="">{t('exhibiciones_lista.filtro_todos')}</option>
                        {opciones?.tipos.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_estado')}</label>
                    <select
                        className={INPUT_CLASS}
                        value={draft.estado ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, estado: e.target.value ? (Number(e.target.value) as 1 | 2) : undefined }))}
                    >
                        <option value="">{t('exhibiciones_lista.filtro_todos')}</option>
                        <option value="1">{t('exhibiciones_lista.estado_pendiente')}</option>
                        <option value="2">{t('exhibiciones_lista.estado_aprobado')}</option>
                    </select>
                </div>
                <div>
                    <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_tienda')}</label>
                    <input
                        type="text"
                        className={INPUT_CLASS}
                        value={draft.tienda ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, tienda: e.target.value || undefined }))}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_fecha_desde')}</label>
                        <input
                            type="date"
                            className={INPUT_CLASS}
                            value={draft.fechaDesde ?? ''}
                            onChange={(e) => setDraft(d => ({ ...d, fechaDesde: e.target.value || undefined }))}
                        />
                    </div>
                    <div>
                        <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_fecha_hasta')}</label>
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
                    {t('exhibiciones_lista.filtro_aplicar')}
                </button>
                <button
                    type="button"
                    onClick={() => { setDraft({}); onClear(); }}
                    className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}
                >
                    {t('exhibiciones_lista.filtro_limpiar')}
                </button>
            </div>
        </div>
    );
}

export default FiltrosPanel;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibiciones/FiltrosPanel.tsx
git commit -m "feat: FiltrosPanel component"
```

---

## Task 8: `Pagination` component

**Files:**
- Create: `src/components/exhibiciones/Pagination.tsx`

**Interfaces:**
- Produces: `Pagination` component, props `{ page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void }`. Task 9 renders it only when `isDesktop` is true.

- [ ] **Step 1: Create the component**

Create `src/components/exhibiciones/Pagination.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50];

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
    const { t } = useTranslation();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const [pageInput, setPageInput] = useState(String(page));

    useEffect(() => setPageInput(String(page)), [page]);

    const commitPageInput = () => {
        const parsed = Math.min(totalPages, Math.max(1, Math.trunc(Number(pageInput)) || 1));
        setPageInput(String(parsed));
        if (parsed !== page) onPageChange(parsed);
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-cb-border mt-2">
            <div className="flex items-center gap-2 text-xs text-cb-text-secondary">
                <span>{t('exhibiciones_lista.por_pagina')}</span>
                <select
                    className="border border-cb-border rounded-lg px-2 py-1 text-sm bg-card cursor-pointer"
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                >
                    {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                </select>
                <span>{t('exhibiciones_lista.mostrando', { count: total === 0 ? 0 : Math.min(pageSize, total - (page - 1) * pageSize), total })}</span>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-cb-border text-cb-text-secondary hover:text-primary hover:bg-primary/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-cb-text-secondary px-1">
                    {t('exhibiciones_lista.pagina_de', { page, totalPages })}
                </span>
                <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={commitPageInput}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitPageInput(); }}
                    className="w-14 h-8 text-center border border-cb-border rounded-lg text-sm"
                />
                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-cb-border text-cb-text-secondary hover:text-primary hover:bg-primary/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default Pagination;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/exhibiciones/Pagination.tsx
git commit -m "feat: Pagination component"
```

---

## Task 9: `ExhibicionesPage` — orchestration

**Files:**
- Create: `src/pages/ExhibicionesPage.tsx`

**Interfaces:**
- Consumes: `ExhibicionCard` (Task 6), `FiltrosPanel` (Task 7), `Pagination` (Task 8), `useMediaQuery` (Task 5), `Exhibicion`/`ExhibicionesListResponse`/`ExhibicionesFiltros` types (Task 4), `apiClient`, `useDialog` (`src/context/DialogContext.tsx` — `alert(title, message): Promise<void>`), `SIATC_THEME`.
- Produces: `ExhibicionesPage` component (default export), no props — mounted directly on the `/exhibiciones` route. Task 11 imports it.

- [ ] **Step 1: Create the page**

Create `src/pages/ExhibicionesPage.tsx`:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useDialog } from '../context/DialogContext.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { ExhibicionCard } from '../components/exhibiciones/ExhibicionCard.js';
import { FiltrosPanel } from '../components/exhibiciones/FiltrosPanel.js';
import { Pagination } from '../components/exhibiciones/Pagination.js';
import type { Exhibicion, ExhibicionesListResponse, ExhibicionesFiltros } from '../types/index.js';

const DEFAULT_PAGE_SIZE = 20;

export function ExhibicionesPage() {
    const { t } = useTranslation();
    const { alert } = useDialog();
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [filtrosOpen, setFiltrosOpen] = useState(false);
    const [filtros, setFiltros] = useState<ExhibicionesFiltros>({});
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    const [items, setItems] = useState<Exhibicion[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [loadMoreError, setLoadMoreError] = useState(false);

    // Búsqueda con debounce — evita un request por cada tecla.
    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // append=false (búsqueda/filtro/página nueva en desktop) reemplaza la
    // lista y usa `loading`/`error`. append=true (scroll infinito en
    // mobile) agrega al final y usa `loadingMore`/`loadMoreError` — un
    // fallo cargando "más" no debe borrar lo que ya se ve, y debe ofrecer
    // reintentar en vez de reintentar solo automáticamente en bucle.
    const fetchPage = useCallback(async (pageToLoad: number, append: boolean) => {
        if (append) { setLoadingMore(true); setLoadMoreError(false); }
        else { setLoading(true); setError(''); }
        try {
            const params = new URLSearchParams();
            params.set('page', String(pageToLoad));
            params.set('pageSize', String(pageSize));
            if (search) params.set('search', search);
            if (filtros.tipo) params.set('tipo', String(filtros.tipo));
            if (filtros.estado) params.set('estado', String(filtros.estado));
            if (filtros.tienda) params.set('tienda', filtros.tienda);
            if (filtros.fechaDesde) params.set('fechaDesde', filtros.fechaDesde);
            if (filtros.fechaHasta) params.set('fechaHasta', filtros.fechaHasta);

            const data = await apiClient.get<ExhibicionesListResponse>(`/exhibiciones?${params.toString()}`);
            setTotal(data.total);
            setPage(data.page);
            setItems(prev => (append ? [...prev, ...data.items] : data.items));
        } catch (err) {
            const message = err instanceof Error ? err.message : t('exhibiciones_lista.error_cargar');
            if (append) setLoadMoreError(true); else setError(message);
        } finally {
            if (append) setLoadingMore(false); else setLoading(false);
        }
    }, [pageSize, search, filtros, t]);

    // Cualquier cambio de búsqueda/filtros/tamaño de página o de modo
    // (desktop↔mobile) reinicia la lista desde la página 1.
    useEffect(() => {
        setItems([]);
        setLoadMoreError(false);
        fetchPage(1, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, filtros, pageSize, isDesktop]);

    // Scroll infinito — solo en mobile, solo mientras haya más páginas, y
    // se detiene (no reintenta solo) si la última carga falló — el botón
    // "Reintentar" del centinela es quien vuelve a llamar fetchPage.
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

    const handleAction = (action: 'ver' | 'checklist' | 'ticket') => {
        void action;
        alert(t('exhibiciones_lista.proximamente_titulo'), t('exhibiciones_lista.proximamente_mensaje'));
    };

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div>
                    <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('exhibiciones_lista.title')}</h1>
                    <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('exhibiciones_lista.subtitle')}</p>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => setFiltrosOpen(v => !v)}
                            className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer shrink-0'}
                        >
                            <Filter className="w-4 h-4" /> {t('exhibiciones_lista.filtros')}
                        </button>
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                                <Search className="w-4 h-4" />
                            </div>
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder={t('exhibiciones_lista.search_placeholder')}
                                className="block w-full pl-10 pr-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => fetchPage(isDesktop ? page : 1, false)}
                            title={t('exhibiciones_lista.reintentar')}
                            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-cb-border text-cb-text-secondary hover:text-primary hover:bg-primary/10 transition-colors duration-150 active:scale-95 cursor-pointer"
                        >
                            <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                        </button>
                    </div>

                    <FiltrosPanel
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
                        <p className="text-sm text-cb-text-secondary text-center py-12">{t('exhibiciones_lista.vacio')}</p>
                    )}

                    <div className="space-y-3">
                        {items.map(item => (
                            <ExhibicionCard key={item.id} exhibicion={item} onAction={handleAction} />
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
                                    {t('exhibiciones_lista.reintentar')}
                                </button>
                            ) : (
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            )}
                        </div>
                    )}

                    {isDesktop && total > 0 && (
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={(p) => fetchPage(p, false)}
                            onPageSizeChange={(size) => setPageSize(size)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExhibicionesPage;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ExhibicionesPage.tsx
git commit -m "feat: ExhibicionesPage — orchestrates search, filtros, pagination/infinite-scroll"
```

---

## Task 10: i18n keys

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Produces: every `exhibiciones_lista.*` key referenced by Tasks 6-9.

- [ ] **Step 1: Add the Spanish keys**

In `public/locales/es.json`, add a new top-level `"exhibiciones_lista"` key (as a sibling of `"perfil"`, before the final closing `}`):

```json
    "exhibiciones_lista": {
        "title": "Exhibiciones",
        "subtitle": "Lista de exhibiciones registradas",
        "search_placeholder": "N° Exhibición...",
        "filtros": "Filtros",
        "filtro_tipo": "Tipo de exhibición",
        "filtro_estado": "Estado",
        "filtro_tienda": "Tienda / Sucursal",
        "filtro_fecha_desde": "Desde",
        "filtro_fecha_hasta": "Hasta",
        "filtro_aplicar": "Aplicar",
        "filtro_limpiar": "Limpiar",
        "filtro_todos": "Todos",
        "estado_pendiente": "Pendiente",
        "estado_aprobado": "Aprobado",
        "campo_tienda": "Tienda",
        "campo_sucursal": "Sucursal",
        "campo_tipo": "Tipo",
        "campo_ubicacion": "Ubicación",
        "accion_ver": "Ver",
        "accion_checklist": "Checklist",
        "accion_ticket": "Ticket",
        "proximamente_titulo": "Próximamente",
        "proximamente_mensaje": "Esta función todavía no está disponible.",
        "vacio": "No se encontraron exhibiciones con los filtros aplicados.",
        "error_cargar": "No se pudo cargar la lista de exhibiciones.",
        "mostrando": "Mostrando {{count}} de {{total}}",
        "pagina_de": "Página {{page}} de {{totalPages}}",
        "por_pagina": "Por página",
        "reintentar": "Recargar"
    }
```

Remember to add a trailing comma after the `"perfil": { ... }` block's closing `}` since this new key follows it.

- [ ] **Step 2: Add the English keys**

In `public/locales/en.json`, add the equivalent block in the same position:

```json
    "exhibiciones_lista": {
        "title": "Exhibits",
        "subtitle": "List of registered exhibits",
        "search_placeholder": "Exhibit N°...",
        "filtros": "Filters",
        "filtro_tipo": "Exhibit type",
        "filtro_estado": "Status",
        "filtro_tienda": "Store / Branch",
        "filtro_fecha_desde": "From",
        "filtro_fecha_hasta": "To",
        "filtro_aplicar": "Apply",
        "filtro_limpiar": "Clear",
        "filtro_todos": "All",
        "estado_pendiente": "Pending",
        "estado_aprobado": "Approved",
        "campo_tienda": "Store",
        "campo_sucursal": "Branch",
        "campo_tipo": "Type",
        "campo_ubicacion": "Location",
        "accion_ver": "View",
        "accion_checklist": "Checklist",
        "accion_ticket": "Ticket",
        "proximamente_titulo": "Coming soon",
        "proximamente_mensaje": "This feature isn't available yet.",
        "vacio": "No exhibits found with the applied filters.",
        "error_cargar": "Couldn't load the exhibits list.",
        "mostrando": "Showing {{count}} of {{total}}",
        "pagina_de": "Page {{page}} of {{totalPages}}",
        "por_pagina": "Per page",
        "reintentar": "Refresh"
    }
```

- [ ] **Step 3: Verify both files are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/es.json'))" && node -e "JSON.parse(require('fs').readFileSync('public/locales/en.json'))" && echo OK`
Expected: `OK` (no `SyntaxError`).

- [ ] **Step 4: Commit**

```bash
git add public/locales/es.json public/locales/en.json
git commit -m "feat: i18n keys for the exhibiciones list (es/en)"
```

---

## Task 11: Wire `ExhibicionesPage` into routing

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ExhibicionesPage` (Task 9).

- [ ] **Step 1: Replace the placeholder route and clean up the now-unused import**

In `src/App.tsx`, replace:

```tsx
import { ComingSoonPage } from './pages/ComingSoonPage.js';
import { Image, ListChecks, Ticket, Info } from 'lucide-react';
```

with:

```tsx
import { ComingSoonPage } from './pages/ComingSoonPage.js';
import { ExhibicionesPage } from './pages/ExhibicionesPage.js';
import { ListChecks, Ticket, Info } from 'lucide-react';
```

(`Image` was only used for the `/exhibiciones` placeholder's icon — with that route gone, `tsconfig.app.json`'s `noUnusedLocals: true` would fail the build if it stayed imported.)

Replace:

```tsx
                                <Route path="/exhibiciones" element={<ComingSoonPage titleKey="nav.exhibiciones" icon={Image} />} />
```

with:

```tsx
                                <Route path="/exhibiciones" element={<ExhibicionesPage />} />
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (specifically, no "`Image` is declared but never used").

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: mount ExhibicionesPage at /exhibiciones"
```

---

## Task 12: Full verification (tests, build, live browser check)

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all test files pass, including the new `server/lib/exhibicionesFilter.test.ts` (11 new tests) — total test count should be 46 (existing) + 11 = 57.

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` both succeed with no errors.

- [ ] **Step 3: Manual end-to-end check against the real database**

Start backend + frontend locally (same inline-env-var pattern used throughout this session — never write the DB password to a file):

```bash
# AZURE_SQL_PASSWORD debe estar ya exportado en el shell donde se corre esto
# — nunca escribir la contraseña real en este archivo (queda commiteado a git).
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" PORT=3000 npx tsx server/index.ts &
npx vite --port 5173 &
```

In the browser (or via the Claude Browser tool as done earlier in this session):
1. Log in, click "Exhibiciones" in the sidebar.
2. Confirm the list loads with real data (compare a couple of entries against the reference screenshot — e.g. `EXB0000003 - lineal de Campana`).
3. Type into the search box, confirm the list narrows to matching `nroExhibicion`/`nombre` after the debounce.
4. Open "Filtros", pick a `tipo`, click "Aplicar" — confirm the list narrows and every visible card's Tipo matches.
5. Click "Limpiar" — confirm it goes back to the unfiltered list.
6. Resize the browser to ≥1024px wide — confirm the classic `Pagination` control appears at the bottom (page size selector + page number + prev/next), and that changing the page size or the page actually changes the visible cards.
7. Resize to <1024px (or use the `mobile` preset) — confirm `Pagination` is replaced by scroll-to-load: scrolling to the bottom of the card list fetches and appends the next batch.
8. Click "Ver", "Checklist", and "Ticket" on any card — confirm each opens the "Próximamente" dialog, not a broken link.
9. Check the browser console for errors (ignore Vite HMR websocket noise if using the Claude Browser tool in a background tab, per the pattern established earlier this session).

- [ ] **Step 4: Stop local servers**

```bash
kill %1 %2
```

(Or find and `taskkill` the PIDs listening on 3000/5173, same as done throughout this session on Windows.)

- [ ] **Step 5: Final commit if anything was adjusted during manual verification**

If Step 3 surfaced anything requiring a fix, fix it, re-run Steps 1-2, and commit with a message describing what was found and fixed.
