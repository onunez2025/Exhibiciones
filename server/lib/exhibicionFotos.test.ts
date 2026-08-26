import { describe, it, expect } from 'vitest';
import { buildFotoUrl } from './exhibicionFotos.js';

describe('buildFotoUrl', () => {
    it('joins container URL, filename, and SAS token', () => {
        const url = buildFotoUrl(
            'https://soleblob1.blob.core.windows.net/exhibiciones',
            'sp=r&se=2027-01-01T00:00:00Z&sig=abc',
            'ddd35740-30c2-4fa5-970e-c0a28a89d92d.jpg'
        );
        expect(url).toBe(
            'https://soleblob1.blob.core.windows.net/exhibiciones/ddd35740-30c2-4fa5-970e-c0a28a89d92d.jpg?sp=r&se=2027-01-01T00:00:00Z&sig=abc'
        );
    });

    it('strips a trailing slash from the container URL', () => {
        const url = buildFotoUrl('https://acc.blob.core.windows.net/cont/', 'sig=abc', 'a.jpg');
        expect(url).toBe('https://acc.blob.core.windows.net/cont/a.jpg?sig=abc');
    });

    it('strips a leading "?" from the SAS token if present', () => {
        const url = buildFotoUrl('https://acc.blob.core.windows.net/cont', '?sig=abc', 'a.jpg');
        expect(url).toBe('https://acc.blob.core.windows.net/cont/a.jpg?sig=abc');
    });

    it('omits the "?" entirely when the SAS token is empty (local/dev without one configured)', () => {
        const url = buildFotoUrl('https://acc.blob.core.windows.net/cont', '', 'a.jpg');
        expect(url).toBe('https://acc.blob.core.windows.net/cont/a.jpg');
    });

    it('URL-encodes special characters in the filename', () => {
        const url = buildFotoUrl('https://acc.blob.core.windows.net/cont', 'sig=abc', 'foto con espacio.jpg');
        expect(url).toBe('https://acc.blob.core.windows.net/cont/foto%20con%20espacio.jpg?sig=abc');
    });
});
