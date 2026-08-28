# Checklist — Crear ("Nuevo CheckList")

**Fecha:** 2026-08-27
**Estado:** Aprobado, pendiente de plan de implementación
**Sub-proyecto:** 5 de N (sobre Fundación + Exhibiciones-Lista + Exhibición-Detalle + Exhibición-Crear)

## Contexto

Checklist es hoy 100% "Próximamente" en el menú lateral — no hay lista, ni
detalle, ni creación construida todavía. Este spec construye directo la
creación de un checklist **sobre una exhibición existente**, accesible
desde la opción "Checklist" del menú ⋮ de cada tarjeta (hoy abre el
diálogo "Próximamente"). Referencia visual: captura de la app móvil vieja
("Nuevo CheckList", 2 pestañas) — solo como referencia de contenido, no
de estilo ni de estructura de pestañas (ver Decisiones).

**Descubrimientos de esta sesión de brainstorming** (investigando
`EXHIBICION.TB_CHECKLIST`, `TB_CHECKLIST_DETALLE` y los procs
`PROC_GUARDAR_CHECKLIST` / `PROC_GUARDAR_CHECKLISTDETALLE` /
`PROC_BANDEJA_CHECKLIST`):

- Un checklist es una cabecera (`TB_CHECKLIST`, ligada a
  `IN_exhibicion_id`) + exactamente **12 líneas fijas**
  (`TB_CHECKLIST_DETALLE`), una por cada ítem del catálogo
  `dbo.PV_TABLA` (`VC_tabla = 'EXHIBICION_VISUAL'`). Cada línea es
  Conforme/No Conforme (`BI_desconforme`) con un motivo de texto opcional
  (`VC_desconforme_motivo`) — la tabla también soporta foto y "generar
  ticket" por línea, pero ninguno de los dos existe todavía en esta app
  (ver Alcance).
- Los 12 ítems se agrupan en 3 categorías vía `dbo.PV_TABLA`
  (`VC_tabla = 'EXHIBICION_VISUAL_TIPO'`), relacionadas por
  `EXHIBICION_VISUAL.VC_filtro = EXHIBICION_VISUAL_TIPO.IN_id` — **verificado
  en vivo, coincide exacto con la captura de referencia**:

  | Categoría (`IN_id`) | Ítems (`IN_id` → nombre) |
  |---|---|
  | 1 — Visual Etiqueta | 1 Producto, 2 Atributo, 3 Faltantes, 4 E.E |
  | 2 — Visual Exhibiciones | 5 Operativo, 6 Limpieza, 7 Invadido, 8 Elementos Adicionales, 9 Folletos |
  | 3 — Visual POP | 10 Estado, 11 Vigencia, 12 Faltantes |

- La numeración es `YYYYMM` + secuencial dentro del mes (ej. `202303003`),
  igual patrón de fragilidad que el N° de exhibición del proc viejo — se
  corrige igual, con `WITH (UPDLOCK, HOLDLOCK)`.
- Aprobar un checklist (`PROC_CHECKLIST_CAMBIAR_ESTADO`) depende de
  `WEB_MARKETING_PUNTOS_DE_ATENCION` para scoping por usuario — misma
  tabla ya descartada como no reusable en los dos sub-proyectos
  anteriores. No aplica de todas formas: esta vuelta solo se construye
  crear.

## Alcance

**Incluido:**
- Opción "Checklist" del menú ⋮ de `ExhibicionCard` navega a
  `/exhibiciones/:id/checklist/nueva` (en vez de abrir "Próximamente").
- Formulario de un solo paso: Tienda/Sucursal/Exhibición (de solo
  lectura, ya se sabe de qué exhibición es) + los 12 ítems agrupados en
  sus 3 categorías, cada uno Conforme/No Conforme.
- Motivo de texto obligatorio cuando un ítem queda "No Conforme".
- Guardar crea el checklist (estado Pendiente) + sus 12 líneas, y vuelve
  al detalle de la exhibición.

**Explícitamente fuera de alcance** (sub-proyectos futuros o decisiones
deliberadas):
- Ver/aprobar/rechazar checklists ya creados — no existe pantalla de
  detalle de checklist todavía.
- Foto por ítem (`VC_directorio_foto`/`VC_archivo_nombre` en
  `TB_CHECKLIST_DETALLE`) — solo motivo de texto en esta versión.
- "Generar ticket" desde un ítem no conforme (`BI_desconforme_ticket`) —
  el módulo Tickets ni existe todavía.
- Guardar como borrador incompleto — los 12 ítems son obligatorios para
  guardar.
- Pestaña "Detalles" separada de la captura de referencia — el motivo
  aparece inline debajo del ítem marcado No Conforme en vez de una
  segunda pestaña (más simple, ver Decisiones).

## Decisiones tomadas (de la sesión de brainstorming)

| Pregunta | Decisión |
|---|---|
| Por dónde empezar (no hay nada construido de Checklist) | Crear directo, ligado a una exhibición existente — no lista/detalle primero |
| Captura de "No Conforme" | Solo motivo de texto, sin foto ni generar-ticket por ítem |
| Completitud para guardar | Los 12 ítems son obligatorios (Conforme o No Conforme + motivo si aplica) |
| Estructura del formulario | Un solo formulario sin pestañas — el motivo aparece inline bajo el ítem, no en una pestaña "Detalles" separada |
| Adónde navega al guardar | Vuelve al detalle de la exhibición (`/exhibiciones/:id`) — no hay pantalla de detalle de checklist a la que ir |

## Arquitectura

```
Frontend (React)                         Backend (Express)                    Azure SQL
┌───────────────────────────┐          ┌────────────────────────────────┐   ┌──────────────────────────┐
│ ChecklistCrearPage          │──GET───▶│ GET /exhibiciones/:id            │──▶│ TB_EXHIBICION (contexto)  │
│  (Tienda/Sucursal/Exhib.    │  (ya existe, reusado para el contexto)     │   │ dbo.PV_TABLA (EXHIBICION_ │
│   de solo lectura +         │──GET───▶│ GET /exhibiciones/catalogo-      │──▶│  VISUAL / _VISUAL_TIPO)   │
│   12 ítems en 3 categorías) │         │      checklist                   │   │ TB_CHECKLIST              │
│                              │──POST──▶│ POST /exhibiciones/:id/checklist │──▶│ TB_CHECKLIST_DETALLE      │
└───────────────────────────┘         └────────────────────────────────┘   └──────────────────────────┘
```

Todo vive en el mismo `server/routes/exhibiciones.ts` — son sub-recursos
de una exhibición, mismo patrón ya establecido con `/componentes` y
`/fotos`.

## Backend

### `GET /api/exhibiciones/catalogo-checklist`

Protegido con `verifyToken`. Sin params. Ruta literal — se agrega antes
de `GET /:id` en el archivo, mismo motivo que `opciones-crear` y
`catalogo-componentes`.

```sql
SELECT V.IN_id as visualId, V.VC_descripcion as nombre, V.VC_filtro as tipoId
FROM dbo.PV_TABLA V WHERE V.VC_tabla = 'EXHIBICION_VISUAL' AND V.CH_activo = '1'
ORDER BY V.VC_filtro, V.IN_id

SELECT IN_id as tipoId, VC_descripcion as tipoNombre
FROM dbo.PV_TABLA WHERE VC_tabla = 'EXHIBICION_VISUAL_TIPO' AND CH_activo = '1'
ORDER BY IN_id
```

El route handler arma la estructura anidada agrupando los ítems por
`tipoId`:

```ts
{
  categorias: Array<{
    tipoId: number;
    tipoNombre: string;
    items: Array<{ visualCodigo: string; nombre: string }>;
  }>;
}
```

**Función pura testeable** `agruparCatalogoChecklist(itemsRows,
tiposRows)` en `server/lib/checklistCatalogo.ts` — arma el arreglo
anidado a partir de las dos filas planas, testeada sin tocar la base de
datos (mismo patrón que `mapComponentesRows`).

### `POST /api/exhibiciones/:id/checklist`

Body: `{ items: Array<{ visualCodigo: string; desconforme: boolean; motivo: string | null }> }`.

Validación server-side (400 si falla), función pura
`validarChecklistItems(items: unknown, codigosValidos: string[])` en
`server/lib/checklistCrear.ts` (recibe los 12 códigos válidos ya
consultados por el route handler, así queda pura y testeable sin DB):

- `items` trae **exactamente** los 12 `visualCodigo` de `codigosValidos`
  — sin duplicados, sin faltantes, sin códigos ajenos.
- Cada ítem con `desconforme: true` trae `motivo` no vacío (tras
  `trim()`) y de **máximo 150 caracteres** — `TB_CHECKLIST_DETALLE.VC_desconforme_motivo`
  es `VARCHAR(150)`; sin este chequeo, mssql trunca en silencio en vez de
  avisar. Un ítem con `desconforme: false` ignora cualquier `motivo`
  enviado (se guarda `null`).

El `id` de la exhibición se valida contra `TB_EXHIBICION` (404 si no
existe) antes de todo, mismo patrón que `/componentes` y `/fotos`.

Número de checklist generado con el mismo resguardo de carrera que el
N° de exhibición:

```sql
BEGIN TRAN
DECLARE @prefix INT = CONVERT(INT, CONCAT(YEAR(GETDATE()), RIGHT('00' + CONVERT(VARCHAR, MONTH(GETDATE())), 2), '000'))
DECLARE @sgte INT
SELECT @sgte = ISNULL(MAX(IN_checklist_number), @prefix) + 1
FROM EXHIBICION.TB_CHECKLIST WITH (UPDLOCK, HOLDLOCK)
WHERE CONCAT(YEAR(DT_fecha_crea), RIGHT('00' + CONVERT(VARCHAR, MONTH(DT_fecha_crea)), 2))
    = CONCAT(YEAR(GETDATE()), RIGHT('00' + CONVERT(VARCHAR, MONTH(GETDATE())), 2))

INSERT INTO EXHIBICION.TB_CHECKLIST
    (IN_checklist_number, IN_exhibicion_id, IN_estado_id, VC_usuario_crea, DT_fecha_crea)
OUTPUT INSERTED.IN_checklist_id as id, INSERTED.IN_checklist_number as checklistNumber
VALUES (@sgte, @id, 1, @usuario, GETDATE())

-- + 12 INSERT en EXHIBICION.TB_CHECKLIST_DETALLE, una por ítem, misma transacción
COMMIT
```

Las 12 líneas se insertan en la **misma transacción** que la cabecera —
si cualquier inserción falla, el rollback deja todo sin crear (nunca un
checklist con menos de 12 líneas).

Respuesta `201`: `{ id, checklistNumber }`.

## Frontend

- **`ChecklistCrearPage.tsx`** (ruta `/exhibiciones/:id/checklist/nueva`)
  — al montar, pide en paralelo `GET /exhibiciones/:id` (contexto:
  N°, nombre, tienda, sucursal — mismo endpoint que ya usa el detalle) y
  `GET /exhibiciones/catalogo-checklist`. Header de solo lectura con
  Tienda/Sucursal/Exhibición, seguido de 3 secciones (una por categoría)
  con sus ítems.
- Cada ítem: nombre + dos botones tipo segmented-control ("Conforme" /
  "No Conforme", selección excluyente — reemplaza los dos checkboxes
  independientes de la captura de referencia, que en la práctica se
  comportan como un radio button). Al marcar "No Conforme" aparece un
  `<textarea>` de motivo justo debajo, con foco automático.
- "Guardar" deshabilitado hasta que los 12 ítems tengan selección y todo
  ítem "No Conforme" tenga motivo no vacío.
- Al guardar: `POST`, luego `navigate('/exhibiciones/:id', {
  viewTransition: true })` + `useDialog().alert(...)` de confirmación
  (mismo patrón ya usado para otros mensajes de éxito/error en la app).
- `ExhibicionCard.tsx` / `ExhibicionesPage.tsx`: `handleAction('checklist')`
  pasa de abrir el diálogo "Próximamente" a
  `navigate(`/exhibiciones/${id}/checklist/nueva`)` — `'ticket'` sigue
  abriendo "Próximamente" sin cambios.

## Manejo de errores

- `POST /:id/checklist` con menos/más de 12 ítems, códigos duplicados o
  ajenos, o un "No Conforme" sin motivo → 400 con mensaje claro; el
  formulario no navega, muestra el error inline.
- Id de exhibición inexistente → 404, mismo patrón que `/componentes` y
  `/fotos`.
- Carrera de dos creaciones simultáneas en el mismo mes → resuelta por
  el `UPDLOCK, HOLDLOCK`, no por manejo de error.
- Fallo de red al cargar el catálogo o el contexto de la exhibición →
  estado de error con botón para reintentar, no un formulario roto a
  medias.

## Testing

- `server/lib/checklistCatalogo.test.ts` — `agruparCatalogoChecklist`:
  agrupa correctamente por categoría, preserva orden, maneja catálogo
  vacío.
- `server/lib/checklistCrear.test.ts` — `validarChecklistItems`: exactamente
  12 códigos válidos pasa; falta uno falla; duplicado falla; código ajeno
  falla; "No Conforme" sin motivo falla; motivo con espacios en blanco
  falla (trim); "Conforme" con motivo enviado lo ignora (queda `null`).
- Sin tests de componentes React nuevos — mismo criterio que los
  sub-proyectos anteriores.
- Verificación manual: crear un checklist real de prueba de punta a
  punta (los 12 ítems, al menos uno marcado No Conforme con motivo),
  confirmar que aparecen las 12 líneas en la base con el motivo correcto,
  y marcar la fila de prueba como limpieza (no hay endpoint de borrado,
  mismo criterio que en Exhibición-Crear: `UPDATE ... SET IN_estado_id = 0`
  sobre el checklist de prueba — la exhibición "padre" no se toca, sigue
  siendo una real).
