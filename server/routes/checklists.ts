import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { getDbConnection } from '../db.js';
import { safeError } from '../lib/security.js';
import { buildChecklistsFilter } from '../lib/checklistsFilter.js';
import type { ChecklistsQueryParams, QueryParam } from '../lib/checklistsFilter.js';
import { agruparChecklistDetalle } from '../lib/checklistDetalle.js';
import type { VisualItemRow, VisualTipoRow } from '../lib/checklistCatalogo.js';

const router = Router();

function bindParams(request: sql.Request, params: QueryParam[]): void {
    for (const p of params) {
        request.input(p.name, p.type as sql.ISqlType, p.value);
    }
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function parseChecklistsQuery(query: Request['query']): ChecklistsQueryParams {
    const estadoIdNum = query.estadoId ? parseInt(String(query.estadoId), 10) : undefined;
    return {
        search: asString(query.search),
        conforme: asString(query.conforme),
        estadoId: Number.isInteger(estadoIdNum) ? estadoIdNum : undefined,
        tienda: asString(query.tienda),
        fechaDesde: asString(query.fechaDesde),
        fechaHasta: asString(query.fechaHasta),
    };
}

router.get('/', async (req: Request, res: Response) => {
    try {
        const filter = buildChecklistsFilter(parseChecklistsQuery(req.query));
        const page = Math.max(1, Math.trunc(Number(req.query.page)) || 1);
        const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(req.query.pageSize)) || 20));
        const offset = (page - 1) * pageSize;

        const pool = await getDbConnection();

        const dataRequest = pool.request();
        bindParams(dataRequest, filter.params);
        dataRequest.input('offset', sql.Int, offset);
        dataRequest.input('pageSize', sql.Int, pageSize);

        const dataResult = await dataRequest.query(`
            SELECT
                C.IN_checklist_id as id,
                C.IN_checklist_number as checklistNumber,
                C.IN_exhibicion_id as exhibicionId,
                E.VC_nro_exhibicion as exhibicionNroExhibicion,
                E.VC_nombre as exhibicionNombre,
                E.VC_cliente_nombre as clienteNombre,
                E.VC_sucursal_nombre as sucursalNombre,
                C.IN_estado_id as estadoId,
                CASE WHEN EXISTS (
                    SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD
                    WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1
                ) THEN 0 ELSE 1 END as conforme,
                C.DT_fecha_crea as fechaCrea
            FROM EXHIBICION.TB_CHECKLIST C
            INNER JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = C.IN_exhibicion_id
            WHERE ${filter.whereSql}
            ORDER BY C.IN_checklist_number DESC, C.IN_checklist_id DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        const countRequest = pool.request();
        bindParams(countRequest, filter.params);
        const countResult = await countRequest.query(`
            SELECT COUNT(*) as total
            FROM EXHIBICION.TB_CHECKLIST C
            INNER JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = C.IN_exhibicion_id
            WHERE ${filter.whereSql}
        `);

        const items = dataResult.recordset.map((r: {
            id: number;
            checklistNumber: number;
            exhibicionId: number;
            exhibicionNroExhibicion: string;
            exhibicionNombre: string;
            clienteNombre: string;
            sucursalNombre: string;
            estadoId: number;
            conforme: number;
            fechaCrea: string;
        }) => ({
            id: Number(r.id),
            checklistNumber: Number(r.checklistNumber),
            exhibicionId: Number(r.exhibicionId),
            exhibicionNroExhibicion: r.exhibicionNroExhibicion,
            exhibicionNombre: r.exhibicionNombre,
            clienteNombre: r.clienteNombre,
            sucursalNombre: r.sucursalNombre,
            estadoId: Number(r.estadoId),
            conforme: r.conforme === 1,
            fechaCrea: r.fechaCrea,
        }));

        res.json({
            items,
            total: countResult.recordset[0].total,
            page,
            pageSize,
        });
    } catch (err: unknown) {
        console.error('[Checklists] list error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de checklist inválido.' });
            return;
        }

        const pool = await getDbConnection();

        const cabeceraResult = await pool.request().input('id', sql.BigInt, id).query(`
            SELECT
                C.IN_checklist_id as id,
                C.IN_checklist_number as checklistNumber,
                C.IN_exhibicion_id as exhibicionId,
                E.VC_nro_exhibicion as exhibicionNroExhibicion,
                E.VC_nombre as exhibicionNombre,
                E.VC_cliente_nombre as clienteNombre,
                E.VC_sucursal_nombre as sucursalNombre,
                C.IN_estado_id as estadoId,
                C.DT_fecha_crea as fechaCrea
            FROM EXHIBICION.TB_CHECKLIST C
            INNER JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = C.IN_exhibicion_id
            WHERE C.IN_checklist_id = @id AND C.IN_estado_id > 0
        `);

        const cabecera = cabeceraResult.recordset[0];
        if (!cabecera) {
            res.status(404).json({ error: 'Checklist no encontrado.' });
            return;
        }

        const [itemsResult, tiposResult, detalleResult] = await Promise.all([
            pool.request().query(`
                SELECT IN_id as visualId, VC_descripcion as nombre, TRY_CONVERT(INT, VC_filtro) as tipoId
                FROM dbo.PV_TABLA
                WHERE VC_tabla = 'EXHIBICION_VISUAL' AND CH_activo = '1'
                ORDER BY VC_filtro, IN_id
            `),
            pool.request().query(`
                SELECT IN_id as tipoId, VC_descripcion as tipoNombre
                FROM dbo.PV_TABLA
                WHERE VC_tabla = 'EXHIBICION_VISUAL_TIPO' AND CH_activo = '1'
                ORDER BY IN_id
            `),
            pool.request().input('id', sql.BigInt, id).query(`
                SELECT
                    VC_visual_codigo as visualCodigo,
                    BI_desconforme as desconforme,
                    VC_desconforme_motivo as motivo
                FROM EXHIBICION.TB_CHECKLIST_DETALLE
                WHERE IN_checklist_id = @id AND IN_estado = 1
            `),
        ]);

        const categorias = agruparChecklistDetalle(
            itemsResult.recordset as VisualItemRow[],
            tiposResult.recordset as VisualTipoRow[],
            detalleResult.recordset.map((d: { visualCodigo: string; desconforme: boolean | number; motivo: string | null }) => ({
                visualCodigo: d.visualCodigo,
                desconforme: Boolean(d.desconforme),
                motivo: d.motivo,
            }))
        );

        const conforme = categorias.every(cat => cat.items.every(item => !item.desconforme));

        res.json({
            id: Number(cabecera.id),
            checklistNumber: Number(cabecera.checklistNumber),
            exhibicionId: Number(cabecera.exhibicionId),
            exhibicionNroExhibicion: cabecera.exhibicionNroExhibicion,
            exhibicionNombre: cabecera.exhibicionNombre,
            clienteNombre: cabecera.clienteNombre,
            sucursalNombre: cabecera.sucursalNombre,
            estadoId: Number(cabecera.estadoId),
            conforme,
            fechaCrea: cabecera.fechaCrea,
            categorias,
        });
    } catch (err: unknown) {
        console.error('[Checklists] detalle error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.post('/:id/atender', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de checklist inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const updateResult = await pool.request()
            .input('id', sql.BigInt, id)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                UPDATE EXHIBICION.TB_CHECKLIST
                SET IN_estado_id = 2,
                    VC_usuario_atendido = @usuario,
                    VC_fecha_atendido = GETDATE()
                WHERE IN_checklist_id = @id AND IN_estado_id = 1
            `);

        if (updateResult.rowsAffected[0] === 0) {
            const existsResult = await pool.request()
                .input('id', sql.BigInt, id)
                .query('SELECT IN_estado_id as estadoId FROM EXHIBICION.TB_CHECKLIST WHERE IN_checklist_id = @id');
            if (existsResult.recordset.length === 0 || existsResult.recordset[0].estadoId === 0) {
                res.status(404).json({ error: 'Checklist no encontrado.' });
            } else {
                res.status(409).json({ error: 'El checklist ya no se encuentra pendiente de atención.' });
            }
            return;
        }

        res.json({ estadoId: 2 });
    } catch (err: unknown) {
        console.error('[Checklists] atender error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.post('/:id/anular', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de checklist inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const updateResult = await pool.request()
            .input('id', sql.BigInt, id)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                UPDATE EXHIBICION.TB_CHECKLIST
                SET IN_estado_id = 0,
                    VC_usuario_modi = @usuario,
                    DT_fecha_modi = GETDATE()
                WHERE IN_checklist_id = @id AND IN_estado_id > 0
            `);

        if (updateResult.rowsAffected[0] === 0) {
            res.status(404).json({ error: 'Checklist no encontrado o ya anulado.' });
            return;
        }

        res.json({ estadoId: 0 });
    } catch (err: unknown) {
        console.error('[Checklists] anular error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
