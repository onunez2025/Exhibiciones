export interface ChecklistItemInput {
    visualCodigo: string;
    desconforme: boolean;
    motivo: string | null;
}

export type ValidacionChecklist =
    | { valido: true; items: ChecklistItemInput[] }
    | { valido: false; error: string };

const MAX_MOTIVO_LENGTH = 150; // TB_CHECKLIST_DETALLE.VC_desconforme_motivo es VARCHAR(150)

// Puro — recibe los códigos válidos ya consultados por el route handler
// (así no toca la base de datos y es testeable aislado). Exige
// exactamente esos códigos, sin duplicados ni ajenos, y motivo
// obligatorio (no vacío, máximo 150 caracteres) para cualquier ítem
// "No Conforme". Un ítem "Conforme" ignora cualquier motivo enviado.
export function validarChecklistItems(body: unknown, codigosValidos: string[]): ValidacionChecklist {
    if (typeof body !== 'object' || body === null || !Array.isArray((body as Record<string, unknown>).items)) {
        return { valido: false, error: 'Datos inválidos.' };
    }
    const itemsRaw = (body as { items: unknown[] }).items;

    if (itemsRaw.length !== codigosValidos.length) {
        return { valido: false, error: `Se esperaban ${codigosValidos.length} ítems.` };
    }

    const vistos = new Set<string>();
    const items: ChecklistItemInput[] = [];

    for (const raw of itemsRaw) {
        if (typeof raw !== 'object' || raw === null) {
            return { valido: false, error: 'Datos inválidos.' };
        }
        const r = raw as Record<string, unknown>;
        const visualCodigo = typeof r.visualCodigo === 'string' ? r.visualCodigo.trim() : '';
        const desconforme = r.desconforme === true;

        if (!codigosValidos.includes(visualCodigo)) {
            return { valido: false, error: 'Ítem de checklist inválido.' };
        }
        if (vistos.has(visualCodigo)) {
            return { valido: false, error: 'Ítem de checklist duplicado.' };
        }
        vistos.add(visualCodigo);

        let motivo: string | null = null;
        if (desconforme) {
            const motivoTrim = typeof r.motivo === 'string' ? r.motivo.trim() : '';
            if (!motivoTrim) {
                return { valido: false, error: 'Los ítems No Conforme necesitan un motivo.' };
            }
            if (motivoTrim.length > MAX_MOTIVO_LENGTH) {
                return { valido: false, error: `El motivo no puede superar los ${MAX_MOTIVO_LENGTH} caracteres.` };
            }
            motivo = motivoTrim;
        }

        items.push({ visualCodigo, desconforme, motivo });
    }

    return { valido: true, items };
}
