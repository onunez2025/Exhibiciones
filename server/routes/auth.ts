// server/routes/auth.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDbConnection } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { getJwtSecret } from '../lib/security.js';
import { blacklistToken } from '../lib/redis.js';

const router = Router();

const loginSchema = z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(255),
});

// Tablas propias de Exhibiciones bajo el esquema EXHIBICION — no se
// comparte el esquema EBM del resto del ecosistema SIATC aquí.
const USER_SELECT = `
    SELECT
        u.IN_usuario_id      as id,
        u.VC_usuario         as username,
        u.VC_password_hash   as password_hash,
        u.VC_nombre_completo as full_name,
        u.VC_email           as email,
        u.VC_celular         as celular,
        u.VC_zona            as zona,
        u.IN_rol_id          as role_id,
        r.VC_nombre          as role_name,
        CAST(u.BI_activo AS BIT) as is_active,
        u.VC_avatar_url      as avatar_url
    FROM EXHIBICION.TB_USUARIOS u
    LEFT JOIN EXHIBICION.TB_ROLES r ON u.IN_rol_id = r.IN_rol_id
`;

async function loadPermissions(pool: sql.ConnectionPool, roleId: number | null): Promise<string[]> {
    if (!roleId) return [];
    const result = await pool.request()
        .input('roleId', sql.Int, roleId)
        .query(`
            SELECT p.VC_modulo as modulo, p.VC_accion as accion
            FROM EXHIBICION.TB_ROL_PERMISOS rp
            INNER JOIN EXHIBICION.TB_PERMISOS p ON rp.IN_permiso_id = p.IN_permiso_id
            WHERE rp.IN_rol_id = @roleId
        `);
    return result.recordset.map((p: { modulo: string; accion: string }) =>
        `${(p.modulo || '').trim()}.${(p.accion || '').trim()}`.toLowerCase()
    );
}

function signToken(user: {
    id: number; username: string; full_name: string; role_id: number | null; role_name: string | null; permissions: string[];
}): string {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role_id: user.role_id,
            role_name: user.role_name || 'Sin rol',
            permissions: user.permissions,
        },
        getJwtSecret(),
        { expiresIn: '24h' }
    );
}

router.post('/login', async (req: Request, res: Response) => {
    try {
        const parseResult = loginSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Datos de login inválidos' });
        }
        const { username, password } = parseResult.data;

        const pool = await getDbConnection();
        const userResult = await pool.request()
            .input('username', sql.NVarChar(100), username)
            .query(`${USER_SELECT} WHERE u.VC_usuario = @username AND u.BI_activo = 1`);

        const user = userResult.recordset[0];
        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Credenciales inválidas o usuario deshabilitado' });
        }

        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password_hash);
        } catch {
            isMatch = false;
        }
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        user.permissions = await loadPermissions(pool, user.role_id);

        pool.request()
            .input('id', sql.BigInt, user.id)
            .query('UPDATE EXHIBICION.TB_USUARIOS SET DT_ultimo_login = GETDATE() WHERE IN_usuario_id = @id')
            .catch(() => { /* no crítico */ });

        const { password_hash: _ph, ...safeUser } = user;
        const token = signToken(user);

        res.json({ user: safeUser, token });
    } catch (error: unknown) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error interno durante la autenticación' });
    }
});

router.get('/me', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Token inválido' });

        const pool = await getDbConnection();
        const userResult = await pool.request()
            .input('id', sql.BigInt, userId)
            .query(`${USER_SELECT} WHERE u.IN_usuario_id = @id AND u.BI_activo = 1`);

        const user = userResult.recordset[0];
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado o deshabilitado' });

        user.permissions = await loadPermissions(pool, user.role_id);
        delete user.password_hash;

        res.json({ user });
    } catch (error: unknown) {
        console.error('Session validate error:', error);
        res.status(500).json({ error: 'Error interno durante la validación de sesión' });
    }
});

router.post('/change-password', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { currentPassword, newPassword } = req.body;
        if (!userId || !currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        const pool = await getDbConnection();
        const result = await pool.request()
            .input('id', sql.BigInt, userId)
            .query('SELECT VC_password_hash as password_hash FROM EXHIBICION.TB_USUARIOS WHERE IN_usuario_id = @id');

        const row = result.recordset[0];
        if (!row) return res.status(400).json({ error: 'Usuario no encontrado' });

        const isMatch = await bcrypt.compare(currentPassword, row.password_hash || '');
        if (!isMatch) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.request()
            .input('hash', sql.NVarChar(255), hash)
            .input('id', sql.BigInt, userId)
            .query('UPDATE EXHIBICION.TB_USUARIOS SET VC_password_hash = @hash WHERE IN_usuario_id = @id');

        res.json({ message: 'Contraseña actualizada exitosamente.' });
    } catch (err: unknown) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/logout', verifyToken, async (req: Request, res: Response) => {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    const exp = req.user?.exp;
    if (token && exp) {
        await blacklistToken(token, exp);
    }
    res.json({ message: 'Sesión cerrada correctamente.' });
});

export default router;
