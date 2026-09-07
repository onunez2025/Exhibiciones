// Reglas de seguridad de RBAC extraídas como funciones puras — el route
// handler consulta la base (quién es, qué tiene, cuántos otros admins
// activos hay) y le pasa esos datos ya resueltos a estas funciones, que
// deciden sin tocar la base. Así quedan testeables aisladas, algo que no
// existía para ninguna de las dos rutas antes de esta revisión.

// Decide si una operación que cambia el rol o el estado (activo/inactivo)
// de un usuario dejaría al sistema sin ningún Administrador activo.
// `otrosAdminsActivos` es el conteo de administradores activos DISTINTOS
// del usuario que se está editando.
export function evaluarUltimoAdminActivo(
    eraAdminActivo: boolean,
    seguiraSiendoAdminActivo: boolean,
    otrosAdminsActivos: number
): boolean {
    if (eraAdminActivo && !seguiraSiendoAdminActivo && otrosAdminsActivos <= 0) {
        return false;
    }
    return true;
}

export interface PermisoCatalogo {
    id: number;
    modulo: string;
    accion: string;
}

// Determina cuáles de los `permisoIdsSolicitados` el llamador NO tiene ya
// en `permisosPropios` (formato "modulo.accion" en minúsculas, el mismo
// que arma loadPermissions() en server/routes/auth.ts). Un resultado
// vacío significa "todo autorizado, puede conceder estos permisos".
// Evita que alguien con 'seguridad.roles - gestionar' se autoescale
// otorgándose a sí mismo (o a su propio rol) un permiso que no tiene.
export function permisosNoAutorizados(
    permisoIdsSolicitados: number[],
    catalogo: PermisoCatalogo[],
    permisosPropios: string[]
): PermisoCatalogo[] {
    const propios = new Set(permisosPropios);
    return catalogo.filter(p => {
        if (!permisoIdsSolicitados.includes(p.id)) return false;
        const clave = `${(p.modulo || '').trim()}.${(p.accion || '').trim()}`.toLowerCase();
        return !propios.has(clave);
    });
}
