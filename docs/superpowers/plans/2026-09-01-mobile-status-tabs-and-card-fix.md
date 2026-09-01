# Pestañas de Estado en Mobile y Corrección de Desbordamiento de Tarjetas — Implementation Plan

**Goal:** Add horizontal status tabs (segmented control) to Exhibiciones, Checklists, and Tickets for instant status filtering, and fix the mobile overflow bug where the "Ver" button was pushed outside the card boundary.

**Architecture:**
- Create `src/components/common/StatusTabs.tsx` — segmented tab bar with pill indicators and responsive horizontal scroll.
- Refactor `ChecklistCard.tsx`, `TicketCard.tsx`, and `ExhibicionCard.tsx`:
  - Eliminate the overflowing eye button since the whole card is already clickable.
  - Distribute row 1 cleanly (Left: Module Icon + ID/Number; Right: Badges + optional subtle Chevron).
- Update `ChecklistsPage.tsx`, `TicketsPage.tsx`, and `ExhibicionesPage.tsx` to include `StatusTabs` seamlessly integrated with backend filtering.
- Update i18n keys for tab labels in `es.json` and `en.json`.

---

## Tasks

### Task 1: Componente Reutilizable `StatusTabs.tsx`
- Create `src/components/common/StatusTabs.tsx` with smooth pill animations and touch-friendly targets.
- Write unit test for tab selection.

### Task 2: Corrección de Tarjetas (`ChecklistCard`, `TicketCard`, `ExhibicionCard`)
- Refactor header rows so badges and IDs never overflow on narrow screens (360px+).
- Clean up redundant eye button since the entire card is now clickable.

### Task 3: Integrar Pestañas en `ChecklistsPage.tsx`
- Add tabs: "Pendientes", "Atendidos", "Todos".
- Connect tab change to `filtros.estadoId` and fetch.

### Task 4: Integrar Pestañas en `TicketsPage.tsx`
- Add tabs: "Pendientes", "Atendidos", "Todos".
- Connect tab change to `filtros.estado` and fetch.

### Task 5: Integrar Pestañas en `ExhibicionesPage.tsx`
- Add tabs: "Pendientes", "Activas / Aprobadas", "Todas".
- Connect tab change to `filtros.estadoId` and fetch.

### Task 6: Traducciones y Verificación
- Add tab labels to `es.json` and `en.json`.
- Run vitest suite + `npm run build`.
- Validate layout in mobile viewport.
