// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getTokenMock = vi.fn<() => string | null>(() => null);
vi.mock('./storageService.js', () => ({
    StorageService: {
        getToken: () => getTokenMock(),
        clear: vi.fn(),
    },
}));

import { apiClient } from './apiClient.js';

describe('apiClient', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        getTokenMock.mockReturnValue(null);
        // @ts-expect-error -- test override of a read-only global
        delete window.location;
        // @ts-expect-error -- minimal stub, only `href` is exercised
        window.location = { href: '' };
    });

    afterEach(() => {
        // @ts-expect-error -- test restore of window.location
        window.location = originalLocation;
        vi.restoreAllMocks();
    });

    it('sends a GET with no Authorization header when there is no token', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ hello: 'world' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await apiClient.get<{ hello: string }>('/ping');

        expect(result).toEqual({ hello: 'world' });
        const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
    });

    it('attaches Authorization when a token is present', async () => {
        getTokenMock.mockReturnValue('abc123');
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({}),
        });
        vi.stubGlobal('fetch', fetchMock);

        await apiClient.get('/ping');

        const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer abc123');
    });

    it('redirects to /login on a 401 response', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
        vi.stubGlobal('fetch', fetchMock);

        await expect(apiClient.get('/private')).rejects.toThrow();
        expect(window.location.href).toBe('/login?expired=true');
    });

    it('throws the server-provided error message on a non-401 failure', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: 'Datos inválidos' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await expect(apiClient.post('/thing', {})).rejects.toThrow('Datos inválidos');
    });

    it('returns undefined for a 204 No Content response', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
        vi.stubGlobal('fetch', fetchMock);

        const result = await apiClient.delete('/thing/1');
        expect(result).toBeUndefined();
    });
});
