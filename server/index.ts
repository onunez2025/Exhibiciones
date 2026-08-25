// server/index.ts
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
const redisStore = (prefix: string) => new RedisStore({
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
    prefix,
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, store: redisStore('rl:exh:global:'), message: { error: 'Too many requests.' } });
const authLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 50, store: redisStore('rl:exh:login:'), message: { error: 'Too many login attempts.' } });

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
