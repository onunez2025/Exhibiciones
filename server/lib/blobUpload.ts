const EXTENSION_POR_CONTENT_TYPE: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

export interface FotoDecodificada {
    buffer: Buffer;
    extension: string;
}

export type ResultadoDecodificarFoto =
    | { ok: true; foto: FotoDecodificada }
    | { ok: false; error: string };

// Decodifica y valida en un solo paso (formato soportado, no vacío, no
// demasiado grande) — puro salvo por Buffer.from (sin red, sin disco), así
// que se puede probar aislado. El mensaje de tamaño queda fijo en "8MB"
// porque hoy solo se llama con ese límite (MAX_FOTO_BYTES en la ruta).
export function decodificarFotoBase64(base64: string, contentType: string, maxBytes: number): ResultadoDecodificarFoto {
    const extension = EXTENSION_POR_CONTENT_TYPE[contentType];
    if (!extension) {
        return { ok: false, error: 'Formato de imagen no soportado.' };
    }
    if (!base64) {
        return { ok: false, error: 'No se recibió ningún archivo.' };
    }

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) {
        return { ok: false, error: 'El archivo no es una imagen válida.' };
    }
    if (buffer.length > maxBytes) {
        return { ok: false, error: 'La foto es demasiado grande (máximo 8MB).' };
    }

    return { ok: true, foto: { buffer, extension } };
}
