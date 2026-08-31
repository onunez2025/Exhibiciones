import { describe, it, expect } from 'vitest';
import { agruparChecklistDetalle } from './checklistDetalle.js';

describe('agruparChecklistDetalle', () => {
    const tipos = [
        { tipoId: 1, tipoNombre: 'Visual Etiqueta' },
        { tipoId: 2, tipoNombre: 'Visual Exhibiciones' },
    ];
    const catalogItems = [
        { visualId: 1, nombre: 'Producto', tipoId: 1 },
        { visualId: 2, nombre: 'Atributo', tipoId: 1 },
        { visualId: 5, nombre: 'Operativo', tipoId: 2 },
    ];

    it('merges catalog structure with checklist responses', () => {
        const detalle = [
            { visualCodigo: '1', desconforme: false, motivo: null },
            { visualCodigo: '2', desconforme: true, motivo: 'Etiqueta rota' },
            { visualCodigo: '5', desconforme: false, motivo: null },
        ];

        const result = agruparChecklistDetalle(catalogItems, tipos, detalle);
        expect(result).toEqual([
            {
                tipoId: 1,
                tipoNombre: 'Visual Etiqueta',
                items: [
                    { visualCodigo: '1', nombre: 'Producto', desconforme: false, motivo: null },
                    { visualCodigo: '2', nombre: 'Atributo', desconforme: true, motivo: 'Etiqueta rota' },
                ],
            },
            {
                tipoId: 2,
                tipoNombre: 'Visual Exhibiciones',
                items: [
                    { visualCodigo: '5', nombre: 'Operativo', desconforme: false, motivo: null },
                ],
            },
        ]);
    });

    it('defaults to conforme (desconforme: false, motivo: null) if an item has no recorded response', () => {
        const detalle = [{ visualCodigo: '1', desconforme: true, motivo: 'Falta precio' }];
        const result = agruparChecklistDetalle(catalogItems, tipos, detalle);
        expect(result[0].items[1]).toEqual({
            visualCodigo: '2',
            nombre: 'Atributo',
            desconforme: false,
            motivo: null,
        });
    });

    it('handles empty categories gracefully', () => {
        const emptyTipos = [{ tipoId: 3, tipoNombre: 'Visual POP' }];
        const result = agruparChecklistDetalle([], emptyTipos, []);
        expect(result).toEqual([{ tipoId: 3, tipoNombre: 'Visual POP', items: [] }]);
    });

    it('returns empty array when types are empty', () => {
        expect(agruparChecklistDetalle([], [], [])).toEqual([]);
    });
});
