# Ticket — Crear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Nuevo Ticket" — create a service request (`Requerimiento`) tied to an existing exhibición, typed from a 9-item catalog that has never been wired to any code before, reachable from the "Ticket" option on each exhibición's kebab menu.

**Architecture:** Three new backend endpoints on the existing `server/routes/exhibiciones.ts` (a static type catalog, a create endpoint that inserts a header + history row + N component-detail rows inside one transaction, and a photo-upload endpoint that reuses the exact Blob Storage pattern already proven in Exhibición-Crear), plus one new frontend page with 3 local tabs (Principal/Componentes/Fotos, no separate routes per tab) that reuses the already-shipped exhibición-detail endpoint for read-only context.

**Tech Stack:** Express + TypeScript (`tsx`) · `mssql` · React 19 + `react-i18next` + `react-router-dom` v7 · existing `apiClient`/`SIATC_THEME`/`useDialog` conventions.

**Spec:** [docs/superpowers/specs/2026-08-31-ticket-crear-design.md](../specs/2026-08-31-ticket-crear-design.md)

## Global Constraints

- Writes go directly to `EXHIBICION.WEB_MARKETING_REQUERIMIENTO` and its satellite tables — never call the legacy `PROC_GUARDAR_WEB_MARKETING_REQUERIMIENTO` (a generic form for an unrelated module with capacitación/trade/espacio fields out of scope here).
- `VC_organizacion='1301'`, `VC_sociedad='1300'`, and (for detail lines) `VC_centro='1301'` are fixed constants — 100% of real data uses them, they are never user input or config.
- The ticket number is `'RSM' + 7 digits`, a **global** running counter (never resets by month, unlike the checklist number) — generated inside a transaction with `WITH (UPDLOCK, HOLDLOCK)` over `MAX(CONVERT(INT, SUBSTRING(VC_requerimiento, 4, 99))) WHERE SUBSTRING(VC_requerimiento, 1, 3) = 'RSM'`.
- `WEB_MARKETING_REQUERIMIENTO` has no numeric primary key — `VC_requerimiento` (e.g. `'RSM0000567'`) IS the identifier used everywhere (route params, responses).
- The header insert, the history insert, and all component-detail-line inserts happen inside **one transaction** — never a ticket header with only some of its chosen component lines.
- `componentes` may be an empty array (some ticket types need none) — this must never be treated as invalid input, and the multi-row INSERT must be skipped (not attempted with zero rows) when it's empty.
- A component line's `VC_articulo_codigo`, `VC_articulo_nombre`, and `VC_articulo_tipo` (`'PRD'`/`'CAR'`) are always looked up server-side from `TB_EXHIBICION_COMPONENTE`/`WEB_MARKETING_PRODUCTOS` by `componenteId` — never trusted from the client request body.
- A component line's `componenteId` must belong to the exhibición the ticket is being created for, and be active (`IN_estado = 1`) — never accept a componenteId from a different exhibición.
- `motivo` (→ `VC_observacion`) has a hard 200-character limit (`WEB_MARKETING_REQUERIMIENTO.VC_observacion` is `VARCHAR(200)`) — validated server-side.
- Out of scope for this plan (do not build): the "¿cuenta con punto de luz?"/espacio fields, a Contactos selector, any ticket list/bandeja, viewing/editing/approving an existing ticket. Saving navigates straight back to `/exhibiciones/:id` — there is no ticket-detail page.
- After creating (header + optional photos), show a visible confirmation (`useDialog().alert(...)`) before navigating back — learned from Checklist-Crear's final review (Important #4): the exhibición detail page shows nothing ticket-related, so the user needs explicit feedback that something was saved.
- Photo upload reuses `decodificarFotoBase64` (`server/lib/blobUpload.ts`) and `buildFotoUrl` (`server/lib/exhibicionFotos.ts`) exactly as-is — same Blob container (`exhibiciones`), same 8MB cap, same UUID-named blob convention as `TB_EXHIBICION_FOTO`.
- Every new user-facing string goes through `react-i18next` under a new `ticket_crear.*` namespace.
- Follow existing conventions: `SIATC_THEME` tokens, `apiClient`, `navigate(path, { viewTransition: true })`, `PAGE_SUBTITLE_VISIBLE` (not `PAGE_SUBTITLE`) for a subtitle identifying the record, `cn()` for conditional class names.
- Never write the real Azure SQL admin password or the Blob Storage SAS token into any file that gets committed to git — pass them only as inline shell environment variables to one-off verification commands.

---

## Task 1: `validarTicketCrear` — pure server-side validation

**Files:**
- Create: `server/lib/ticketCrear.ts`
- Test: `server/lib/ticketCrear.test.ts`

**Interfaces:**
- Produces: `TicketComponenteInput` (`{ componenteId: number; cantidad: number }`), `DatosTicketValidados` (`{ tipoId: number; motivo: string; componentes: TicketComponenteInput[] }`), `ValidacionTicket` (`{ valido: true; datos: DatosTicketValidados } | { valido: false; error: string }`), and `validarTicketCrear(body: unknown, tiposValidos: number[], componentesValidos: number[]): ValidacionTicket`. Task 3 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/ticketCrear.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validarTicketCrear } from './ticketCrear.js';

const TIPOS = [1, 2, 3, 6, 7];
const COMPONENTES = [101, 102, 103];

function body(overrides: Record<string, unknown> = {}) {
    return { tipoId: 7, motivo: 'Reposición de accesorios faltantes', componentes: [], ...overrides };
}

describe('validarTicketCrear', () => {
    it('accepts a valid ticket with no componentes', () => {
        const result = validarTicketCrear(body(), TIPOS, COMPONENTES);
        expect(result).toEqual({
            valido: true,
            datos: { tipoId: 7, motivo: 'Reposición de accesorios faltantes', componentes: [] },
        });
    });

    it('accepts a valid ticket with componentes, trims motivo', () => {
        const result = validarTicketCrear(
            body({ motivo: '  Cambiar carcasa dañada  ', componentes: [{ componenteId: 101, cantidad: 2 }] }),
            TIPOS, COMPONENTES
        );
        expect(result).toEqual({
            valido: true,
            datos: { tipoId: 7, motivo: 'Cambiar carcasa dañada', componentes: [{ componenteId: 101, cantidad: 2 }] },
        });
    });

    it('accepts multiple distinct componentes', () => {
        const result = validarTicketCrear(
            body({ componentes: [{ componenteId: 101, cantidad: 1 }, { componenteId: 103, cantidad: 5 }] }),
            TIPOS, COMPONENTES
        );
        expect(result.valido).toBe(true);
    });

    it('rejects a tipoId not in the active catalog', () => {
        expect(validarTicketCrear(body({ tipoId: 99 }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'Tipo de ticket inválido.' });
    });

    it('rejects a missing or non-numeric tipoId', () => {
        expect(validarTicketCrear(body({ tipoId: 'x' }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'Tipo de ticket inválido.' });
    });

    it('rejects an empty or whitespace-only motivo', () => {
        expect(validarTicketCrear(body({ motivo: '   ' }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'El motivo es obligatorio.' });
    });

    it('rejects a motivo longer than 200 characters', () => {
        expect(validarTicketCrear(body({ motivo: 'x'.repeat(201) }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'El motivo no puede superar los 200 caracteres.' });
    });

    it('rejects a componenteId not in the exhibición\'s own componentes', () => {
        expect(validarTicketCrear(body({ componentes: [{ componenteId: 999, cantidad: 1 }] }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'Componente inválido.' });
    });

    it('rejects a duplicated componenteId', () => {
        expect(validarTicketCrear(
            body({ componentes: [{ componenteId: 101, cantidad: 1 }, { componenteId: 101, cantidad: 2 }] }),
            TIPOS, COMPONENTES
        )).toEqual({ valido: false, error: 'Componente duplicado.' });
    });

    it('rejects a cantidad that is zero, negative, or not an integer', () => {
        expect(validarTicketCrear(body({ componentes: [{ componenteId: 101, cantidad: 0 }] }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'La cantidad debe ser un número entero mayor a 0.' });
        expect(validarTicketCrear(body({ componentes: [{ componenteId: 101, cantidad: 1.5 }] }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'La cantidad debe ser un número entero mayor a 0.' });
    });

    it('rejects componentes that is not an array', () => {
        expect(validarTicketCrear(body({ componentes: 'no' }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'Datos inválidos.' });
    });

    it('rejects a non-object body', () => {
        expect(validarTicketCrear(null, TIPOS, COMPONENTES)).toEqual({ valido: false, error: 'Datos inválidos.' });
        expect(validarTicketCrear('x', TIPOS, COMPONENTES)).toEqual({ valido: false, error: 'Datos inválidos.' });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/ticketCrear.test.ts`
Expected: FAIL — `Cannot find module './ticketCrear.js'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/ticketCrear.ts`:

```ts
export interface TicketComponenteInput {
    componenteId: number;
    cantidad: number;
}

export interface DatosTicketValidados {
    tipoId: number;
    motivo: string;
    componentes: TicketComponenteInput[];
}

export type ValidacionTicket =
    | { valido: true; datos: DatosTicketValidados }
    | { valido: false; error: string };

const MAX_MOTIVO_LENGTH = 200; // WEB_MARKETING_REQUERIMIENTO.VC_observacion es VARCHAR(200)

// Puro — recibe los tipos y componentes válidos ya consultados por el route
// handler (así no toca la base de datos y es testeable aislado). `tiposValidos`
// son los IN_tipo_id activos de TB_TIPOS_REQUERIMIENTO; `componentesValidos`
// son los IN_exhibicion_componente_id activos que YA pertenecen a la
// exhibición para la que se crea el ticket (nunca el catálogo completo).
// `componentes` puede venir vacío — hay tipos de ticket (p.ej. Capacitación)
// que no necesitan ninguno.
export function validarTicketCrear(body: unknown, tiposValidos: number[], componentesValidos: number[]): ValidacionTicket {
    if (typeof body !== 'object' || body === null) {
        return { valido: false, error: 'Datos inválidos.' };
    }
    const b = body as Record<string, unknown>;

    const tipoId = Number(b.tipoId);
    if (!Number.isInteger(tipoId) || !tiposValidos.includes(tipoId)) {
        return { valido: false, error: 'Tipo de ticket inválido.' };
    }

    const motivo = typeof b.motivo === 'string' ? b.motivo.trim() : '';
    if (!motivo) {
        return { valido: false, error: 'El motivo es obligatorio.' };
    }
    if (motivo.length > MAX_MOTIVO_LENGTH) {
        return { valido: false, error: `El motivo no puede superar los ${MAX_MOTIVO_LENGTH} caracteres.` };
    }

    if (!Array.isArray(b.componentes)) {
        return { valido: false, error: 'Datos inválidos.' };
    }

    const vistos = new Set<number>();
    const componentes: TicketComponenteInput[] = [];
    for (const raw of b.componentes) {
        if (typeof raw !== 'object' || raw === null) {
            return { valido: false, error: 'Datos inválidos.' };
        }
        const r = raw as Record<string, unknown>;
        const componenteId = Number(r.componenteId);
        const cantidad = Number(r.cantidad);

        if (!Number.isInteger(componenteId) || !componentesValidos.includes(componenteId)) {
            return { valido: false, error: 'Componente inválido.' };
        }
        if (vistos.has(componenteId)) {
            return { valido: false, error: 'Componente duplicado.' };
        }
        vistos.add(componenteId);

        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            return { valido: false, error: 'La cantidad debe ser un número entero mayor a 0.' };
        }

        componentes.push({ componenteId, cantidad });
    }

    return { valido: true, datos: { tipoId, motivo, componentes } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/ticketCrear.test.ts`
Expected: PASS — all 13 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/ticketCrear.ts server/lib/ticketCrear.test.ts
git commit -m "feat: validarTicketCrear — server-side validation for creating a ticket"
```

---

## Task 2: `GET /api/exhibiciones/tipos-ticket`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Produces: `GET /tipos-ticket` → `{ tipos: { id: number; codigo: string; nombre: string }[] }`.

- [ ] **Step 1: Add the route**

In `server/routes/exhibiciones.ts`, add this route directly after `GET /catalogo-checklist` (still before `GET /:id` — literal routes must stay ahead of the `:id` param route, same reasoning as every other literal route in this file):

```ts
// EXHIBICION.TB_TIPOS_REQUERIMIENTO — catálogo de 9 tipos de ticket
// (Mantenimiento, Modificación, Muebles, Capacitación, POP, Recojo,
// Reposición, Folletería, Otros). Confirmado que hasta este plan ninguna
// columna ni procedimiento existente la usaba — ver spec.
router.get('/tipos-ticket', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request().query(`
            SELECT IN_tipo_id as id, VC_codigo as codigo, VC_nombre as nombre
            FROM EXHIBICION.TB_TIPOS_REQUERIMIENTO
            WHERE BI_activo = 1
            ORDER BY IN_orden
        `);
        res.json({ tipos: result.recordset });
    } catch (err: unknown) {
        console.error('[Exhibiciones] tipos-ticket error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification against the real database**

Start the backend locally (inline env vars, never written to a file):

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" PORT=3000 npx tsx server/index.ts
```

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"REPLACE_WITH_CURRENT_ADMIN_PASSWORD"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s http://localhost:3000/api/exhibiciones/tipos-ticket -H "Authorization: Bearer $TOKEN"
```

Expected: `{"tipos":[...]}` with exactly 9 entries, in this order: Mantenimiento de exhibición (MNT), Modificación de exhibición (MOD), Muebles de exhibición (MUE), Capacitación (CAP), Material POP/Merchandising (POP), Recojo de exhibición (REC), Reposición de exhibición (REP), Folletería y tags precios (FOL), Otros (OTR).

- [ ] **Step 4: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: GET /api/exhibiciones/tipos-ticket"
```

---

## Task 3: `POST /api/exhibiciones/:id/tickets`

**Files:**
- Modify: `server/routes/exhibiciones.ts`

**Interfaces:**
- Consumes: `validarTicketCrear` (Task 1).
- Produces: `POST /:id/tickets` → `201 { numero: string }`, `400`, or `404`.

- [ ] **Step 1: Add the import**

In `server/routes/exhibiciones.ts`, replace:

```ts
import { validarChecklistItems } from '../lib/checklistCrear.js';
```

with:

```ts
import { validarChecklistItems } from '../lib/checklistCrear.js';
import { validarTicketCrear } from '../lib/ticketCrear.js';
```

- [ ] **Step 2: Add the route**

Add this route directly after `POST /:id/checklist` (still before `POST /:id/aprobar` — order among these POST routes doesn't affect matching since their literal suffixes never collide):

```ts
router.post('/:id/tickets', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();

        const exhibicionResult = await pool.request().input('id', sql.BigInt, id).query(`
            SELECT VC_cliente_codigo as clienteCodigo, VC_sucursal_codigo as sucursalCodigo, VC_cliente_nombre as clienteNombre
            FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id
        `);
        const exhibicion = exhibicionResult.recordset[0];
        if (!exhibicion) {
            res.status(404).json({ error: 'Exhibición no encontrada.' });
            return;
        }

        const tiposResult = await pool.request().query(`
            SELECT IN_tipo_id as id FROM EXHIBICION.TB_TIPOS_REQUERIMIENTO WHERE BI_activo = 1
        `);
        const tiposValidos: number[] = tiposResult.recordset.map((r: { id: number }) => r.id);

        const componentesResult = await pool.request().input('id', sql.BigInt, id).query(`
            SELECT IN_exhibicion_componente_id as id
            FROM EXHIBICION.TB_EXHIBICION_COMPONENTE WHERE IN_exhibicion_id = @id AND IN_estado = 1
        `);
        // Number(...) explícito: IN_exhibicion_componente_id es BIGINT — el
        // driver mssql lo devuelve como string aunque el tipo TS diga
        // number. Sin esto, validarTicketCrear compararía un number (del
        // body ya parseado) contra strings y rechazaría TODO componente
        // válido (mismo patrón de bug ya conocido, ver progress.md de
        // checklist-crear).
        const componentesValidos: number[] = componentesResult.recordset.map((r: { id: number }) => Number(r.id));

        const validacion = validarTicketCrear(req.body, tiposValidos, componentesValidos);
        if (!validacion.valido) {
            res.status(400).json({ error: validacion.error });
            return;
        }
        const { tipoId, motivo, componentes } = validacion.datos;

        const usuario = req.user?.username ?? 'system';
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const cabeceraRequest = new sql.Request(transaction);
            cabeceraRequest.input('exhibicionId', sql.BigInt, id);
            cabeceraRequest.input('tipoId', sql.Int, tipoId);
            cabeceraRequest.input('motivo', sql.VarChar(200), motivo);
            cabeceraRequest.input('clienteCodigo', sql.VarChar(10), exhibicion.clienteCodigo);
            cabeceraRequest.input('sucursalCodigo', sql.VarChar(10), exhibicion.sucursalCodigo);
            cabeceraRequest.input('clienteNombre', sql.VarChar(120), exhibicion.clienteNombre);
            cabeceraRequest.input('usuario', sql.VarChar(20), usuario);

            // WITH (UPDLOCK, HOLDLOCK): resguarda contra colisiones ENTRE
            // llamadas a este mismo endpoint. A diferencia del N° de
            // checklist, este es un contador GLOBAL (nunca se reinicia por
            // mes) — mismo esquema que ya usaba el proc legacy
            // PROC_GUARDAR_WEB_MARKETING_REQUERIMIENTO. Esa tabla lleva sin
            // actividad desde 2023-12-01 (confirmado en la spec): hoy no hay
            // ningún escritor legacy vivo compitiendo por este número, a
            // diferencia del caso de checklist.
            const cabeceraResult = await cabeceraRequest.query(`
                DECLARE @sgte INT
                SELECT @sgte = ISNULL(MAX(CONVERT(INT, SUBSTRING(VC_requerimiento, 4, 99))), 0) + 1
                FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO WITH (UPDLOCK, HOLDLOCK)
                WHERE SUBSTRING(VC_requerimiento, 1, 3) = 'RSM'

                DECLARE @numero VARCHAR(10) = 'RSM' + RIGHT('0000000' + CONVERT(VARCHAR, @sgte), 7)

                INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO
                    (VC_organizacion, VC_sociedad, VC_requerimiento, IN_exhibicion_id, IN_tipo_rq_id,
                     VC_observacion, VC_estado, CH_anulado, CH_ticket,
                     VC_cliente_codigo, VC_cliente_sucursal, VC_cliente_nombre,
                     IN_capacparticipantes, VC_usuario_crea, DT_fecha_crea)
                OUTPUT INSERTED.VC_requerimiento as numero
                VALUES
                    ('1301', '1300', @numero, @exhibicionId, @tipoId,
                     @motivo, '01', 'N', 'W',
                     @clienteCodigo, @sucursalCodigo, @clienteNombre,
                     0, @usuario, GETDATE())
            `);

            const numero: string = cabeceraResult.recordset[0].numero;

            const histRequest = new sql.Request(transaction);
            histRequest.input('numero', sql.VarChar(10), numero);
            histRequest.input('usuario', sql.VarChar(50), usuario);
            histRequest.input('nombre', sql.VarChar(150), usuario);
            await histRequest.query(`
                INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO_HIST (VC_requerimiento, VC_usuario, VC_nombre, VC_estado, VC_observacion)
                VALUES (@numero, @usuario, @nombre, '01', NULL)
            `);

            if (componentes.length > 0) {
                // Busca código/nombre/tipo real por componenteId — nunca se
                // confía en lo que mande el cliente (Global Constraint).
                const lookupRequest = new sql.Request(transaction);
                const placeholders = componentes.map((c, i) => {
                    lookupRequest.input(`compId${i}`, sql.BigInt, c.componenteId);
                    return `@compId${i}`;
                });
                const lookupResult = await lookupRequest.query(`
                    SELECT
                        C.IN_exhibicion_componente_id as componenteId,
                        C.IN_tipo as tipo,
                        C.VC_codigo_producto as codigo,
                        P.VC_articulo_nombre2 as nombre
                    FROM EXHIBICION.TB_EXHIBICION_COMPONENTE C
                    LEFT JOIN EXHIBICION.WEB_MARKETING_PRODUCTOS P
                        ON P.VC_articulo_codigo = C.VC_codigo_producto
                        AND P.VC_tipo = CASE C.IN_tipo WHEN 1 THEN 'PRD' WHEN 2 THEN 'CAR' END
                    WHERE C.IN_exhibicion_componente_id IN (${placeholders.join(', ')})
                `);
                // Number(...) explícito por el mismo motivo que arriba —
                // IN_exhibicion_componente_id vuelve a llegar como BIGINT.
                const porId = new Map(lookupResult.recordset.map((r: { componenteId: number; tipo: number; codigo: string; nombre: string | null }) => [Number(r.componenteId), r]));

                const detalleRequest = new sql.Request(transaction);
                detalleRequest.input('numero', sql.VarChar(10), numero);
                detalleRequest.input('usuario', sql.VarChar(20), usuario);
                const filas = componentes.map((c, i) => {
                    const info = porId.get(c.componenteId);
                    const articuloTipo = info?.tipo === 1 ? 'PRD' : 'CAR';
                    detalleRequest.input(`articuloTipo${i}`, sql.VarChar(3), articuloTipo);
                    detalleRequest.input(`articuloCodigo${i}`, sql.VarChar(20), info?.codigo ?? '');
                    detalleRequest.input(`articuloNombre${i}`, sql.VarChar(120), info?.nombre ?? '');
                    detalleRequest.input(`cantidad${i}`, sql.Int, c.cantidad);
                    return `(@numero, 'E', '', '1301', '', @articuloTipo${i}, @articuloCodigo${i}, @articuloNombre${i}, 'UNI', @cantidad${i}, 'A', @usuario, GETDATE())`;
                });
                await detalleRequest.query(`
                    INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO_DETALLE
                        (VC_requerimiento, VC_tipo, VC_posicion, VC_centro, VC_almacen,
                         VC_articulo_tipo, VC_articulo_codigo, VC_articulo_nombre, VC_articulo_um,
                         IN_articulo_cantidad, CH_estado, VC_usuario_crea, DT_fecha_crea)
                    VALUES ${filas.join(', ')}
                `);
            }

            await transaction.commit();
            res.status(201).json({ numero });
        } catch (txErr) {
            await transaction.rollback().catch(() => {});
            throw txErr;
        }
    } catch (err: unknown) {
        console.error('[Exhibiciones] crear ticket error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification against the real database**

With the backend still running from Task 2, using a real exhibición id that has at least one componente already assigned (check via `GET /api/exhibiciones/<id>` — look for a non-empty `componentes.carcasas` or `componentes.productos`), and a real `tipoId` from Task 2's response (e.g. `7` for Reposición):

```bash
curl -s -X POST http://localhost:3000/api/exhibiciones/<REAL_ID>/tickets \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tipoId":7,"motivo":"Prueba SDD — reposición de accesorio","componentes":[{"componenteId":<REAL_COMPONENTE_ID>,"cantidad":1}]}'
```

Expected: `201` with `{"numero":"RSM00XXXXX"}`. **Anota el `numero` devuelto — lo necesitas para la Task 4 y para limpiarlo en la Task 10.** Then test with an empty `componentes` array:

```bash
curl -s -X POST http://localhost:3000/api/exhibiciones/<REAL_ID>/tickets \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tipoId":4,"motivo":"Prueba SDD — sin componentes","componentes":[]}'
```

Expected: `201` with a new, higher `numero`. Then test validation (invalid tipoId):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/exhibiciones/<REAL_ID>/tickets \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tipoId":999,"motivo":"x","componentes":[]}'
```

Expected: `400`. Finally, directly query the database (one-off script, same inline-credential pattern as always) to confirm both tickets created above have exactly the right number of `WEB_MARKETING_REQUERIMIENTO_DETALLE` rows (1 and 0 respectively) and a `WEB_MARKETING_REQUERIMIENTO_HIST` row each with `VC_estado = '01'`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/exhibiciones.ts
git commit -m "feat: POST /api/exhibiciones/:id/tickets — race-safe global ticket number, header+hist+lines in one transaction"
```

---

## Task 4: `POST /api/exhibiciones/:id/tickets/:numero/fotos`

**Files:**
- Modify: `server/routes/exhibiciones.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `decodificarFotoBase64` (`server/lib/blobUpload.ts`, existing), `buildFotoUrl` (`server/lib/exhibicionFotos.ts`, existing).
- Produces: `POST /:id/tickets/:numero/fotos` → `201 { id: number; url: string }`, `400`, `404`, or `502`.

- [ ] **Step 1: Raise the body size limit for this route**

In `server/index.ts`, replace:

```ts
app.use('/api/exhibiciones/:id/fotos', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '2mb' }));
```

with:

```ts
app.use('/api/exhibiciones/:id/fotos', express.json({ limit: '12mb' }));
app.use('/api/exhibiciones/:id/tickets/:numero/fotos', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '2mb' }));
```

- [ ] **Step 2: Add the route**

In `server/routes/exhibiciones.ts`, add this route directly after `POST /:id/tickets` (still before `POST /:id/aprobar`):

```ts
router.post('/:id/tickets/:numero/fotos', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const numero = req.params.numero;
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const exists = await pool.request().input('id', sql.BigInt, id).input('numero', sql.VarChar(10), numero).query(`
            SELECT 1 FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO WHERE VC_requerimiento = @numero AND IN_exhibicion_id = @id
        `);
        if (exists.recordset.length === 0) {
            res.status(404).json({ error: 'Ticket no encontrado.' });
            return;
        }

        const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType : '';
        const archivoBase64 = typeof req.body?.archivoBase64 === 'string' ? req.body.archivoBase64 : '';

        const resultado = decodificarFotoBase64(archivoBase64, contentType, MAX_FOTO_BYTES);
        if (!resultado.ok) {
            res.status(400).json({ error: resultado.error });
            return;
        }

        const blobContainerUrl = cleanEnv('BLOB_CONTAINER_URL');
        const blobSasToken = cleanEnv('BLOB_SAS_TOKEN');
        const nombreArchivo = `${randomUUID()}${resultado.foto.extension}`;

        const uploadRes = await fetch(buildFotoUrl(blobContainerUrl, blobSasToken, nombreArchivo), {
            method: 'PUT',
            headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType },
            body: resultado.foto.buffer,
        });
        if (!uploadRes.ok) {
            const detalle = await uploadRes.text().catch(() => '');
            console.error('[Exhibiciones] subida a blob (ticket) falló:', uploadRes.status, detalle);
            res.status(502).json({ error: 'No se pudo subir la foto. Intenta de nuevo.' });
            return;
        }

        const insertResult = await pool.request()
            .input('numero', sql.VarChar(10), numero)
            .input('nombre', sql.VarChar(200), nombreArchivo)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO_FOTO
                    (VC_requerimiento, VC_directorio, VC_archivo_nombre, IN_estado, VC_usuario_crea, DT_fecha_crea)
                OUTPUT INSERTED.IN_requerimiento_foto_id as id
                VALUES (@numero, '', @nombre, 1, @usuario, GETDATE())
            `);

        // Number(...): IN_requerimiento_foto_id es BIGINT — mismo patrón
        // ya conocido en el resto del código, se normaliza a number acá
        // para que coincida con el tipo TicketFoto.id.
        res.status(201).json({ id: Number(insertResult.recordset[0].id), url: buildFotoUrl(blobContainerUrl, blobSasToken, nombreArchivo) });
    } catch (err: unknown) {
        console.error('[Exhibiciones] agregar foto de ticket error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification against the real database**

Using the `numero` from Task 3's verification and a small real JPEG (base64-encode it yourself, e.g. `base64 -w0 photo.jpg`):

```bash
curl -s -X POST http://localhost:3000/api/exhibiciones/<REAL_ID>/tickets/<NUMERO>/fotos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"archivoBase64\":\"$(base64 -w0 photo.jpg)\",\"contentType\":\"image/jpeg\"}"
```

Expected: `201` with `{"id": <number>, "url": "https://...blob.core.windows.net/exhibiciones/<uuid>.jpg?..."}`. If no write-capable Blob SAS token is available in this environment, note that explicitly in the task report instead of skipping verification silently — this mirrors the same deferred-verification gap already accepted for Exhibición-Crear's own photo upload.

Kill the backend process when done with Tasks 2-4's verification.

- [ ] **Step 5: Commit**

```bash
git add server/index.ts server/routes/exhibiciones.ts
git commit -m "feat: POST /api/exhibiciones/:id/tickets/:numero/fotos"
```

---

## Task 5: Frontend types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `TipoTicketOpcion`, `TiposTicketResponse`, `TicketComponenteInput`, `CrearTicketInput`, `CrearTicketResponse`, `AgregarFotoTicketInput`, `TicketFoto`. Task 7 imports all of these.

- [ ] **Step 1: Add the types**

Append to `src/types/index.ts` (after the existing `CrearChecklistResponse` interface):

```ts
export interface TipoTicketOpcion {
    id: number;
    codigo: string;
    nombre: string;
}

export interface TiposTicketResponse {
    tipos: TipoTicketOpcion[];
}

export interface TicketComponenteInput {
    componenteId: number;
    cantidad: number;
}

export interface CrearTicketInput {
    tipoId: number;
    motivo: string;
    componentes: TicketComponenteInput[];
}

export interface CrearTicketResponse {
    numero: string;
}

export interface AgregarFotoTicketInput {
    archivoBase64: string;
    contentType: string;
}

export interface TicketFoto {
    id: number;
    url: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: frontend types for creating a ticket"
```

---

## Task 6: `TicketCrearPage` — the 3-tab ticket form

**Files:**
- Create: `src/pages/TicketCrearPage.tsx`

**Interfaces:**
- Consumes: `ExhibicionDetalle`, `ExhibicionComponenteItem` (existing types), `TiposTicketResponse`, `TipoTicketOpcion`, `CrearTicketInput`, `CrearTicketResponse`, `AgregarFotoTicketInput`, `TicketFoto` (Task 5), `apiClient`, `SIATC_THEME`, `cn`, `useDialog`.
- Produces: `TicketCrearPage` component (default export), no props — mounted on `/exhibiciones/:id/tickets/nuevo`. Task 7 wires the route.

- [ ] **Step 1: Create the page**

Create `src/pages/TicketCrearPage.tsx`:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle, Plus, ImageOff } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useDialog } from '../context/DialogContext.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { cn } from '../utils/cn.js';
import type {
    ExhibicionDetalle, TiposTicketResponse, TipoTicketOpcion,
    CrearTicketInput, CrearTicketResponse, AgregarFotoTicketInput, TicketFoto,
} from '../types/index.js';

type TabKey = 'principal' | 'componentes' | 'fotos';

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

// Convierte un File a base64 + contentType — mismo helper ya usado en
// DetalleFotosTab, duplicado acá porque no vale la pena extraer un módulo
// compartido para 12 líneas usadas en solo 2 sitios (YAGNI).
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

function Foto({ url }: { url: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) {
        return (
            <div className="aspect-square rounded-xl border border-cb-border flex items-center justify-center bg-muted text-cb-text-secondary">
                <ImageOff className="w-6 h-6" />
            </div>
        );
    }
    return <img src={url} onError={() => setFailed(true)} className="aspect-square rounded-xl border border-cb-border object-cover" alt="" />;
}

export function TicketCrearPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { alert } = useDialog();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [tab, setTab] = useState<TabKey>('principal');
    const [exhibicion, setExhibicion] = useState<ExhibicionDetalle | null>(null);
    const [tipos, setTipos] = useState<TipoTicketOpcion[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [tipoId, setTipoId] = useState('');
    const [motivo, setMotivo] = useState('');
    const [cantidades, setCantidades] = useState<Record<number, string>>({});

    const [numero, setNumero] = useState<string | null>(null);
    const [fotos, setFotos] = useState<TicketFoto[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const [errorFoto, setErrorFoto] = useState('');

    const cargar = useCallback(() => {
        setLoading(true);
        setError('');
        Promise.all([
            apiClient.get<ExhibicionDetalle>(`/exhibiciones/${id}`),
            apiClient.get<TiposTicketResponse>('/exhibiciones/tipos-ticket'),
        ])
            .then(([exhibicionData, tiposData]) => {
                setExhibicion(exhibicionData);
                setTipos(tiposData.tipos);
            })
            .catch(() => setError(t('ticket_crear.error_cargar')))
            .finally(() => setLoading(false));
    }, [id, t]);

    useEffect(() => { cargar(); }, [cargar]);

    const volver = () => navigate(`/exhibiciones/${id}`, { viewTransition: true });

    // Deshabilitado si el catálogo de tipos llega vacío (no debería pasar
    // con datos sanos, pero un formulario sin ningún tipo elegible no debe
    // dejar crear un ticket sin sentido — mismo guard ya aplicado en
    // Checklist-Crear tras su revisión final).
    const puedeGuardar = (tipos?.length ?? 0) > 0 && tipoId !== '' && motivo.trim() !== '' && !guardando;

    const handleGuardar = async () => {
        if (!exhibicion) return;
        setGuardando(true);
        setErrorGuardar('');
        try {
            const componentes = [...exhibicion.componentes.carcasas, ...exhibicion.componentes.productos]
                .map(item => ({ componenteId: item.id, cantidad: Number(cantidades[item.id] ?? 0) }))
                .filter(c => c.cantidad > 0);

            const data = await apiClient.post<CrearTicketResponse>(`/exhibiciones/${id}/tickets`, {
                tipoId: Number(tipoId),
                motivo: motivo.trim(),
                componentes,
            } satisfies CrearTicketInput);

            setNumero(data.numero);
            setTab('fotos');
        } catch (err) {
            setErrorGuardar(err instanceof Error ? err.message : t('ticket_crear.error_guardar'));
        } finally {
            setGuardando(false);
        }
    };

    const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !numero) return;

        if (file.size > 8 * 1024 * 1024) {
            setErrorFoto(t('ticket_crear.error_foto_grande'));
            return;
        }

        setSubiendoFoto(true);
        setErrorFoto('');
        try {
            const { base64, contentType } = await leerArchivoComoBase64(file);
            const foto = await apiClient.post<TicketFoto>(`/exhibiciones/${id}/tickets/${numero}/fotos`, {
                archivoBase64: base64,
                contentType,
            } satisfies AgregarFotoTicketInput);
            setFotos(prev => [...prev, foto]);
        } catch (err) {
            setErrorFoto(err instanceof Error ? err.message : t('ticket_crear.error_agregar_foto'));
        } finally {
            setSubiendoFoto(false);
        }
    };

    const handleFinalizar = async () => {
        await alert(t('ticket_crear.guardado_titulo'), t('ticket_crear.guardado_mensaje', { numero }));
        navigate(`/exhibiciones/${id}`, { viewTransition: true });
    };

    const TABS: { key: TabKey; label: string }[] = [
        { key: 'principal', label: t('ticket_crear.tab_principal') },
        { key: 'componentes', label: t('ticket_crear.tab_componentes') },
        { key: 'fotos', label: t('ticket_crear.tab_fotos') },
    ];

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
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('ticket_crear.title')}</h1>
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
                            <button type="button" onClick={cargar} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}>
                                {t('ticket_crear.reintentar')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && exhibicion && tipos && (
                        <div className="max-w-2xl space-y-4">
                            <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
                                {TABS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setTab(key)}
                                        disabled={key === 'fotos' && !numero}
                                        className={cn(
                                            'px-3.5 py-2.5 rounded-lg text-xs font-bold transition-colors duration-150',
                                            tab === key ? 'bg-card text-primary shadow-sm cursor-pointer' : 'text-cb-text-secondary hover:text-primary cursor-pointer',
                                            key === 'fotos' && !numero && 'opacity-40 cursor-not-allowed hover:text-cb-text-secondary'
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {tab === 'principal' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3 p-4 bg-card border border-cb-border rounded-xl">
                                        <div>
                                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('ticket_crear.campo_tienda')}</p>
                                            <p className="text-sm text-cb-text-primary">{exhibicion.clienteNombre}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('ticket_crear.campo_sucursal')}</p>
                                            <p className="text-sm text-cb-text-primary">{exhibicion.sucursalNombre}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('ticket_crear.campo_exhibicion')}</p>
                                            <p className="text-sm text-cb-text-primary">{exhibicion.nroExhibicion} - {exhibicion.nombre}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={LABEL_CLASS}>{t('ticket_crear.campo_tipo')}</label>
                                        <select className={INPUT_CLASS} value={tipoId} onChange={(e) => setTipoId(e.target.value)} disabled={numero !== null}>
                                            <option value="">{t('ticket_crear.selecciona')}</option>
                                            {tipos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className={LABEL_CLASS}>{t('ticket_crear.campo_motivo')}</label>
                                        <textarea
                                            value={motivo}
                                            onChange={(e) => setMotivo(e.target.value)}
                                            placeholder={t('ticket_crear.motivo_placeholder')}
                                            maxLength={200}
                                            rows={3}
                                            disabled={numero !== null}
                                            className={INPUT_CLASS + ' resize-none'}
                                        />
                                    </div>

                                    {errorGuardar && (
                                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            {errorGuardar}
                                        </div>
                                    )}

                                    {!numero ? (
                                        <button
                                            type="button"
                                            onClick={handleGuardar}
                                            disabled={!puedeGuardar}
                                            className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                                        >
                                            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                            {t('ticket_crear.accion_guardar')}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleFinalizar}
                                            className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto cursor-pointer'}
                                        >
                                            {t('ticket_crear.accion_finalizar')}
                                        </button>
                                    )}
                                </div>
                            )}

                            {tab === 'componentes' && (
                                <div className="space-y-4">
                                    {[...exhibicion.componentes.carcasas, ...exhibicion.componentes.productos].length === 0 ? (
                                        <p className="text-sm text-cb-text-secondary text-center py-8">{t('ticket_crear.sin_componentes')}</p>
                                    ) : (
                                        <ul className="border border-cb-border rounded-xl divide-y divide-cb-border">
                                            {[...exhibicion.componentes.carcasas, ...exhibicion.componentes.productos].map(item => (
                                                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                                    <span className="text-cb-text-primary">{item.nombre ?? '—'}</span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        disabled={numero !== null}
                                                        value={cantidades[item.id] ?? ''}
                                                        onChange={(e) => setCantidades(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                        placeholder="0"
                                                        className="w-20 px-2 py-1.5 bg-card text-cb-text-primary border border-cb-border rounded-lg text-sm text-right"
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {tab === 'fotos' && numero && (
                                <div className="space-y-4">
                                    <div>
                                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleArchivoSeleccionado} className="hidden" />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={subiendoFoto}
                                            className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                                        >
                                            {subiendoFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            {t('ticket_crear.accion_agregar_foto')}
                                        </button>
                                    </div>

                                    {errorFoto && (
                                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                            {errorFoto}
                                        </div>
                                    )}

                                    {fotos.length === 0 ? (
                                        <p className="text-sm text-cb-text-secondary text-center py-8">{t('ticket_crear.sin_fotos')}</p>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {fotos.map(foto => <Foto key={foto.id} url={foto.url} />)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TicketCrearPage;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (missing i18n keys are not TypeScript errors — Task 8 adds them).

- [ ] **Step 3: Commit**

```bash
git add src/pages/TicketCrearPage.tsx
git commit -m "feat: TicketCrearPage — the Nuevo Ticket form (Principal/Componentes/Fotos)"
```

---

## Task 7: Wire the route and the "Ticket" kebab action

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/ExhibicionesPage.tsx`

**Interfaces:**
- Consumes: `TicketCrearPage` (Task 6).

- [ ] **Step 1: Add the route**

In `src/App.tsx`, replace:

```tsx
import { ChecklistCrearPage } from './pages/ChecklistCrearPage.js';
```

with:

```tsx
import { ChecklistCrearPage } from './pages/ChecklistCrearPage.js';
import { TicketCrearPage } from './pages/TicketCrearPage.js';
```

Replace:

```tsx
                                <Route path="/exhibiciones/:id/checklist/nueva" element={<ChecklistCrearPage />} />
```

with:

```tsx
                                <Route path="/exhibiciones/:id/checklist/nueva" element={<ChecklistCrearPage />} />
                                <Route path="/exhibiciones/:id/tickets/nuevo" element={<TicketCrearPage />} />
```

- [ ] **Step 2: Wire the "Ticket" kebab action**

In `src/pages/ExhibicionesPage.tsx`, replace:

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
        if (action === 'ticket') {
            navigate(`/exhibiciones/${id}/tickets/nuevo`, { viewTransition: true });
            return;
        }
        alert(t('exhibiciones_lista.proximamente_titulo'), t('exhibiciones_lista.proximamente_mensaje'));
    };
```

Note: after this change, `handleAction`'s `action` parameter type (`'ver' | 'checklist' | 'ticket'`) has no remaining case that falls through to the `alert(...)` line — this is fine as written (TypeScript doesn't require exhaustiveness here since the fallthrough is reachable only if a caller passes an unexpected string at runtime, which the type system already prevents at compile time); do not add a fourth case or remove the fallthrough.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/ExhibicionesPage.tsx
git commit -m "feat: wire /exhibiciones/:id/tickets/nuevo route and the Ticket kebab action"
```

---

## Task 8: i18n keys

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Produces: every `ticket_crear.*` key referenced by Task 6.

- [ ] **Step 1: Add the Spanish keys**

In `public/locales/es.json`, add a new top-level `"ticket_crear"` key (as a sibling of `"checklist_crear"`, before the final closing `}` — remember the trailing comma after `"checklist_crear": { ... }`'s closing `}`):

```json
    "ticket_crear": {
        "title": "Nuevo Ticket",
        "tab_principal": "Principal",
        "tab_componentes": "Componentes",
        "tab_fotos": "Fotos",
        "campo_tienda": "Tienda",
        "campo_sucursal": "Sucursal",
        "campo_exhibicion": "Exhibición",
        "campo_tipo": "Tipo de Ticket",
        "campo_motivo": "Motivo",
        "motivo_placeholder": "Describe el motivo del ticket...",
        "selecciona": "Selecciona...",
        "sin_componentes": "Esta exhibición no tiene componentes registrados.",
        "accion_agregar_foto": "Agregar Foto",
        "sin_fotos": "No se han agregado fotos.",
        "accion_guardar": "Guardar",
        "accion_finalizar": "Finalizar",
        "error_cargar": "No se pudo cargar el formulario.",
        "error_guardar": "No se pudo crear el ticket.",
        "error_agregar_foto": "No se pudo subir la foto.",
        "error_foto_grande": "La foto es demasiado grande (máximo 8MB).",
        "reintentar": "Reintentar",
        "guardado_titulo": "Ticket guardado",
        "guardado_mensaje": "El ticket {{numero}} se registró correctamente."
    }
```

- [ ] **Step 2: Add the English keys**

In `public/locales/en.json`, add the equivalent block in the same position:

```json
    "ticket_crear": {
        "title": "New Ticket",
        "tab_principal": "Main",
        "tab_componentes": "Components",
        "tab_fotos": "Photos",
        "campo_tienda": "Store",
        "campo_sucursal": "Branch",
        "campo_exhibicion": "Exhibit",
        "campo_tipo": "Ticket Type",
        "campo_motivo": "Reason",
        "motivo_placeholder": "Describe the reason for this ticket...",
        "selecciona": "Select...",
        "sin_componentes": "This exhibit has no registered components.",
        "accion_agregar_foto": "Add Photo",
        "sin_fotos": "No photos added yet.",
        "accion_guardar": "Save",
        "accion_finalizar": "Finish",
        "error_cargar": "Couldn't load the form.",
        "error_guardar": "Couldn't create the ticket.",
        "error_agregar_foto": "Couldn't upload the photo.",
        "error_foto_grande": "The photo is too large (8MB max).",
        "reintentar": "Retry",
        "guardado_titulo": "Ticket saved",
        "guardado_mensaje": "Ticket {{numero}} was saved successfully."
    }
```

- [ ] **Step 3: Verify both files are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/es.json'))" && node -e "JSON.parse(require('fs').readFileSync('public/locales/en.json'))" && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add public/locales/es.json public/locales/en.json
git commit -m "feat: i18n keys for creating a ticket (es/en)"
```

---

## Task 9: Full verification (tests, build, API-level E2E, cleanup)

**Files:** none (verification only).

**Note on method:** use `curl`/Node scripts for the E2E check, not interactive browser automation — a prior plan's equivalent task once stalled for 10 minutes in a browser session and had to be retried. API-level checks exercise the exact same backend logic without that risk.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all test files pass, including the new suite from Task 1 (12 new tests on top of the existing 100 → 112 total).

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` both succeed with no errors.

- [ ] **Step 3: API-level E2E verification**

Start the backend locally (inline env vars, never written to a file):

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" PORT=3000 npx tsx server/index.ts &
```

1. Log in, `GET /api/exhibiciones/tipos-ticket` — confirm 9 types.
2. Pick a real exhibición id that has at least one componente (check `GET /api/exhibiciones/<id>`).
3. `POST /:id/tickets` with a valid `tipoId`, a motivo, and one componente line → confirm `201` with a `numero` matching `RSM\d{7}`. **Note this numero for cleanup.**
4. `POST /:id/tickets/:numero/fotos` with a small real photo (if a write-capable Blob SAS token is available in this environment) → confirm `201` with an `id` and a `url`; otherwise note explicitly that photo upload was not exercised.
5. `POST /:id/tickets` again with an invalid `tipoId` → confirm `400`.
6. `POST /:id/tickets` again with a `motivo` longer than 200 characters → confirm `400`.
7. `POST /:id/tickets` again with a `componenteId` that does NOT belong to that exhibición (e.g. a real componente id from a different exhibición) → confirm `400`.
8. Directly query the database (one-off script, same inline-credential pattern) to confirm: the ticket from step 3 has exactly 1 row in `WEB_MARKETING_REQUERIMIENTO_DETALLE`, exactly 1 row in `WEB_MARKETING_REQUERIMIENTO_HIST` with `VC_estado='01'`, and `CH_ticket='W'` on the header.
9. Create a second ticket immediately after (any valid type/motivo, no componentes) and confirm its `numero`'s numeric suffix is exactly one higher than the first ticket's — proves the global counter incremented correctly across two calls in the same session.

Kill the backend process when done.

- [ ] **Step 4: Clean up test data**

Anular (never DELETE) the tickets created during steps 3-9, and never touch the exhibición itself:

```bash
DB_SERVER="soledbserver.database.windows.net" DB_NAME="soledb-puntoventa" DB_USER="soledbserveradmin" DB_PASSWORD="$AZURE_SQL_PASSWORD" node -e "
const sql = require('mssql');
(async () => {
  const pool = await sql.connect({ server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, options: { encrypt: true, trustServerCertificate: false } });
  await pool.request().query(\`UPDATE EXHIBICION.WEB_MARKETING_REQUERIMIENTO SET CH_anulado = 'S' WHERE VC_requerimiento IN (/* pega aquí los numeros de ticket de prueba */)\`);
  console.log('listo');
  await pool.close();
})();
"
```

The `WEB_MARKETING_REQUERIMIENTO_DETALLE`/`_HIST`/`_FOTO` rows don't need separate cleanup — nothing in this plan queries them independent of their parent ticket's `CH_anulado`.

- [ ] **Step 5: Final commit if anything was adjusted during manual verification**

If Step 3 surfaced anything requiring a fix, fix it, re-run Steps 1-2, and commit with a message describing what was found and fixed.
