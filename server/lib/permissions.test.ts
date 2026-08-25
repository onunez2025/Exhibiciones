// server/lib/permissions.test.ts
import { describe, it, expect } from 'vitest';
import { resolvePermission } from './permissions.js';

describe('resolvePermission', () => {
    it('grants everything to Administrador regardless of permissions list', () => {
        expect(resolvePermission('Administrador', [], 'exh.checklists.delete')).toBe(true);
    });

    it('is case-insensitive on the role name', () => {
        expect(resolvePermission('administrador', [], 'exh.checklists.delete')).toBe(true);
    });

    it('grants a permission present in the list for a non-admin role', () => {
        expect(resolvePermission('Promotoria', ['exh.checklists.ver'], 'exh.checklists.ver')).toBe(true);
    });

    it('denies a permission absent from the list', () => {
        expect(resolvePermission('Promotoria', ['exh.checklists.ver'], 'exh.checklists.eliminar')).toBe(false);
    });

    it('denies everything when the permissions list is empty', () => {
        expect(resolvePermission('Promotoria', [], 'exh.checklists.ver')).toBe(false);
    });
});
