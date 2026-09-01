import { describe, it, expect } from 'vitest';
import { buildTicketsFilter } from './ticketsFilter.js';

describe('buildTicketsFilter', () => {
    it('applies default exclusion of anulados when no filters given', () => {
        const result = buildTicketsFilter({});
        expect(result.whereClauses).toContain("R.CH_anulado = 'N' AND R.VC_estado != '00'");
        expect(result.params).toHaveLength(0);
    });

    it('filters by search term', () => {
        const result = buildTicketsFilter({ search: 'RSM0000570' });
        expect(result.whereClauses.some(c => c.includes('LIKE @search'))).toBe(true);
        const p = result.params.find(x => x.name === 'search');
        expect(p).toBeDefined();
        expect(p?.value).toBe('%RSM0000570%');
    });

    it('filters by estado code', () => {
        const result = buildTicketsFilter({ estado: '01' });
        expect(result.whereClauses).toContain('R.VC_estado = @estado');
        const p = result.params.find(x => x.name === 'estado');
        expect(p?.value).toBe('01');
    });

    it('filters by tipoId', () => {
        const result = buildTicketsFilter({ tipoId: 4 });
        expect(result.whereClauses).toContain('R.IN_tipo_rq_id = @tipoId');
        const p = result.params.find(x => x.name === 'tipoId');
        expect(p?.value).toBe(4);
    });

    it('filters by tienda / sucursal', () => {
        const result = buildTicketsFilter({ tienda: 'Benavides' });
        expect(result.whereClauses.some(c => c.includes('LIKE @tienda'))).toBe(true);
        const p = result.params.find(x => x.name === 'tienda');
        expect(p?.value).toBe('%Benavides%');
    });

    it('filters by date range', () => {
        const result = buildTicketsFilter({ fechaDesde: '2026-08-01', fechaHasta: '2026-08-31' });
        expect(result.whereClauses).toContain('R.DT_fecha_crea >= @fechaDesde');
        expect(result.whereClauses).toContain('R.DT_fecha_crea < @fechaHasta');
        const desde = result.params.find(x => x.name === 'fechaDesde');
        const hasta = result.params.find(x => x.name === 'fechaHasta');
        expect(desde?.value).toEqual(new Date('2026-08-01T00:00:00.000Z'));
        expect(hasta?.value).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    });

    it('ignores invalid dates', () => {
        const result = buildTicketsFilter({ fechaDesde: 'invalido', fechaHasta: 'tambien' });
        expect(result.whereClauses).not.toContain('R.DT_fecha_crea >= @fechaDesde');
        expect(result.whereClauses).not.toContain('R.DT_fecha_crea < @fechaHasta');
    });

    it('allows including anulados when explicitly requested', () => {
        const result = buildTicketsFilter({ incluirAnulados: true });
        expect(result.whereClauses).not.toContain("R.CH_anulado = 'N' AND R.VC_estado != '00'");
    });
});
