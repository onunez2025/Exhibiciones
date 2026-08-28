export interface VisualItemRow {
    visualId: number;
    nombre: string;
    tipoId: number;
}

export interface VisualTipoRow {
    tipoId: number;
    tipoNombre: string;
}

export interface ChecklistCatalogoItem {
    visualCodigo: string;
    nombre: string;
}

export interface ChecklistCatalogoCategoria {
    tipoId: number;
    tipoNombre: string;
    items: ChecklistCatalogoItem[];
}

// Arma la estructura anidada (categoría -> ítems) a partir de las dos
// consultas planas a dbo.PV_TABLA — puro, sin tocar la base de datos.
// Preserva el orden de `tiposRows` para las categorías y el orden de
// `itemsRows` (ya viene ordenado por tipoId, IN_id desde la query) para
// los ítems dentro de cada categoría.
export function agruparCatalogoChecklist(itemsRows: VisualItemRow[], tiposRows: VisualTipoRow[]): ChecklistCatalogoCategoria[] {
    return tiposRows.map(tipo => ({
        tipoId: tipo.tipoId,
        tipoNombre: tipo.tipoNombre,
        items: itemsRows
            .filter(item => item.tipoId === tipo.tipoId)
            .map(item => ({ visualCodigo: String(item.visualId), nombre: item.nombre })),
    }));
}
