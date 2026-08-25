# Fundación — Exhibiciones App

**Fecha:** 2026-08-25
**Estado:** Aprobado, pendiente de plan de implementación
**Sub-proyecto:** 1 de N (ver decomposición al final)

## Contexto

Reconstrucción del Sistema de Exhibiciones Trade Marketing (hoy en .NET +
Angular, en `Exhibiciones.Api`) sobre el stack del ecosistema SIATC — React
19 + Vite + Express/TS + Azure SQL — siguiendo el patrón de
`SIATC-App-Template` y la app hermana `Technical` (Liquidaciones).

Este spec cubre únicamente la **Fundación**: scaffold, autenticación real
end-to-end, control de acceso básico, y un pipeline de despliegue confiable.
Los módulos de negocio (Exhibiciones, Checklists, Requerimientos, Puntos de
Atención) son sub-proyectos separados, cada uno con su propio spec.

Un primer intento de este mismo rebuild (mismo día) terminó en una sesión
larga de debugging en producción por varios problemas descubiertos tarde:
`bcrypt` nativo roto en Alpine, un bug de *hoisting* de imports en ESM que
rompía la carga de `.env` en desarrollo, el editor de variables de entorno
de EasyPanel truncando valores sin comillas en el primer `#`, CORS
bloqueando el propio dominio por falta de `ALLOWED_ORIGINS`, y — el más
costoso — un rate-limiter respaldado por Redis que, al no tener Redis
configurado, reintentaba en cada request y dejaba toda la app (incluida la
página de login) inutilizablemente lenta. Ese intento se descartó por
completo (carpeta local borrada, repos reseteados) y este spec incorpora
las lecciones aprendidas como requisitos, no como parches posteriores.

## Alcance

**Incluido en Fundación:**
- Scaffold del proyecto (frontend + backend) en un solo repo
- Login real contra `EXHIBICION.TB_USUARIOS` / `TB_ROLES` (bcryptjs + JWT)
- Sesión persistente, validación contra `/auth/me`, logout, timeout por
  inactividad (30 min)
- Control de acceso por rol (Administrador vs. resto) — infraestructura de
  permisos granulares (`TB_PERMISOS`/`TB_ROL_PERMISOS`) construida y lista,
  aunque hoy no haya datos que la ejerciten
- Layout base: sidebar, topbar, toggle de tema, selector de idioma (ES/EN)
- Dashboard placeholder ("ya estás dentro") como página de aterrizaje
- Despliegue funcionando de punta a punta en EasyPanel (Docker), con Redis
  **opcional** (circuit-breaker, no bloqueante)
- Push dual a GitHub (`onunez2025/Exhibiciones`, rama `master`, conectado al
  webhook de auto-deploy) y Azure DevOps (`MTExhibiciones`) como respaldo

**Explícitamente fuera de alcance** (sub-proyectos futuros):
- Cualquier módulo de negocio (Exhibiciones, Checklists, Requerimientos,
  Puntos de Atención, Promotores)
- Carga de datos reales en `TB_ROL_PERMISOS` (se hace cuando se sepa qué
  permisos necesita cada módulo)
- AppSwitcher / integración con el registro central de apps del ecosistema
  SIATC (`GAC_APP_TB_CONSOLE_APPLICATIONS`)
- Subida de archivos (`multer`), exportación a Excel (`exceljs`) — se
  agregan cuando un módulo real los necesite
- Paridad de desarrollo local vía Docker/`docker compose` — se decidió
  verificación local simple (type-check + build + prueba de login real),
  sin levantar el contenedor completo en cada iteración
- Redis como servicio productivo real (queda como mejora futura; por ahora
  la app debe funcionar completa sin él)

## Decisiones tomadas (de la sesión de brainstorming)

| Pregunta | Decisión |
|---|---|
| Estrategia de Redis | Circuit-breaker: opcional, con ventana de enfriamiento tras fallos — nunca reintento en caliente por request |
| Tamaño de la Fundación | Autenticación + shell de la app (sidebar/topbar/dashboard placeholder) |
| Granularidad de control de acceso | Infraestructura de permisos completa desde ya, aunque solo se ejerza por rol hoy |
| i18n | Bilingüe (ES/EN) desde el inicio, tal como trae el template |
| Verificación pre-deploy | Local simple (lint + build + login real contra Azure SQL) — sin Docker local |
| Enfoque de construcción | Híbrido: núcleo del `SIATC-App-Template` (auth, seguridad, sistema de diseño, componentes de layout), sin AppSwitcher/Console/exceljs/multer |

## Arquitectura

**Stack:** React 19 + Vite + TypeScript · Express + TypeScript (`tsx`) ·
Azure SQL (`soledb-puntoventa`, esquema `EXHIBICION`) · Tailwind CSS 4.

```
Exhibiciones-App/
├── server/
│   ├── index.ts              # bootstrap: helmet, cors, rate-limit tolerante, rutas
│   ├── db.ts                 # conexión Azure SQL (config perezosa, cleanEnv)
│   ├── lib/
│   │   ├── security.ts       # safeError, sanitizeLog, cleanEnv
│   │   └── redis.ts          # circuit-breaker
│   ├── middleware/
│   │   └── auth.ts           # verifyToken, checkPermission, logAudit
│   └── routes/
│       ├── auth.ts           # login, /me, logout, change-password
│       └── health.ts
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   └── DashboardPage.tsx
│   ├── components/
│   │   ├── layout/            # MainLayout, Sidebar (sin AppSwitcher)
│   │   └── common/            # Modal, ErrorBoundary, RequirePermission
│   ├── hooks/useAuth.tsx
│   ├── context/                # ThemeContext, ToastContext, DialogContext
│   ├── services/                # apiClient, storageService
│   └── i18n.ts + locales/{es,en}.json
├── docs/superpowers/specs/       # este archivo y los siguientes
├── Dockerfile
├── docker-compose.yml             # con Redis, para cuando se decida usar
└── .env.example
```

## Autenticación y control de acceso

**Backend (`/api/auth/*`)**
- `POST /login` — valida usuario/contraseña contra `EXHIBICION.TB_USUARIOS`
  + `TB_ROLES` (bcryptjs), carga permisos desde `TB_ROL_PERMISOS`/
  `TB_PERMISOS`, firma JWT de 24h (`id`, `username`, `role_name`,
  `permissions[]`).
- `GET /me` — valida token, re-consulta usuario (estado/rol actualizado),
  devuelve sesión fresca.
- `POST /logout` — invalida el token en Redis si está disponible; si no,
  igual borra el token del lado cliente. Nunca bloquea el logout por Redis
  caído.
- Toda lectura de `process.env` (DB, JWT_SECRET) pasa por `cleanEnv()`
  (despoja comillas envolventes) y se lee de forma perezosa (dentro de
  funciones, no a nivel de módulo — evita el bug de hoisting de imports en
  ESM vs. `dotenv.config()`).

**Control de acceso**
- `checkPermission('modulo.accion')` en backend: bypass total si
  `role_name` es "Administrador"; si no, revisa `permissions[]` del JWT.
- `hasPermission()` en frontend (mismo criterio) + `<RequirePermission>`
  para ocultar/mostrar UI condicionalmente.
- Único gate activo en Fundación: `authGuard` (¿hay sesión válida?) — el
  dashboard placeholder no exige ningún permiso de módulo específico.

**Sesión en frontend**
- `useAuth()` guarda JWT + usuario en `localStorage`, valida contra
  `/auth/me` al cargar, logout automático a los 30 min de inactividad.
- `authGuard` consulta el backend, no solo verifica que exista *algo* en
  localStorage (a diferencia del sistema Angular anterior).

## Manejo de errores y resiliencia

**Circuit-breaker de Redis**
- Cada operación fallida marca un timestamp de "última falla".
- Dentro de la ventana de enfriamiento (15s), no se intenta reconectar —
  se asume caído y se sigue sin rate-limit / sin blacklist.
- Pasada la ventana, se reintenta una vez antes de decidir si sigue caído.

**Errores de base de datos**
- Respuesta al cliente: siempre genérica (`safeError()`), nunca detalles
  de infraestructura.
- Log del servidor: **sí** debe mostrar el error real (lección de hoy — 
  enmascarar también los logs del servidor deja ciego el diagnóstico
  remoto vía EasyPanel).
- DB caída → 401/500 controlado, nunca crashea el proceso ni tumba otras
  rutas.

**Frontend**
- `ErrorBoundary` global — un fallo en render muestra tarjeta de error con
  botón "Recargar", nunca una pantalla en blanco silenciosa.
- Token expirado/inválido → `apiClient` redirige a `/login`
  automáticamente.

## Despliegue e infraestructura

**Repos (push dual):**
- `origin` → GitHub `onunez2025/Exhibiciones`, rama `master`, conectado al
  webhook de auto-deploy de EasyPanel.
- `azure` → Azure DevOps `MTExhibiciones`, respaldo.

**Docker:** mismo `Dockerfile` multi-stage, con `npm ci --fetch-retries=5`
desde el primer commit (no como parche posterior). `bcryptjs` desde el
inicio.

**Variables de entorno — checklist completo antes del primer deploy:**

| Variable | Notas |
|---|---|
| `APP_CODE` | `EXH` |
| `NODE_ENV` | `production` |
| `PORT` | asignado por EasyPanel |
| `DB_SERVER` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | con comillas si el valor contiene `#` |
| `JWT_SECRET` | uno nuevo para producción, distinto al de dev |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | opcionales — la app funciona completa sin ellos |
| `ALLOWED_ORIGINS` | opcional — CORS permite mismo-origen automáticamente |

**Infraestructura ya resuelta, no requiere repetirse:**
- Firewall de Azure SQL con la IP del VPS (`72.61.75.5`) ya permitida.
- Webhook de EasyPanel ya existe y se reutiliza.

## Verificación (antes de cada push)

1. `npm run lint` (type-check) y `npm run build` limpios.
2. Login real probado contra Azure SQL desde el entorno de desarrollo.
3. Recién entonces: push a ambos repos + trigger del webhook de deploy.

## Descomposición de sub-proyectos (referencia)

1. **Fundación** (este spec)
2. Módulo Exhibiciones (entidad central — CRUD + listado)
3. Checklists de visita
4. Requerimientos
5. Puntos de Atención / Promotores
6. Resto según prioridad del negocio
