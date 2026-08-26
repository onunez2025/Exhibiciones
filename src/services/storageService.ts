import type { User } from '../types/index.js';

const PREFIX = 'exh_';

export const StorageService = {
    set(key: string, value: unknown): void {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch { /* quota exceeded — ignore */ }
    },

    get<T>(key: string): T | null {
        try {
            const item = localStorage.getItem(PREFIX + key);
            return item ? (JSON.parse(item) as T) : null;
        } catch {
            return null;
        }
    },

    remove(key: string): void {
        localStorage.removeItem(PREFIX + key);
    },

    clear(): void {
        Object.keys(localStorage)
            .filter(k => k.startsWith(PREFIX))
            .forEach(k => localStorage.removeItem(k));
    },

    getToken(): string | null {
        return this.get<string>('token');
    },

    setToken(token: string): void {
        this.set('token', token);
    },

    getCurrentUser(): User | null {
        return this.get<User>('user');
    },

    setCurrentUser(user: User): void {
        this.set('user', user);
    },
};
