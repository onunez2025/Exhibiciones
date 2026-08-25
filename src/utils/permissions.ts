export function resolvePermission(
    roleName: string,
    permissions: string[],
    required: string
): boolean {
    const roleLower = (roleName || '').trim().toLowerCase();
    if (roleLower === 'administrador') return true;
    return permissions.includes(required);
}
