import { describe, it, expect } from 'vitest';
import { decodificarFotoBase64 } from './blobUpload.js';

// Un PNG mínimo válido en base64 (1x1 px transparente) — suficientemente
// real para probar la ruta feliz sin depender de un archivo externo.
const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('decodificarFotoBase64', () => {
    it('decodes a valid PNG and maps the extension', () => {
        const result = decodificarFotoBase64(PNG_1X1_BASE64, 'image/png', 1024 * 1024);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.foto.extension).toBe('.png');
            expect(result.foto.buffer.length).toBeGreaterThan(0);
        }
    });

    it('maps image/jpeg to .jpg and image/webp to .webp', () => {
        const jpeg = decodificarFotoBase64(PNG_1X1_BASE64, 'image/jpeg', 1024 * 1024);
        const webp = decodificarFotoBase64(PNG_1X1_BASE64, 'image/webp', 1024 * 1024);
        expect(jpeg.ok && jpeg.foto.extension).toBe('.jpg');
        expect(webp.ok && webp.foto.extension).toBe('.webp');
    });

    it('rejects an unsupported content type', () => {
        const result = decodificarFotoBase64(PNG_1X1_BASE64, 'application/pdf', 1024 * 1024);
        expect(result).toEqual({ ok: false, error: 'Formato de imagen no soportado.' });
    });

    it('rejects an empty base64 string', () => {
        const result = decodificarFotoBase64('', 'image/png', 1024 * 1024);
        expect(result).toEqual({ ok: false, error: 'No se recibió ningún archivo.' });
    });

    it('rejects a decoded buffer larger than maxBytes', () => {
        const result = decodificarFotoBase64(PNG_1X1_BASE64, 'image/png', 10);
        expect(result).toEqual({ ok: false, error: 'La foto es demasiado grande (máximo 8MB).' });
    });
});
