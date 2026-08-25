import { StorageService } from './storageService.js';

const API_BASE_URL =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (import.meta.env.PROD ? '' : 'http://localhost:3000') + '/api';

async function request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    customHeaders?: Record<string, string>
): Promise<T> {
    const token = StorageService.getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...customHeaders,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'include',
    });

    if (response.status === 401) {
        StorageService.clear();
        window.location.href = '/login?expired=true';
        throw new Error('Session expired');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}

export const apiClient = {
    get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
        return request<T>('GET', endpoint, undefined, headers);
    },
    post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
        return request<T>('POST', endpoint, body, headers);
    },
    put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
        return request<T>('PUT', endpoint, body, headers);
    },
    delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
        return request<T>('DELETE', endpoint, undefined, headers);
    },
    patch<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
        return request<T>('PATCH', endpoint, body, headers);
    },
};
