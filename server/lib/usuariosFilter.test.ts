import { describe, it, expect } from 'vitest';
import { buildUsuariosFilter } from './usuariosFilter.js';

function findParam(params: { name: string; value: unknown }[], name: string) {
    return params.find(p => p.name === name);
}

describe('buildUsuariosFilter', () => {
    it('returns default 1 = 1 when no parameters passed', () => {
        const result = buildUsuariosFilter({});
        expect(result.whereSql).toBe('1 = 1');
        expect(result.params).toEqual([]);
    });

    it('adds search conditions for username, name and email', () => {
        const result = buildUsuariosFilter({ search: 'juan' });
        expect(result.whereSql).toBe(
            '1 = 1 AND (u.VC_usuario LIKE @search OR u.VC_nombre_completo LIKE @searchContains OR u.VC_email LIKE @searchContains)'
        );
        expect(findParam(result.params, 'search')?.value).toBe('juan%');
        expect(findParam(result.params, 'searchContains')?.value).toBe('%juan%');
    });

    it('adds rolId filter when positive integer is provided', () => {
        const result = buildUsuariosFilter({ rolId: 3 });
        expect(result.whereSql).toBe('1 = 1 AND u.IN_rol_id = @rolId');
        expect(findParam(result.params, 'rolId')?.value).toBe(3);
    });

    it('adds activo boolean filter', () => {
        const result = buildUsuariosFilter({ activo: true });
        expect(result.whereSql).toBe('1 = 1 AND u.BI_activo = @activo');
        expect(findParam(result.params, 'activo')?.value).toBe(1);

        const inactiveResult = buildUsuariosFilter({ activo: false });
        expect(inactiveResult.whereSql).toBe('1 = 1 AND u.BI_activo = @activo');
        expect(findParam(inactiveResult.params, 'activo')?.value).toBe(0);
    });

    it('combines all filters together', () => {
        const result = buildUsuariosFilter({ search: 'admin', rolId: 5, activo: true });
        expect(result.whereSql).toBe(
            '1 = 1 AND (u.VC_usuario LIKE @search OR u.VC_nombre_completo LIKE @searchContains OR u.VC_email LIKE @searchContains) AND u.IN_rol_id = @rolId AND u.BI_activo = @activo'
        );
        expect(result.params.length).toBe(4);
    });
});
