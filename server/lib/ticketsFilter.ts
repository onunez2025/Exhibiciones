export interface SqlParam {
    name: string;
    type: 'NVarChar' | 'VarChar' | 'Int' | 'DateTime';
    length?: number;
    value: unknown;
}

export interface TicketsFilterInput {
    search?: string;
    estado?: string;
    tipoId?: number;
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    incluirAnulados?: boolean;
}

export interface TicketsFilterResult {
    whereClauses: string[];
    params: SqlParam[];
}

export function buildTicketsFilter(filtros: TicketsFilterInput): TicketsFilterResult {
    const whereClauses: string[] = [];
    const params: SqlParam[] = [];

    if (!filtros.incluirAnulados) {
        whereClauses.push("R.CH_anulado = 'N' AND R.VC_estado != '00'");
    }

    if (filtros.search && filtros.search.trim()) {
        const term = `%${filtros.search.trim()}%`;
        whereClauses.push(`(
            R.VC_requerimiento LIKE @search OR
            E.VC_nro_exhibicion LIKE @search OR
            E.VC_nombre LIKE @search OR
            R.VC_cliente_nombre LIKE @search OR
            R.VC_observacion LIKE @search
        )`);
        params.push({ name: 'search', type: 'NVarChar', length: 200, value: term });
    }

    if (filtros.estado && filtros.estado.trim()) {
        whereClauses.push('R.VC_estado = @estado');
        params.push({ name: 'estado', type: 'VarChar', length: 10, value: filtros.estado.trim() });
    }

    if (typeof filtros.tipoId === 'number' && Number.isInteger(filtros.tipoId) && filtros.tipoId > 0) {
        whereClauses.push('R.IN_tipo_rq_id = @tipoId');
        params.push({ name: 'tipoId', type: 'Int', value: filtros.tipoId });
    }

    if (filtros.tienda && filtros.tienda.trim()) {
        const term = `%${filtros.tienda.trim()}%`;
        whereClauses.push('(R.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)');
        params.push({ name: 'tienda', type: 'NVarChar', length: 150, value: term });
    }

    if (filtros.fechaDesde) {
        const d = new Date(filtros.fechaDesde);
        if (!Number.isNaN(d.getTime())) {
            const desde = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
            whereClauses.push('R.DT_fecha_crea >= @fechaDesde');
            params.push({ name: 'fechaDesde', type: 'DateTime', value: desde });
        }
    }

    if (filtros.fechaHasta) {
        const d = new Date(filtros.fechaHasta);
        if (!Number.isNaN(d.getTime())) {
            // Hasta exclusivo: día siguiente a las 00:00:00 UTC
            const hastaExclusivo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
            whereClauses.push('R.DT_fecha_crea < @fechaHasta');
            params.push({ name: 'fechaHasta', type: 'DateTime', value: hastaExclusivo });
        }
    }

    return { whereClauses, params };
}
