// server/routes/exhibiciones.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDbConnection } from '../db.js';
import { safeError, cleanEnv } from '../lib/security.js';
import sql from 'mssql';
import { buildExhibicionesFilter } from '../lib/exhibicionesFilter.js';
import type { ExhibicionesQueryParams, QueryParam } from '../lib/exhibicionesFilter.js';
import { mapComponentesRows } from '../lib/exhibicionComponentes.js';
import { buildFotoUrl } from '../lib/exhibicionFotos.js';

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

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();

        // Sin filtro de estado acá a propósito — a diferencia de la lista
        // (que oculta estado 0/Anulado), el detalle es una vista de solo
        // lectura por id: no tiene sentido devolver 404 para un registro que
        // sí existe solo porque está anulado.
        const principalResult = await pool.request()
            .input('id', sql.BigInt, id)
            .query(`
                SELECT
                    E.IN_exhibicion_id as id,
                    E.VC_nro_exhibicion as nroExhibicion,
                    E.VC_nombre as nombre,
                    E.VC_cliente_nombre as clienteNombre,
                    E.VC_sucursal_nombre as sucursalNombre,
                    E.VC_piso as piso,
                    ET.VC_descripcion as tipoNombre,
                    EPD.VC_descripcion as pisoDetalleNombre,
                    E.IN_estado_id as estadoId,
                    E.DT_fecha_crea as fechaCrea
                FROM EXHIBICION.TB_EXHIBICION E
                LEFT JOIN dbo.PV_TABLA ET
                    ON ET.VC_tabla = 'EXHIBICION_TIPO' AND ET.CH_activo = '1' AND ET.IN_id = E.IN_exhibicion_tipo_id
                LEFT JOIN dbo.PV_TABLA EPD
                    ON EPD.VC_tabla = 'EXHIBICION_PISO_DETALLE' AND EPD.CH_activo = '1' AND EPD.IN_id = E.IN_piso_detalle_id
                WHERE E.IN_exhibicion_id = @id
            `);

        const principalRow = principalResult.recordset[0];
        if (!principalRow) {
            res.status(404).json({ error: 'Exhibición no encontrada.' });
            return;
        }

        const componentesResult = await pool.request()
            .input('id', sql.BigInt, id)
            .query(`
                SELECT
                    C.IN_exhibicion_componente_id as id,
                    C.IN_tipo as tipo,
                    P.VC_articulo_nombre2 as nombre,
                    C.IN_cantidad as cantidad
                FROM EXHIBICION.TB_EXHIBICION_COMPONENTE C
                LEFT JOIN EXHIBICION.WEB_MARKETING_PRODUCTOS P
                    ON P.VC_articulo_codigo = C.VC_codigo_producto
                    AND P.VC_tipo = CASE C.IN_tipo WHEN 1 THEN 'PRD' WHEN 2 THEN 'CAR' END
                WHERE C.IN_exhibicion_id = @id AND C.IN_estado = 1
                ORDER BY nombre
            `);

        const fotosResult = await pool.request()
            .input('id', sql.BigInt, id)
            .query(`
                SELECT
                    IN_exhibicion_foto_id as id,
                    VC_archivo_nombre as archivoNombre,
                    BI_es_foto_principal as esFotoPrincipal
                FROM EXHIBICION.TB_EXHIBICION_FOTO
                WHERE IN_exhibicion_id = @id AND IN_estado > 0
                ORDER BY BI_es_foto_principal DESC, IN_exhibicion_foto_id ASC
            `);

        const blobContainerUrl = cleanEnv('BLOB_CONTAINER_URL');
        const blobSasToken = cleanEnv('BLOB_SAS_TOKEN');

        res.json({
            id: principalRow.id,
            nroExhibicion: principalRow.nroExhibicion,
            nombre: principalRow.nombre,
            clienteNombre: principalRow.clienteNombre,
            sucursalNombre: principalRow.sucursalNombre,
            piso: principalRow.piso,
            tipoNombre: principalRow.tipoNombre,
            pisoDetalleNombre: principalRow.pisoDetalleNombre,
            estadoId: principalRow.estadoId,
            fechaCrea: principalRow.fechaCrea,
            canAprobar: principalRow.estadoId === 1,
            componentes: mapComponentesRows(componentesResult.recordset),
            fotos: fotosResult.recordset.map((f: { id: number; archivoNombre: string; esFotoPrincipal: boolean }) => ({
                id: f.id,
                url: buildFotoUrl(blobContainerUrl, blobSasToken, f.archivoNombre),
                esFotoPrincipal: f.esFotoPrincipal,
            })),
        });
    } catch (err: unknown) {
        console.error('[Exhibiciones] detalle error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.post('/:id/aprobar', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();

        // UPDATE con guardia de estado en el mismo WHERE (no lectura previa
        // + escritura separada) — así dos aprobaciones concurrentes nunca
        // pueden pisarse: solo una puede matchear IN_estado_id = 1.
        const updateResult = await pool.request()
            .input('id', sql.BigInt, id)
            .input('usuario', sql.NVarChar(50), req.user?.username ?? 'system')
            .query(`
                UPDATE EXHIBICION.TB_EXHIBICION
                SET IN_estado_id = 2, VC_usuario_modi = @usuario, DT_fecha_modi = GETDATE()
                WHERE IN_exhibicion_id = @id AND IN_estado_id = 1
            `);

        if (updateResult.rowsAffected[0] === 0) {
            const existsResult = await pool.request()
                .input('id', sql.BigInt, id)
                .query('SELECT 1 FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
            if (existsResult.recordset.length === 0) {
                res.status(404).json({ error: 'Exhibición no encontrada.' });
            } else {
                res.status(409).json({ error: 'La exhibición ya no está pendiente de revisión.' });
            }
            return;
        }

        res.json({ estadoId: 2 });
    } catch (err: unknown) {
        console.error('[Exhibiciones] aprobar error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
