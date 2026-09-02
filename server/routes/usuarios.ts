import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import sql from 'mssql';
import { z } from 'zod';
import { getDbConnection } from '../db.js';
import { buildUsuariosFilter, type QueryParam } from '../lib/usuariosFilter.js';
import { checkPermission, logAudit } from '../middleware/auth.js';

const router = Router();

// Middleware: todas las rutas de este router requieren permiso de usuarios o Administrador
router.use(checkPermission('seguridad.usuarios - gestionar'));

function bindParams(request: sql.Request, params: QueryParam[]): void {
    for (const p of params) {
        request.input(p.name, p.type as sql.ISqlType, p.value);
    }
}

// ─── GET /api/usuarios ────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const rolId = req.query.rolId ? parseInt(String(req.query.rolId), 10) : undefined;
        let activo: boolean | undefined = undefined;
        if (req.query.activo === 'true' || req.query.activo === '1') activo = true;
        else if (req.query.activo === 'false' || req.query.activo === '0') activo = false;

        const page = Math.max(1, Math.trunc(Number(req.query.page)) || 1);
        const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(req.query.pageSize)) || 20));
        const offset = (page - 1) * pageSize;

        const filter = buildUsuariosFilter({
            search,
            rolId: Number.isInteger(rolId) ? rolId : undefined,
            activo,
        });

        const pool = await getDbConnection();

        // 1. Conteo total
        const countRequest = pool.request();
        bindParams(countRequest, filter.params);
        const countResult = await countRequest.query(`
            SELECT COUNT(*) AS total
            FROM EXHIBICION.TB_USUARIOS u
            WHERE ${filter.whereSql}
        `);
        const total = (countResult.recordset[0]?.total as number) ?? 0;

        // 2. Registros paginados
        const dataRequest = pool.request();
        bindParams(dataRequest, filter.params);
        dataRequest.input('offset', sql.Int, offset);
        dataRequest.input('pageSize', sql.Int, pageSize);

        const dataResult = await dataRequest.query(`
            SELECT
                u.IN_usuario_id       as id,
                u.VC_usuario          as username,
                u.VC_nombre_completo  as fullName,
                u.VC_email            as email,
                u.VC_celular          as celular,
                u.VC_zona             as zona,
                u.IN_rol_id           as rolId,
                r.VC_nombre           as rolNombre,
                CAST(u.BI_activo AS BIT) as activo,
                u.DT_ultimo_login     as ultimoLogin,
                u.DT_fecha_crea       as fechaCrea
            FROM EXHIBICION.TB_USUARIOS u
            LEFT JOIN EXHIBICION.TB_ROLES r ON u.IN_rol_id = r.IN_rol_id
            WHERE ${filter.whereSql}
            ORDER BY u.DT_fecha_crea DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

        res.json({
            items: dataResult.recordset,
            total,
            page,
            pageSize,
        });
    } catch (err) {
        console.error('[Usuarios] Error al listar usuarios:', err);
        res.status(500).json({ error: 'Error al obtener la lista de usuarios.' });
    }
});

// ─── POST /api/usuarios ───────────────────────────────────────────────────────
const usuarioCrearSchema = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Usuario solo permite letras, números, puntos y guiones'),
    password: z.string().min(6).max(100),
    fullName: z.string().min(2).max(150),
    email: z.string().email().max(120).optional().nullable().or(z.literal('')),
    celular: z.string().max(20).optional().nullable().or(z.literal('')),
    rolId: z.number().int().positive(),
    zona: z.string().max(50).optional().nullable().or(z.literal('')),
});

router.post('/', async (req: Request, res: Response) => {
    try {
        const parsed = usuarioCrearSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.format() });
            return;
        }
        const { username, password, fullName, email, celular, rolId, zona } = parsed.data;

        const pool = await getDbConnection();

        // Verificar unicidad de username
        const exists = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .query('SELECT TOP 1 IN_usuario_id FROM EXHIBICION.TB_USUARIOS WHERE VC_usuario = @username');

        if (exists.recordset.length > 0) {
            res.status(400).json({ error: 'El nombre de usuario ya se encuentra registrado.' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const insertResult = await pool.request()
            .input('username', sql.VarChar(50), username)
            .input('passwordHash', sql.VarChar(256), passwordHash)
            .input('fullName', sql.VarChar(150), fullName)
            .input('email', sql.VarChar(120), email || null)
            .input('celular', sql.VarChar(20), celular || null)
            .input('rolId', sql.Int, rolId)
            .input('zona', sql.VarChar(50), zona || null)
            .query(`
                INSERT INTO EXHIBICION.TB_USUARIOS
                    (VC_usuario, VC_password_hash, VC_nombre_completo, VC_email, VC_celular, IN_rol_id, VC_zona, BI_activo, DT_fecha_crea)
                OUTPUT
                    INSERTED.IN_usuario_id as id,
                    INSERTED.VC_usuario as username,
                    INSERTED.VC_nombre_completo as fullName,
                    INSERTED.VC_email as email,
                    INSERTED.VC_celular as celular,
                    INSERTED.IN_rol_id as rolId,
                    INSERTED.VC_zona as zona,
                    INSERTED.BI_activo as activo,
                    INSERTED.DT_fecha_crea as fechaCrea
                VALUES
                    (@username, @passwordHash, @fullName, @email, @celular, @rolId, @zona, 1, GETDATE())
            `);

        const createdUser = insertResult.recordset[0];
        await logAudit(req, 'USUARIO_CREADO', 'TB_USUARIOS', String(createdUser.id), `Usuario creado: ${username}`);

        res.status(201).json(createdUser);
    } catch (err) {
        console.error('[Usuarios] Error al crear usuario:', err);
        res.status(500).json({ error: 'Error interno al registrar el usuario.' });
    }
});

// ─── PUT /api/usuarios/:id ────────────────────────────────────────────────────
const usuarioEditarSchema = z.object({
    fullName: z.string().min(2).max(150),
    email: z.string().email().max(120).optional().nullable().or(z.literal('')),
    celular: z.string().max(20).optional().nullable().or(z.literal('')),
    rolId: z.number().int().positive(),
    zona: z.string().max(50).optional().nullable().or(z.literal('')),
    activo: z.boolean(),
});

router.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'ID de usuario inválido.' });
            return;
        }

        const parsed = usuarioEditarSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.format() });
            return;
        }
        const { fullName, email, celular, rolId, zona, activo } = parsed.data;

        const pool = await getDbConnection();

        await pool.request()
            .input('id', sql.BigInt, id)
            .input('fullName', sql.VarChar(150), fullName)
            .input('email', sql.VarChar(120), email || null)
            .input('celular', sql.VarChar(20), celular || null)
            .input('rolId', sql.Int, rolId)
            .input('zona', sql.VarChar(50), zona || null)
            .input('activo', sql.Bit, activo ? 1 : 0)
            .query(`
                UPDATE EXHIBICION.TB_USUARIOS
                SET
                    VC_nombre_completo = @fullName,
                    VC_email = @email,
                    VC_celular = @celular,
                    IN_rol_id = @rolId,
                    VC_zona = @zona,
                    BI_activo = @activo
                WHERE IN_usuario_id = @id
            `);

        await logAudit(req, 'USUARIO_ACTUALIZADO', 'TB_USUARIOS', String(id), `Usuario ID ${id} actualizado`);
        res.json({ ok: true, message: 'Usuario actualizado correctamente.' });
    } catch (err) {
        console.error('[Usuarios] Error al actualizar usuario:', err);
        res.status(500).json({ error: 'Error al actualizar el usuario.' });
    }
});

// ─── PUT /api/usuarios/:id/password ───────────────────────────────────────────
const passwordResetSchema = z.object({
    newPassword: z.string().min(6).max(100),
});

router.put('/:id/password', async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'ID de usuario inválido.' });
            return;
        }

        const parsed = passwordResetSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Contraseña inválida. Mínimo 6 caracteres.' });
            return;
        }

        const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

        const pool = await getDbConnection();
        await pool.request()
            .input('id', sql.BigInt, id)
            .input('passwordHash', sql.VarChar(256), passwordHash)
            .query(`
                UPDATE EXHIBICION.TB_USUARIOS
                SET VC_password_hash = @passwordHash
                WHERE IN_usuario_id = @id
            `);

        await logAudit(req, 'PASSWORD_RESET_ADMIN', 'TB_USUARIOS', String(id), `Contraseña reseteada por admin para usuario ${id}`);
        res.json({ ok: true, message: 'Contraseña actualizada exitosamente.' });
    } catch (err) {
        console.error('[Usuarios] Error al resetear contraseña:', err);
        res.status(500).json({ error: 'Error al cambiar la contraseña.' });
    }
});

// ─── PATCH /api/usuarios/:id/toggle-activo ────────────────────────────────────
router.patch('/:id/toggle-activo', async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'ID de usuario inválido.' });
            return;
        }

        const pool = await getDbConnection();
        const result = await pool.request()
            .input('id', sql.BigInt, id)
            .query(`
                UPDATE EXHIBICION.TB_USUARIOS
                SET BI_activo = CASE WHEN BI_activo = 1 THEN 0 ELSE 1 END
                OUTPUT INSERTED.BI_activo as activo
                WHERE IN_usuario_id = @id
            `);

        if (result.recordset.length === 0) {
            res.status(404).json({ error: 'Usuario no encontrado.' });
            return;
        }

        const nuevoEstado = result.recordset[0].activo;
        await logAudit(req, 'USUARIO_TOGGLE_ACTIVO', 'TB_USUARIOS', String(id), `Estado cambiado a ${nuevoEstado ? 'Activo' : 'Inactivo'}`);
        res.json({ ok: true, activo: nuevoEstado });
    } catch (err) {
        console.error('[Usuarios] Error al cambiar estado:', err);
        res.status(500).json({ error: 'Error al cambiar el estado del usuario.' });
    }
});

export default router;
