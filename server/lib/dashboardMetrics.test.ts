import { describe, it, expect } from 'vitest';
import { calcularPorcentajeConformidad } from './dashboardMetrics.js';

describe('calcularPorcentajeConformidad', () => {
    it('calculates conformity percentage correctly', () => {
        expect(calcularPorcentajeConformidad(100, 75)).toBe(75);
        expect(calcularPorcentajeConformidad(3, 1)).toBe(33);
        expect(calcularPorcentajeConformidad(108, 60)).toBe(56);
    });

    it('returns null (sin datos) when there are no checklists evaluated yet, instead of a fake 100%', () => {
        expect(calcularPorcentajeConformidad(0, 0)).toBeNull();
        expect(calcularPorcentajeConformidad(-5, 0)).toBeNull();
    });
});
