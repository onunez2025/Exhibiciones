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
