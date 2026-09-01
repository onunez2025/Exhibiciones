# Tickets — Bandeja (lista + detalle + gestión) — diseño

## Contexto

El ítem "Tickets" del menú principal (sidebar) cae hoy en `ComingSoonPage` ("Este módulo está en construcción"). Ya existe el flujo de **crear** un ticket para una exhibición (`TicketCrearPage`, alcanzable desde el kebab de una exhibición en `/exhibiciones/:id/tickets/nuevo`), pero ninguna pantalla para **ver** los tickets registrados ni consultar su detalle o fotos.

Este sub-proyecto cierra el ciclo de Tickets implementando la **Bandeja de Tickets** (`/tickets`) y la **Vista de Detalle de Ticket** (`/tickets/:numero`), siguiendo los mismos patrones de arquitectura, UX y diseño visual aplicados en `Exhibiciones` y `Checklist`.

## Alcance

### 1. Lista de Tickets (`/tickets`)
- Reemplaza el placeholder `ComingSoonPage` del sidebar.
- Buscador reactivo (por N° de ticket `RSM...`, nombre de exhibición, tienda o motivo).
- Panel de Filtros colapsable:
  - Estado: Todos, Nuevo / Pendiente (`01`), Aprobado (`02`), Atendido (`05`), Cerrado (`06`).
  - Tipo de Requerimiento (select cargado desde `TB_TIPOS_REQUERIMIENTO`).
  - Tienda / Sucursal (input texto).
  - Rango de fechas (Desde / Hasta).
- Tarjetas de ticket (`TicketCard`):
  - Número de ticket (ej. `RSM0000570`).
  - Tipo de ticket (badge o texto destacado).
  - Exhibición asociada y tienda / sucursal.
  - Badge de estado con estilo y color SIATC.
  - Motivo / observación resumido.
  - Fecha y hora de creación.
  - Botón "Ver detalle" (ícono ojo).
- Paginación en desktop / scroll infinito en mobile (mismo patrón que `ExhibicionesPage` y `ChecklistsPage`).

### 2. Detalle de Ticket (`/tickets/:numero`)
- Cabecera drill-down con botón "Volver" a `/tickets`.
- N° de ticket (ej. `#RSM0000570`), badge de estado y fecha/hora.
- Tarjeta de contexto con Tienda, Sucursal, Exhibición y Usuario creador.
- Sección "Motivo / Observación" con el texto completo.
- Sección "Componentes Solicitados" (si el ticket incluye componentes con su cantidad).
- Sección "Fotos Adjuntas" con las miniaturas de fotos subidas a Azure Blob Storage, con vista ampliada (lightbox/modal) al hacer clic.
- Botones de acción según el estado del ticket:
  - **"Marcar como Atendido / Cerrar"**: para avanzar el estado administrativo del ticket.
  - **"Anular Ticket"**: con diálogo de confirmación que marca `CH_anulado = 'S'` y `VC_estado = '00'`.

## Modelo de Datos

### Tablas utilizadas:
- `EXHIBICION.WEB_MARKETING_REQUERIMIENTO`:
  - `VC_requerimiento` (PK funcional, VARCHAR(10), ej. `'RSM0000570'`).
  - `IN_exhibicion_id` (FK a `TB_EXHIBICION`).
  - `IN_tipo_rq_id` (FK a `TB_TIPOS_REQUERIMIENTO`).
  - `VC_observacion` (VARCHAR(200), motivo del ticket).
  - `VC_estado` (CHAR(2): `'01'` Nuevo/Pendiente, `'02'` Aprobado Supervisor, `'03'` Aprobado Trade, `'04'` Aprobado GV, `'05'` Atendido Trade, `'06'` Cerrado, `'00'` Anulado).
  - `CH_anulado` (CHAR(1): `'N'` activo, `'S'` anulado).
  - `VC_cliente_codigo`, `VC_cliente_sucursal`, `VC_cliente_nombre`.
  - `VC_usuario_crea`, `DT_fecha_crea`.
- `EXHIBICION.TB_TIPOS_REQUERIMIENTO`:
  - `IN_tipo_id`, `VC_nombre`, `BI_activo`.
- `EXHIBICION.TB_EXHIBICION`:
  - `IN_exhibicion_id`, `VC_nro_exhibicion`, `VC_nombre`, `VC_cliente_nombre`, `VC_sucursal_nombre`.
- `EXHIBICION.WEB_MARKETING_REQUERIMIENTO_DETALLE`:
  - `VC_requerimiento`, `VC_articulo_codigo`, `VC_articulo_nombre`, `IN_articulo_cantidad`.
- `EXHIBICION.WEB_MARKETING_REQUERIMIENTO_FOTO`:
  - `IN_requerimiento_foto_id`, `VC_requerimiento`, `VC_archivo_nombre`, `IN_estado = 1`.
  - Construcción de URL pública mediante SAS token (`buildFotoUrl`).

## API Endpoints

### 1. `GET /api/tickets`
- Autenticado con `verifyToken`.
- Query params: `page`, `pageSize`, `search`, `estado`, `tipoId`, `tienda`, `fechaDesde`, `fechaHasta`.
- Retorna lista paginada:
  ```ts
  {
    items: TicketListItem[],
    total: number,
    page: number,
    pageSize: number
  }
  ```

### 2. `GET /api/tickets/:numero`
- Autenticado con `verifyToken`.
- Retorna el detalle completo del ticket:
  ```ts
  {
    numero: string;
    exhibicionId: number;
    exhibicionNroExhibicion: string;
    exhibicionNombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    tipoId: number;
    tipoNombre: string;
    motivo: string;
    estadoCodigo: string;
    estadoNombre: string;
    usuarioCrea: string;
    fechaCrea: string;
    componentes: TicketComponenteDetalle[];
    fotos: TicketFoto[];
  }
  ```

### 3. `POST /api/tickets/:numero/atender`
- Marca el ticket como Atendido/Cerrado (`VC_estado = '05'` o `'06'`).

### 4. `POST /api/tickets/:numero/anular`
- Marca el ticket como Anulado (`CH_anulado = 'S'`, `VC_estado = '00'`).

## Criterios de Calidad
- TDD con tests unitarios para query builder (`ticketsFilter.test.ts`) y utilitario de estado (`estadoTicket.test.ts`).
- 0 errores de TypeScript (`npx tsc --noEmit -p tsconfig.app.json`).
- `npm run build` exitoso.
- i18n completo en español (`es.json`) e inglés (`en.json`).
- Verificación E2E contra base de datos Azure SQL.
