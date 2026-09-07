import { describe, it, expect } from 'vitest';
import { evaluarUltimoAdminActivo, permisosNoAutorizados } from './rbacGuards.js';

describe('evaluarUltimoAdminActivo', () => {
    it('blocks deactivating/demoting the last active admin (no other active admins)', () => {
        expect(evaluarUltimoAdminActivo(true, false, 0)).toBe(false);
    });

    it('allows it when at least one other admin stays active', () => {
        expect(evaluarUltimoAdminActivo(true, false, 1)).toBe(true);
        expect(evaluarUltimoAdminActivo(true, false, 5)).toBe(true);
    });

    it('allows it when the user stays an active admin (no real demotion/deactivation)', () => {
        expect(evaluarUltimoAdminActivo(true, true, 0)).toBe(true);
    });

    it('allows it for a user who was never an active admin to begin with', () => {
        expect(evaluarUltimoAdminActivo(false, false, 0)).toBe(true);
        expect(evaluarUltimoAdminActivo(false, true, 0)).toBe(true);
    });
});

describe('permisosNoAutorizados', () => {
    const catalogo = [
        { id: 1, modulo: 'Seguridad', accion: 'Roles - Ver' },
        { id: 2, modulo: 'Seguridad', accion: 'Roles - Gestionar' },
        { id: 3, modulo: 'Seguridad', accion: 'Usuarios - Ver' },
        { id: 4, modulo: 'Seguridad', accion: 'Usuarios - Gestionar' },
        { id: 7, modulo: 'Exhibiciones', accion: 'Exhibiciones - Ver' },
    ];

    it('returns empty when every requested permission is already held', () => {
        const propios = ['seguridad.roles - ver', 'seguridad.roles - gestionar'];
        expect(permisosNoAutorizados([1, 2], catalogo, propios)).toEqual([]);
    });

    it('flags a requested permission the caller does not hold — the self-escalation case', () => {
        // El caso real: alguien con solo 'seguridad.roles - gestionar'
        // intenta concederse también 'seguridad.usuarios - gestionar'.
        const propios = ['seguridad.roles - gestionar'];
        const resultado = permisosNoAutorizados([2, 4], catalogo, propios);
        expect(resultado).toEqual([{ id: 4, modulo: 'Seguridad', accion: 'Usuarios - Gestionar' }]);
    });

    it('ignores catalog entries that were not requested at all', () => {
        const propios: string[] = [];
        expect(permisosNoAutorizados([1], catalogo, propios)).toEqual([{ id: 1, modulo: 'Seguridad', accion: 'Roles - Ver' }]);
        // id 4 no estaba en la solicitud, no debe aparecer aunque tampoco esté autorizado.
        expect(permisosNoAutorizados([1], catalogo, propios).some(p => p.id === 4)).toBe(false);
    });

    it('matches case-insensitively, same as loadPermissions() building the JWT claim', () => {
        const propios = ['SEGURIDAD.ROLES - VER'.toLowerCase()];
        expect(permisosNoAutorizados([1], catalogo, propios)).toEqual([]);
    });

    it('returns an empty array for an empty request', () => {
        expect(permisosNoAutorizados([], catalogo, [])).toEqual([]);
    });
});
