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
import { decodificarFotoBase64 } from '../lib/blobUpload.js';
import { agruparCatalogoChecklist } from '../lib/checklistCatalogo.js';
import { validarChecklistItems } from '../lib/checklistCrear.js';
import { validarTicketCrear } from '../lib/ticketCrear.js';
import { randomUUID } from 'crypto';
import { logAudit } from '../middleware/auth.js';

const router = Router();

const MAX_FOTO_BYTES = 8 * 1024 * 1024; // 8MB — ver decodificarFotoBase64

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
                SELECT
                    VC_cliente_codigo as clienteCodigo, MAX(VC_cliente_nombre) as clienteNombre,
                    VC_sucursal_codigo as sucursalCodigo, MAX(VC_sucursal_nombre) as sucursalNombre,
                    MAX(VC_direccion) as direccion
                FROM EXHIBICION.TB_EXHIBICION
                WHERE VC_cliente_codigo IS NOT NULL AND VC_sucursal_codigo IS NOT NULL
                GROUP BY VC_cliente_codigo, VC_sucursal_codigo
                ORDER BY MAX(VC_cliente_nombre), MAX(VC_sucursal_nombre)
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
            await transaction.rollback().catch(() => {});
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

// Los 12 ítems fijos del checklist viven en dbo.PV_TABLA
// (VC_tabla='EXHIBICION_VISUAL'), agrupados en 3 categorías vía
// dbo.PV_TABLA (VC_tabla='EXHIBICION_VISUAL_TIPO'), relacionadas por
// EXHIBICION_VISUAL.VC_filtro = EXHIBICION_VISUAL_TIPO.IN_id — VC_filtro
// se guarda como texto, de ahí el TRY_CONVERT(INT, ...) para que coincida
// con el tipo TypeScript `tipoId: number` (TRY_CONVERT en vez de CONVERT:
// una fila con VC_filtro no numérico se descarta silenciosamente en vez
// de tumbar el endpoint entero — igual que agruparCatalogoChecklist ya
// descarta cualquier tipoId que no matchea ningún tipo activo).
//
// Compartida por GET /catalogo-checklist y POST /:id/checklist: ambos
// deben ver EXACTAMENTE el mismo conjunto de ítems válidos. Antes, POST
// armaba codigosValidos con una query propia sin este filtro/agrupación
// — si algún día un ítem quedaba huérfano de categoría, el formulario
// (que sí lo filtra) se volvía imposible de guardar sin diagnóstico.
async function obtenerCategoriasChecklist(pool: sql.ConnectionPool) {
    const [itemsResult, tiposResult] = await Promise.all([
        pool.request().query(`
            SELECT IN_id as visualId, VC_descripcion as nombre, TRY_CONVERT(INT, VC_filtro) as tipoId
            FROM dbo.PV_TABLA WHERE VC_tabla = 'EXHIBICION_VISUAL' AND CH_activo = '1'
            ORDER BY VC_filtro, IN_id
        `),
        pool.request().query(`
            SELECT IN_id as tipoId, VC_descripcion as tipoNombre
            FROM dbo.PV_TABLA WHERE VC_tabla = 'EXHIBICION_VISUAL_TIPO' AND CH_activo = '1'
            ORDER BY IN_id
        `),
    ]);
    return agruparCatalogoChecklist(itemsResult.recordset, tiposResult.recordset);
}

router.get('/catalogo-checklist', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        res.json({ categorias: await obtenerCategoriasChecklist(pool) });
    } catch (err: unknown) {
        console.error('[Exhibiciones] catalogo-checklist error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

// EXHIBICION.TB_TIPOS_REQUERIMIENTO — catálogo de 9 tipos de ticket
// (Mantenimiento, Modificación, Muebles, Capacitación, POP, Recojo,
// Reposición, Folletería, Otros). Confirmado que hasta este plan ninguna
// columna ni procedimiento existente la usaba — ver spec.
router.get('/tipos-ticket', async (_req: Request, res: Response) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request().query(`
            SELECT IN_tipo_id as id, VC_codigo as codigo, VC_nombre as nombre
            FROM EXHIBICION.TB_TIPOS_REQUERIMIENTO
            WHERE BI_activo = 1
            ORDER BY IN_orden
        `);
        res.json({ tipos: result.recordset });
    } catch (err: unknown) {
        console.error('[Exhibiciones] tipos-ticket error:', err instanceof Error ? err.message : err);
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

router.post('/:id/fotos', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const exists = await pool.request().input('id', sql.BigInt, id)
            .query('SELECT 1 FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
        if (exists.recordset.length === 0) {
            res.status(404).json({ error: 'Exhibición no encontrada.' });
            return;
        }

        const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType : '';
        const archivoBase64 = typeof req.body?.archivoBase64 === 'string' ? req.body.archivoBase64 : '';
        const esFotoPrincipal = req.body?.esFotoPrincipal === true;

        const resultado = decodificarFotoBase64(archivoBase64, contentType, MAX_FOTO_BYTES);
        if (!resultado.ok) {
            res.status(400).json({ error: resultado.error });
            return;
        }

        const blobContainerUrl = cleanEnv('BLOB_CONTAINER_URL');
        const blobSasToken = cleanEnv('BLOB_SAS_TOKEN');
        const nombreArchivo = `${randomUUID()}${resultado.foto.extension}`;

        const uploadRes = await fetch(buildFotoUrl(blobContainerUrl, blobSasToken, nombreArchivo), {
            method: 'PUT',
            headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType },
            body: resultado.foto.buffer,
        });
        if (!uploadRes.ok) {
            const detalle = await uploadRes.text().catch(() => '');
            console.error('[Exhibiciones] subida a blob falló:', uploadRes.status, detalle);
            res.status(502).json({ error: 'No se pudo subir la foto. Intenta de nuevo.' });
            return;
        }

        // Nunca deja dos fotos marcadas como principal a la vez (a
        // diferencia de datos históricos donde sí puede pasar).
        if (esFotoPrincipal) {
            await pool.request().input('id', sql.BigInt, id)
                .query('UPDATE EXHIBICION.TB_EXHIBICION_FOTO SET BI_es_foto_principal = 0 WHERE IN_exhibicion_id = @id');
        }

        const insertResult = await pool.request()
            .input('exhibicionId', sql.BigInt, id)
            .input('nombre', sql.VarChar(200), nombreArchivo)
            .input('extension', sql.VarChar(10), resultado.foto.extension)
            .input('esFotoPrincipal', sql.Bit, esFotoPrincipal)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                INSERT INTO EXHIBICION.TB_EXHIBICION_FOTO
                    (IN_exhibicion_id, VC_directorio, VC_archivo_nombre, VC_extension, IN_estado, VC_usuario_crea, DT_fecha_crea, BI_es_foto_principal)
                OUTPUT INSERTED.IN_exhibicion_foto_id as id
                VALUES (@exhibicionId, '', @nombre, @extension, 1, @usuario, GETDATE(), @esFotoPrincipal)
            `);

        res.status(201).json({
            id: insertResult.recordset[0].id,
            url: buildFotoUrl(blobContainerUrl, blobSasToken, nombreArchivo),
            esFotoPrincipal,
        });
    } catch (err: unknown) {
        console.error('[Exhibiciones] agregar foto error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.post('/:id/checklist', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();

        const exists = await pool.request().input('id', sql.BigInt, id)
            .query('SELECT 1 FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id');
        if (exists.recordset.length === 0) {
            res.status(404).json({ error: 'Exhibición no encontrada.' });
            return;
        }

        const categorias = await obtenerCategoriasChecklist(pool);
        const codigosValidos: string[] = categorias.flatMap(cat => cat.items.map(item => item.visualCodigo));

        const validacion = validarChecklistItems(req.body, codigosValidos);
        if (!validacion.valido) {
            res.status(400).json({ error: validacion.error });
            return;
        }

        const usuario = req.user?.username ?? 'system';
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const cabeceraRequest = new sql.Request(transaction);
            cabeceraRequest.input('exhibicionId', sql.BigInt, id);
            cabeceraRequest.input('usuario', sql.VarChar(50), usuario);

            // WITH (UPDLOCK, HOLDLOCK) resguarda contra colisiones ENTRE
            // llamadas a este mismo endpoint — no contra la app móvil legacy
            // (EXHIBICION.PROC_GUARDAR_CHECKLIST), que sigue en producción y
            // lee el mismo MAX() sin ningún lock: un UPDLOCK es compatible
            // con locks compartidos (S), así que ambos pueden leer el mismo
            // MAX y generar el mismo N° si corren en la misma ventana.
            // Confirmado en vivo durante el desarrollo de este plan (ver
            // .superpowers/sdd/2026-08-27-checklist-crear/progress.md,
            // checklist id 192 / 202608002, creado por la app vieja).
            // Cerrar esto de forma definitiva requeriría una constraint
            // UNIQUE en TB_CHECKLIST.IN_checklist_number — cambio de esquema
            // en una tabla compartida en vivo con la app legacy, fuera de
            // alcance sin decisión explícita del dueño del producto.
            const cabeceraResult = await cabeceraRequest.query(`
                DECLARE @prefix INT = CONVERT(INT, CONCAT(YEAR(GETDATE()), RIGHT('00' + CONVERT(VARCHAR, MONTH(GETDATE())), 2), '000'))
                DECLARE @sgte INT
                SELECT @sgte = ISNULL(MAX(IN_checklist_number), @prefix) + 1
                FROM EXHIBICION.TB_CHECKLIST WITH (UPDLOCK, HOLDLOCK)
                WHERE CONCAT(YEAR(DT_fecha_crea), RIGHT('00' + CONVERT(VARCHAR, MONTH(DT_fecha_crea)), 2))
                    = CONCAT(YEAR(GETDATE()), RIGHT('00' + CONVERT(VARCHAR, MONTH(GETDATE())), 2))

                INSERT INTO EXHIBICION.TB_CHECKLIST
                    (IN_checklist_number, IN_exhibicion_id, IN_estado_id, VC_usuario_crea, DT_fecha_crea)
                OUTPUT INSERTED.IN_checklist_id as id, INSERTED.IN_checklist_number as checklistNumber
                VALUES (@sgte, @exhibicionId, 1, @usuario, GETDATE())
            `);

            const checklistId = cabeceraResult.recordset[0].id;
            const checklistNumber = cabeceraResult.recordset[0].checklistNumber;

            // Un solo INSERT multi-fila en vez de 12 round-trips secuenciales
            // — el rango UPDLOCK/HOLDLOCK de arriba sigue vivo hasta el
            // commit, y cada round-trip extra es tiempo de bloqueo extra
            // sobre una tabla que la app legacy también escribe.
            const detalleRequest = new sql.Request(transaction);
            detalleRequest.input('checklistId', sql.BigInt, checklistId);
            const filas = validacion.items.map((item, i) => {
                detalleRequest.input(`visualCodigo${i}`, sql.VarChar(20), item.visualCodigo);
                detalleRequest.input(`desconforme${i}`, sql.Bit, item.desconforme);
                detalleRequest.input(`motivo${i}`, sql.VarChar(150), item.motivo);
                return `(@checklistId, @visualCodigo${i}, @desconforme${i}, @motivo${i}, 1)`;
            });
            // filas.length === 0 solo puede pasar si el catálogo activo
            // está vacío (codigosValidos.length === 0) — un `VALUES` sin
            // filas es un error de sintaxis SQL. El frontend ya bloquea
            // guardar en ese caso, pero un llamado directo a la API no
            // pasa por esa guarda: se preserva el comportamiento previo
            // (checklist con cabecera pero sin líneas) en vez de que el
            // endpoint truene con un 500.
            if (filas.length > 0) {
                await detalleRequest.query(`
                    INSERT INTO EXHIBICION.TB_CHECKLIST_DETALLE
                        (IN_checklist_id, VC_visual_codigo, BI_desconforme, VC_desconforme_motivo, IN_estado)
                    VALUES ${filas.join(', ')}
                `);
            }

            await transaction.commit();
            // id llega como string del driver mssql (BIGINT OUTPUT) — mismo
            // patrón ya conocido en el resto del código; se normaliza a
            // number aquí para que coincida con CrearChecklistResponse.
            res.status(201).json({ id: Number(checklistId), checklistNumber });
        } catch (txErr) {
            await transaction.rollback().catch(() => {});
            throw txErr;
        }
    } catch (err: unknown) {
        console.error('[Exhibiciones] crear checklist error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.post('/:id/tickets', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();

        const exhibicionResult = await pool.request().input('id', sql.BigInt, id).query(`
            SELECT VC_cliente_codigo as clienteCodigo, VC_sucursal_codigo as sucursalCodigo, VC_cliente_nombre as clienteNombre
            FROM EXHIBICION.TB_EXHIBICION WHERE IN_exhibicion_id = @id
        `);
        const exhibicion = exhibicionResult.recordset[0];
        if (!exhibicion) {
            res.status(404).json({ error: 'Exhibición no encontrada.' });
            return;
        }

        const tiposResult = await pool.request().query(`
            SELECT IN_tipo_id as id FROM EXHIBICION.TB_TIPOS_REQUERIMIENTO WHERE BI_activo = 1
        `);
        const tiposValidos: number[] = tiposResult.recordset.map((r: { id: number }) => r.id);

        const componentesResult = await pool.request().input('id', sql.BigInt, id).query(`
            SELECT IN_exhibicion_componente_id as id
            FROM EXHIBICION.TB_EXHIBICION_COMPONENTE WHERE IN_exhibicion_id = @id AND IN_estado = 1
        `);
        // Number(...) explícito: IN_exhibicion_componente_id es BIGINT — el
        // driver mssql lo devuelve como string aunque el tipo TS diga
        // number. Sin esto, validarTicketCrear compararía un number (del
        // body ya parseado) contra strings y rechazaría TODO componente
        // válido (mismo patrón de bug ya conocido, ver progress.md de
        // checklist-crear).
        const componentesValidos: number[] = componentesResult.recordset.map((r: { id: number }) => Number(r.id));

        const validacion = validarTicketCrear(req.body, tiposValidos, componentesValidos);
        if (!validacion.valido) {
            res.status(400).json({ error: validacion.error });
            return;
        }
        const { tipoId, motivo, componentes } = validacion.datos;

        const usuario = req.user?.username ?? 'system';
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const cabeceraRequest = new sql.Request(transaction);
            cabeceraRequest.input('exhibicionId', sql.BigInt, id);
            cabeceraRequest.input('tipoId', sql.Int, tipoId);
            cabeceraRequest.input('motivo', sql.VarChar(200), motivo);
            cabeceraRequest.input('clienteCodigo', sql.VarChar(10), exhibicion.clienteCodigo);
            cabeceraRequest.input('sucursalCodigo', sql.VarChar(10), exhibicion.sucursalCodigo);
            cabeceraRequest.input('clienteNombre', sql.VarChar(120), exhibicion.clienteNombre);
            cabeceraRequest.input('usuario', sql.VarChar(20), usuario);

            // WITH (UPDLOCK, HOLDLOCK): resguarda contra colisiones ENTRE
            // llamadas a este mismo endpoint. A diferencia del N° de
            // checklist, este es un contador GLOBAL (nunca se reinicia por
            // mes) — mismo esquema que ya usaba el proc legacy
            // PROC_GUARDAR_WEB_MARKETING_REQUERIMIENTO. Esa tabla lleva sin
            // actividad desde 2023-12-01 (confirmado en la spec): hoy no hay
            // ningún escritor legacy vivo compitiendo por este número, a
            // diferencia del caso de checklist.
            const cabeceraResult = await cabeceraRequest.query(`
                DECLARE @sgte INT
                SELECT @sgte = ISNULL(MAX(CONVERT(INT, SUBSTRING(VC_requerimiento, 4, 99))), 0) + 1
                FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO WITH (UPDLOCK, HOLDLOCK)
                WHERE SUBSTRING(VC_requerimiento, 1, 3) = 'RSM'

                DECLARE @numero VARCHAR(10) = 'RSM' + RIGHT('0000000' + CONVERT(VARCHAR, @sgte), 7)

                INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO
                    (VC_organizacion, VC_sociedad, VC_requerimiento, IN_exhibicion_id, IN_tipo_rq_id,
                     VC_observacion, VC_estado, CH_anulado, CH_ticket,
                     VC_cliente_codigo, VC_cliente_sucursal, VC_cliente_nombre,
                     IN_capacparticipantes, VC_usuario_crea, DT_fecha_crea)
                OUTPUT INSERTED.VC_requerimiento as numero
                VALUES
                    ('1301', '1300', @numero, @exhibicionId, @tipoId,
                     @motivo, '01', 'N', 'W',
                     @clienteCodigo, @sucursalCodigo, @clienteNombre,
                     0, @usuario, GETDATE())
            `);

            const numero: string = cabeceraResult.recordset[0].numero;

            const histRequest = new sql.Request(transaction);
            histRequest.input('numero', sql.VarChar(10), numero);
            histRequest.input('usuario', sql.VarChar(50), usuario);
            histRequest.input('nombre', sql.VarChar(150), usuario);
            await histRequest.query(`
                INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO_HIST (VC_requerimiento, VC_usuario, VC_nombre, VC_estado, VC_observacion)
                VALUES (@numero, @usuario, @nombre, '01', NULL)
            `);

            if (componentes.length > 0) {
                // Busca código/nombre/tipo real por componenteId — nunca se
                // confía en lo que mande el cliente (Global Constraint).
                const lookupRequest = new sql.Request(transaction);
                const placeholders = componentes.map((c, i) => {
                    lookupRequest.input(`compId${i}`, sql.BigInt, c.componenteId);
                    return `@compId${i}`;
                });
                const lookupResult = await lookupRequest.query(`
                    SELECT
                        C.IN_exhibicion_componente_id as componenteId,
                        C.IN_tipo as tipo,
                        C.VC_codigo_producto as codigo,
                        P.VC_articulo_nombre2 as nombre
                    FROM EXHIBICION.TB_EXHIBICION_COMPONENTE C
                    LEFT JOIN EXHIBICION.WEB_MARKETING_PRODUCTOS P
                        ON P.VC_articulo_codigo = C.VC_codigo_producto
                        AND P.VC_tipo = CASE C.IN_tipo WHEN 1 THEN 'PRD' WHEN 2 THEN 'CAR' END
                    WHERE C.IN_exhibicion_componente_id IN (${placeholders.join(', ')})
                `);
                // Number(...) explícito por el mismo motivo que arriba —
                // IN_exhibicion_componente_id vuelve a llegar como BIGINT.
                const porId = new Map(lookupResult.recordset.map((r: { componenteId: number; tipo: number; codigo: string; nombre: string | null }) => [Number(r.componenteId), r]));

                const detalleRequest = new sql.Request(transaction);
                detalleRequest.input('numero', sql.VarChar(10), numero);
                detalleRequest.input('usuario', sql.VarChar(20), usuario);
                const filas = componentes.map((c, i) => {
                    const info = porId.get(c.componenteId);
                    const articuloTipo = info?.tipo === 1 ? 'PRD' : 'CAR';
                    detalleRequest.input(`articuloTipo${i}`, sql.VarChar(3), articuloTipo);
                    detalleRequest.input(`articuloCodigo${i}`, sql.VarChar(20), info?.codigo ?? '');
                    detalleRequest.input(`articuloNombre${i}`, sql.VarChar(120), info?.nombre ?? '');
                    detalleRequest.input(`cantidad${i}`, sql.Int, c.cantidad);
                    return `('1301', @numero, 'E', '', '1301', '', @articuloTipo${i}, @articuloCodigo${i}, @articuloNombre${i}, 'UNI', @cantidad${i}, 'A', @usuario, GETDATE())`;
                });
                // VC_organizacion es NOT NULL sin default en esta tabla (a
                // diferencia de las demás columnas NOT NULL, que sí lo
                // tienen) — confirmado contra INFORMATION_SCHEMA.COLUMNS
                // durante la verificación manual de esta tarea; el primer
                // intento sin esta columna falló con "Cannot insert the
                // value NULL into column 'VC_organizacion'". Mismo
                // constante fija '1301' que en la cabecera.
                await detalleRequest.query(`
                    INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO_DETALLE
                        (VC_organizacion, VC_requerimiento, VC_tipo, VC_posicion, VC_centro, VC_almacen,
                         VC_articulo_tipo, VC_articulo_codigo, VC_articulo_nombre, VC_articulo_um,
                         IN_articulo_cantidad, CH_estado, VC_usuario_crea, DT_fecha_crea)
                    VALUES ${filas.join(', ')}
                `);
            }

            await transaction.commit();
            res.status(201).json({ numero });
        } catch (txErr) {
            await transaction.rollback().catch(() => {});
            throw txErr;
        }
    } catch (err: unknown) {
        console.error('[Exhibiciones] crear ticket error:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.post('/:id/tickets/:numero/fotos', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const numero = req.params.numero;
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Id de exhibición inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const exists = await pool.request().input('id', sql.BigInt, id).input('numero', sql.VarChar(10), numero).query(`
            SELECT 1 FROM EXHIBICION.WEB_MARKETING_REQUERIMIENTO WHERE VC_requerimiento = @numero AND IN_exhibicion_id = @id
        `);
        if (exists.recordset.length === 0) {
            res.status(404).json({ error: 'Ticket no encontrado.' });
            return;
        }

        const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType : '';
        const archivoBase64 = typeof req.body?.archivoBase64 === 'string' ? req.body.archivoBase64 : '';

        const resultado = decodificarFotoBase64(archivoBase64, contentType, MAX_FOTO_BYTES);
        if (!resultado.ok) {
            res.status(400).json({ error: resultado.error });
            return;
        }

        const blobContainerUrl = cleanEnv('BLOB_CONTAINER_URL');
        const blobSasToken = cleanEnv('BLOB_SAS_TOKEN');
        const nombreArchivo = `${randomUUID()}${resultado.foto.extension}`;

        const uploadRes = await fetch(buildFotoUrl(blobContainerUrl, blobSasToken, nombreArchivo), {
            method: 'PUT',
            headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType },
            body: resultado.foto.buffer,
        });
        if (!uploadRes.ok) {
            const detalle = await uploadRes.text().catch(() => '');
            console.error('[Exhibiciones] subida a blob (ticket) falló:', uploadRes.status, detalle);
            res.status(502).json({ error: 'No se pudo subir la foto. Intenta de nuevo.' });
            return;
        }

        const insertResult = await pool.request()
            .input('numero', sql.VarChar(10), numero)
            .input('nombre', sql.VarChar(200), nombreArchivo)
            .input('usuario', sql.VarChar(50), req.user?.username ?? 'system')
            .query(`
                INSERT INTO EXHIBICION.WEB_MARKETING_REQUERIMIENTO_FOTO
                    (VC_requerimiento, VC_directorio, VC_archivo_nombre, IN_estado, VC_usuario_crea, DT_fecha_crea)
                OUTPUT INSERTED.IN_requerimiento_foto_id as id
                VALUES (@numero, '', @nombre, 1, @usuario, GETDATE())
            `);

        // Number(...): IN_requerimiento_foto_id es BIGINT — mismo patrón
        // ya conocido en el resto del código, se normaliza a number acá
        // para que coincida con el tipo TicketFoto.id.
        res.status(201).json({ id: Number(insertResult.recordset[0].id), url: buildFotoUrl(blobContainerUrl, blobSasToken, nombreArchivo) });
    } catch (err: unknown) {
        console.error('[Exhibiciones] agregar foto de ticket error:', err instanceof Error ? err.message : err);
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
