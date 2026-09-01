# Dashboard Operativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `/dashboard` into an operational command center displaying real-time KPIs, recent activity feeds (checklists and tickets), and quick action shortcuts.

**Architecture:**
- Backend: Query aggregator `server/routes/dashboard.ts` mounted at `/api/dashboard` with `verifyToken`, pure helper `server/lib/dashboardMetrics.ts` with vitest tests.
- Frontend: `DashboardPage.tsx`, `KPICard.tsx`, `ActividadRecienteList.tsx`, SIATC theme.
- Tech Stack: Express + TypeScript · `mssql` · React 19 + `lucide-react` + `react-i18next`.
- Spec Authority: `docs/superpowers/specs/2026-09-01-dashboard-design.md`.

**Global Constraints:**
- Work directly on `master`.
- Each task ends in its own real git commit.
- Before committing each task, verify `npm run build` and `npx vitest run` are green.

---

## Task 1: Backend `dashboardMetrics` Helper + Routes `server/routes/dashboard.ts`

**Files:**
- Create: `server/lib/dashboardMetrics.ts`
- Create: `server/lib/dashboardMetrics.test.ts`
- Create: `server/routes/dashboard.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Produces: `calcularPorcentajeConformidad(total: number, conformes: number): number`, `GET /api/dashboard/resumen`.

- [ ] **Step 1: Write test file `server/lib/dashboardMetrics.test.ts`**
- [ ] **Step 2: Implement `server/lib/dashboardMetrics.ts`**
- [ ] **Step 3: Run unit tests to pass**
- [ ] **Step 4: Create `server/routes/dashboard.ts` and mount in `server/index.ts`**
- [ ] **Step 5: Verify build & commit**

---

## Task 2: Frontend Types in `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `DashboardKPIs`, `DashboardChecklistReciente`, `DashboardTicketReciente`, `DashboardResumenResponse`.

- [ ] **Step 1: Add types to `src/types/index.ts`**
- [ ] **Step 2: Verify typecheck**
- [ ] **Step 3: Commit**

---

## Task 3: Components `KPICard.tsx` and `ActividadRecienteList.tsx`

**Files:**
- Create: `src/components/dashboard/KPICard.tsx`
- Create: `src/components/dashboard/ActividadRecienteList.tsx`

**Interfaces:**
- Produces: `KPICard`, `ActividadRecienteList`.

- [ ] **Step 1: Create `src/components/dashboard/KPICard.tsx`**
- [ ] **Step 2: Create `src/components/dashboard/ActividadRecienteList.tsx`**
- [ ] **Step 3: Verify build**
- [ ] **Step 4: Commit**

---

## Task 4: Upgrade `src/pages/DashboardPage.tsx`

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Connects to `GET /api/dashboard/resumen`, renders header, 4 KPI cards, quick actions bar, and recent feeds.

- [ ] **Step 1: Implement full `DashboardPage.tsx`**
- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

---

## Task 5: i18n Keys in `es.json` and `en.json`

**Files:**
- Modify: `public/locales/es.json`
- Modify: `public/locales/en.json`

**Interfaces:**
- Expands `dashboard` namespace with KPI labels, subtitles, quick action labels, and table headers.

- [ ] **Step 1: Update `es.json`**
- [ ] **Step 2: Update `en.json`**
- [ ] **Step 3: Validate JSON syntax**
- [ ] **Step 4: Commit**

---

## Task 6: Full Verification & E2E Testing

**Files:**
- Automated tests: Vitest suite
- Build validation: `npm run build`
- API-level E2E tests against Azure SQL

- [ ] **Step 1: Run Vitest test suite**
- [ ] **Step 2: Run build**
- [ ] **Step 3: Run E2E script against Azure SQL**
- [ ] **Step 4: Verify git status is clean**
