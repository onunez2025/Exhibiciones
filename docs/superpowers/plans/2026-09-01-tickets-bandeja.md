# Tickets — Bandeja (lista + detalle + gestión) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Tickets inbox module (`/tickets` list view and `/tickets/:numero` detail view with status management) to replace the Coming Soon placeholder and close the ticket lifecycle in the application.

**Architecture:**
- Backend: Pure SQL filter builder `server/lib/ticketsFilter.ts`, router `server/routes/tickets.ts` mounted at `/api/tickets` with `verifyToken`.
- Frontend: React 19 pages `TicketsPage` and `TicketDetallePage`, `TicketCard`, `TicketFiltrosPanel`, and `estadoTicket` utility.
- Tech Stack: Express + TypeScript · `mssql` · React 19 + `react-router-dom` v7 + `react-i18next` + `lucide-react` + `DialogContext`.
- Spec Authority: `docs/superpowers/specs/2026-09-01-tickets-bandeja-design.md`.

**Global Constraints:**
- Work directly on `master`.
- Each task ends in its own real git commit.
- Before committing each task, verify `npm run build` and `npx vitest run` are green.
- Exclude cancelled tickets (`CH_anulado = 'S'` or `VC_estado = '00'`) from default inbox view.

---

## Task 1: `buildTicketsFilter` pure query builder + unit tests

**Files:**
- Create: `server/lib/ticketsFilter.ts`
- Create: `server/lib/ticketsFilter.test.ts`

**Interfaces:**
- Produces: `buildTicketsFilter(filtros: TicketsFilterInput): { whereClauses: string[], params: SqlParam[] }`

- [ ] **Step 1: Write test file `server/lib/ticketsFilter.test.ts`**
- [ ] **Step 2: Run test to fail**
- [ ] **Step 3: Write `server/lib/ticketsFilter.ts`**
- [ ] **Step 4: Run test to pass**
- [ ] **Step 5: Verify build & commit**

---

## Task 2: Backend Routes `server/routes/tickets.ts` and Mount in `server/index.ts`

**Files:**
- Create: `server/routes/tickets.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Produces: `GET /api/tickets`, `GET /api/tickets/:numero`, `POST /api/tickets/:numero/atender`, `POST /api/tickets/:numero/anular`.

- [ ] **Step 1: Implement `server/routes/tickets.ts`**
- [ ] **Step 2: Mount `ticketsRouter` at `/api/tickets` in `server/index.ts`**
- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

---

## Task 3: Frontend Types in `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `TicketListItem`, `TicketsListResponse`, `TicketsFiltros`, `TicketDetalleComponente`, `TicketDetalleFoto`, `TicketDetalle`.

- [ ] **Step 1: Add ticket inbox and detail types**
- [ ] **Step 2: Verify typecheck**
- [ ] **Step 3: Commit**

---

## Task 4: UI Status Helper `src/utils/estadoTicket.ts` + Unit Tests

**Files:**
- Create: `src/utils/estadoTicket.ts`
- Create: `src/utils/estadoTicket.test.ts`

**Interfaces:**
- Produces: `getEstadoTicketEstilo(estadoCodigo: string): EstadoTicketEstilo`, `getEstadoTicketLabelKey(estadoCodigo: string): string`.

- [ ] **Step 1: Write test file `src/utils/estadoTicket.test.ts`**
- [ ] **Step 2: Implement `src/utils/estadoTicket.ts`**
- [ ] **Step 3: Run tests & verify build**
- [ ] **Step 4: Commit**

---

## Task 5: Components `TicketCard.tsx` and `TicketFiltrosPanel.tsx`

**Files:**
- Create: `src/components/tickets/TicketCard.tsx`
- Create: `src/components/tickets/TicketFiltrosPanel.tsx`

**Interfaces:**
- Produces: `TicketCard`, `TicketFiltrosPanel`.

- [ ] **Step 1: Create `TicketCard.tsx`**
- [ ] **Step 2: Create `TicketFiltrosPanel.tsx`**
- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

---

## Task 6: List Page `src/pages/TicketsPage.tsx`

**Files:**
- Create: `src/pages/TicketsPage.tsx`

**Interfaces:**
- Produces: `TicketsPage` (search, filters, responsive cards, desktop pagination, mobile infinite scroll).

- [ ] **Step 1: Create `src/pages/TicketsPage.tsx`**
- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

---

## Task 7: Detail Page `src/pages/TicketDetallePage.tsx`

**Files:**
- Create: `src/pages/TicketDetallePage.tsx`

**Interfaces:**
- Produces: `TicketDetallePage` (context card, observation, components list, photos lightbox, atender/anular actions).

- [ ] **Step 1: Create `src/pages/TicketDetallePage.tsx`**
- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

---

## Task 8: Route Wiring in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Replaces `<Route path="/tickets" element={<ComingSoonPage ... />} />` with `/tickets` (`TicketsPage`) and `/tickets/:numero` (`TicketDetallePage`).

- [ ] **Step 1: Update routes in `src/App.tsx`**
- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

---

## Task 9: i18n Keys in `es.json` and `en.json`

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Produces: `tickets_bandeja` namespace with all labels, filter options, dialogs, and errors.

- [ ] **Step 1: Add Spanish keys**
- [ ] **Step 2: Add English keys**
- [ ] **Step 3: Validate JSON syntax**
- [ ] **Step 4: Commit**

---

## Task 10: Full Verification & E2E Testing

**Files:**
- Automated tests: Vitest suite (all test files)
- Build validation: `npm run build`
- API-level E2E tests against Azure SQL

- [ ] **Step 1: Run Vitest test suite**
- [ ] **Step 2: Run build**
- [ ] **Step 3: Run E2E script against Azure SQL**
- [ ] **Step 4: Verify git status is clean**
