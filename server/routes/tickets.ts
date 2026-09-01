import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { getDbConnection } from '../db.js';
import { safeError, cleanEnv } from '../lib/security.js';
import { buildFotoUrl } from '../lib/exhibicionFotos.js';
import { buildTicketsFilter } from '../lib/ticketsFilter.js';

const router = Router();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function bindParams(req: sql.Request, params: { name: string; type: string; length?: number; value: unknown }[]) {
    for (const p of params) {
        if (p.type === 'NVarChar') {
            req.input(p.name, sql.NVarChar(p.length ?? 200), p.value);
        } else if (p.type === 'VarChar') {
            req.input(p.name, sql.VarChar(p.length ?? 50), p.value);
        } else if (p.type === 'Int') {
            req.input(p.name, sql.Int, p.value);
        } else if (p.type === 'DateTime') {
            req.input(p.name, sql.DateTime, p.value);
        }
    }
}

// ─── GET /api/tickets — listado con filtros y paginación ────────────────────
router.get('/', async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const rawPageSize = parseInt(String(req.query.pageSize || String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE;
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));
        const offset = (page - 1) * pageSize;

        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const estado = typeof req.query.estado === 'string' ? req.query.estado : undefined;
        const tipoId = req.query.tipoId ? parseInt(String(req.query.tipoId), 10) : undefined;
        const tienda = typeof req.query.tienda === 'string' ? req.query.tienda : undefined;
        const fechaDesde = typeof req.query.fechaDesde === 'string' ? req.query.fechaDesde : undefined;
        const fechaHasta = typeof req.query.fechaHasta === 'string' ? req.query.fechaHasta : undefined;

        const { whereClauses, params } = buildTicketsFilter({
            search,
            estado,
            tipoId: Number.isInteger(tipoId) ? tipoId : undefined,
            tienda,
            fechaDesde,
            fechaHasta,
        });

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const pool = await getDbConnection();

        // 1. Total count
        const countReq = pool.request();
        bindParams(countReq, params);
        const countResult = await countReq.query(`
            SELECT COUNT(*) as total
            FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO R
            LEFT JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = R.IN_exhibicion_id
            ${whereSql}
        `);
        const total = countResult.recordset[0]?.total ?? 0;

        // 2. Data page
        const dataReq = pool.request();
        bindParams(dataReq, params);
        dataReq.input('offset', sql.Int, offset);
        dataReq.input('pageSize', sql.Int, pageSize);

        const dataResult = await dataReq.query(`
            SELECT
                R.VC_requerimiento as numero,
                R.IN_exhibicion_id as exhibicionId,
                ISNULL(E.VC_nro_exhibicion, '') as exhibicionNroExhibicion,
                ISNULL(E.VC_nombre, '') as exhibicionNombre,
                ISNULL(R.VC_cliente_nombre, ISNULL(E.VC_cliente_nombre, '')) as clienteNombre,
                ISNULL(E.VC_sucursal_nombre, '') as sucursalNombre,
                ISNULL(R.IN_tipo_rq_id, 0) as tipoId,
                ISNULL(T.VC_nombre, 'Otros') as tipoNombre,
                ISNULL(R.VC_observacion, '') as motivo,
                R.VC_estado as estadoCodigo,
                ISNULL(PE.VC_descripcion, R.VC_estado) as estadoNombre,
                ISNULL(R.VC_usuario_crea, '') as usuarioCrea,
                R.DT_fecha_crea as fechaCrea
            FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO R
            LEFT JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = R.IN_exhibicion_id
            LEFT JOIN EXHIBICION.TB_TIPOS_REQUERIMIENTO T ON T.IN_tipo_id = R.IN_tipo_rq_id
            LEFT JOIN dbo.PV_TABLA PE ON PE.VC_tabla = 'REQUERIMIENTO_ESTADO' AND PE.VC_codigo = R.VC_estado AND PE.CH_activo = '1'
            ${whereSql}
            ORDER BY R.DT_fecha_crea DESC, R.VC_requerimiento DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        const items = dataResult.recordset.map((r: {
            numero: string;
            exhibicionId: unknown;
            exhibicionNroExhibicion: string;
            exhibicionNombre: string;
            clienteNombre: string;
            sucursalNombre: string;
            tipoId: unknown;
            tipoNombre: string;
            motivo: string;
            estadoCodigo: string;
            estadoNombre: string;
            usuarioCrea: string;
            fechaCrea: string | Date;
        }) => ({
            numero: r.numero,
            exhibicionId: Number(r.exhibicionId),
            exhibicionNroExhibicion: r.exhibicionNroExhibicion,
            exhibicionNombre: r.exhibicionNombre,
            clienteNombre: r.clienteNombre,
            sucursalNombre: r.sucursalNombre,
            tipoId: Number(r.tipoId),
            tipoNombre: r.tipoNombre,
            motivo: r.motivo,
            estadoCodigo: r.estadoCodigo,
            estadoNombre: r.estadoNombre,
            usuarioCrea: r.usuarioCrea,
            fechaCrea: r.fechaCrea,
        }));

        res.json({ items, total, page, pageSize });
    } catch (err: unknown) {
        console.error('[Tickets] list error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

// ─── GET /api/tickets/:numero — detalle de ticket con fotos y componentes ───
router.get('/:numero', async (req: Request, res: Response) => {
    try {
        const numero = String(req.params.numero || '').trim();
        if (!numero || numero.length > 10) {
            res.status(400).json({ error: 'Número de ticket inválido.' });
            return;
        }

        const pool = await getDbConnection();

        const cabeceraResult = await pool.request().input('numero', sql.VarChar(10), numero).query(`
            SELECT
                R.VC_requerimiento as numero,
                R.IN_exhibicion_id as exhibicionId,
                ISNULL(E.VC_nro_exhibicion, '') as exhibicionNroExhibicion,
                ISNULL(E.VC_nombre, '') as exhibicionNombre,
                ISNULL(R.VC_cliente_nombre, ISNULL(E.VC_cliente_nombre, '')) as clienteNombre,
                ISNULL(E.VC_sucursal_nombre, '') as sucursalNombre,
                ISNULL(R.IN_tipo_rq_id, 0) as tipoId,
                ISNULL(T.VC_nombre, 'Otros') as tipoNombre,
                ISNULL(R.VC_observacion, '') as motivo,
                R.VC_estado as estadoCodigo,
                ISNULL(PE.VC_descripcion, R.VC_estado) as estadoNombre,
                ISNULL(R.VC_usuario_crea, '') as usuarioCrea,
                R.DT_fecha_crea as fechaCrea
            FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO R
            LEFT JOIN EXHIBICION.TB_EXHIBICION E ON E.IN_exhibicion_id = R.IN_exhibicion_id
            LEFT JOIN EXHIBICION.TB_TIPOS_REQUERIMIENTO T ON T.IN_tipo_id = R.IN_tipo_rq_id
            LEFT JOIN dbo.PV_TABLA PE ON PE.VC_tabla = 'REQUERIMIENTO_ESTADO' AND PE.VC_codigo = R.VC_estado AND PE.CH_activo = '1'
            WHERE R.VC_requerimiento = @numero AND R.CH_anulado = 'N' AND R.VC_estado != '00'
        `);

        const cabecera = cabeceraResult.recordset[0];
        if (!cabecera) {
            res.status(404).json({ error: 'Ticket no encontrado.' });
            return;
        }

        const [componentesResult, fotosResult] = await Promise.all([
            pool.request().input('numero', sql.VarChar(10), numero).query(`
                SELECT
                    IN_requerimiento_detalle_id as id,
                    ISNULL(VC_articulo_codigo, '') as codigo,
                    ISNULL(VC_articulo_nombre, '') as nombre,
                    ISNULL(IN_articulo_cantidad, 1) as cantidad
                FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO_DETALLE
                WHERE VC_requerimiento = @numero
                ORDER BY IN_requerimiento_detalle_id
            `),
            pool.request().input('numero', sql.VarChar(10), numero).query(`
                SELECT
                    IN_requerimiento_foto_id as id,
                    VC_archivo_nombre as nombreArchivo,
                    DT_fecha_crea as fechaCrea
                FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO_FOTO
                WHERE VC_requerimiento = @numero AND IN_estado = 1
                ORDER BY IN_requerimiento_foto_id
            `),
        ]);

        const blobContainerUrl = cleanEnv('BLOB_CONTAINER_URL');
        const blobSasToken = cleanEnv('BLOB_SAS_TOKEN');

        const componentes = componentesResult.recordset.map((c: { id: unknown; codigo: string; nombre: string; cantidad: number }) => ({
            id: Number(c.id),
            codigo: c.codigo,
            nombre: c.nombre,
            cantidad: Number(c.cantidad),
        }));

        const fotos = fotosResult.recordset.map((f: { id: unknown; nombreArchivo: string; fechaCrea: string | Date }) => ({
            id: Number(f.id),
            url: buildFotoUrl(blobContainerUrl, blobSasToken, f.nombreArchivo),
            fechaCrea: f.fechaCrea,
        }));

        res.json({
            numero: cabecera.numero,
            exhibicionId: Number(cabecera.exhibicionId),
            exhibicionNroExhibicion: cabecera.exhibicionNroExhibicion,
            exhibicionNombre: cabecera.exhibicionNombre,
            clienteNombre: cabecera.clienteNombre,
            sucursalNombre: cabecera.sucursalNombre,
            tipoId: Number(cabecera.tipoId),
            tipoNombre: cabecera.tipoNombre,
            motivo: cabecera.motivo,
            estadoCodigo: cabecera.estadoCodigo,
            estadoNombre: cabecera.estadoNombre,
            usuarioCrea: cabecera.usuarioCrea,
            fechaCrea: cabecera.fechaCrea,
            componentes,
            fotos,
        });
    } catch (err: unknown) {
        console.error('[Tickets] detalle error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

// ─── POST /api/tickets/:numero/atender — marcar como atendido / cerrado ──────
router.post('/:numero/atender', async (req: Request, res: Response) => {
    try {
        const numero = String(req.params.numero || '').trim();
        if (!numero || numero.length > 10) {
            res.status(400).json({ error: 'Número de ticket inválido.' });
            return;
        }

        const usuario = req.user?.username ?? 'system';
        const pool = await getDbConnection();

        const updateResult = await pool.request()
            .input('numero', sql.VarChar(10), numero)
            .input('usuario', sql.VarChar(50), usuario)
            .query(`
                UPDATE EXHIBICION.WEB_MARKETING_REQUERIMIENTO
                SET VC_estado = '05',
                    VC_usuario_modifica = @usuario,
                    DT_fecha_modifica = GETDATE()
                WHERE VC_requerimiento = @numero AND CH_anulado = 'N' AND VC_estado IN ('01', '02', '03', '04')
            `);

        if (updateResult.rowsAffected[0] === 0) {
            const checkResult = await pool.request()
                .input('numero', sql.VarChar(10), numero)
                .query(`
                    SELECT VC_estado, CH_anulado FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO WHERE VC_requerimiento = @numero
                `);
            if (checkResult.recordset.length === 0 || checkResult.recordset[0].CH_anulado === 'S') {
                res.status(404).json({ error: 'Ticket no encontrado o anulado.' });
            } else {
                res.status(409).json({ error: 'El ticket ya ha sido atendido o cerrado.' });
            }
            return;
        }

        // Historial
        await pool.request()
            .input('numero', sql.VarChar(10), numero)
            .input('usuario', sql.VarChar(50), usuario)
            .input('nombre', sql.VarChar(150), req.user?.full_name ?? usuario)
            .query(`
                INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO_HIST
                    (VC_requerimiento, VC_usuario, VC_nombre, VC_estado, VC_observacion)
                VALUES (@numero, @usuario, @nombre, '05', 'Atendido desde plataforma web')
            `);

        res.json({ estadoCodigo: '05', estadoNombre: 'Atendido por Trade' });
    } catch (err: unknown) {
        console.error('[Tickets] atender error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

// ─── POST /api/tickets/:numero/anular — anular ticket ─────────────────────────
router.post('/:numero/anular', async (req: Request, res: Response) => {
    try {
        const numero = String(req.params.numero || '').trim();
        if (!numero || numero.length > 10) {
            res.status(400).json({ error: 'Número de ticket inválido.' });
            return;
        }

        const usuario = req.user?.username ?? 'system';
        const pool = await getDbConnection();

        const updateResult = await pool.request()
            .input('numero', sql.VarChar(10), numero)
            .input('usuario', sql.VarChar(50), usuario)
            .query(`
                UPDATE EXHIBICION.WEB_MARKETING_REQUERIMIENTO
                SET VC_estado = '00',
                    CH_anulado = 'S',
                    VC_usuario_modifica = @usuario,
                    DT_fecha_modifica = GETDATE()
                WHERE VC_requerimiento = @numero AND CH_anulado = 'N' AND VC_estado != '00'
            `);

        if (updateResult.rowsAffected[0] === 0) {
            res.status(404).json({ error: 'Ticket no encontrado o ya anulado.' });
            return;
        }

        // Historial
        await pool.request()
            .input('numero', sql.VarChar(10), numero)
            .input('usuario', sql.VarChar(50), usuario)
            .input('nombre', sql.VarChar(150), req.user?.full_name ?? usuario)
            .query(`
                INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO_HIST
                    (VC_requerimiento, VC_usuario, VC_nombre, VC_estado, VC_observacion)
                VALUES (@numero, @usuario, @nombre, '00', 'Anulado desde plataforma web')
            `);

        res.json({ estadoCodigo: '00' });
    } catch (err: unknown) {
        console.error('[Tickets] anular error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
