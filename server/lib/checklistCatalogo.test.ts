import { describe, it, expect } from 'vitest';
import { agruparCatalogoChecklist } from './checklistCatalogo.js';

describe('agruparCatalogoChecklist', () => {
    it('returns one entry per tipo, in tipo order', () => {
        const tipos = [{ tipoId: 1, tipoNombre: 'Visual Etiqueta' }, { tipoId: 2, tipoNombre: 'Visual Exhibiciones' }];
        const items = [
            { visualId: 5, nombre: 'Operativo', tipoId: 2 },
            { visualId: 1, nombre: 'Producto', tipoId: 1 },
        ];
        const result = agruparCatalogoChecklist(items, tipos);
        expect(result).toEqual([
            { tipoId: 1, tipoNombre: 'Visual Etiqueta', items: [{ visualCodigo: '1', nombre: 'Producto' }] },
            { tipoId: 2, tipoNombre: 'Visual Exhibiciones', items: [{ visualCodigo: '5', nombre: 'Operativo' }] },
        ]);
    });

    it('preserves item order within a category', () => {
        const tipos = [{ tipoId: 1, tipoNombre: 'Visual Etiqueta' }];
        const items = [
            { visualId: 1, nombre: 'Producto', tipoId: 1 },
            { visualId: 2, nombre: 'Atributo', tipoId: 1 },
            { visualId: 3, nombre: 'Faltantes', tipoId: 1 },
        ];
        const result = agruparCatalogoChecklist(items, tipos);
        expect(result[0].items.map(i => i.nombre)).toEqual(['Producto', 'Atributo', 'Faltantes']);
    });

    it('gives a category with no matching items an empty array, not a dropped category', () => {
        const tipos = [{ tipoId: 1, tipoNombre: 'Visual Etiqueta' }, { tipoId: 3, tipoNombre: 'Visual POP' }];
        const items = [{ visualId: 1, nombre: 'Producto', tipoId: 1 }];
        const result = agruparCatalogoChecklist(items, tipos);
        expect(result).toHaveLength(2);
        expect(result[1]).toEqual({ tipoId: 3, tipoNombre: 'Visual POP', items: [] });
    });

    it('converts visualId to a string visualCodigo', () => {
        const tipos = [{ tipoId: 1, tipoNombre: 'Visual Etiqueta' }];
        const items = [{ visualId: 12, nombre: 'Faltantes', tipoId: 1 }];
        const result = agruparCatalogoChecklist(items, tipos);
        expect(result[0].items[0].visualCodigo).toBe('12');
    });

    it('returns an empty array for empty tipos', () => {
        expect(agruparCatalogoChecklist([], [])).toEqual([]);
    });
});
