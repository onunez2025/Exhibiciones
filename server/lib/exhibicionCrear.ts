export interface CrearExhibicionInput {
    clienteCodigo: string;
    clienteNombre: string;
    sucursalCodigo: string;
    sucursalNombre: string;
    direccion: string | null;
    nombre: string;
    tipoId: number;
    piso: string | null;
    pisoDetalleId: number | null;
}

export type ValidacionCrear =
    | { valido: true; datos: CrearExhibicionInput }
    | { valido: false; error: string };

function stringNoVacio(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function stringOpcional(value: unknown): string | null {
    const s = stringNoVacio(value);
    return s || null;
}

// Puro — sin tocar la base de datos — para poder probarlo aislado (mismo
// patrón que exhibicionesFilter.ts). Tienda/Sucursal/Nombre/Tipo son
// obligatorios; Piso, Detalle y Dirección quedan opcionales.
export function validarExhibicionCrear(body: unknown): ValidacionCrear {
    if (typeof body !== 'object' || body === null) {
        return { valido: false, error: 'Datos inválidos.' };
    }
    const b = body as Record<string, unknown>;

    const clienteCodigo = stringNoVacio(b.clienteCodigo);
    const sucursalCodigo = stringNoVacio(b.sucursalCodigo);
    const nombre = stringNoVacio(b.nombre);
    const tipoId = Number(b.tipoId);

    if (!clienteCodigo || !sucursalCodigo) {
        return { valido: false, error: 'Selecciona una tienda y sucursal.' };
    }
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
        datos: {
            clienteCodigo,
            clienteNombre: stringNoVacio(b.clienteNombre),
            sucursalCodigo,
            sucursalNombre: stringNoVacio(b.sucursalNombre),
            direccion: stringOpcional(b.direccion),
            nombre,
            tipoId,
            piso: stringOpcional(b.piso),
            pisoDetalleId,
        },
    };
}
