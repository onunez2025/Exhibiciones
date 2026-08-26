import { describe, it, expect } from 'vitest';
import { buildExhibicionesFilter } from './exhibicionesFilter.js';

function findParam(params: { name: string; value: unknown }[], name: string) {
    return params.find(p => p.name === name);
}

describe('buildExhibicionesFilter', () => {
    it('returns only the base estado filter when no params are given', () => {
        const result = buildExhibicionesFilter({});
        expect(result.whereSql).toBe('E.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('adds a search clause matching prefix on nro and contains on nombre', () => {
        const result = buildExhibicionesFilter({ search: 'EXB0000003' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0 AND (E.VC_nro_exhibicion LIKE @search OR E.VC_nombre LIKE @searchContains)');
        expect(findParam(result.params, 'search')?.value).toBe('EXB0000003%');
        expect(findParam(result.params, 'searchContains')?.value).toBe('%EXB0000003%');
    });

    it('trims whitespace from search before building the clause', () => {
        const result = buildExhibicionesFilter({ search: '  lineal  ' });
        expect(findParam(result.params, 'search')?.value).toBe('lineal%');
    });

    it('ignores an empty/whitespace-only search', () => {
        const result = buildExhibicionesFilter({ search: '   ' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0');
        expect(result.params).toEqual([]);
    });

    it('adds an exact tipo filter when tipo is a valid number', () => {
        const result = buildExhibicionesFilter({ tipo: '49' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0 AND E.IN_exhibicion_tipo_id = @tipo');
        expect(findParam(result.params, 'tipo')?.value).toBe(49);
    });

    it('ignores a non-numeric tipo', () => {
        const result = buildExhibicionesFilter({ tipo: 'abc' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0');
    });

    it('adds an estado filter only for the valid values 1 or 2', () => {
        const result1 = buildExhibicionesFilter({ estado: '1' });
        expect(result1.whereSql).toContain('E.IN_estado_id = @estado');
        expect(findParam(result1.params, 'estado')?.value).toBe(1);

        const result0 = buildExhibicionesFilter({ estado: '0' });
        expect(result0.whereSql).toBe('E.IN_estado_id > 0');

        const result9 = buildExhibicionesFilter({ estado: '9' });
        expect(result9.whereSql).toBe('E.IN_estado_id > 0');
    });

    it('adds a tienda clause matching cliente or sucursal nombre', () => {
        const result = buildExhibicionesFilter({ tienda: 'San Miguel' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0 AND (E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)');
        expect(findParam(result.params, 'tienda')?.value).toBe('%San Miguel%');
    });

    it('adds fechaDesde/fechaHasta clauses for valid ISO dates, ignoring invalid ones', () => {
        const result = buildExhibicionesFilter({ fechaDesde: '2021-01-01', fechaHasta: '2021-12-31' });
        expect(result.whereSql).toBe('E.IN_estado_id > 0 AND E.DT_fecha_crea >= @fechaDesde AND E.DT_fecha_crea <= @fechaHasta');
        expect(findParam(result.params, 'fechaDesde')?.value).toEqual(new Date('2021-01-01'));

        const bad = buildExhibicionesFilter({ fechaDesde: 'not-a-date' });
        expect(bad.whereSql).toBe('E.IN_estado_id > 0');
    });

    it('sets fechaHasta to the end of that day so the whole day is included', () => {
        const result = buildExhibicionesFilter({ fechaHasta: '2021-07-12' });
        const value = findParam(result.params, 'fechaHasta')?.value as Date;
        expect(value.getHours()).toBe(23);
        expect(value.getMinutes()).toBe(59);
    });

    it('combines every filter together in one WHERE clause', () => {
        const result = buildExhibicionesFilter({
            search: 'EXB', tipo: '6', estado: '2', tienda: 'Plaza', fechaDesde: '2021-01-01', fechaHasta: '2021-12-31',
        });
        expect(result.whereSql).toBe(
            'E.IN_estado_id > 0' +
            ' AND (E.VC_nro_exhibicion LIKE @search OR E.VC_nombre LIKE @searchContains)' +
            ' AND E.IN_exhibicion_tipo_id = @tipo' +
            ' AND E.IN_estado_id = @estado' +
            ' AND (E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)' +
            ' AND E.DT_fecha_crea >= @fechaDesde' +
            ' AND E.DT_fecha_crea <= @fechaHasta'
        );
        expect(result.params.map(p => p.name)).toEqual(
            ['search', 'searchContains', 'tipo', 'estado', 'tienda', 'fechaDesde', 'fechaHasta']
        );
    });
});
