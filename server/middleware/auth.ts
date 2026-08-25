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
