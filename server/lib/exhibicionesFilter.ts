import sql from 'mssql';

export interface ExhibicionesQueryParams {
    search?: string;
    tipo?: string;
    estado?: string;
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}

export interface QueryParam {
    name: string;
    // Valor de mssql (ej. sql.Int, sql.NVarChar(20)) — tipado unknown aquí
    // para no acoplar este módulo puro al tipo exacto de la librería;
    // quien lo consume (Task 3) lo castea a sql.ISqlType al hacer .input().
    type: unknown;
    value: unknown;
}

export interface ExhibicionesFilter {
    whereSql: string;
    params: QueryParam[];
}

// Arma el WHERE + params de la lista de exhibiciones a partir de query
// params ya parseados (todos opcionales). Puro — sin tocar la base de
// datos — para poder probarlo sin una conexión real. IN_estado_id > 0
// siempre está presente: el estado 0 (Anulado) nunca debe aparecer en la
// lista, sin importar qué más se filtre.
export function buildExhibicionesFilter(query: ExhibicionesQueryParams): ExhibicionesFilter {
    const clauses: string[] = ['E.IN_estado_id > 0'];
    const params: QueryParam[] = [];

    const search = query.search?.trim();
    if (search) {
        clauses.push('(E.VC_nro_exhibicion LIKE @search OR E.VC_nombre LIKE @searchContains)');
        params.push({ name: 'search', type: sql.NVarChar(20), value: `${search}%` });
        params.push({ name: 'searchContains', type: sql.NVarChar(200), value: `%${search}%` });
    }

    if (query.tipo !== undefined) {
        const tipoNum = Number(query.tipo);
        if (Number.isFinite(tipoNum)) {
            clauses.push('E.IN_exhibicion_tipo_id = @tipo');
            params.push({ name: 'tipo', type: sql.Int, value: tipoNum });
        }
    }

    if (query.estado !== undefined) {
        const estadoNum = Number(query.estado);
        if (estadoNum === 1 || estadoNum === 2) {
            clauses.push('E.IN_estado_id = @estado');
            params.push({ name: 'estado', type: sql.Int, value: estadoNum });
        }
    }

    const tienda = query.tienda?.trim();
    if (tienda) {
        clauses.push('(E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)');
        params.push({ name: 'tienda', type: sql.NVarChar(250), value: `%${tienda}%` });
    }

    if (query.fechaDesde) {
        const d = new Date(query.fechaDesde);
        if (!Number.isNaN(d.getTime())) {
            clauses.push('E.DT_fecha_crea >= @fechaDesde');
            params.push({ name: 'fechaDesde', type: sql.DateTime, value: d });
        }
    }

    if (query.fechaHasta) {
        const d = new Date(query.fechaHasta);
        if (!Number.isNaN(d.getTime())) {
            // Fin del día — si no, "hasta el 12/07" excluiría todo lo creado
            // ese mismo día después de medianoche.
            d.setHours(23, 59, 59, 999);
            clauses.push('E.DT_fecha_crea <= @fechaHasta');
            params.push({ name: 'fechaHasta', type: sql.DateTime, value: d });
        }
    }

    return { whereSql: clauses.join(' AND '), params };
}
