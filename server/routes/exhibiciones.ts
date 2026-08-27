// server/routes/exhibiciones.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDbConnection } from '../db.js';
import { safeError, cleanEnv } from '../lib/security.js';
import sql from 'mssql';
import { buildExhibicionesFilter } from '../lib/exhibicionesFilter.js';
import type { ExhibicionesQueryParams, QueryParam } from '../lib/exhibicionesFilter.js';
import { mapComponentesRows } from '../lib/exhibicionComponentes.js';
import { validarExhibicionCrear } from '../lib/exhibicionCrear.js';
import { buildFotoUrl } from '../lib/exhibicionFotos.js';
import { logAudit } from '../middleware/auth.js';

const router = Router();

// Catálogo real vive en dbo.PV_TABLA (tabla genérica de parámetros
// compartida por todo el ERP) — no en el esquema EXHIBICION. Confirmado
// leyendo EXHIBICION.PROC_BANDEJA_EXHIBICION, el stored procedure que
// alimentaba esta misma pantalla en la app anterior. Compartido entre
// /opciones-filtro y /opciones-crear — mismas dos consultas, dos
// consumidores distintos.
async function obtenerCatalogosPvTabla(pool: sql.ConnectionPool) {
    const [tipos, pisoDetalles] = await Promise.all([
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
    return { tipos: tipos.recordset, pisoDetalles: pisoDetalles.recordset };
}

router.get('/opciones-filtro', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const { tipos, pisoDetalles } = await obtenerCatalogosPvTabla(pool);
        res.json({ tipos, ubicaciones: pisoDetalles });
    } catch (err: unknown) {
        console.error('[Exhibiciones] opciones-filtro error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

// Tienda/Sucursal para el formulario de creación: las combinaciones que YA
// existen en TB_EXHIBICION (34 clientes / 77 sucursales), no el maestro SAP
// completo (SAP.TB_KNA1, 15,743 clientes de toda la empresa) ni las tablas
// de asignación por usuario de la app vieja (TB_PROMOTOR_CLIENTE, etc. —
// verificado que ningún usuario de esta app existe en SEGURIDAD.TB_USUARIO,
// esa lógica de scoping no es reusable).
router.get('/opciones-crear', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const [{ tipos, pisoDetalles }, tiendasResult] = await Promise.all([
            obtenerCatalogosPvTabla(pool),
            pool.request().query(`
                SELECT DISTINCT
                    VC_cliente_codigo as clienteCodigo, VC_cliente_nombre as clienteNombre,
                    VC_sucursal_codigo as sucursalCodigo, VC_sucursal_nombre as sucursalNombre,
                    VC_direccion as direccion
                FROM EXHIBICION.TB_EXHIBICION
                WHERE VC_cliente_codigo IS NOT NULL AND VC_sucursal_codigo IS NOT NULL
                ORDER BY VC_cliente_nombre, VC_sucursal_nombre
            `),
        ]);
        res.json({ tiendas: tiendasResult.recordset, tipos, pisoDetalles });
    } catch (err: unknown) {
        console.error('[Exhibiciones] opciones-crear error:', err instanceof Error ? err.message : err);
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

router.post('/', async (req: Request, res: Response) => {
    try {
        const validacion = validarExhibicionCrear(req.body);
        if (!validacion.valido) {
            res.status(400).json({ error: validacion.error });
            return;
        }
        const { clienteCodigo, clienteNombre, sucursalCodigo, sucursalNombre, direccion, nombre, tipoId, piso, pisoDetalleId } = validacion.datos;

        const pool = await getDbConnection();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);
            request.input('nombre', sql.VarChar(150), nombre);
            request.input('clienteCodigo', sql.VarChar(10), clienteCodigo);
            request.input('clienteNombre', sql.VarChar(250), clienteNombre);
            request.input('sucursalCodigo', sql.VarChar(10), sucursalCodigo);
            request.input('sucursalNombre', sql.VarChar(250), sucursalNombre);
            request.input('direccion', sql.VarChar(250), direccion);
            request.input('tipoId', sql.Int, tipoId);
            request.input('piso', sql.VarChar(100), piso);
            request.input('pisoDetalleId', sql.Int, pisoDetalleId);
            request.input('usuario', sql.VarChar(50), req.user?.username ?? 'system');

            // WITH (UPDLOCK, HOLDLOCK) — a diferencia del proc viejo
            // (PROC_GUARDAR_EXHIBICION), esto sí evita que dos creaciones
            // simultáneas lean el mismo MAX y generen el mismo N°.
            const result = await request.query(`
                DECLARE @sgte INT
                SELECT @sgte = ISNULL(MAX(CONVERT(INT, SUBSTRING(VC_nro_exhibicion, 4, 99))), 0) + 1
                FROM EXHIBICION.TB_EXHIBICION WITH (UPDLOCK, HOLDLOCK)
                WHERE SUBSTRING(VC_nro_exhibicion, 1, 3) = 'EXB'

                DECLARE @nro VARCHAR(10) = 'EXB' + RIGHT('0000000' + CONVERT(VARCHAR, @sgte), 7)

                INSERT INTO EXHIBICION.TB_EXHIBICION
                    (VC_nombre, VC_cliente_codigo, VC_cliente_nombre, VC_sucursal_codigo, VC_sucursal_nombre,
                     VC_direccion, IN_exhibicion_tipo_id, VC_piso, IN_piso_detalle_id, IN_estado_id,
                     VC_usuario_crea, DT_fecha_crea, VC_nro_exhibicion)
                OUTPUT INSERTED.IN_exhibicion_id as id, INSERTED.VC_nro_exhibicion as nroExhibicion
                VALUES (@nombre, @clienteCodigo, @clienteNombre, @sucursalCodigo, @sucursalNombre,
                        @direccion, @tipoId, @piso, @pisoDetalleId, 1,
                        @usuario, GETDATE(), @nro)
            `);

            await transaction.commit();
            const row = result.recordset[0];
            res.status(201).json({ id: row.id, nroExhibicion: row.nroExhibicion });
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }
    } catch (err: unknown) {
        console.error('[Exhibiciones] crear error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

// Catálogo completo para el selector "Agregar Carcasa"/"Agregar Producto"
// — solo PRD y CAR (no 'MUE', ver spec). WEB_MARKETING_PRODUCTOS tiene 216
// PRD y 44 CAR — chico, se carga una vez y se filtra en el navegador.
router.get('/catalogo-componentes', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const [productos, carcasas] = await Promise.all([
            pool.request().query(`
                SELECT VC_articulo_codigo as codigo, VC_articulo_nombre2 as nombre
                FROM EXHIBICION.WEB_MARKETING_PRODUCTOS WHERE VC_tipo = 'PRD' ORDER BY nombre
            `),
            pool.request().query(`
                SELECT VC_articulo_codigo as codigo, VC_articulo_nombre2 as nombre
                FROM EXHIBICION.WEB_MARKETING_PRODUCTOS WHERE VC_tipo = 'CAR' ORDER BY nombre
            `),
        ]);
        res.json({ productos: productos.recordset, carcasas: carcasas.recordset });
    } catch (err: unknown) {
        console.error('[Exhibiciones] catalogo-componentes error:', err instanceof Error ? err.message : err);
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

router.post('/:id/componentes', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const tipo = Number(req.body?.tipo);
        const codigoProducto = typeof req.body?.codigoProducto === 'string' ? req.body.codigoProducto.trim() : '';
        const cantidad = Number(req.body?.cantidad);

        if (tipo !== 1 && tipo !== 2) {
            res.status(400).json({ error: 'Tipo de componente inválido.' });
            return;
        }
        if (!codigoProducto) {
            res.status(400).json({ error: 'Selecciona un producto o carcasa.' });
            return;
        }
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            res.status(400).json({ error: 'La cantidad debe ser un número entero mayor a 0.' });
            return;
        }

        const pool = await getDbConnection();

        const exists = await pool.request().input('id', sql.BigInt, id)
            .query('SELECT 1 FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
        if (exists.recordset.length === 0) {
            res.status(404).json({ error: 'Exhibición no encontrada.' });
            return;
        }

        // Verifica que el código exista en el catálogo con el tipo correcto
        // — evita insertar un código inventado si alguien arma la request a
        // mano en vez de usar el selector.
        const catalogoTipo = tipo === 1 ? 'PRD' : 'CAR';
        const productoResult = await pool.request()
            .input('codigo', sql.VarChar(20), codigoProducto)
            .input('tipo', sql.VarChar(3), catalogoTipo)
            .query(`
                SELECT VC_articulo_nombre2 as nombre
                FROM EXHIBICION.WEB_MARKETING_PRODUCTOS
                WHERE VC_articulo_codigo = @codigo AND VC_tipo = @tipo
            `);
        const producto = productoResult.recordset[0];
        if (!producto) {
            res.status(400).json({ error: 'Producto no encontrado en el catálogo.' });
            return;
        }

        const insertResult = await pool.request()
            .input('exhibicionId', sql.BigInt, id)
            .input('codigo', sql.VarChar(20), codigoProducto)
            .input('cantidad', sql.Int, cantidad)
            .input('tipo', sql.Int, tipo)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                INSERT INTO EXHIBICION.TB_EXHIBICION_COMPONENTE
                    (IN_exhibicion_id, VC_codigo_producto, IN_cantidad, IN_tipo, IN_estado, VC_usuario_crea, DT_fecha_crea)
                OUTPUT INSERTED.IN_exhibicion_componente_id as id
                VALUES (@exhibicionId, @codigo, @cantidad, @tipo, 1, @usuario, GETDATE())
            `);

        res.status(201).json({ id: insertResult.recordset[0].id, nombre: producto.nombre, cantidad });
    } catch (err: unknown) {
        console.error('[Exhibiciones] agregar componente error:', err instanceof Error ? err.message : err);
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

        await logAudit(req, 'APROBAR', 'EXHIBICION', String(id));

        res.json({ estadoId: 2 });
    } catch (err: unknown) {
        console.error('[Exhibiciones] aprobar error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
