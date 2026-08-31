import sql from 'mssql';

export interface ChecklistsQueryParams {
    search?: string;
    conforme?: string;
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}

export interface QueryParam {
    name: string;
    type: unknown;
    value: unknown;
}

export interface ChecklistsFilter {
    whereSql: string;
    params: QueryParam[];
}

export function buildChecklistsFilter(query: ChecklistsQueryParams): ChecklistsFilter {
    const clauses: string[] = ['C.IN_estado_id > 0'];
    const params: QueryParam[] = [];

    const search = query.search?.trim();
    if (search) {
        clauses.push('(CONVERT(VARCHAR, C.IN_checklist_number) LIKE @search OR E.VC_nombre LIKE @searchContains OR E.VC_nro_exhibicion LIKE @search)');
        params.push({ name: 'search', type: sql.NVarChar(20), value: `${search}%` });
        params.push({ name: 'searchContains', type: sql.NVarChar(200), value: `%${search}%` });
    }

    if (query.conforme === 'si') {
        clauses.push('NOT EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)');
    } else if (query.conforme === 'no') {
        clauses.push('EXISTS (SELECT 1 FROM EXHIBICION.TB_CHECKLIST_DETALLE CD WHERE CD.IN_checklist_id = C.IN_checklist_id AND CD.IN_estado = 1 AND CD.BI_desconforme = 1)');
    }

    const tienda = query.tienda?.trim();
    if (tienda) {
        clauses.push('(E.VC_cliente_nombre LIKE @tienda OR E.VC_sucursal_nombre LIKE @tienda)');
        params.push({ name: 'tienda', type: sql.NVarChar(250), value: `%${tienda}%` });
    }

    if (query.fechaDesde) {
        const d = new Date(query.fechaDesde);
        if (!Number.isNaN(d.getTime())) {
            clauses.push('C.DT_fecha_crea >= @fechaDesde');
            params.push({ name: 'fechaDesde', type: sql.DateTime, value: d });
        }
    }

    if (query.fechaHasta) {
        const d = new Date(query.fechaHasta);
        if (!Number.isNaN(d.getTime())) {
            d.setHours(23, 59, 59, 999);
            clauses.push('C.DT_fecha_crea <= @fechaHasta');
            params.push({ name: 'fechaHasta', type: sql.DateTime, value: d });
        }
    }

    return { whereSql: clauses.join(' AND '), params };
}
