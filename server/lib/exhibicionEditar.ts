export interface EditarExhibicionInput {
    nombre: string;
    tipoId: number;
    piso: string | null;
    pisoDetalleId: number | null;
}

export type ValidacionEditar =
    | { valido: true; datos: EditarExhibicionInput }
    | { valido: false; error: string };

function stringNoVacio(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function stringOpcional(value: unknown): string | null {
    const s = stringNoVacio(value);
    return s || null;
}

// Puro — mismo patrón que validarExhibicionCrear, pero sin
// Tienda/Sucursal (esos campos no son editables, ver spec). Nombre y
// tipoId son obligatorios; Piso y Detalle quedan opcionales.
export function validarExhibicionEditar(body: unknown): ValidacionEditar {
    if (typeof body !== 'object' || body === null) {
        return { valido: false, error: 'Datos inválidos.' };
    }
    const b = body as Record<string, unknown>;

    const nombre = stringNoVacio(b.nombre);
    const tipoId = Number(b.tipoId);

    if (!nombre) {
        return { valido: false, error: 'El nombre de la exhibición es obligatorio.' };
    }
    if (!Number.isFinite(tipoId) || tipoId <= 0) {
        return { valido: false, error: 'Selecciona un tipo de exhibición.' };
    }

    let pisoDetalleId: number | null = null;
    if (b.pisoDetalleId !== undefined && b.pisoDetalleId !== null && b.pisoDetalleId !== '') {
        pisoDetalleId = Number(b.pisoDetalleId);
        if (!Number.isFinite(pisoDetalleId) || pisoDetalleId <= 0) {
            return { valido: false, error: 'Detalle de ubicación inválido.' };
        }
    }

    return {
        valido: true,
        datos: { nombre, tipoId, piso: stringOpcional(b.piso), pisoDetalleId },
    };
}
