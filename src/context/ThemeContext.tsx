import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        return (localStorage.getItem('exh_theme') as Theme) || 'system';
    });

    const getResolved = (t: Theme): 'light' | 'dark' => {
        if (t === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return t;
    };

    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => getResolved(theme));

    const applyTheme = (t: Theme) => {
        const resolved = getResolved(t);
        setResolvedTheme(resolved);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
    };

    useEffect(() => {
        applyTheme(theme);
        if (theme === 'system') {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = () => applyTheme('system');
            mq.addEventListener('change', handler);
            return () => mq.removeEventListener('change', handler);
        }
    }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem('exh_theme', t);
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextType {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
    return ctx;
}
