import sql from 'mssql';

export interface UsuariosQueryParams {
    search?: string;
    rolId?: number;
    activo?: boolean;
}

export interface QueryParam {
    name: string;
    type: unknown;
    value: unknown;
}

export interface UsuariosFilter {
    whereSql: string;
    params: QueryParam[];
}

export function buildUsuariosFilter(query: UsuariosQueryParams): UsuariosFilter {
    const clauses: string[] = ['1 = 1'];
    const params: QueryParam[] = [];

    const search = query.search?.trim();
    if (search) {
        clauses.push('(u.VC_usuario LIKE @search OR u.VC_nombre_completo LIKE @searchContains OR u.VC_email LIKE @searchContains)');
        params.push({ name: 'search', type: sql.NVarChar(50), value: `${search}%` });
        params.push({ name: 'searchContains', type: sql.NVarChar(150), value: `%${search}%` });
    }

    if (typeof query.rolId === 'number' && Number.isInteger(query.rolId) && query.rolId > 0) {
        clauses.push('u.IN_rol_id = @rolId');
        params.push({ name: 'rolId', type: sql.Int, value: query.rolId });
    }

    if (typeof query.activo === 'boolean') {
        clauses.push('u.BI_activo = @activo');
        params.push({ name: 'activo', type: sql.Bit, value: query.activo ? 1 : 0 });
    }

    return { whereSql: clauses.join(' AND '), params };
}
