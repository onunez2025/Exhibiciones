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
