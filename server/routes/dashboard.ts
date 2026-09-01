import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDbConnection } from '../db.js';
import { safeError } from '../lib/security.js';
import { calcularPorcentajeConformidad } from '../lib/dashboardMetrics.js';

const router = Router();

// GET /api/dashboard/resumen
router.get('/resumen', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();

        const [kpisResult, checklistsResult, ticketsResult] = await Promise.all([
            pool.request().query(`
                SELECT
                    -- Exhibiciones
                    (SELECT COUNT(*) FROM EXHIBICION.TB_EXHIBICION WHERE IN_estado_id = 2) as exhibicionesActivas,
                    (SELECT COUNT(*) FROM EXHIBICION.TB_EXHIBICION WHERE IN_estado_id = 1) as exhibicionesPendientes,

                    -- Checklists
                    (SELECT COUNT(*) FROM EXHIBICION.TB_CHECKLIST WHERE IN_estado_id > 0) as checklistsTotal,
                    (SELECT COUNT(*) FROM EXHIBICION.TB_CHECKLIST WHERE IN_estado_id = 1) as checklistsPendientes,
                    (SELECT ISNULL(SUM(conforme), 0) FROM (
                        SELECT CASE WHEN EXISTS (
                            SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE D
                            WHERE D.IN_checklist_id = C.IN_checklist_id AND D.IN_estado = 1 AND D.BI_desconforme = 1
                        ) THEN 0 ELSE 1 END as conforme
                        FROM EXHIBICION.TB_CHECKLIST C
                        WHERE C.IN_estado_id > 0
                    ) X) as checklistsConformesTotal,

                    -- Tickets
                    (SELECT COUNT(*) FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO WHERE CH_anulado = 'N' AND VC_estado IN ('01', '02', '03', '04')) as ticketsPendientes,
                    (SELECT COUNT(*) FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO WHERE CH_anulado = 'N' AND VC_estado IN ('05', '06')) as ticketsAtendidos
            `),

            pool.request().query(`
                SELECT TOP 5
                    C.IN_checklist_id as id,
                    C.IN_checklist_number as checklistNumber,
                    ISNULL(E.VC_nro_exhibicion, '') as exhibicionNroExhibicion,
                    ISNULL(E.VC_nombre, '') as exhibicionNombre,
                    ISNULL(E.VC_cliente_nombre, '') as clienteNombre,
                    C.IN_estado_id as estadoId,
                    C.DT_fecha_crea as fechaCrea,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE D
                        WHERE D.IN_checklist_id = C.IN_checklist_id AND D.IN_estado = 1 AND D.BI_desconforme = 1
                    ) THEN 0 ELSE 1 END as conforme
                FROM EXHIBICION.TB_CHECKLIST C
                LEFT JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = C.IN_exhibicion_id
                WHERE C.IN_estado_id > 0
                ORDER BY C.DT_fecha_crea DESC, C.IN_checklist_id DESC
            `),

            pool.request().query(`
                SELECT TOP 5
                    R.VC_requerimiento as numero,
                    ISNULL(E.VC_nombre, '') as exhibicionNombre,
                    ISNULL(R.VC_cliente_nombre, ISNULL(E.VC_cliente_nombre, '')) as clienteNombre,
                    ISNULL(T.VC_nombre, 'Otros') as tipoNombre,
                    R.VC_estado as estadoCodigo,
                    ISNULL(PE.VC_descripcion, R.VC_estado) as estadoNombre,
                    R.DT_fecha_crea as fechaCrea
                FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO R
                LEFT JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = R.IN_exhibicion_id
                LEFT JOIN EXHIBICION.TB_TIPOS_REQUERIMIENTO T ON T.IN_tipo_id = R.IN_tipo_rq_id
                LEFT JOIN dbo.PV_TABLA PE ON PE.VC_tabla = 'REQUERIMIENTO_ESTADO' AND PE.VC_codigo = R.VC_estado AND PE.CH_activo = '1'
                WHERE R.CH_anulado = 'N' AND R.VC_estado != '00'
                ORDER BY R.DT_fecha_crea DESC, R.VC_requerimiento DESC
            `),
        ]);

        const rawKpis = kpisResult.recordset[0] ?? {};
        const checklistsTotal = Number(rawKpis.checklistsTotal ?? 0);
        const checklistsConformesTotal = Number(rawKpis.checklistsConformesTotal ?? 0);
        const porcentajeConformidad = calcularPorcentajeConformidad(checklistsTotal, checklistsConformesTotal);

        const kpis = {
            exhibicionesActivas: Number(rawKpis.exhibicionesActivas ?? 0),
            exhibicionesPendientes: Number(rawKpis.exhibicionesPendientes ?? 0),
            checklistsTotal,
            checklistsPendientes: Number(rawKpis.checklistsPendientes ?? 0),
            checklistsConformesTotal,
            porcentajeConformidad,
            ticketsPendientes: Number(rawKpis.ticketsPendientes ?? 0),
            ticketsAtendidos: Number(rawKpis.ticketsAtendidos ?? 0),
        };

        const ultimosChecklists = checklistsResult.recordset.map((r: {
            id: unknown;
            checklistNumber: number;
            exhibicionNroExhibicion: string;
            exhibicionNombre: string;
            clienteNombre: string;
            estadoId: number;
            conforme: number;
            fechaCrea: string | Date;
        }) => ({
            id: Number(r.id),
            checklistNumber: r.checklistNumber,
            exhibicionNroExhibicion: r.exhibicionNroExhibicion,
            exhibicionNombre: r.exhibicionNombre,
            clienteNombre: r.clienteNombre,
            estadoId: r.estadoId,
            conforme: Boolean(r.conforme),
            fechaCrea: r.fechaCrea,
        }));

        const ultimosTickets = ticketsResult.recordset.map((r: {
            numero: string;
            exhibicionNombre: string;
            clienteNombre: string;
            tipoNombre: string;
            estadoCodigo: string;
            estadoNombre: string;
            fechaCrea: string | Date;
        }) => ({
            numero: r.numero,
            exhibicionNombre: r.exhibicionNombre,
            clienteNombre: r.clienteNombre,
            tipoNombre: r.tipoNombre,
            estadoCodigo: r.estadoCodigo,
            estadoNombre: r.estadoNombre,
            fechaCrea: r.fechaCrea,
        }));

        res.json({ kpis, ultimosChecklists, ultimosTickets });
    } catch (err: unknown) {
        console.error('[Dashboard] resumen error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
