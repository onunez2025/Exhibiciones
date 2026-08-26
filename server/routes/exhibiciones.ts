// server/routes/exhibiciones.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDbConnection } from '../db.js';
import { safeError } from '../lib/security.js';
import sql from 'mssql';
import { buildExhibicionesFilter } from '../lib/exhibicionesFilter.js';
import type { ExhibicionesQueryParams, QueryParam } from '../lib/exhibicionesFilter.js';

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

function bindParams(request: sql.Request, params: QueryParam[]): void {
    for (const p of params) {
        request.input(p.name, p.type as sql.ISqlType, p.value);
    }
}

// req.query usa el parser "extendido" de Express — `?tipo=1&tipo=2` llega
// como array, `?tienda[x]=1` como objeto anidado. buildExhibicionesFilter
// espera strings; un `as ExhibicionesQueryParams` sin normalizar antes
// dejaba pasar esos casos hasta un `.trim()` sobre un array/objeto, que
// revienta con un 500 en vez de simplemente ignorar el param raro.
function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function parseExhibicionesQuery(query: Request['query']): ExhibicionesQueryParams {
    return {
        search: asString(query.search),
        tipo: asString(query.tipo),
        estado: asString(query.estado),
        tienda: asString(query.tienda),
        fechaDesde: asString(query.fechaDesde),
        fechaHasta: asString(query.fechaHasta),
    };
}

router.get('/', async (req: Request, res: Response) => {
    try {
        const filter = buildExhibicionesFilter(parseExhibicionesQuery(req.query));
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
                E.IN_exhibicion_id as id,
                E.VC_nro_exhibicion as nroExhibicion,
                E.VC_nombre as nombre,
                E.VC_cliente_nombre as clienteNombre,
                E.VC_sucursal_nombre as sucursalNombre,
                ET.VC_descripcion as tipoNombre,
                EPD.VC_descripcion as ubicacionNombre,
                E.IN_estado_id as estadoId,
                E.DT_fecha_crea as fechaCrea
            FROM EXHIBICION.TB_EXHIBICION E
            LEFT JOIN dbo.PV_TABLA ET
                ON ET.VC_tabla = 'EXHIBICION_TIPO' AND ET.CH_activo = '1' AND ET.IN_id = E.IN_exhibicion_tipo_id
            LEFT JOIN dbo.PV_TABLA EPD
                ON EPD.VC_tabla = 'EXHIBICION_PISO_DETALLE' AND EPD.CH_activo = '1' AND EPD.IN_id = E.IN_piso_detalle_id
            WHERE ${filter.whereSql}
            ORDER BY E.VC_nro_exhibicion DESC, E.IN_exhibicion_id DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        const countRequest = pool.request();
        bindParams(countRequest, filter.params);
        const countResult = await countRequest.query(`
            SELECT COUNT(*) as total
            FROM EXHIBICION.TB_EXHIBICION E
            WHERE ${filter.whereSql}
        `);

        res.json({
            items: dataResult.recordset,
            total: countResult.recordset[0].total,
            page,
            pageSize,
        });
    } catch (err: unknown) {
        console.error('[Exhibiciones] list error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
