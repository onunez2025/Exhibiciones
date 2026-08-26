// server/lib/permissions.ts

// Pura — decide si un rol/lista de permisos alcanza para una acción dada.
// Administrador siempre pasa; el resto necesita el permiso exacto en su
// lista. TB_ROL_PERMISOS está vacía hoy en la base real, así que todo
// usuario no-admin resuelve en `false` hasta que se carguen datos reales —
// eso es esperado, no un bug.
export function resolvePermission(
    roleName: string,
    permissions: string[],
    required: string
): boolean {
    const roleLower = (roleName || '').trim().toLowerCase();
    if (roleLower === 'administrador') return true;
    return permissions.includes(required);
}
