import { describe, it, expect } from 'vitest';
import { resolvePermission } from './permissions.js';

describe('resolvePermission', () => {
    it('grants everything to Administrador', () => {
        expect(resolvePermission('Administrador', [], 'exh.checklists.delete')).toBe(true);
    });

    it('grants a permission present in the list', () => {
        expect(resolvePermission('Promotoria', ['exh.checklists.ver'], 'exh.checklists.ver')).toBe(true);
    });

    it('denies a permission absent from the list', () => {
        expect(resolvePermission('Promotoria', ['exh.checklists.ver'], 'exh.checklists.eliminar')).toBe(false);
    });

    it('denies everything for a null/empty role', () => {
        expect(resolvePermission('', [], 'exh.checklists.ver')).toBe(false);
    });
});
