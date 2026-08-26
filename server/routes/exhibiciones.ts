// server/routes/exhibiciones.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDbConnection } from '../db.js';
import { safeError } from '../lib/security.js';

const router = Router();

// Catálogo real vive en dbo.PV_TABLA (tabla genérica de parámetros
// compartida por todo el ERP) — no en el esquema EXHIBICION. Confirmado
// leyendo EXHIBICION.PROC_BANDEJA_EXHIBICION, el stored procedure que
// alimentaba esta misma pantalla en la app anterior.
router.get('/opciones-filtro', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const [tipos, ubicaciones] = await Promise.all([
            pool.request().query(`
                SELECT IN_id as id, VC_descripcion as nombre
                FROM dbo.PV_TABLA
                WHERE VC_tabla = 'EXHIBICION_TIPO' AND CH_activo = '1'
                ORDER BY VC_descripcion
            `),
            pool.request().query(`
                SELECT IN_id as id, VC_descripcion as nombre
                FROM dbo.PV_TABLA
                WHERE VC_tabla = 'EXHIBICION_PISO_DETALLE' AND CH_activo = '1'
                ORDER BY VC_descripcion
            `),
        ]);
        res.json({ tipos: tipos.recordset, ubicaciones: ubicaciones.recordset });
    } catch (err: unknown) {
        console.error('[Exhibiciones] opciones-filtro error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
