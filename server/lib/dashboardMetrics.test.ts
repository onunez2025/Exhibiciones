import { describe, it, expect } from 'vitest';
import {
    calcularPorcentajeConformidad,
    calcularTotalPendientes,
} from './dashboardMetrics.js';

describe('dashboardMetrics', () => {
    it('calculates conformity percentage correctly', () => {
        expect(calcularPorcentajeConformidad(100, 75)).toBe(75);
        expect(calcularPorcentajeConformidad(3, 1)).toBe(33);
        expect(calcularPorcentajeConformidad(108, 60)).toBe(56);
    });

    it('returns 100% when there are no checklists evaluated yet', () => {
        expect(calcularPorcentajeConformidad(0, 0)).toBe(100);
        expect(calcularPorcentajeConformidad(-5, 0)).toBe(100);
    });

    it('sums total pending administrative tasks', () => {
        expect(calcularTotalPendientes(18, 262, 345)).toBe(625);
        expect(calcularTotalPendientes(0, 0, 0)).toBe(0);
    });
});
