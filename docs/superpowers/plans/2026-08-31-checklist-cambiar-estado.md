# Checklist — Gestión de Estados (Atender / Anular) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to transition a checklist's administrative state from the read-only detail page (`/checklist/:id`): marking a pending checklist as "Atendido" (`1 → 2`) and "Anular" (`1 → 0` or `2 → 0`) with confirmation.

**Architecture:**
- Backend: Two endpoints in `server/routes/checklists.ts`:
  - `POST /api/checklists/:id/atender` (sets `IN_estado_id = 2`, `VC_usuario_atendido = @user`, `VC_fecha_atendido = GETDATE()`).
  - `POST /api/checklists/:id/anular` (sets `IN_estado_id = 0`, `VC_usuario_modi = @user`, `DT_fecha_modi = GETDATE()`).
- Frontend: Action buttons in `ChecklistDetallePage.tsx` under the summary header:
  - "Marcar como Atendido" (primary/emerald button with CheckCircle icon) displayed when `checklist.estadoId === 1`.
  - "Anular Checklist" (secondary/rose button with Trash2/Ban icon) displayed when `checklist.estadoId > 0`, guarded by `useDialog().confirm(...)`.

**Tech Stack:** Express + TypeScript (`tsx`) · `mssql` · React 19 + `react-i18next` + `react-router-dom` v7 · `DialogContext`.

---

## Task 1: Backend Endpoints `POST /api/checklists/:id/atender` and `POST /api/checklists/:id/anular`

**Files:**
- Modify: `server/routes/checklists.ts`

**Interfaces:**
- Produces: `POST /api/checklists/:id/atender` -> `{ estadoId: 2 }` & `POST /api/checklists/:id/anular` -> `{ estadoId: 0 }`.

- [ ] **Step 1: Add endpoints to `server/routes/checklists.ts`**

Add at the end of `server/routes/checklists.ts`:

```ts
router.post('/:id/atender', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de checklist inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const updateResult = await pool.request()
            .input('id', sql.BigInt, id)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                UPDATE EXHIBICION.TB_CHECKLIST
                SET IN_estado_id = 2,
                    VC_usuario_atendido = @usuario,
                    VC_fecha_atendido = GETDATE()
                WHERE IN_checklist_id = @id AND IN_estado_id = 1
            `);

        if (updateResult.rowsAffected[0] === 0) {
            const existsResult = await pool.request()
                .input('id', sql.BigInt, id)
                .query('SELECT IN_estado_id as estadoId FROM EXHIBICION.TB_CHECKLIST WHERE IN_checklist_id = @id');
            if (existsResult.recordset.length === 0 || existsResult.recordset[0].estadoId === 0) {
                res.status(404).json({ error: 'Checklist no encontrado.' });
            } else {
                res.status(409).json({ error: 'El checklist ya no se encuentra pendiente de atención.' });
            }
            return;
        }

        res.json({ estadoId: 2 });
    } catch (err: unknown) {
        console.error('[Checklists] atender error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.post('/:id/anular', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de checklist inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const updateResult = await pool.request()
            .input('id', sql.BigInt, id)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                UPDATE EXHIBICION.TB_CHECKLIST
                SET IN_estado_id = 0,
                    VC_usuario_modi = @usuario,
                    DT_fecha_modi = GETDATE()
                WHERE IN_checklist_id = @id AND IN_estado_id > 0
            `);

        if (updateResult.rowsAffected[0] === 0) {
            res.status(404).json({ error: 'Checklist no encontrado o ya anulado.' });
            return;
        }

        res.json({ estadoId: 0 });
    } catch (err: unknown) {
        console.error('[Checklists] anular error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add server/routes/checklists.ts
git commit -m "feat: POST /api/checklists/:id/atender and POST /api/checklists/:id/anular endpoints"
```

---

## Task 2: Frontend Types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `AtenderChecklistResponse`, `AnularChecklistResponse`.

- [ ] **Step 1: Add types to `src/types/index.ts`**

```ts
export interface AtenderChecklistResponse {
    estadoId: 2;
}

export interface AnularChecklistResponse {
    estadoId: 0;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: frontend types for checklist state transitions"
```

---

## Task 3: i18n Keys for Checklist Actions

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Produces: action labels, dialog strings, confirmation messages.

- [ ] **Step 1: Add keys to `public/locales/es.json`**

In `checklist_bandeja` block:
```json
        "accion_atender": "Marcar como Atendido",
        "accion_anular": "Anular Checklist",
        "confirmar_atender_titulo": "¿Marcar como Atendido?",
        "confirmar_atender_mensaje": "¿Deseas marcar este checklist como atendido y revisado?",
        "confirmar_anular_titulo": "¿Anular Checklist?",
        "confirmar_anular_mensaje": "¿Estás seguro de que deseas anular este checklist? Esta acción no se puede deshacer.",
        "atendido_exito": "El checklist ha sido marcado como atendido.",
        "anulado_exito": "El checklist ha sido anulado correctamente.",
        "error_atender": "No se pudo actualizar el estado del checklist.",
        "error_anular": "No se pudo anular el checklist."
```

- [ ] **Step 2: Add keys to `public/locales/en.json`**

In `checklist_bandeja` block:
```json
        "accion_atender": "Mark as Resolved",
        "accion_anular": "Cancel Checklist",
        "confirmar_atender_titulo": "Mark as Resolved?",
        "confirmar_atender_mensaje": "Do you want to mark this checklist as resolved and reviewed?",
        "confirmar_anular_titulo": "Cancel Checklist?",
        "confirmar_anular_mensaje": "Are you sure you want to cancel this checklist? This action cannot be undone.",
        "atendido_exito": "Checklist marked as resolved.",
        "anulado_exito": "Checklist canceled successfully.",
        "error_atender": "Couldn't update checklist status.",
        "error_anular": "Couldn't cancel checklist."
```

- [ ] **Step 3: Validate JSON format**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/es.json')); JSON.parse(require('fs').readFileSync('public/locales/en.json')); console.log('JSON OK')"`

- [ ] **Step 4: Commit**

```bash
git add public/locales/es.json public/locales/en.json
git commit -m "feat: i18n keys for checklist atender and anular actions"
```

---

## Task 4: Action Buttons & Handlers in `ChecklistDetallePage.tsx`

**Files:**
- Modify: `src/pages/ChecklistDetallePage.tsx`

**Interfaces:**
- Consumes: `useDialog` (`alert`, `confirm`), `apiClient.post`, `AtenderChecklistResponse`, `AnularChecklistResponse`.

- [ ] **Step 1: Add action buttons to `ChecklistDetallePage.tsx`**

Integrate "Marcar como Atendido" and "Anular Checklist" action buttons with loading states and confirmation dialogs.

- [ ] **Step 2: Verify build / typecheck**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChecklistDetallePage.tsx
git commit -m "feat: action buttons for marking checklist as atendido or anulado in detail view"
```

---

## Task 5: Full Verification & Cleanup

- [ ] **Step 1: Run full test suite**
- [ ] **Step 2: Run build**
- [ ] **Step 3: Run API-level E2E tests against Azure SQL**
