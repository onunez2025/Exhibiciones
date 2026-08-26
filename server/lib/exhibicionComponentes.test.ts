import { describe, it, expect } from 'vitest';
import { mapComponentesRows } from './exhibicionComponentes.js';

describe('mapComponentesRows', () => {
    it('returns empty carcasas/productos for an empty input', () => {
        expect(mapComponentesRows([])).toEqual({ carcasas: [], productos: [] });
    });

    it('groups tipo=1 rows into productos and tipo=2 rows into carcasas', () => {
        const result = mapComponentesRows([
            { id: 1, tipo: 1, nombre: 'Campana A', cantidad: 2 },
            { id: 2, tipo: 2, nombre: 'Carcasa X', cantidad: 1 },
            { id: 3, tipo: 1, nombre: 'Campana B', cantidad: 3 },
        ]);
        expect(result.productos).toEqual([
            { id: 1, nombre: 'Campana A', cantidad: 2 },
            { id: 3, nombre: 'Campana B', cantidad: 3 },
        ]);
        expect(result.carcasas).toEqual([
            { id: 2, nombre: 'Carcasa X', cantidad: 1 },
        ]);
    });

    it('preserves the input order within each group', () => {
        const result = mapComponentesRows([
            { id: 5, tipo: 1, nombre: 'Z', cantidad: 1 },
            { id: 6, tipo: 1, nombre: 'A', cantidad: 1 },
        ]);
        expect(result.productos.map(p => p.nombre)).toEqual(['Z', 'A']);
    });

    it('ignores rows with an unrecognized tipo instead of throwing', () => {
        const result = mapComponentesRows([
            { id: 7, tipo: 3, nombre: 'Raro', cantidad: 1 },
        ]);
        expect(result).toEqual({ carcasas: [], productos: [] });
    });

    it('keeps nombre as null when the product catalog has no match', () => {
        const result = mapComponentesRows([
            { id: 8, tipo: 1, nombre: null, cantidad: 1 },
        ]);
        expect(result.productos).toEqual([{ id: 8, nombre: null, cantidad: 1 }]);
    });
});
