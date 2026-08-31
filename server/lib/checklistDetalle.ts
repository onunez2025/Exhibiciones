import type { VisualItemRow, VisualTipoRow } from './checklistCatalogo.js';

export interface ChecklistDetalleItemRow {
    visualCodigo: string;
    desconforme: boolean;
    motivo: string | null;
}

export interface ChecklistDetalleCategoriaItem {
    visualCodigo: string;
    nombre: string;
    desconforme: boolean;
    motivo: string | null;
}

export interface ChecklistDetalleCategoria {
    tipoId: number;
    tipoNombre: string;
    items: ChecklistDetalleCategoriaItem[];
}

export function agruparChecklistDetalle(
    itemsRows: VisualItemRow[],
    tiposRows: VisualTipoRow[],
    detalleRows: ChecklistDetalleItemRow[]
): ChecklistDetalleCategoria[] {
    const respuestasMap = new Map<string, ChecklistDetalleItemRow>();
    for (const d of detalleRows) {
        respuestasMap.set(String(d.visualCodigo), d);
    }

    return tiposRows.map(tipo => ({
        tipoId: tipo.tipoId,
        tipoNombre: tipo.tipoNombre,
        items: itemsRows
            .filter(item => item.tipoId === tipo.tipoId)
            .map(item => {
                const codigo = String(item.visualId);
                const r = respuestasMap.get(codigo);
                return {
                    visualCodigo: codigo,
                    nombre: item.nombre,
                    desconforme: Boolean(r?.desconforme),
                    motivo: r?.motivo ?? null,
                };
            }),
    }));
}
