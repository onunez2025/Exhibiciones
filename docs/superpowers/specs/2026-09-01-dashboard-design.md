# Dashboard Operativo — Diseño

## Contexto

La pantalla `/dashboard` es la página inicial tras iniciar sesión en la plataforma. Actualmente solo muestra un texto estático de bienvenida sin ninguna métrica del negocio.

Con los tres módulos core ya construidos y operando (`Exhibiciones`, `Checklist` y `Tickets`), el Dashboard debe consolidarse como el **Centro de Mando Operativo**, ofreciendo a supervisores, coordinadores y trade marketing visibilidad inmediata del estado de la red de exhibiciones y acceso directo a las acciones clave.

## Alcance

### 1. Resumen de KPIs / Métricas en Tiempo Real
- **Exhibiciones Activas**:
  - Número de exhibiciones activas/aprobadas en tiendas (`IN_estado_id = 2`).
  - Sub-métrica: exhibiciones pendientes de aprobación (`IN_estado_id = 1`).
  - Enlace rápido a `/exhibiciones`.
- **Checklists & Conformidad**:
  - Total de checklists registrados.
  - % de conformidad global (`conformes / total * 100`).
  - Enlace rápido a `/checklist`.
- **Tickets de Requerimiento**:
  - Total de tickets pendientes de atención (`01` a `04`).
  - Sub-métrica: tickets atendidos y cerrados (`05`, `06`).
  - Enlace rápido a `/tickets`.
- **Atención Prioritaria / Pendientes**:
  - Total acumulado de tareas que requieren acción administrativa (checklists pendientes de atención + exhibiciones por revisar).

### 2. Barra de Accesos Rápidos
- Botón directo para "Registrar Exhibición" (`/exhibiciones/nueva`).
- Botón directo para "Revisar Checklists" (`/checklist`).
- Botón directo para "Bandeja de Tickets" (`/tickets`).

### 3. Actividad Reciente (Últimos Movimientos)
- **Últimos Checklists Registrados (Top 5)**:
  - N° de checklist, exhibición, tienda/sucursal, badge de conformidad (Conforme / No Conforme), fecha y botón para ir a `/checklist/:id`.
- **Últimos Tickets Generados (Top 5)**:
  - N° de ticket `#RSM...`, tipo de requerimiento, tienda/sucursal, badge de estado, fecha y botón para ir a `/tickets/:numero`.

## API Endpoint

### `GET /api/dashboard/resumen`
- Autenticado con `verifyToken`.
- Devuelve las métricas consolidadas y las dos listas de actividad reciente en una sola consulta optimizada:
  ```ts
  export interface DashboardKPIs {
      exhibicionesActivas: number;
      exhibicionesPendientes: number;
      checklistsTotal: number;
      checklistsPendientes: number;
      checklistsConformesTotal: number;
      porcentajeConformidad: number;
      ticketsPendientes: number;
      ticketsAtendidos: number;
  }

  export interface DashboardChecklistReciente {
      id: number;
      checklistNumber: number;
      exhibicionNroExhibicion: string;
      exhibicionNombre: string;
      clienteNombre: string;
      estadoId: number;
      conforme: boolean;
      fechaCrea: string;
  }

  export interface DashboardTicketReciente {
      numero: string;
      tipoNombre: string;
      exhibicionNombre: string;
      clienteNombre: string;
      estadoCodigo: string;
      estadoNombre: string;
      fechaCrea: string;
  }

  export interface DashboardResumenResponse {
      kpis: DashboardKPIs;
      ultimosChecklists: DashboardChecklistReciente[];
      ultimosTickets: DashboardTicketReciente[];
  }
  ```

## Criterios de Calidad
- TDD con tests unitarios para las funciones de cálculo de métricas.
- Endpoint de alto rendimiento (queries agrupadas ejecutadas en paralelo mediante `Promise.all`).
- Componente `DashboardPage` responsivo, con estados de carga (`Skeleton` o spinners discretos), error con reintento y visualización premium bajo el diseño SIATC.
- i18n completo en español e inglés.
- Verificación E2E contra Azure SQL.
