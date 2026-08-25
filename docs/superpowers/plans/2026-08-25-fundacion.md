# Fundación — Exhibiciones App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a React 19 + Vite + Express/TS app with real authentication against `EXHIBICION.TB_USUARIOS`, a base layout shell, and a deploy pipeline that survives EasyPanel without Redis being a hard dependency.

**Architecture:** Frontend (Vite/React, served statically in production by the same Express process) + backend (Express/TS run via `tsx`) talking to Azure SQL directly. Redis is optional everywhere via a shared circuit-breaker — nothing blocks or retries hot when it's down.

**Tech Stack:** React 19, Vite 6, TypeScript 5, Express 4, Tailwind CSS 4, `mssql`, `bcryptjs`, `jsonwebtoken`, `ioredis`, `zod`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-fundacion-design.md`

## Global Constraints

- Node.js env vars are always read through `cleanEnv()` (server/lib/security.ts), never `process.env.X` directly, and always inside a function body (not at module top level) — ESM import hoisting means module-level reads run before `dotenv.config()` in local dev.
- Use `bcryptjs`, never `bcrypt` (native builds break on Alpine/Docker).
- Redis calls (blacklist, rate-limit) must check `isRedisAvailable()` first and call `recordRedisFailure()` on any failure — never let `ioredis`/`rate-limit-redis` retry per-request without the circuit breaker gating it.
- CORS same-origin decisions go through the pure `resolveCorsAllow()` function (server/lib/cors.ts), never inline in the `cors()` callback — must stay unit-testable without a live request.
- All new logic files ship with a Vitest test file alongside them. UI-only files (pages, layout components) are verified manually per the spec's "Verificación" section — no supertest, no jsdom, no component-render tests in this plan.
- Every SQL query against `EXHIBICION.*` uses parameterized `.input()` calls — never string-concatenate user input into a query.
- Client-facing error responses always go through `safeError()`; server-side `console.error`/`console.warn` always log the raw message — never enmascarar los logs del servidor (lección de la sesión anterior).

---

## Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/main.tsx` (stub, replaced in Task 13)
- Create: `src/App.tsx` (stub, replaced in Task 13)
- Create: `src/index.css` (stub, replaced in Task 10)

**Interfaces:**
- Produces: a working `npm install` / `npm run build` / `npm run lint` / `npm run test` pipeline that every later task builds on.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "exhibiciones-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "server": "tsx --watch server/index.ts",
    "build": "tsc -b && vite build",
    "start": "tsx server/index.ts",
    "preview": "vite preview",
    "lint": "tsc -b",
    "test": "vitest run"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "clsx": "^2.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-rate-limit": "^8.5.2",
    "helmet": "^8.2.0",
    "i18next": "^26.3.3",
    "i18next-browser-languagedetector": "^8.2.1",
    "i18next-http-backend": "^4.0.0",
    "ioredis": "^5.11.1",
    "jsonwebtoken": "^9.0.2",
    "lucide-react": "^0.474.0",
    "mssql": "^11.0.1",
    "rate-limit-redis": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-i18next": "^17.0.8",
    "react-router-dom": "^7.1.5",
    "tailwind-merge": "^2.6.0",
    "tsx": "^4.19.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.8",
    "@types/mssql": "^9.1.5",
    "@types/node": "^22.10.10",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "vitest": "^3.0.4"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 3: Write `tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts", "server/**/*.ts"]
}
```

- [ ] **Step 5: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
        outDir: 'dist',
        sourcemap: false,
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
```

- [ ] **Step 6: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['server/**/*.test.ts', 'src/**/*.test.ts'],
    },
});
```

- [ ] **Step 7: Write `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Exhibiciones — Grupo Sole</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Write `.gitignore`**

```
node_modules/
dist/
dist-server/
.env
.env.bak
*.log
.DS_Store
Thumbs.db
node_modules/.tmp/
```

- [ ] **Step 9: Write `.env.example`**

```
# ─── App Identity ─────────────────────────────────────────────────────────────
APP_CODE=EXH
PORT=3000
NODE_ENV=development

# ─── Azure SQL ────────────────────────────────────────────────────────────────
# Si el valor contiene '#', ',' o espacios, enciérralo entre comillas dobles —
# el editor de variables de EasyPanel corta el valor en el primer '#' si no
# está citado. cleanEnv() despoja esas comillas antes de usarlas.
DB_SERVER=soledbserver.database.windows.net
DB_NAME=soledb-puntoventa
DB_USER=soledbserveradmin
DB_PASSWORD="REPLACE_WITH_REAL_PASSWORD"

# ─── JWT ──────────────────────────────────────────────────────────────────────
# Generar con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=REPLACE_WITH_STRONG_SECRET_MIN_64_CHARS

# ─── Redis (opcional — la app funciona completa sin esto) ─────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ─── CORS (opcional — mismo-origen se permite automáticamente) ────────────────
ALLOWED_ORIGINS=https://exhibiciones.siatc.cloud

# ─── Frontend (Vite) ──────────────────────────────────────────────────────────
VITE_APP_CODE=EXH
VITE_APP_NAME=Exhibiciones
VITE_APP_DESC=Gestión de Exhibiciones Trade Marketing
```

- [ ] **Step 10: Write stub `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <div>Scaffold OK — reemplazado en Task 13</div>
    </React.StrictMode>
);
```

- [ ] **Step 11: Write stub `src/App.tsx`**

```tsx
export default function App() {
    return <div>Scaffold OK — reemplazado en Task 13</div>;
}
```

- [ ] **Step 12: Write stub `src/index.css`**

```css
@import "tailwindcss";

body { margin: 0; font-family: system-ui, sans-serif; }
```

- [ ] **Step 13: Install dependencies**

Run: `npm install`
Expected: completes with 0 errors (deprecation warnings from transitive deps are fine).

- [ ] **Step 14: Verify the pipeline**

Run: `npm run lint`
Expected: passes (no `.ts` files with errors yet — only the stub `App.tsx`/`main.tsx`).

Run: `npm run build`
Expected: `dist/index.html` and `dist/assets/*.js` produced, exits 0.

Run: `npm run test`
Expected: "No test files found" — expected at this point, not a failure.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "chore: scaffold — package.json, tsconfig, vite, vitest, env example"
```

---

## Task 2: Security utilities (cleanEnv / safeError / sanitizeLog)

**Files:**
- Create: `server/lib/security.ts`
- Test: `server/lib/security.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no deps on other tasks).
- Produces: `cleanEnv(name: string): string`, `safeError(err: unknown): string`, `sanitizeLog(val: unknown, maxLen?: number): string` — used by every backend task from here on.

- [ ] **Step 1: Write the failing tests**

```ts
// server/lib/security.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanEnv, safeError, sanitizeLog } from './security.js';

describe('cleanEnv', () => {
    const KEY = 'TEST_CLEAN_ENV_VAR';

    afterEach(() => {
        delete process.env[KEY];
    });

    it('returns the raw value when there are no surrounding quotes', () => {
        process.env[KEY] = '@s0le@dm1nAI#82,';
        expect(cleanEnv(KEY)).toBe('@s0le@dm1nAI#82,');
    });

    it('strips a single layer of surrounding double quotes', () => {
        process.env[KEY] = '"@s0le@dm1nAI#82,"';
        expect(cleanEnv(KEY)).toBe('@s0le@dm1nAI#82,');
    });

    it('strips a single layer of surrounding single quotes', () => {
        process.env[KEY] = "'hello world'";
        expect(cleanEnv(KEY)).toBe('hello world');
    });

    it('trims leading and trailing whitespace', () => {
        process.env[KEY] = '  spaced-value  ';
        expect(cleanEnv(KEY)).toBe('spaced-value');
    });

    it('returns an empty string when the var is unset', () => {
        expect(cleanEnv(KEY)).toBe('');
    });

    it('does not strip a quote that only appears on one side', () => {
        process.env[KEY] = '"unbalanced';
        expect(cleanEnv(KEY)).toBe('"unbalanced');
    });
});

describe('safeError', () => {
    beforeEach(() => {
        process.env.NODE_ENV = 'development';
    });
    afterEach(() => {
        delete process.env.NODE_ENV;
    });

    it('returns the real message outside production', () => {
        expect(safeError(new Error('boom'))).toBe('boom');
    });

    it('returns a generic message in production', () => {
        process.env.NODE_ENV = 'production';
        expect(safeError(new Error('secret connection string'))).toBe('Internal server error');
    });

    it('stringifies non-Error values outside production', () => {
        expect(safeError('plain string')).toBe('plain string');
    });
});

describe('sanitizeLog', () => {
    it('replaces control characters with ?', () => {
        expect(sanitizeLog('a\nb\tc')).toBe('a?b?c');
    });

    it('truncates values longer than maxLen', () => {
        const long = 'x'.repeat(250);
        const result = sanitizeLog(long, 200);
        expect(result.length).toBe(201); // 200 chars + ellipsis
        expect(result.endsWith('…')).toBe(true);
    });

    it('coerces non-string values', () => {
        expect(sanitizeLog(12345)).toBe('12345');
        expect(sanitizeLog(null)).toBe('');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/security.test.ts`
Expected: FAIL — `Cannot find module './security.js'`

- [ ] **Step 3: Write the implementation**

```ts
// server/lib/security.ts

// Algunos paneles (EasyPanel/Docker Compose env_file, entre otros) no despojan
// comillas envolventes de los valores como sí hace `dotenv` — un valor pegado
// como DB_PASSWORD="algo" puede llegar a process.env literalmente con las
// comillas incluidas. Esto limpia una sola capa de comillas (simples o
// dobles) que envuelvan todo el valor, y recorta espacios.
export function cleanEnv(name: string): string {
    let v = (process.env[name] || '').trim();
    if (v.length >= 2) {
        const first = v[0];
        const last = v[v.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            v = v.slice(1, -1);
        }
    }
    return v;
}

export function safeError(err: unknown): string {
    if (process.env.NODE_ENV !== 'production') {
        if (err instanceof Error) return err.message;
        return String(err);
    }
    return 'Internal server error';
}

export function sanitizeLog(val: unknown, maxLen = 200): string {
    const s = String(val ?? '').replace(/[\x00-\x1F\x7F]/g, '?');
    return s.length > maxLen ? s.substring(0, maxLen) + '…' : s;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/security.test.ts`
Expected: PASS — 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/security.ts server/lib/security.test.ts
git commit -m "feat: security utilities — cleanEnv, safeError, sanitizeLog (TDD)"
```

---

## Task 3: Redis circuit-breaker

**Files:**
- Create: `server/lib/redis.ts`
- Test: `server/lib/redis.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (`ioredis` package only).
- Produces: `isRedisAvailable(): boolean`, `recordRedisFailure(): void`, `getRedisClient(): Redis`, `isTokenBlacklisted(token: string): Promise<boolean>`, `blacklistToken(token: string, exp: number): Promise<void>` — consumed by Task 6 (middleware) and Task 8 (rate-limiter in `server/index.ts`).

This is the fix for the failure mode that broke the previous attempt: with Redis unreachable, every single request paid the cost of `ioredis`'s full retry sequence before falling through, which made even the login page unusable. The circuit breaker below skips the network call entirely while "open."

- [ ] **Step 1: Write the failing tests**

```ts
// server/lib/redis.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isRedisAvailable, recordRedisFailure } from './redis.js';

describe('circuit breaker', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    it('is available before any failure is recorded', () => {
        expect(isRedisAvailable()).toBe(true);
    });

    it('becomes unavailable immediately after a failure', () => {
        recordRedisFailure();
        expect(isRedisAvailable()).toBe(false);
    });

    it('becomes available again after the cooldown window elapses', () => {
        vi.useFakeTimers();
        recordRedisFailure();
        expect(isRedisAvailable()).toBe(false);

        vi.advanceTimersByTime(15_001); // cooldown is 15s
        expect(isRedisAvailable()).toBe(true);

        vi.useRealTimers();
    });

    it('stays unavailable just before the cooldown window elapses', () => {
        vi.useFakeTimers();
        recordRedisFailure();
        vi.advanceTimersByTime(14_999);
        expect(isRedisAvailable()).toBe(false);
        vi.useRealTimers();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/redis.test.ts`
Expected: FAIL — `Cannot find module './redis.js'`

- [ ] **Step 3: Write the implementation**

```ts
// server/lib/redis.ts
import Redis from 'ioredis';
import crypto from 'crypto';

const COOLDOWN_MS = 15_000;
let circuitOpenUntil = 0;

// Mientras el circuito está "abierto" no se intenta NADA contra Redis — ni
// siquiera un solo comando. Esto es lo que evita la tormenta de reintentos
// que dejó inutilizable hasta la página de login la vez pasada: sin esto,
// cada request pagaba el costo completo de maxRetriesPerRequest antes de
// seguir de largo.
export function isRedisAvailable(): boolean {
    return Date.now() >= circuitOpenUntil;
}

export function recordRedisFailure(): void {
    circuitOpenUntil = Date.now() + COOLDOWN_MS;
}

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB || '0'),
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null, // no reconexión automática en segundo plano
        });
        redisClient.on('error', () => {
            // Silencioso a propósito — cada llamador decide si vale la pena
            // loguear, y siempre llama recordRedisFailure() por su cuenta.
        });
    }
    return redisClient;
}

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
    if (!isRedisAvailable()) return false;
    try {
        const client = getRedisClient();
        const result = await client.get(`bl:${hashToken(token)}`);
        return result !== null;
    } catch (err) {
        recordRedisFailure();
        console.error('[Redis] isTokenBlacklisted failed:', (err as Error).message);
        return false;
    }
}

export async function blacklistToken(token: string, exp: number): Promise<void> {
    if (!isRedisAvailable()) return; // best-effort — el cliente ya borró su token igual
    try {
        const client = getRedisClient();
        const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 1);
        await client.set(`bl:${hashToken(token)}`, '1', 'EX', ttl);
    } catch (err) {
        recordRedisFailure();
        console.error('[Redis] blacklistToken failed:', (err as Error).message);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/redis.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/redis.ts server/lib/redis.test.ts
git commit -m "feat: Redis circuit-breaker — no reintento en caliente cuando está caído (TDD)"
```

---

## Task 4: CORS same-origin resolver

**Files:**
- Create: `server/lib/cors.ts`
- Test: `server/lib/cors.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure function).
- Produces: `resolveCorsAllow(opts: ResolveCorsOptions): boolean` — consumed by Task 8 (`server/index.ts`).

This is the fix for the other failure mode from the previous attempt: `ALLOWED_ORIGINS` unset in production made the server reject requests from its *own* domain, because the same-origin check lived inline inside the `cors()` callback and was never exercised in isolation.

- [ ] **Step 1: Write the failing tests**

```ts
// server/lib/cors.test.ts
import { describe, it, expect } from 'vitest';
import { resolveCorsAllow } from './cors.js';

describe('resolveCorsAllow', () => {
    it('allows everything outside production', () => {
        expect(resolveCorsAllow({
            origin: 'https://evil.example.com',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'development',
            allowedOrigins: '',
        })).toBe(true);
    });

    it('allows requests with no Origin header (curl, server-to-server)', () => {
        expect(resolveCorsAllow({
            origin: undefined,
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: '',
        })).toBe(true);
    });

    it('allows same-origin requests even when ALLOWED_ORIGINS is empty', () => {
        expect(resolveCorsAllow({
            origin: 'https://exhibiciones.siatc.cloud',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: '',
        })).toBe(true);
    });

    it('allows an origin present in ALLOWED_ORIGINS', () => {
        expect(resolveCorsAllow({
            origin: 'https://console.siatc.cloud',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: 'https://console.siatc.cloud,https://other.siatc.cloud',
        })).toBe(true);
    });

    it('blocks a cross-origin request not in ALLOWED_ORIGINS', () => {
        expect(resolveCorsAllow({
            origin: 'https://evil.example.com',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: 'https://console.siatc.cloud',
        })).toBe(false);
    });

    it('trims whitespace around entries in ALLOWED_ORIGINS', () => {
        expect(resolveCorsAllow({
            origin: 'https://console.siatc.cloud',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: ' https://console.siatc.cloud , https://other.siatc.cloud ',
        })).toBe(true);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/cors.test.ts`
Expected: FAIL — `Cannot find module './cors.js'`

- [ ] **Step 3: Write the implementation**

```ts
// server/lib/cors.ts
export interface ResolveCorsOptions {
    origin: string | undefined;
    host: string | undefined;
    nodeEnv: string | undefined;
    allowedOrigins: string; // raw ALLOWED_ORIGINS env value, comma-separated
}

// Decide si una petición debe pasar CORS. Puro — sin tocar Express — para
// poder probarlo sin levantar un servidor. El caso que rompió la vez pasada:
// el propio dominio de la app pegándole a su propia API con ALLOWED_ORIGINS
// vacío. sameOrigin se evalúa ANTES que la allowlist para que eso nunca
// vuelva a bloquear el sitio a sí mismo.
export function resolveCorsAllow(opts: ResolveCorsOptions): boolean {
    const { origin, host, nodeEnv, allowedOrigins } = opts;

    if (nodeEnv !== 'production') return true;
    if (!origin) return true;

    const sameOrigin = host ? origin === `https://${host}` : false;
    if (sameOrigin) return true;

    const allowed = allowedOrigins.split(',').map(s => s.trim()).filter(Boolean);
    return allowed.includes(origin);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/cors.test.ts`
Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/cors.ts server/lib/cors.test.ts
git commit -m "feat: CORS same-origin resolver — nunca bloquea al propio dominio (TDD)"
```

---

## Task 5: DB connection module

**Files:**
- Create: `server/db.ts`
- Test: `server/db.test.ts`

**Interfaces:**
- Consumes: `cleanEnv` from `server/lib/security.ts` (Task 2).
- Produces: `getDbConnection(): Promise<sql.ConnectionPool>`, `buildConfig(): sql.config` (exported for testing) — consumed by Task 6 (middleware audit log), Task 7 (routes).

- [ ] **Step 1: Write the failing test**

This tests the config-assembly logic without opening a real network connection — `buildConfig()` is a pure function over `process.env`.

```ts
// server/db.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { buildConfig } from './db.js';

describe('buildConfig', () => {
    const keys = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

    afterEach(() => {
        keys.forEach(k => delete process.env[k]);
    });

    it('reads all four connection fields from env, quotes stripped', () => {
        process.env.DB_SERVER = 'soledbserver.database.windows.net';
        process.env.DB_NAME = 'soledb-puntoventa';
        process.env.DB_USER = 'soledbserveradmin';
        process.env.DB_PASSWORD = '"@s0le@dm1nAI#82,"';

        const config = buildConfig();

        expect(config.server).toBe('soledbserver.database.windows.net');
        expect(config.database).toBe('soledb-puntoventa');
        expect(config.user).toBe('soledbserveradmin');
        expect(config.password).toBe('@s0le@dm1nAI#82,');
    });

    it('defaults to empty strings when env vars are unset', () => {
        const config = buildConfig();
        expect(config.server).toBe('');
        expect(config.database).toBe('');
    });

    it('always encrypts and never trusts an unverified server certificate', () => {
        const config = buildConfig();
        expect(config.options?.encrypt).toBe(true);
        expect(config.options?.trustServerCertificate).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/db.test.ts`
Expected: FAIL — `Cannot find module './db.js'`

- [ ] **Step 3: Write the implementation**

```ts
// server/db.ts
import sql from 'mssql';
import { cleanEnv } from './lib/security.js';

// Perezosa (dentro de la función, no a nivel de módulo) — en ESM los
// `import` se hoistean y se evalúan antes que `dotenv.config()` (statement,
// no import) en server/index.ts. Si esto se construyera al cargar el
// módulo, process.env.DB_* aún estaría vacío en desarrollo local con `tsx`.
export function buildConfig(): sql.config {
    return {
        server: cleanEnv('DB_SERVER'),
        database: cleanEnv('DB_NAME'),
        user: cleanEnv('DB_USER'),
        password: cleanEnv('DB_PASSWORD'),
        options: {
            encrypt: true,
            trustServerCertificate: false,
            connectTimeout: 30000,
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
        },
    };
}

let pool: sql.ConnectionPool | null = null;

export async function getDbConnection(): Promise<sql.ConnectionPool> {
    if (pool && pool.connected) return pool;
    pool = await sql.connect(buildConfig());
    return pool;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/db.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/db.ts server/db.test.ts
git commit -m "feat: DB connection module — config perezosa vía cleanEnv (TDD)"
```

---

## Task 6: Permission logic + auth middleware

**Files:**
- Create: `server/lib/permissions.ts`
- Test: `server/lib/permissions.test.ts`
- Create: `server/middleware/auth.ts`
- Test: `server/middleware/auth.test.ts`

**Interfaces:**
- Consumes: `isTokenBlacklisted` (Task 3), `getDbConnection` (Task 5), `sanitizeLog` (Task 2).
- Produces: `resolvePermission(roleName: string, permissions: string[], required: string): boolean`; `verifyToken`, `verifyTokenForDownload`, `checkPermission(permission: string)`, `logAudit(req, action, entity, entityId?, details?)` Express middleware from `server/middleware/auth.ts`; extends `Express.Request.user` globally — consumed by Task 7 (routes) and Task 8 (server bootstrap).

- [ ] **Step 1: Write the failing test for `resolvePermission`**

```ts
// server/lib/permissions.test.ts
import { describe, it, expect } from 'vitest';
import { resolvePermission } from './permissions.js';

describe('resolvePermission', () => {
    it('grants everything to Administrador regardless of permissions list', () => {
        expect(resolvePermission('Administrador', [], 'exh.checklists.delete')).toBe(true);
    });

    it('is case-insensitive on the role name', () => {
        expect(resolvePermission('administrador', [], 'exh.checklists.delete')).toBe(true);
    });

    it('grants a permission present in the list for a non-admin role', () => {
        expect(resolvePermission('Promotoria', ['exh.checklists.ver'], 'exh.checklists.ver')).toBe(true);
    });

    it('denies a permission absent from the list', () => {
        expect(resolvePermission('Promotoria', ['exh.checklists.ver'], 'exh.checklists.eliminar')).toBe(false);
    });

    it('denies everything when the permissions list is empty', () => {
        expect(resolvePermission('Promotoria', [], 'exh.checklists.ver')).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/lib/permissions.test.ts`
Expected: FAIL — `Cannot find module './permissions.js'`

- [ ] **Step 3: Write `server/lib/permissions.ts`**

```ts
// server/lib/permissions.ts

// Pura — decide si un rol/lista de permisos alcanza para una acción dada.
// Administrador siempre pasa; el resto necesita el permiso exacto en su
// lista. TB_ROL_PERMISOS está vacía hoy en la base real, así que todo
// usuario no-admin resuelve en `false` hasta que se carguen datos reales —
// eso es esperado, no un bug.
export function resolvePermission(
    roleName: string,
    permissions: string[],
    required: string
): boolean {
    const roleLower = (roleName || '').trim().toLowerCase();
    if (roleLower === 'administrador') return true;
    return permissions.includes(required);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/lib/permissions.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Write the failing tests for the middleware's JWT handling**

`verifyToken`/`checkPermission` are Express middleware (take `req, res, next`), so instead of mocking Express we test the piece that actually carries risk: that a token signed with the real `getJwtSecret()` verifies correctly, and a token signed with a different secret does not. This exercises the exact `cleanEnv`-backed secret lookup used at runtime.

```ts
// server/middleware/auth.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// getJwtSecret is not exported — re-derive the same lookup here to prove
// the contract: whatever JWT_SECRET is set to (quotes and all) round-trips.
function readSecret(): string {
    let v = (process.env.JWT_SECRET || 'fallback_development_secret_do_not_use').trim();
    if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') v = v.slice(1, -1);
    return v;
}

describe('JWT secret handling', () => {
    afterEach(() => {
        delete process.env.JWT_SECRET;
    });

    it('a token signed with the real (quoted) secret verifies against the cleaned value', () => {
        process.env.JWT_SECRET = '"my-quoted-secret-value"';
        const token = jwt.sign({ id: 1 }, readSecret(), { expiresIn: '1h' });
        const decoded = jwt.verify(token, readSecret()) as { id: number };
        expect(decoded.id).toBe(1);
    });

    it('a token signed with a different secret fails verification', () => {
        process.env.JWT_SECRET = 'secret-a';
        const token = jwt.sign({ id: 1 }, readSecret(), { expiresIn: '1h' });
        process.env.JWT_SECRET = 'secret-b';
        expect(() => jwt.verify(token, readSecret())).toThrow();
    });

    it('falls back to the development secret when unset', () => {
        const token = jwt.sign({ id: 1 }, readSecret(), { expiresIn: '1h' });
        const decoded = jwt.verify(token, readSecret()) as { id: number };
        expect(decoded.id).toBe(1);
    });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run server/middleware/auth.test.ts`
Expected: PASS already (this test doesn't import the not-yet-written middleware file — it's testing the *contract*, not the module). Confirm it passes before moving on; this proves the secret-handling logic is correct before it's wired into real middleware.

- [ ] **Step 7: Write `server/middleware/auth.ts`**

```ts
// server/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isTokenBlacklisted } from '../lib/redis.js';
import { getDbConnection } from '../db.js';
import sql from 'mssql';
import { sanitizeLog, cleanEnv } from '../lib/security.js';
import { resolvePermission } from '../lib/permissions.js';

// Leído en cada llamada, no al cargar el módulo — mismo motivo que db.ts:
// el hoisting de imports en ESM hace que este módulo se evalúe antes que
// dotenv.config() en desarrollo local.
function getJwtSecret(): string {
    return cleanEnv('JWT_SECRET') || 'fallback_development_secret_do_not_use';
}

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                role_id: number | null;
                role_name: string;
                username: string;
                full_name?: string;
                permissions: string[];
                exp?: number;
            };
        }
    }
}

export async function verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token de autorización requerido.' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        if (await isTokenBlacklisted(token)) {
            res.status(401).json({ error: 'Sesión expirada. Por favor inicia sesión nuevamente.' });
            return;
        }

        const decoded = jwt.verify(token, getJwtSecret()) as Express.Request['user'];
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido o expirado.' });
    }
}

export function verifyTokenForDownload(req: Request, res: Response, next: NextFunction): void {
    const token =
        (req.headers['authorization'] || '').replace('Bearer ', '') ||
        (req.query.token as string | undefined);

    if (!token) {
        res.status(401).json({ error: 'Token requerido.' });
        return;
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret()) as Express.Request['user'];
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido o expirado.' });
    }
}

export async function logAudit(
    req: Request,
    action: string,
    entity: string,
    entityId?: string,
    details?: string
): Promise<void> {
    try {
        const pool = await getDbConnection();
        await pool.request()
            .input('username', sql.NVarChar(255), sanitizeLog(req.user?.username ?? 'system'))
            .input('action', sql.NVarChar(100), action)
            .input('entity', sql.NVarChar(100), entity)
            .input('entityId', sql.NVarChar(100), entityId ?? null)
            .input('details', sql.NVarChar(sql.MAX), details ?? null)
            .input('ip', sql.NVarChar(50), req.ip ?? null)
            .query(`
                INSERT INTO EXHIBICION.TB_AUDIT_LOG
                    (VC_username, VC_accion, VC_entidad, VC_entidad_id, VC_detalles, VC_ip, DT_fecha)
                VALUES
                    (@username, @action, @entity, @entityId, @details, @ip, GETDATE())
            `);
    } catch (err) {
        console.error('[Audit] Failed to write audit log:', (err as Error).message);
    }
}

export function checkPermission(permission: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: 'No autenticado.' });
            return;
        }

        if (!resolvePermission(user.role_name, user.permissions, permission)) {
            await logAudit(req, 'ACCESS_DENIED', permission, undefined, `Permission denied: ${permission}`);
            res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
            return;
        }

        next();
    };
}
```

> **Nota:** `logAudit` asume una tabla `EXHIBICION.TB_AUDIT_LOG` propia (no la
> `GAC_APP_TB_AUDIT_LOG` compartida del ecosistema, que espera `UserId`
> `UNIQUEIDENTIFIER` y nuestros usuarios usan `IN_usuario_id BIGINT` —
> incompatibles). Esta tabla **no existe todavía** en `soledb-puntoventa`;
> creación de la tabla es responsabilidad de Task 8 (paso de verificación
> manual) — hasta entonces `logAudit` falla en silencio y solo loguea a
> consola, lo cual es el comportamiento correcto (nunca debe tumbar el
> request que la llama).

- [ ] **Step 8: Run the full test suite to confirm nothing broke**

Run: `npx vitest run`
Expected: PASS — all tests from Tasks 2–6 green (permissions + auth secret-handling + earlier tasks).

- [ ] **Step 9: Run type-check**

Run: `npm run lint`
Expected: PASS — no TS errors in the new files.

- [ ] **Step 10: Commit**

```bash
git add server/lib/permissions.ts server/lib/permissions.test.ts server/middleware/auth.ts server/middleware/auth.test.ts
git commit -m "feat: permission resolution + auth middleware (TDD on the logic-bearing parts)"
```

---

## Task 7: Health + auth routes

**Files:**
- Create: `server/routes/health.ts`
- Create: `server/routes/auth.ts`

**Interfaces:**
- Consumes: `getDbConnection` (Task 5), `cleanEnv`/`safeError` (Task 2), `verifyToken` (Task 6).
- Produces: default-exported `healthRouter`, default-exported `authRouter` — mounted in Task 8's `server/index.ts` at `/api/health` and `/api/auth`.

This task touches the real `EXHIBICION` schema and is verified manually against the live Azure SQL database, per the spec's chosen verification approach — not mocked.

- [ ] **Step 1: Write `server/routes/health.ts`**

```ts
// server/routes/health.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDbConnection } from '../db.js';
import { safeError } from '../lib/security.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request().query('SELECT @@VERSION as version, DB_NAME() as db');
        res.json({
            status: 'ok',
            db: result.recordset[0].db,
            ts: new Date().toISOString(),
        });
    } catch (err: unknown) {
        // safeError() enmascara el mensaje real hacia el cliente (correcto) —
        // pero el log del servidor sí debe mostrar el error crudo, o queda
        // imposible diagnosticar remotamente vía logs de EasyPanel.
        console.error('[Health] DB connection failed:', err instanceof Error ? err.message : err);
        res.status(503).json({ status: 'error', error: safeError(err) });
    }
});

export default router;
```

- [ ] **Step 2: Write `server/routes/auth.ts`**

```ts
// server/routes/auth.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDbConnection } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { cleanEnv } from '../lib/security.js';

const router = Router();

// Leído en cada llamada, no al cargar el módulo — ver nota en server/db.ts.
function getJwtSecret(): string {
    return cleanEnv('JWT_SECRET') || 'fallback_development_secret_do_not_use';
}

const loginSchema = z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(255),
});

// Tablas propias de Exhibiciones bajo el esquema EXHIBICION — no se
// comparte el esquema EBM del resto del ecosistema SIATC aquí.
const USER_SELECT = `
    SELECT
        u.IN_usuario_id      as id,
        u.VC_usuario         as username,
        u.VC_password_hash   as password_hash,
        u.VC_nombre_completo as full_name,
        u.VC_email           as email,
        u.VC_celular         as celular,
        u.VC_zona            as zona,
        u.IN_rol_id          as role_id,
        r.VC_nombre          as role_name,
        CAST(u.BI_activo AS BIT) as is_active,
        u.VC_avatar_url      as avatar_url
    FROM EXHIBICION.TB_USUARIOS u
    LEFT JOIN EXHIBICION.TB_ROLES r ON u.IN_rol_id = r.IN_rol_id
`;

async function loadPermissions(pool: sql.ConnectionPool, roleId: number | null): Promise<string[]> {
    if (!roleId) return [];
    const result = await pool.request()
        .input('roleId', sql.Int, roleId)
        .query(`
            SELECT p.VC_modulo as modulo, p.VC_accion as accion
            FROM EXHIBICION.TB_ROL_PERMISOS rp
            INNER JOIN EXHIBICION.TB_PERMISOS p ON rp.IN_permiso_id = p.IN_permiso_id
            WHERE rp.IN_rol_id = @roleId
        `);
    return result.recordset.map((p: { modulo: string; accion: string }) =>
        `${(p.modulo || '').trim()}.${(p.accion || '').trim()}`.toLowerCase()
    );
}

function signToken(user: {
    id: number; username: string; full_name: string; role_id: number | null; role_name: string | null; permissions: string[];
}): string {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role_id: user.role_id,
            role_name: user.role_name || 'Sin rol',
            permissions: user.permissions,
        },
        getJwtSecret(),
        { expiresIn: '24h' }
    );
}

router.post('/login', async (req: Request, res: Response) => {
    try {
        const parseResult = loginSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Datos de login inválidos' });
        }
        const { username, password } = parseResult.data;

        const pool = await getDbConnection();
        const userResult = await pool.request()
            .input('username', sql.NVarChar(100), username)
            .query(`${USER_SELECT} WHERE u.VC_usuario = @username AND u.BI_activo = 1`);

        const user = userResult.recordset[0];
        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Credenciales inválidas o usuario deshabilitado' });
        }

        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password_hash);
        } catch {
            isMatch = false;
        }
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        user.permissions = await loadPermissions(pool, user.role_id);

        pool.request()
            .input('id', sql.BigInt, user.id)
            .query('UPDATE EXHIBICION.TB_USUARIOS SET DT_ultimo_login = GETDATE() WHERE IN_usuario_id = @id')
            .catch(() => { /* no crítico */ });

        const { password_hash: _ph, ...safeUser } = user;
        const token = signToken(user);

        res.json({ user: safeUser, token });
    } catch (error: unknown) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error interno durante la autenticación' });
    }
});

router.get('/me', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Token inválido' });

        const pool = await getDbConnection();
        const userResult = await pool.request()
            .input('id', sql.BigInt, userId)
            .query(`${USER_SELECT} WHERE u.IN_usuario_id = @id AND u.BI_activo = 1`);

        const user = userResult.recordset[0];
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado o deshabilitado' });

        user.permissions = await loadPermissions(pool, user.role_id);
        delete user.password_hash;

        res.json({ user });
    } catch (error: unknown) {
        console.error('Session validate error:', error);
        res.status(500).json({ error: 'Error interno durante la validación de sesión' });
    }
});

router.post('/change-password', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { currentPassword, newPassword } = req.body;
        if (!userId || !currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        const pool = await getDbConnection();
        const result = await pool.request()
            .input('id', sql.BigInt, userId)
            .query('SELECT VC_password_hash as password_hash FROM EXHIBICION.TB_USUARIOS WHERE IN_usuario_id = @id');

        const row = result.recordset[0];
        if (!row) return res.status(400).json({ error: 'Usuario no encontrado' });

        const isMatch = await bcrypt.compare(currentPassword, row.password_hash || '');
        if (!isMatch) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.request()
            .input('hash', sql.NVarChar(255), hash)
            .input('id', sql.BigInt, userId)
            .query('UPDATE EXHIBICION.TB_USUARIOS SET VC_password_hash = @hash WHERE IN_usuario_id = @id');

        res.json({ message: 'Contraseña actualizada exitosamente.' });
    } catch (err: unknown) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
```

- [ ] **Step 3: Run type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual verification against the real database**

This is the verification the spec calls for instead of mocked integration tests — run these from the project root with a real `.env` (copy `.env.example`, fill in the real Azure SQL credentials with quotes around the password):

```bash
node -e "
require('dotenv').config();
const sql = require('mssql');
(async () => {
  const pool = await sql.connect({
    server: process.env.DB_SERVER, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD.replace(/^\"|\"$/g, ''),
    options: { encrypt: true, trustServerCertificate: false }
  });
  const r = await pool.request().query(\"SELECT TOP 1 VC_usuario FROM EXHIBICION.TB_USUARIOS WHERE BI_activo = 1\");
  console.log('OK, usuario de prueba disponible:', r.recordset[0]?.VC_usuario);
  await pool.close();
})();
"
```
Expected: prints a real, active username from `EXHIBICION.TB_USUARIOS` — confirms schema/credentials are reachable before wiring the HTTP layer in Task 8.

- [ ] **Step 5: Commit**

```bash
git add server/routes/health.ts server/routes/auth.ts
git commit -m "feat: health + auth routes against EXHIBICION.TB_USUARIOS (bcryptjs, sin cookie SSO)"
```

---

## Task 8: Server bootstrap

**Files:**
- Create: `server/index.ts`

**Interfaces:**
- Consumes: `healthRouter`, `authRouter` (Task 7); `resolveCorsAllow` (Task 4); `isRedisAvailable`/`recordRedisFailure`/`getRedisClient` (Task 3); `safeError` (Task 2).
- Produces: the running server — `npm run server` starts it, `npm run start` runs the production entry (matches the existing `Dockerfile` `CMD`).

- [ ] **Step 1: Write `server/index.ts`**

```ts
// server/index.ts
import { safeError } from './lib/security.js';
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisAvailable, recordRedisFailure } from './lib/redis.js';
import { resolveCorsAllow } from './lib/cors.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
// TODO (sub-proyectos futuros): import tus routers de módulo aquí

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);

// ─── Helmet / CSP ─────────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            baseUri: ["'self'"],
        },
    },
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// ─── Rate limiting (Redis-backed, circuit-breaker gated) ──────────────────────
// sendCommand consulta isRedisAvailable() ANTES de tocar la red — si el
// circuito está abierto, ni siquiera se intenta el comando. Esto es lo que
// evita la tormenta de reintentos que dejó inutilizable la app entera la
// vez pasada.
const redisStore = () => new RedisStore({
    sendCommand: async (...args: string[]) => {
        if (!isRedisAvailable()) throw new Error('circuit-open');
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await (getRedisClient() as any).call(...args);
        } catch (err) {
            recordRedisFailure();
            throw err;
        }
    },
    prefix: 'rl:exh:',
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, store: redisStore(), message: { error: 'Too many requests.' } });
const authLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 50, store: redisStore(), message: { error: 'Too many login attempts.' } });

// Si Redis está caído, la request sigue sin límite en vez de tumbar la app
// entera — se loguea una sola vez por request degradada, no por cada intento
// interno de reintento.
function tolerant(mw: RequestHandler, label: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        mw(req, res, (err?: unknown) => {
            if (err) {
                console.error(`[RateLimit:${label}] degradado (Redis no disponible)`);
                return next();
            }
            next();
        });
    };
}

app.use(tolerant(limiter, 'global'));
app.use('/api/auth/login', tolerant(authLimiter, 'login'));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors((req, callback) => {
    const allow = resolveCorsAllow({
        origin: req.headers.origin,
        host: req.headers.host,
        nodeEnv: process.env.NODE_ENV,
        allowedOrigins: process.env.ALLOWED_ORIGINS || '',
    });
    if (!allow) console.error(`Blocked CORS from: ${req.headers.origin}`);
    callback(null, { origin: allow, credentials: true });
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
// TODO (sub-proyectos futuros): app.use('/api/exhibiciones', verifyToken, exhibicionesRouter);

// ─── Serve frontend in production ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
    const staticPath = path.join(__dirname, '../dist');
    app.use(express.static(staticPath));
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api')) return next();
        const indexPath = path.join(staticPath, 'index.html');
        res.sendFile(indexPath);
    });
}

app.listen(port, () => {
    console.log(`[EXH] Server running on port ${port} (${process.env.NODE_ENV || 'development'})`);
});
```

- [ ] **Step 2: Run type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual verification — start the server and hit every endpoint**

With a real `.env` in place (from Task 7's verification step):

```bash
npm run server
```
Expected console output: `[EXH] Server running on port 3000 (development)` — with **no** `[Redis] Connection error` spam (Redis isn't configured locally, and the circuit breaker means it's only attempted once per 15s window, not per request).

In a second terminal:
```bash
curl -s http://localhost:3000/api/health
```
Expected: `{"status":"ok","db":"soledb-puntoventa","ts":"..."}` within a couple seconds — not 30+.

```bash
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"wrong-password-on-purpose"}'
```
Expected: `{"error":"Credenciales inválidas"}` with HTTP 401 — fast, not hanging.

- [ ] **Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat: server bootstrap — CORS/rate-limit ambos vía circuit-breaker desde el día uno"
```

---

## Task 9: Frontend types, storage, API client

**Files:**
- Create: `src/types/index.ts`
- Create: `src/utils/cn.ts`
- Test: `src/utils/cn.test.ts`
- Create: `src/services/storageService.ts`
- Create: `src/services/apiClient.ts`
- Test: `src/services/apiClient.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (frontend-only, talks to the backend over HTTP).
- Produces: `User` type; `cn(...inputs): string`; `StorageService` object (`get`, `set`, `remove`, `clear`, `getToken`, `setToken`, `getCurrentUser`, `setCurrentUser`); `apiClient` object (`get`, `post`, `put`, `delete`, `patch`) — consumed by Task 11 (`useAuth`), Task 12 (layout), Task 13 (pages).

- [ ] **Step 1: Write `src/types/index.ts`**

```ts
export interface User {
    id: number;
    username: string;
    full_name: string;
    email?: string;
    celular?: string;
    zona?: string;
    role_id: number | null;
    role_name: string;
    is_active?: boolean;
    avatar_url?: string;
    permissions: string[];
}
```

- [ ] **Step 2: Write the failing test for `cn`**

```ts
// src/utils/cn.test.ts
import { describe, it, expect } from 'vitest';
import { cn } from './cn.js';

describe('cn', () => {
    it('joins plain class strings', () => {
        expect(cn('a', 'b')).toBe('a b');
    });

    it('drops falsy values', () => {
        expect(cn('a', false, null, undefined, 'b')).toBe('a b');
    });

    it('merges conflicting Tailwind classes, keeping the last one', () => {
        expect(cn('px-2', 'px-4')).toBe('px-4');
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/utils/cn.test.ts`
Expected: FAIL — `Cannot find module './cn.js'`

- [ ] **Step 4: Write `src/utils/cn.ts`**

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/utils/cn.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 6: Write `src/services/storageService.ts`**

```ts
import type { User } from '../types/index.js';

const PREFIX = 'exh_';

export const StorageService = {
    set(key: string, value: unknown): void {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch { /* quota exceeded — ignore */ }
    },

    get<T>(key: string): T | null {
        try {
            const item = localStorage.getItem(PREFIX + key);
            return item ? (JSON.parse(item) as T) : null;
        } catch {
            return null;
        }
    },

    remove(key: string): void {
        localStorage.removeItem(PREFIX + key);
    },

    clear(): void {
        Object.keys(localStorage)
            .filter(k => k.startsWith(PREFIX))
            .forEach(k => localStorage.removeItem(k));
    },

    getToken(): string | null {
        return this.get<string>('token');
    },

    setToken(token: string): void {
        this.set('token', token);
    },

    getCurrentUser(): User | null {
        return this.get<User>('user');
    },

    setCurrentUser(user: User): void {
        this.set('user', user);
    },
};
```

- [ ] **Step 7: Write the failing tests for `apiClient`**

```ts
// src/services/apiClient.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getTokenMock = vi.fn<() => string | null>(() => null);
vi.mock('./storageService.js', () => ({
    StorageService: {
        getToken: () => getTokenMock(),
        clear: vi.fn(),
    },
}));

import { apiClient } from './apiClient.js';

describe('apiClient', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        getTokenMock.mockReturnValue(null);
        // @ts-expect-error -- test override of a read-only global
        delete window.location;
        // @ts-expect-error -- minimal stub, only `href` is exercised
        window.location = { href: '' };
    });

    afterEach(() => {
        window.location = originalLocation;
        vi.restoreAllMocks();
    });

    it('sends a GET with no Authorization header when there is no token', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ hello: 'world' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await apiClient.get<{ hello: string }>('/ping');

        expect(result).toEqual({ hello: 'world' });
        const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
    });

    it('attaches Authorization when a token is present', async () => {
        getTokenMock.mockReturnValue('abc123');
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({}),
        });
        vi.stubGlobal('fetch', fetchMock);

        await apiClient.get('/ping');

        const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer abc123');
    });

    it('redirects to /login on a 401 response', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
        vi.stubGlobal('fetch', fetchMock);

        await expect(apiClient.get('/private')).rejects.toThrow();
        expect(window.location.href).toBe('/login?expired=true');
    });

    it('throws the server-provided error message on a non-401 failure', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: 'Datos inválidos' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await expect(apiClient.post('/thing', {})).rejects.toThrow('Datos inválidos');
    });

    it('returns undefined for a 204 No Content response', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
        vi.stubGlobal('fetch', fetchMock);

        const result = await apiClient.delete('/thing/1');
        expect(result).toBeUndefined();
    });
});
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `npx vitest run src/services/apiClient.test.ts`
Expected: FAIL — `Cannot find module './apiClient.js'`

- [ ] **Step 9: Write `src/services/apiClient.ts`**

```ts
import { StorageService } from './storageService.js';

const API_BASE_URL =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (import.meta.env.PROD ? '' : 'http://localhost:3000') + '/api';

async function request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    customHeaders?: Record<string, string>
): Promise<T> {
    const token = StorageService.getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...customHeaders,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'include',
    });

    if (response.status === 401) {
        StorageService.clear();
        window.location.href = '/login?expired=true';
        throw new Error('Session expired');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}

export const apiClient = {
    get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
        return request<T>('GET', endpoint, undefined, headers);
    },
    post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
        return request<T>('POST', endpoint, body, headers);
    },
    put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
        return request<T>('PUT', endpoint, body, headers);
    },
    delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
        return request<T>('DELETE', endpoint, undefined, headers);
    },
    patch<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
        return request<T>('PATCH', endpoint, body, headers);
    },
};
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx vitest run src/services/apiClient.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 11: Run the full test suite and type-check**

Run: `npm run test && npm run lint`
Expected: both PASS.

- [ ] **Step 12: Commit**

```bash
git add src/types/index.ts src/utils/cn.ts src/utils/cn.test.ts src/services/storageService.ts src/services/apiClient.ts src/services/apiClient.test.ts
git commit -m "feat: frontend types, storage service, API client (TDD)"
```

---

## Task 10: Design system, theme/dialog contexts, i18n

**Files:**
- Modify: `src/index.css` (replace stub from Task 1)
- Create: `src/utils/siatc-theme.ts`
- Create: `src/context/ThemeContext.tsx`
- Create: `src/context/DialogContext.tsx`
- Create: `src/i18n.ts`
- Create: `public/locales/es.json`
- Create: `public/locales/en.json`

**Interfaces:**
- Consumes: `cn` (Task 9).
- Produces: `SIATC_THEME` object; `ThemeProvider`/`useTheme()`; `DialogProvider`/`useDialog()` (`confirm`, `alert`) — consumed by Task 11 (`useAuth` logout confirmation), Task 12 (layout), Task 13 (pages, `App.tsx`).

No `ToastProvider` in this task — nothing in Fundación's scope calls it (login shows inline error banners, not toasts; logout navigates away immediately). It gets added in the first module that needs "guardado exitosamente"-style feedback. No `AppSwitcher`/`AppConfigContext` — dropped per spec (Hybrid approach, Console integration out of scope).

- [ ] **Step 1: Write `src/index.css`**

Grupo Sole's real brand color (`#4C5F80`, verified against `gruposole.com.pe`'s own CSS) baked in from the start — not retrofitted after a generic default like the previous attempt.

```css
@import "tailwindcss";

@theme {
    --color-primary: #4C5F80;
    --color-primary-foreground: #ffffff;
    --color-secondary: #A4ABB1;
    --color-background: #f9fafb;
    --color-foreground: #272020;
    --color-card: #ffffff;
    --color-muted: #f1f5f9;
    --color-muted-foreground: #64748b;
    --color-border: #e2e8f0;

    --color-cb-bg: #f8fafc;
    --color-cb-border: #e2e8f0;
    --color-cb-text-primary: #272020;
    --color-cb-text-secondary: #64748b;
    --color-cb-neutral: #94a3b8;
    --color-cb-slate: #94a3b8;
    --color-cb-blue: #4C5F80;

    --radius-cb-chip: 4px;
    --radius-cb-btn: 8px;
    --radius-cb-card: 12px;
    --radius-cb-modal: 16px;

    --shadow-cb-level-1: 0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07);
    --shadow-cb-level-2: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07);
    --shadow-cb-level-3: 0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07);
}

.dark {
    /* Tinte más claro del navy de marca para mantener contraste sobre fondo oscuro */
    --color-primary: #7C93B8;
    --color-primary-foreground: #0f172a;
    --color-background: #020617;
    --color-foreground: #f8fafc;
    --color-card: #0f172a;
    --color-muted: #1e293b;
    --color-muted-foreground: #94a3b8;
    --color-border: #1e293b;

    --color-cb-bg: #0f172a;
    --color-cb-border: #1e293b;
    --color-cb-text-primary: #f8fafc;
    --color-cb-text-secondary: #94a3b8;
    --color-cb-blue: #7C93B8;
}

*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: var(--font-sans, system-ui, sans-serif); background-color: var(--color-background); color: var(--color-foreground); }

.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-cb-border); border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-cb-neutral); }
```

- [ ] **Step 2: Write `src/utils/siatc-theme.ts`**

Trimmed from the ecosystem template: no `APP_SWITCHER` section (no AppSwitcher in Fundación), no dynamic `SIDEBAR` config object (MainLayout uses fixed constants in Task 12 instead of pulling width/collapse behavior from a fetched app config that no longer exists).

```ts
const CRYPTO_BLUE_TOKENS = {
    RADIUS: {
        CHIP: "rounded-cb-chip",
        BUTTON: "rounded-cb-btn",
        INPUT: "rounded-cb-btn",
        CARD: "rounded-cb-card",
        MODAL: "rounded-cb-modal",
        FULL: "rounded-full",
    },
    TYPOGRAPHY: {
        H1: "font-sans font-bold tracking-[-0.02em] text-[18px] leading-[1.2] text-cb-text-primary",
        H2: "font-sans font-bold tracking-[-0.01em] text-[15px] leading-[1.3] text-cb-text-primary",
        BODY: "font-sans font-normal text-[16px] leading-[1.5] text-cb-text-primary",
        BODY_SMALL: "font-sans font-normal text-[14px] leading-[1.5] text-cb-text-secondary",
    },
};

export const SIATC_THEME = {
    TOKENS: {
        ...CRYPTO_BLUE_TOKENS,
        MODAL_OVERLAY: "bg-slate-900/60 backdrop-blur-md",
    },

    LAYOUT: {
        PAGE_WRAPPER: "flex flex-col h-full bg-cb-bg min-h-0 animate-in fade-in duration-500 p-4 space-y-4",
        HEADER_WRAPPER: "flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-1",
        CONTENT_CONTAINER: "flex-1 min-h-0 flex flex-col bg-card border border-cb-border rounded-cb-card shadow-cb-level-1 overflow-hidden",
        SIDEBAR_INNER: "flex flex-col h-full bg-transparent text-cb-text-primary transition-all duration-500",
        SIDEBAR_ITEM_ACTIVE: "group/item flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative overflow-hidden bg-primary text-primary-foreground shadow-lg shadow-primary/25 translate-x-1",
        SIDEBAR_ITEM_INACTIVE: "group/item flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative overflow-hidden text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1",
    },

    TYPOGRAPHY: {
        PAGE_TITLE: CRYPTO_BLUE_TOKENS.TYPOGRAPHY.H1,
        PAGE_SUBTITLE: `${CRYPTO_BLUE_TOKENS.TYPOGRAPHY.BODY_SMALL} hidden sm:block`,
    },

    COMPONENTS: {
        BUTTON_PRIMARY: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-cb-btn hover:bg-primary/90 transition-all active:scale-95 font-bold text-sm shadow-sm",
        BUTTON_SECONDARY: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-card text-cb-text-primary border border-cb-border rounded-cb-btn hover:bg-cb-bg/50 transition-all active:scale-95 font-bold text-sm",
        BUTTON_DANGER: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-[#DF2935] text-white rounded-cb-btn hover:bg-[#DF2935]/90 transition-all active:scale-95 font-bold text-sm shadow-sm",
        MODAL_CONTENT: "bg-card text-cb-text-primary rounded-cb-modal border border-cb-border shadow-cb-level-3 overflow-hidden",
    },

    FORM: {
        FOOTER: "flex items-center gap-3 pt-4 border-t border-cb-border mt-2",
    },

    LOGIN_LAYOUT: {
        LEFT_PANEL: "hidden md:flex flex-col justify-between w-1/2 bg-primary text-white p-12 relative overflow-hidden",
        RIGHT_PANEL: "flex-1 flex flex-col justify-center items-center p-8 bg-[#F7F8FA] dark:bg-[#050B14] relative",
    },
};
```

- [ ] **Step 3: Write `src/context/ThemeContext.tsx`**

```tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        return (localStorage.getItem('exh_theme') as Theme) || 'system';
    });

    const getResolved = (t: Theme): 'light' | 'dark' => {
        if (t === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return t;
    };

    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => getResolved(theme));

    const applyTheme = (t: Theme) => {
        const resolved = getResolved(t);
        setResolvedTheme(resolved);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
    };

    useEffect(() => {
        applyTheme(theme);
        if (theme === 'system') {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = () => applyTheme('system');
            mq.addEventListener('change', handler);
            return () => mq.removeEventListener('change', handler);
        }
    }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem('exh_theme', t);
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextType {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
    return ctx;
}
```

- [ ] **Step 4: Write `src/context/DialogContext.tsx`**

```tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '../utils/cn.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';

interface DialogOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
}

interface DialogContextType {
    confirm: (options: DialogOptions) => Promise<boolean>;
    alert: (title: string, message: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
    const [dialog, setDialog] = useState<(DialogOptions & { resolve: (v: boolean) => void }) | null>(null);

    const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
        return new Promise(resolve => {
            setDialog({ ...options, resolve });
        });
    }, []);

    const alert = useCallback((title: string, message: string): Promise<void> => {
        return confirm({ title, message, confirmLabel: 'Aceptar', cancelLabel: '' }).then(() => undefined);
    }, [confirm]);

    const handleClose = (value: boolean) => {
        dialog?.resolve(value);
        setDialog(null);
    };

    return (
        <DialogContext.Provider value={{ confirm, alert }}>
            {children}
            {dialog && (
                <div className={cn('fixed inset-0 z-[150] flex items-center justify-center p-4', SIATC_THEME.TOKENS.MODAL_OVERLAY)}>
                    <div className={SIATC_THEME.COMPONENTS.MODAL_CONTENT + ' w-full max-w-sm'}>
                        <div className="px-6 py-5 border-b border-cb-border">
                            <h3 className="text-sm font-black uppercase tracking-wider">{dialog.title}</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className={SIATC_THEME.TOKENS.TYPOGRAPHY.BODY_SMALL}>{dialog.message}</p>
                            <div className={cn(SIATC_THEME.FORM.FOOTER, 'mt-0')}>
                                {dialog.cancelLabel !== '' && (
                                    <button
                                        className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, 'flex-1 h-11 cursor-pointer')}
                                        onClick={() => handleClose(false)}
                                    >
                                        {dialog.cancelLabel || 'Cancelar'}
                                    </button>
                                )}
                                <button
                                    className={cn(
                                        dialog.variant === 'danger'
                                            ? SIATC_THEME.COMPONENTS.BUTTON_DANGER
                                            : SIATC_THEME.COMPONENTS.BUTTON_PRIMARY,
                                        'flex-1 h-11 cursor-pointer'
                                    )}
                                    onClick={() => handleClose(true)}
                                >
                                    {dialog.confirmLabel || 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
}

export function useDialog(): DialogContextType {
    const ctx = useContext(DialogContext);
    if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
    return ctx;
}
```

- [ ] **Step 5: Write `src/i18n.ts`**

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'es',
        debug: false,
        interpolation: {
            escapeValue: false,
        },
        backend: {
            loadPath: '/locales/{{lng}}.json',
        },
    });

export default i18n;
```

- [ ] **Step 6: Write `public/locales/es.json`**

```json
{
    "common": {
        "loading": "Cargando...",
        "logout": "Cerrar Sesión",
        "cancel": "Cancelar"
    },
    "nav": {
        "dashboard": "Dashboard",
        "main_menu": "Menú Principal",
        "change_language": "Cambiar idioma",
        "current_language": "Español"
    },
    "auth": {
        "subtitle": "Ingresa tus credenciales para acceder a la plataforma.",
        "title": "Iniciar Sesión",
        "username": "Usuario",
        "username_placeholder": "Ingresa tu usuario",
        "password": "Contraseña",
        "password_placeholder": "Ingresa tu contraseña",
        "login_button": "Iniciar Sesión",
        "error_generic": "Error al iniciar sesión",
        "logout_confirm_title": "Cerrar sesión",
        "logout_confirm_message": "¿Estás seguro de que quieres cerrar tu sesión?"
    },
    "dashboard": {
        "title": "Dashboard",
        "welcome": "Bienvenido, {{name}}.",
        "subtitle": "Sistema de Exhibiciones Trade Marketing — Grupo Sole"
    }
}
```

- [ ] **Step 7: Write `public/locales/en.json`**

```json
{
    "common": {
        "loading": "Loading...",
        "logout": "Log Out",
        "cancel": "Cancel"
    },
    "nav": {
        "dashboard": "Dashboard",
        "main_menu": "Main Menu",
        "change_language": "Change language",
        "current_language": "English"
    },
    "auth": {
        "subtitle": "Enter your credentials to access the platform.",
        "title": "Sign In",
        "username": "Username",
        "username_placeholder": "Enter your username",
        "password": "Password",
        "password_placeholder": "Enter your password",
        "login_button": "Sign In",
        "error_generic": "Error signing in",
        "logout_confirm_title": "Sign out",
        "logout_confirm_message": "Are you sure you want to sign out?"
    },
    "dashboard": {
        "title": "Dashboard",
        "welcome": "Welcome, {{name}}.",
        "subtitle": "Trade Marketing Exhibitions System — Grupo Sole"
    }
}
```

- [ ] **Step 8: Run type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/index.css src/utils/siatc-theme.ts src/context/ThemeContext.tsx src/context/DialogContext.tsx src/i18n.ts public/locales/es.json public/locales/en.json
git commit -m "feat: design system (Sole brand colors from the start), theme/dialog contexts, i18n"
```

---

## Task 11: Permission logic, useAuth, common components

**Files:**
- Create: `src/utils/permissions.ts`
- Test: `src/utils/permissions.test.ts`
- Create: `src/hooks/useAuth.tsx`
- Create: `src/components/common/ErrorBoundary.tsx`
- Create: `src/components/common/RequirePermission.tsx`

**Interfaces:**
- Consumes: `User` type, `StorageService`, `apiClient` (Task 9); `SIATC_THEME` (Task 10).
- Produces: `resolvePermission` (frontend copy — small enough to duplicate across the frontend/backend boundary rather than build a shared package for three lines of logic); `AuthProvider`/`useAuth()` (`user`, `isAuthenticated`, `isLoading`, `login`, `logout`, `hasPermission`); `ErrorBoundary`; `<RequirePermission permission="...">` — consumed by Task 12 (layout), Task 13 (pages, `App.tsx`).

`RequirePermission` has no consumer inside Fundación's own pages yet — the spec explicitly asked for the permission gate infrastructure to exist before any module needs it (`TB_ROL_PERMISOS` is empty in the real database today). Its test proves the gating logic works; the first business module wires it into real UI.

- [ ] **Step 1: Write the failing test for `resolvePermission`**

Identical contract to the backend's `server/lib/permissions.ts` (Task 6) — duplicated intentionally, not imported across the frontend/backend boundary.

```ts
// src/utils/permissions.test.ts
import { describe, it, expect } from 'vitest';
import { resolvePermission } from './permissions.js';

describe('resolvePermission', () => {
    it('grants everything to Administrador', () => {
        expect(resolvePermission('Administrador', [], 'exh.checklists.delete')).toBe(true);
    });

    it('grants a permission present in the list', () => {
        expect(resolvePermission('Promotoria', ['exh.checklists.ver'], 'exh.checklists.ver')).toBe(true);
    });

    it('denies a permission absent from the list', () => {
        expect(resolvePermission('Promotoria', ['exh.checklists.ver'], 'exh.checklists.eliminar')).toBe(false);
    });

    it('denies everything for a null/empty role', () => {
        expect(resolvePermission('', [], 'exh.checklists.ver')).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/permissions.test.ts`
Expected: FAIL — `Cannot find module './permissions.js'`

- [ ] **Step 3: Write `src/utils/permissions.ts`**

```ts
export function resolvePermission(
    roleName: string,
    permissions: string[],
    required: string
): boolean {
    const roleLower = (roleName || '').trim().toLowerCase();
    if (roleLower === 'administrador') return true;
    return permissions.includes(required);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/permissions.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Write `src/hooks/useAuth.tsx`**

No cross-domain SSO cookie logic — dropped along with AppSwitcher/Console per the spec's Hybrid approach; nothing in the ecosystem expects an Exhibiciones-issued cookie yet, and it would be untested surface area.

```tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { StorageService } from '../services/storageService.js';
import { apiClient } from '../services/apiClient.js';
import { resolvePermission } from '../utils/permissions.js';
import type { User } from '../types/index.js';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string, user: User) => void;
    logout: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearInactivityTimer = useCallback(() => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    }, []);

    const logout = useCallback(async () => {
        clearInactivityTimer();
        try {
            await apiClient.post('/auth/logout');
        } catch { /* best-effort — el token se borra igual del lado cliente */ }
        StorageService.clear();
        setUser(null);
        window.location.href = '/login';
    }, [clearInactivityTimer]);

    const resetInactivityTimer = useCallback(() => {
        clearInactivityTimer();
        inactivityTimer.current = setTimeout(() => {
            logout();
        }, INACTIVITY_TIMEOUT_MS);
    }, [clearInactivityTimer, logout]);

    const login = useCallback((token: string, userData: User) => {
        StorageService.setToken(token);
        StorageService.setCurrentUser(userData);
        setUser(userData);
        resetInactivityTimer();
    }, [resetInactivityTimer]);

    useEffect(() => {
        const token = StorageService.getToken();
        if (!token) {
            setIsLoading(false);
            return;
        }

        apiClient.get<{ user: User }>('/auth/me')
            .then(({ user: serverUser }) => {
                StorageService.setCurrentUser(serverUser);
                setUser(serverUser);
                resetInactivityTimer();
            })
            .catch(() => {
                StorageService.clear();
                setUser(null);
            })
            .finally(() => setIsLoading(false));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!user) return;
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
        resetInactivityTimer();
        return () => {
            events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
            clearInactivityTimer();
        };
    }, [user, resetInactivityTimer, clearInactivityTimer]);

    const hasPermission = useCallback((permission: string): boolean => {
        if (!user) return false;
        return resolvePermission(user.role_name, user.permissions, permission);
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
```

- [ ] **Step 6: Write `src/components/common/ErrorBoundary.tsx`**

```tsx
import React from 'react';
import { SIATC_THEME } from '../../utils/siatc-theme.js';

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-8 bg-[#F9FAFB] dark:bg-[#050F1A]">
                    <div className={SIATC_THEME.COMPONENTS.MODAL_CONTENT + ' max-w-md w-full p-8 text-center space-y-4'}>
                        <p className="text-4xl">⚠️</p>
                        <h2 className={SIATC_THEME.TOKENS.TYPOGRAPHY.H1}>Algo salió mal</h2>
                        <p className={SIATC_THEME.TOKENS.TYPOGRAPHY.BODY_SMALL}>
                            {this.state.error?.message || 'Error inesperado. Recarga la página.'}
                        </p>
                        <button
                            className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY}
                            onClick={() => window.location.reload()}
                        >
                            Recargar
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
```

- [ ] **Step 7: Write `src/components/common/RequirePermission.tsx`**

```tsx
import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth.js';

interface RequirePermissionProps {
    permission: string;
    fallback?: ReactNode;
    children: ReactNode;
}

export function RequirePermission({ permission, fallback = null, children }: RequirePermissionProps) {
    const { hasPermission } = useAuth();
    return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
```

- [ ] **Step 8: Run the full test suite and type-check**

Run: `npm run test && npm run lint`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add src/utils/permissions.ts src/utils/permissions.test.ts src/hooks/useAuth.tsx src/components/common/ErrorBoundary.tsx src/components/common/RequirePermission.tsx
git commit -m "feat: useAuth, permission gate infra (RequirePermission), ErrorBoundary (TDD)"
```

---

## Task 12: Layout shell (Sidebar + MainLayout)

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/MainLayout.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 11), `useTheme`/`useDialog` (Task 10), `SIATC_THEME`/`cn` (Tasks 9–10).
- Produces: `Sidebar` component; `MainLayout` component (default export, used as a layout `<Route element={<MainLayout />}>` wrapper) — consumed by Task 13 (`App.tsx`).

Fixed sidebar width constants instead of the template's dynamic branding-driven config — there's no `AppConfigProvider` fetching a per-app sidebar width from a Console database in Fundación, so a hardcoded, sensible default replaces it. Logout goes through `useDialog().confirm()` first — the concrete consumer that justifies keeping `DialogContext` in scope.

- [ ] **Step 1: Write `src/components/layout/Sidebar.tsx`**

```tsx
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth.js';
import { useDialog } from '../../context/DialogContext.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';
import { LayoutDashboard, LogOut, Globe } from 'lucide-react';

const APP_NAME = 'Exhibiciones';
const APP_DESC = 'Grupo Sole';

export interface SidebarProps {
    className?: string;
    isExpanded: boolean;
}

const ICON_ACTIVE = 'flex items-center justify-center w-9 h-9 mx-auto rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-300';
const ICON_INACTIVE = 'flex items-center justify-center w-9 h-9 mx-auto rounded-xl text-cb-text-secondary hover:bg-primary/10 hover:text-primary transition-all duration-300 cursor-pointer';

export function Sidebar({ className, isExpanded }: SidebarProps) {
    const { logout } = useAuth();
    const { confirm } = useDialog();
    const location = useLocation();
    const { t, i18n } = useTranslation();

    const toggleLanguage = () => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');

    const handleLogout = async () => {
        const ok = await confirm({
            title: t('auth.logout_confirm_title'),
            message: t('auth.logout_confirm_message'),
            variant: 'danger',
            confirmLabel: t('common.logout'),
        });
        if (ok) logout();
    };

    // TODO (sub-proyectos futuros): agrega los items de menú de cada módulo aquí
    const menuItems = [
        { path: '/dashboard', name: t('nav.dashboard'), icon: LayoutDashboard },
    ];

    return (
        <div className={cn(SIATC_THEME.LAYOUT.SIDEBAR_INNER, className)}>
            <div className={cn(
                'border-b border-border/50 bg-gradient-to-br from-primary/5 to-transparent transition-all duration-300',
                isExpanded ? 'p-4 gap-3 flex items-center' : 'px-1 py-4 flex flex-col items-center gap-2'
            )}>
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 text-primary-foreground font-black text-sm">
                    S
                </div>
                <div className={cn(
                    'flex flex-col min-w-0 overflow-hidden transition-all duration-300',
                    isExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0 pointer-events-none'
                )}>
                    <h1 className="font-bold text-base leading-none tracking-tight text-foreground uppercase truncate">{APP_NAME}</h1>
                    <p className="text-[9px] font-black text-primary tracking-[0.05em] uppercase mt-1 opacity-70">{APP_DESC}</p>
                </div>
            </div>

            <nav className={cn('flex-1 overflow-y-auto custom-scrollbar transition-all duration-300', isExpanded ? 'px-3 py-6 space-y-1.5' : 'px-1 py-4 space-y-2')}>
                {isExpanded && (
                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] px-4 py-2 uppercase opacity-40">
                        {t('nav.main_menu')}
                    </p>
                )}
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    if (!isExpanded) {
                        return (
                            <NavLink key={item.path} to={item.path} title={item.name} className={isActive ? ICON_ACTIVE : ICON_INACTIVE}>
                                <Icon className="w-5 h-5 shrink-0" />
                            </NavLink>
                        );
                    }
                    return (
                        <NavLink key={item.path} to={item.path} className={isActive ? SIATC_THEME.LAYOUT.SIDEBAR_ITEM_ACTIVE : SIATC_THEME.LAYOUT.SIDEBAR_ITEM_INACTIVE}>
                            <div className="flex items-center gap-3 relative z-10">
                                <Icon className="w-5 h-5 shrink-0" />
                                <span className="tracking-tight">{item.name}</span>
                            </div>
                        </NavLink>
                    );
                })}
            </nav>

            <div className={cn('border-t border-border/50 bg-muted/20 shrink-0 transition-all duration-300', isExpanded ? 'p-4 space-y-2' : 'p-2 flex flex-col items-center gap-2')}>
                {isExpanded ? (
                    <>
                        <button type="button" onClick={toggleLanguage} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-white/5 rounded-2xl transition-all cursor-pointer">
                            <Globe className="w-4 h-4 text-primary" />
                            <span className="uppercase tracking-widest">{t('nav.current_language')}</span>
                        </button>
                        <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl transition-all uppercase tracking-[0.2em] cursor-pointer">
                            <LogOut className="w-4 h-4" />
                            {t('common.logout')}
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={toggleLanguage} title={t('nav.change_language')} className="flex items-center justify-center w-9 h-9 mx-auto rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all cursor-pointer">
                            <Globe className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={handleLogout} title={t('common.logout')} className="flex items-center justify-center w-9 h-9 mx-auto rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default Sidebar;
```

- [ ] **Step 2: Write `src/components/layout/MainLayout.tsx`**

```tsx
import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth.js';
import { useTheme } from '../../context/ThemeContext.js';
import { Sidebar } from './Sidebar.js';
import { cn } from '../../utils/cn.js';
import { Menu, X, Sun, Moon } from 'lucide-react';

const EXPANDED_WIDTH = '280px';
const COLLAPSED_WIDTH = '72px';
const COLLAPSED_KEY = 'exh_sidebar_collapsed';

export const MainLayout: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false); // mobile only
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
    const { theme, setTheme } = useTheme();
    const { t } = useTranslation();

    const isExpanded = sidebarOpen || !isCollapsed;
    const spacerWidth = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

    const handleToggle = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem(COLLAPSED_KEY, String(next));
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#050F1A] flex flex-col justify-center items-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-sm font-bold text-cb-text-secondary uppercase tracking-widest animate-pulse">{t('common.loading')}</p>
            </div>
        );
    }

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return (
        <div className="h-screen bg-[#F8FAFC] dark:bg-[#020617] text-foreground flex overflow-hidden">
            <div
                className={cn('fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md lg:hidden transition-all duration-500', sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')}
                onClick={() => setSidebarOpen(false)}
            />

            <div className="hidden lg:block shrink-0 transition-[width] duration-300 ease-in-out" style={{ width: spacerWidth }} />

            <aside
                className={cn('fixed inset-y-0 left-0 z-[70] transition-[transform,width] duration-300 ease-in-out', sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}
                style={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
            >
                <button
                    type="button"
                    onClick={handleToggle}
                    className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-20 h-10 w-5 rounded-r-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-l-0 border-border/40 shadow-[2px_0_8px_rgba(0,0,0,0.08)] items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200 cursor-pointer"
                >
                    {isExpanded ? '‹' : '›'}
                </button>

                <div className="h-full p-4">
                    <div className="h-full flex flex-col overflow-hidden relative border border-white dark:border-white/5 shadow-2xl rounded-[2.5rem] bg-cb-bg">
                        <button type="button" onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 z-10 p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all cursor-pointer lg:hidden">
                            <X className="w-6 h-6" />
                        </button>
                        <Sidebar className="flex-1" isExpanded={isExpanded} />
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative lg:pr-4 lg:pb-4">
                <header className="h-16 lg:h-20 shrink-0 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40">
                    <button type="button" onClick={() => setSidebarOpen(true)} className="p-3 -ml-3 text-muted-foreground hover:bg-white dark:hover:bg-white/5 rounded-2xl lg:hidden shadow-sm transition-all cursor-pointer">
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="flex items-center p-1.5 gap-2 rounded-[2rem] border bg-card/80 backdrop-blur-xl border-cb-border shadow-cb-level-2">
                        <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 rounded-full transition-all cursor-pointer">
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto custom-scrollbar px-4 lg:px-8 pb-6">
                    <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col min-h-0">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
```

- [ ] **Step 3: Run type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/MainLayout.tsx
git commit -m "feat: layout shell — sidebar con ancho fijo, logout vía confirmación de DialogContext"
```

---

## Task 13: Pages + App wiring

**Files:**
- Create: `src/pages/LoginPage.tsx`
- Create: `src/pages/DashboardPage.tsx`
- Modify: `src/App.tsx` (replace stub from Task 1)
- Modify: `src/main.tsx` (replace stub from Task 1)

**Interfaces:**
- Consumes: everything from Tasks 9–12 (`useAuth`, `apiClient`, `ThemeProvider`, `DialogProvider`, `ErrorBoundary`, `MainLayout`, i18n).
- Produces: the running app — `npm run dev` serves a working login → dashboard flow.

- [ ] **Step 1: Write `src/pages/LoginPage.tsx`**

Single responsive component — mobile gets a top brand panel, desktop gets a split panel — no separate mobile/desktop services (the pattern that looked unprofessional in the previous Angular system).

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { apiClient } from '../services/apiClient.js';
import type { User as AppUser } from '../types/index.js';

interface LoginResponse {
    user: AppUser;
    token: string;
}

export function LoginPage() {
    const { t } = useTranslation();
    const { login } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await apiClient.post<LoginResponse>('/auth/login', { username, password });
            login(data.token, data.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('auth.error_generic'));
        } finally {
            setLoading(false);
        }
    };

    const renderForm = () => (
        <form onSubmit={handleLogin} className="space-y-5">
            <div>
                <label htmlFor="username" className="block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-2 ml-0.5">
                    {t('auth.username')}
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                        <User className="w-[18px] h-[18px]" />
                    </div>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('auth.username_placeholder')}
                        autoComplete="username"
                        required
                        autoFocus
                        className="block w-full pl-11 pr-3 py-3 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-all outline-none text-sm font-medium placeholder:text-cb-neutral/50"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="password" className="block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-2 ml-0.5">
                    {t('auth.password')}
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                        <Lock className="w-[18px] h-[18px]" />
                    </div>
                    <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('auth.password_placeholder')}
                        autoComplete="current-password"
                        required
                        className="block w-full pl-11 pr-11 py-3 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-all outline-none text-sm font-medium placeholder:text-cb-neutral/50"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-cb-neutral hover:text-primary transition-colors cursor-pointer"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
                {loading ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : t('auth.login_button')}
            </button>
        </form>
    );

    return (
        <div className="min-h-dvh flex flex-col md:flex-row bg-[#F7F8FA] dark:bg-[#050B14]">
            {/* ═══ MOBILE (<768px) ═══ */}
            <div className="flex flex-col md:hidden min-h-dvh w-full">
                <div className="relative bg-primary overflow-hidden shrink-0 pb-12 pt-10 min-h-[38dvh]">
                    <div className="absolute -top-14 -right-10 w-52 h-52 rounded-full bg-white/8 pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center text-center px-6">
                        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-xl mb-5">
                            <span className="text-primary font-black text-2xl tracking-tighter">S</span>
                        </div>
                        <h1 className="text-white text-2xl font-bold tracking-tight">Grupo Sole</h1>
                        <p className="text-white/75 text-sm mt-1.5 max-w-[240px]">{t('auth.subtitle')}</p>
                    </div>
                    <svg className="absolute bottom-0 left-0 w-full h-12" viewBox="0 0 375 48" preserveAspectRatio="none">
                        <path d="M0,24 C90,52 285,-4 375,20 L375,48 L0,48 Z" fill="currentColor" className="text-[#F7F8FA] dark:text-[#050B14]" />
                    </svg>
                </div>
                <div className="flex-1 flex flex-col justify-center px-6 py-8">
                    <div className="max-w-sm mx-auto w-full">{renderForm()}</div>
                </div>
            </div>

            {/* ═══ DESKTOP (≥768px) ═══ */}
            <div className="hidden md:flex md:flex-row w-full">
                <div className="hidden md:flex flex-col justify-between w-1/2 bg-primary text-white p-12 lg:p-16 relative overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/6 pointer-events-none" />
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-lg shrink-0">
                            <span className="text-primary font-black text-lg tracking-tighter">S</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight">Grupo Sole</span>
                    </div>
                    <div className="relative z-10 max-w-md">
                        <h1 className="text-4xl lg:text-5xl font-bold mb-5 leading-[1.15] text-wrap-balance">
                            Plataforma de<br />Gestión de<br />Exhibiciones
                        </h1>
                        <p className="text-white/75 text-base leading-relaxed">
                            Registro, seguimiento y control de exhibidores, checklists de visita y requerimientos en punto de venta.
                        </p>
                    </div>
                    <div className="relative z-10 text-xs text-white/50 font-medium">
                        © {new Date().getFullYear()} Grupo Sole Rinnai Corporation. Todos los derechos reservados.
                    </div>
                </div>
                <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 bg-[#F7F8FA] dark:bg-[#050B14] relative">
                    <div className="w-full max-w-[380px] space-y-8">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-bold tracking-tight text-cb-text-primary">{t('auth.title')}</h2>
                            <p className="mt-1.5 text-sm text-cb-text-secondary">{t('auth.subtitle')}</p>
                        </div>
                        <div className="bg-card border border-cb-border rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none p-8">
                            {renderForm()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
```

- [ ] **Step 2: Write `src/pages/DashboardPage.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';

export function DashboardPage() {
    const { user } = useAuth();
    const { t } = useTranslation();

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div>
                    <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('dashboard.title')}</h1>
                    <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('dashboard.subtitle')}</p>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="flex-1 flex items-center justify-center p-16 text-center">
                    <div className="max-w-sm space-y-2">
                        <h2 className="text-lg font-bold text-cb-text-primary">
                            {t('dashboard.welcome', { name: user?.full_name?.split(' ')[0] || user?.username })}
                        </h2>
                        <p className="text-sm text-cb-text-secondary">
                            {user?.role_name}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
```

- [ ] **Step 3: Write `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { DialogProvider } from './context/DialogContext.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
// TODO (sub-proyectos futuros): importa tus páginas de módulo aquí

export default function App() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <AuthProvider>
                    <DialogProvider>
                        <BrowserRouter>
                            <Routes>
                                <Route path="/login" element={<LoginPage />} />
                                <Route element={<MainLayout />}>
                                    <Route index element={<Navigate to="/dashboard" replace />} />
                                    <Route path="/dashboard" element={<DashboardPage />} />
                                    {/* TODO: agrega tus rutas de módulo aquí */}
                                </Route>
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </Routes>
                        </BrowserRouter>
                    </DialogProvider>
                </AuthProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
}
```

- [ ] **Step 4: Write `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';
import './i18n.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
```

- [ ] **Step 5: Run type-check and build**

Run: `npm run lint && npm run build`
Expected: both PASS.

- [ ] **Step 6: Manual verification — full login flow**

With the backend running (`npm run server`) and the frontend dev server up (`npm run dev`):

1. Open `http://localhost:5173/` — should redirect to `/login` and show the Sole-branded login (mobile layout under 768px width, split panel above).
2. Submit an intentionally wrong password for a known username (e.g. `admin`) — should show an inline error, no crash, no blank page.
3. Submit the real credentials — should redirect to `/dashboard`, show "Bienvenido, {nombre}" and the user's role.
4. Reload the page while logged in — should stay on `/dashboard` (session persists via `/auth/me`), not bounce back to `/login`.
5. Click "Cerrar Sesión" in the sidebar — should show the confirmation dialog; confirming should redirect to `/login` and a reload should NOT restore the session.

- [ ] **Step 7: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/DashboardPage.tsx src/App.tsx src/main.tsx
git commit -m "feat: login flow completo — LoginPage, DashboardPage, App wiring"
```

---

## Task 14: Docker, dual-repo push, and deploy verification

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `public/favicon.svg`
- Create: `README.md`

**Interfaces:**
- Consumes: the entire app from Tasks 1–13.
- Produces: a deployable Docker image; both git remotes wired; a verified live deployment.

- [ ] **Step 1: Write `Dockerfile`**

`bcryptjs` from the start means no native-module build step is needed — this Dockerfile has no `python3`/`make`/`g++` toolchain to install, unlike a `bcrypt`-based build would. `--fetch-retries` is present from the first commit, not added after an `ECONNRESET` failure in production.

```dockerfile
# ─── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=60000

COPY . .
RUN npm run build

# ─── Stage 2: Production server ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=60000

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY tsconfig.node.json ./

RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "server/index.ts"]
```

- [ ] **Step 2: Write `docker-compose.yml`**

For local Docker parity testing later, or for anyone who wants Redis running for real instead of relying on the circuit-breaker degrading gracefully. Not required for Fundación's chosen verification approach (Task 7/8's manual steps run against `tsx` directly, no Docker).

```yaml
version: '3.9'

services:
  app:
    build: .
    ports:
      - "${PORT:-3000}:3000"
    env_file:
      - .env
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

- [ ] **Step 3: Write `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#4C5F80"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle">S</text>
</svg>
```

- [ ] **Step 4: Write `README.md`**

```markdown
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
```

- [ ] **Step 5: Run the full verification suite locally**

Run: `npm run lint && npm run test && npm run build`
Expected: all three PASS.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml public/favicon.svg README.md
git commit -m "chore: Docker, docker-compose (Redis opcional), README, favicon"
```

- [ ] **Step 7: Wire both git remotes**

```bash
git remote add origin https://github.com/onunez2025/Exhibiciones.git
git remote add azure "https://<PAT>@dev.azure.com/soledevops/MTExhibiciones/_git/MTExhibiciones"
```

Replace `<PAT>` with the Azure DevOps personal access token. Do not commit this URL anywhere — it only needs to live in local git config (`.git/config`, never tracked).

- [ ] **Step 8: Push to both repos**

```bash
git push -u origin master
git push -u azure master
```
Expected: both succeed. If GitHub's pre-push security hook (`check-security.sh`, installed via `./install-hooks.sh` if reused from the previous attempt) is present, let it run to completion — it type-checks, builds, and runs `npm audit` before allowing the push.

- [ ] **Step 9: Deploy and verify against the real EasyPanel service**

1. In EasyPanel, set every environment variable from the README's table — all of them, before the first deploy, not discovered one at a time through failed deploys.
2. Confirm the Azure SQL firewall already allows the VPS's IP (`72.61.75.5`) — already configured from the previous attempt, no action needed unless the VPS changed.
3. Trigger the deploy webhook:
   ```bash
   curl -s "http://72.61.75.5:3000/api/deploy/<webhook-token>"
   ```
4. Watch the **runtime** log (not just the build log) for `[EXH] Server running on port ... (production)` with no `Cannot find module .../bcrypt_lib.node` and no `[Redis] Connection error` spam (at most one attempt per 15s window, thanks to the circuit breaker).
5. Hit `https://<your-easypanel-domain>/api/health` — expect `{"status":"ok","db":"soledb-puntoventa",...}` within a couple seconds.
6. Open the site in a real browser, confirm the login page renders (not blank), and complete a real login → dashboard → logout cycle end to end.

- [ ] **Step 10: Final commit marking Fundación complete**

```bash
git add -A
git commit -m "chore: Fundación completa — verificada en producción" --allow-empty
git push origin master
git push azure master
```

---

## Plan Self-Review Notes

- **Spec coverage:** every section of the spec (arquitectura, auth, RBAC, i18n, resiliencia de Redis, CORS, variables de entorno, verificación local) maps to at least one task above. AppSwitcher/Console/exceljs/multer/Docker-parity-testing are confirmed absent, matching "fuera de alcance."
- **Placeholder scan:** no task step describes behavior without showing the code; both `TODO` comments left in the code itself (`server/index.ts`, `src/App.tsx`, `src/components/layout/Sidebar.tsx`) are intentional extension points for future sub-projects, not unfinished work in this plan.
- **Type consistency:** `User` (Task 9) is used identically in `useAuth.tsx` (Task 11), `apiClient.test.ts` mocks (Task 9), `LoginPage.tsx`/`DashboardPage.tsx` (Task 13). `resolvePermission(roleName, permissions, required)` has the same signature in both the backend (Task 6) and frontend (Task 11) copies. `getDbConnection`/`buildConfig` (Task 5) are consumed with matching names in Tasks 6–7.

