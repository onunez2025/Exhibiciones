export interface ComponenteRow {
    id: number;
    tipo: number;
    nombre: string | null;
    cantidad: number;
}

export interface ComponenteItem {
    id: number;
    nombre: string | null;
    cantidad: number;
}

export interface ComponentesAgrupados {
    carcasas: ComponenteItem[];
    productos: ComponenteItem[];
}

// IN_tipo: 1 = Producto, 2 = Carcasa — confirmado leyendo el JOIN del proc
// viejo EXHIBICION.PROC_OBTENER_COMPONENTE (tipo 1 -> WEB_MARKETING_PRODUCTOS
// con VC_tipo='PRD', tipo 2 -> VC_tipo='CAR'). Puro, sin tocar la base de
// datos, para poder probarlo aislado (mismo patrón que exhibicionesFilter.ts).
export function mapComponentesRows(rows: ComponenteRow[]): ComponentesAgrupados {
    const carcasas: ComponenteItem[] = [];
    const productos: ComponenteItem[] = [];
    for (const row of rows) {
        const item: ComponenteItem = { id: row.id, nombre: row.nombre, cantidad: row.cantidad };
        if (row.tipo === 1) productos.push(item);
        else if (row.tipo === 2) carcasas.push(item);
        // tipo distinto de 1/2 no debería ocurrir (ver proc viejo), pero se
        // ignora en vez de romper toda la respuesta si aparece.
    }
    return { carcasas, productos };
}
