export interface TicketComponenteInput {
    componenteId: number;
    cantidad: number;
}

export interface DatosTicketValidados {
    tipoId: number;
    motivo: string;
    componentes: TicketComponenteInput[];
}

export type ValidacionTicket =
    | { valido: true; datos: DatosTicketValidados }
    | { valido: false; error: string };

const MAX_MOTIVO_LENGTH = 200; // WEB_MARKETING_REQUERIMIENTO.VC_observacion es VARCHAR(200)

// Puro — recibe los tipos y componentes válidos ya consultados por el route
// handler (así no toca la base de datos y es testeable aislado). `tiposValidos`
// son los IN_tipo_id activos de TB_TIPOS_REQUERIMIENTO; `componentesValidos`
// son los IN_exhibicion_componente_id activos que YA pertenecen a la
// exhibición para la que se crea el ticket (nunca el catálogo completo).
// `componentes` puede venir vacío — hay tipos de ticket (p.ej. Capacitación)
// que no necesitan ninguno.
export function validarTicketCrear(body: unknown, tiposValidos: number[], componentesValidos: number[]): ValidacionTicket {
    if (typeof body !== 'object' || body === null) {
        return { valido: false, error: 'Datos inválidos.' };
    }
    const b = body as Record<string, unknown>;

    const tipoId = Number(b.tipoId);
    if (!Number.isInteger(tipoId) || !tiposValidos.includes(tipoId)) {
        return { valido: false, error: 'Tipo de ticket inválido.' };
    }

    const motivo = typeof b.motivo === 'string' ? b.motivo.trim() : '';
    if (!motivo) {
        return { valido: false, error: 'El motivo es obligatorio.' };
    }
    if (motivo.length > MAX_MOTIVO_LENGTH) {
        return { valido: false, error: `El motivo no puede superar los ${MAX_MOTIVO_LENGTH} caracteres.` };
    }

    if (!Array.isArray(b.componentes)) {
        return { valido: false, error: 'Datos inválidos.' };
    }

    const vistos = new Set<number>();
    const componentes: TicketComponenteInput[] = [];
    for (const raw of b.componentes) {
        if (typeof raw !== 'object' || raw === null) {
            return { valido: false, error: 'Datos inválidos.' };
        }
        const r = raw as Record<string, unknown>;
        const componenteId = Number(r.componenteId);
        const cantidad = Number(r.cantidad);

        if (!Number.isInteger(componenteId) || !componentesValidos.includes(componenteId)) {
            return { valido: false, error: 'Componente inválido.' };
        }
        if (vistos.has(componenteId)) {
            return { valido: false, error: 'Componente duplicado.' };
        }
        vistos.add(componenteId);

        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            return { valido: false, error: 'La cantidad debe ser un número entero mayor a 0.' };
        }

        componentes.push({ componenteId, cantidad });
    }

    return { valido: true, datos: { tipoId, motivo, componentes } };
}
