import { describe, it, expect } from 'vitest';
import { buildChecklistsFilter } from './checklistsFilter.js';

function findParam(params: { name: string; value: unknown }[], name: string) {
    return params.find(p => p.name === name);
}

describe('buildChecklistsFilter', () => {
    it('returns base IN_estado_id > 0 clause when no params are given', () => {
        const result = buildChecklistsFilter({});
        expect(result.whereSql).toBe('C.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('adds search clause matching number or exhibicion name/number', () => {
        const result = buildChecklistsFilter({ search: '202608' });
        expect(result.whereSql).toBe(
            'C.IN_estado_id > 0 AND (CONVERT(VARCHAR, C.IN_checklist_number) LIKE @search OR E.VC_nombre LIKE @searchContains OR E.VC_nro_exhibicion LIKE @search)'
        );
        expect(findParam(result.params, 'search')?.value).toBe('202608%');
        expect(findParam(result.params, 'searchContains')?.value).toBe('%202608%');
    });

    it('trims whitespace from search', () => {
        const result = buildChecklistsFilter({ search: '  pared  ' });
        expect(findParam(result.params, 'search')?.value).toBe('pared%');
        expect(findParam(result.params, 'searchContains')?.value).toBe('%pared%');
    });

    it('ignores empty/whitespace-only search', () => {
        const result = buildChecklistsFilter({ search: '   ' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('adds NOT EXISTS clause when conforme is "si"', () => {
        const result = buildChecklistsFilter({ conforme: 'si' });
        expect(result.whereSql).toBe(
            'C.IN_estado_id > 0 AND NOT EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)'
        );
        expect(result.params).toEqual([]);
    });

    it('adds EXISTS clause when conforme is "no"', () => {
        const result = buildChecklistsFilter({ conforme: 'no' });
        expect(result.whereSql).toBe(
            'C.IN_estado_id > 0 AND EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)'
        );
        expect(result.params).toEqual([]);
    });

    it('ignores invalid conforme values', () => {
        const result = buildChecklistsFilter({ conforme: 'maybe' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0');
    });

    it('adds tienda clause matching cliente or sucursal nombre', () => {
        const result = buildChecklistsFilter({ tienda: 'Saga' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0 AND (E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)');
        expect(findParam(result.params, 'tienda')?.value).toBe('%Saga%');
    });

    it('adds fechaDesde/fechaHasta clauses with fechaHasta set to end of day', () => {
        const result = buildChecklistsFilter({ fechaDesde: '2026-08-01', fechaHasta: '2026-08-31' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0 AND C.DT_fecha_crea >= @fechaDesde AND C.DT_fecha_crea <= @fechaHasta');
        expect(findParam(result.params, 'fechaDesde')?.value).toEqual(new Date('2026-08-01'));
        const hasta = findParam(result.params, 'fechaHasta')?.value as Date;
        expect(hasta.getHours()).toBe(23);
        expect(hasta.getMinutes()).toBe(59);
        expect(hasta.getSeconds()).toBe(59);
    });

    it('ignores invalid dates', () => {
        const result = buildChecklistsFilter({ fechaDesde: 'invalida', fechaHasta: 'tambien-invalida' });
        expect(result.whereSql).toBe('C.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('combines all filters into one query', () => {
        const result = buildChecklistsFilter({
            search: 'EXB',
            conforme: 'si',
            tienda: 'Metro',
            fechaDesde: '2026-08-01',
            fechaHasta: '2026-08-31',
        });
        expect(result.whereSql).toBe(
            'C.IN_estado_id > 0' +
            ' AND (CONVERT(VARCHAR, C.IN_checklist_number) LIKE @search OR E.VC_nombre LIKE @searchContains OR E.VC_nro_exhibicion LIKE @search)' +
            ' AND NOT EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)' +
            ' AND (E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)' +
            ' AND C.DT_fecha_crea >= @fechaDesde' +
            ' AND C.DT_fecha_crea <= @fechaHasta'
        );
        expect(result.params.map(p => p.name)).toEqual(['search', 'searchContains', 'tienda', 'fechaDesde', 'fechaHasta']);
    });
});
