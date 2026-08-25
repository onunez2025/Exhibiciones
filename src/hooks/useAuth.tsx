import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { StorageService } from '../services/storageService.js';
import { apiClient } from '../services/apiClient.js';
import { resolvePermission } from '../utils/permissions.js';
import type { User } from '../types/index.js';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string, user: User) => void;
    logout: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearInactivityTimer = useCallback(() => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    }, []);

    const logout = useCallback(async () => {
        clearInactivityTimer();
        try {
            await apiClient.post('/auth/logout');
        } catch { /* best-effort — el token se borra igual del lado cliente */ }
        StorageService.clear();
        setUser(null);
        window.location.href = '/login';
    }, [clearInactivityTimer]);

    const resetInactivityTimer = useCallback(() => {
        clearInactivityTimer();
        inactivityTimer.current = setTimeout(() => {
            logout();
        }, INACTIVITY_TIMEOUT_MS);
    }, [clearInactivityTimer, logout]);

    const login = useCallback((token: string, userData: User) => {
        StorageService.setToken(token);
        StorageService.setCurrentUser(userData);
        setUser(userData);
        resetInactivityTimer();
    }, [resetInactivityTimer]);

    useEffect(() => {
        const token = StorageService.getToken();
        if (!token) {
            setIsLoading(false);
            return;
        }

        apiClient.get<{ user: User }>('/auth/me')
            .then(({ user: serverUser }) => {
                StorageService.setCurrentUser(serverUser);
                setUser(serverUser);
                resetInactivityTimer();
            })
            .catch(() => {
                StorageService.clear();
                setUser(null);
            })
            .finally(() => setIsLoading(false));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!user) return;
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
        resetInactivityTimer();
        return () => {
            events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
            clearInactivityTimer();
        };
    }, [user, resetInactivityTimer, clearInactivityTimer]);

    const hasPermission = useCallback((permission: string): boolean => {
        if (!user) return false;
        return resolvePermission(user.role_name, user.permissions, permission);
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
