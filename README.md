# Exhibiciones — Grupo Sole

Sistema de Exhibiciones Trade Marketing, sobre el stack del ecosistema
SIATC (React 19 + Vite + Express/TS + Azure SQL).

Ver `docs/superpowers/specs/2026-08-25-fundacion-design.md` para el diseño
completo y `docs/superpowers/plans/2026-08-25-fundacion.md` para el plan de
implementación de este primer sub-proyecto.

## Desarrollo local

1. Copia `.env.example` a `.env` y completa los valores reales.
   **Si un valor contiene `#`, `,` o espacios, enciérralo entre comillas
   dobles** — varios paneles de entorno cortan el valor en el primer `#`
   si no está citado. `cleanEnv()` despoja esas comillas antes de usarlas.
2. `npm install`
3. Backend: `npm run server` (puerto 3000)
4. Frontend: `npm run dev` (puerto 5173, con proxy a `/api` → 3000)
5. Redis es **opcional** — sin él, rate-limiting y blacklist de logout se
   desactivan solos (circuit-breaker), el resto de la app funciona igual.

## Despliegue (EasyPanel / Docker)

Variables de entorno a configurar en el panel (nunca en un `.env` commiteado):

| Variable | Notas |
|---|---|
| `APP_CODE` | `EXH` |
| `NODE_ENV` | `production` |
| `PORT` | asignado por la plataforma |
| `DB_SERVER` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | con comillas si el valor contiene `#` |
| `JWT_SECRET` | uno nuevo para producción |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | opcionales |
| `ALLOWED_ORIGINS` | opcional — mismo-origen se permite automático |

Rama que EasyPanel debe seguir: `master`.
