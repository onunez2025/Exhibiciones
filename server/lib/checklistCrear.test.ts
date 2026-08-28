import { describe, it, expect } from 'vitest';
import { validarChecklistItems } from './checklistCrear.js';

const CODIGOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function itemsCompletos(overrides: Record<number, Partial<{ visualCodigo: string; desconforme: boolean; motivo: string | null }>> = {}) {
    return CODIGOS.map((c, i) => ({ visualCodigo: c, desconforme: false, motivo: null, ...(overrides[i] ?? {}) }));
}

describe('validarChecklistItems', () => {
    it('accepts exactly 12 valid items, all conforme', () => {
        const result = validarChecklistItems({ items: itemsCompletos() }, CODIGOS);
        expect(result.valido).toBe(true);
    });

    it('accepts a desconforme item with a trimmed motivo', () => {
        const items = itemsCompletos({ 1: { desconforme: true, motivo: '  Falta stock  ' } });
        const result = validarChecklistItems({ items }, CODIGOS);
        expect(result.valido).toBe(true);
        if (result.valido) {
            expect(result.items[1]).toEqual({ visualCodigo: '2', desconforme: true, motivo: 'Falta stock' });
        }
    });

    it('ignores a motivo sent for a conforme item', () => {
        const items = itemsCompletos({ 0: { motivo: 'no debería importar' } });
        const result = validarChecklistItems({ items }, CODIGOS);
        expect(result.valido).toBe(true);
        if (result.valido) expect(result.items[0].motivo).toBeNull();
    });

    it('rejects a desconforme item with an empty or whitespace-only motivo', () => {
        const items = itemsCompletos({ 0: { desconforme: true, motivo: '   ' } });
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'Los ítems No Conforme necesitan un motivo.' });
    });

    it('rejects a motivo longer than 150 characters', () => {
        const items = itemsCompletos({ 0: { desconforme: true, motivo: 'x'.repeat(151) } });
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'El motivo no puede superar los 150 caracteres.' });
    });

    it('rejects fewer than 12 items', () => {
        const items = itemsCompletos().slice(0, 11);
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'Se esperaban 12 ítems.' });
    });

    it('rejects a code not in the catalog', () => {
        const items = itemsCompletos({ 0: { visualCodigo: '99' } });
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'Ítem de checklist inválido.' });
    });

    it('rejects a duplicated code', () => {
        // El primer ítem repite el código del segundo — código '1' desaparece, '2' se duplica.
        const items = itemsCompletos({ 0: { visualCodigo: '2' } });
        expect(validarChecklistItems({ items }, CODIGOS)).toEqual({ valido: false, error: 'Ítem de checklist duplicado.' });
    });

    it('rejects a non-object body or a missing items array', () => {
        expect(validarChecklistItems(null, CODIGOS)).toEqual({ valido: false, error: 'Datos inválidos.' });
        expect(validarChecklistItems({}, CODIGOS)).toEqual({ valido: false, error: 'Datos inválidos.' });
    });
});
