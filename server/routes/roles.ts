import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { getDbConnection } from '../db.js';
import { checkPermission, logAudit } from '../middleware/auth.js';

const router = Router();

// Todas las rutas de roles requieren permiso de roles o Administrador
router.use(checkPermission('seguridad.roles - ver'));

// ─── GET /api/roles ───────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request().query(`
            SELECT
                r.IN_rol_id      as id,
                r.VC_nombre      as nombre,
                r.VC_descripcion as descripcion,
                CAST(r.BI_activo AS BIT) as activo,
                r.DT_fecha_crea  as fechaCrea,
                COUNT(u.IN_usuario_id) as totalUsuarios
            FROM EXHIBICION.TB_ROLES r
            LEFT JOIN EXHIBICION.TB_USUARIOS u ON r.IN_rol_id = u.IN_rol_id AND u.BI_activo = 1
            GROUP BY r.IN_rol_id, r.VC_nombre, r.VC_descripcion, r.BI_activo, r.DT_fecha_crea
            ORDER BY r.IN_rol_id ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('[Roles] Error al listar roles:', err);
        res.status(500).json({ error: 'Error al obtener la lista de roles.' });
    }
});

// ─── GET /api/roles/catalogo/permisos ─────────────────────────────────────────
router.get('/catalogo/permisos', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request().query(`
            SELECT
                IN_permiso_id  as id,
                VC_modulo      as modulo,
                VC_accion      as accion,
                VC_descripcion as descripcion
            FROM EXHIBICION.TB_PERMISOS
            ORDER BY VC_modulo ASC, IN_permiso_id ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('[Roles] Error al listar catálogo de permisos:', err);
        res.status(500).json({ error: 'Error al obtener el catálogo de permisos.' });
    }
});

// ─── GET /api/roles/:id/permisos ──────────────────────────────────────────────
router.get('/:id/permisos', async (req: Request, res: Response) => {
    try {
        const roleId = parseInt(String(req.params.id), 10);
        if (!Number.isInteger(roleId) || roleId <= 0) {
            res.status(400).json({ error: 'ID de rol inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const result = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`
                SELECT IN_permiso_id as permisoId
                FROM EXHIBICION.TB_ROL_PERMISOS
                WHERE IN_rol_id = @roleId
            `);

        const permisoIds = result.recordset.map((r: { permisoId: number }) => r.permisoId);
        res.json(permisoIds);
    } catch (err) {
        console.error('[Roles] Error al obtener permisos de rol:', err);
        res.status(500).json({ error: 'Error al obtener los permisos asignados.' });
    }
});

// ─── PUT /api/roles/:id/permisos ──────────────────────────────────────────────
const actualizarPermisosSchema = z.object({
    permisoIds: z.array(z.number().int().positive()),
});

router.put('/:id/permisos', checkPermission('seguridad.roles - gestionar'), async (req: Request, res: Response) => {
    try {
        const roleId = parseInt(String(req.params.id), 10);
        if (!Number.isInteger(roleId) || roleId <= 0) {
            res.status(400).json({ error: 'ID de rol inválido.' });
            return;
        }

        const parsed = actualizarPermisosSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Datos de permisos inválidos.' });
            return;
        }

        const { permisoIds } = parsed.data;
        const pool = await getDbConnection();
        const tx = pool.transaction();
        await tx.begin();

        try {
            // Eliminar asignaciones anteriores
            const delReq = tx.request();
            delReq.input('roleId', sql.Int, roleId);
            await delReq.query('DELETE FROM EXHIBICION.TB_ROL_PERMISOS WHERE IN_rol_id = @roleId');

            // Insertar nuevas asignaciones si las hay
            for (const pid of permisoIds) {
                const insReq = tx.request();
                insReq.input('roleId', sql.Int, roleId);
                insReq.input('permisoId', sql.Int, pid);
                await insReq.query(`
                    INSERT INTO EXHIBICION.TB_ROL_PERMISOS (IN_rol_id, IN_permiso_id)
                    VALUES (@roleId, @permisoId)
                `);
            }

            await tx.commit();
            await logAudit(req, 'ROL_PERMISOS_ACTUALIZADOS', 'TB_ROL_PERMISOS', String(roleId), `Permisos actualizados para rol ${roleId}: ${permisoIds.length} permisos`);
            res.json({ ok: true, message: 'Matriz de permisos guardada exitosamente.' });
        } catch (txErr) {
            await tx.rollback();
            throw txErr;
        }
    } catch (err) {
        console.error('[Roles] Error al guardar matriz de permisos:', err);
        res.status(500).json({ error: 'Error al actualizar la matriz de permisos.' });
    }
});

export default router;
