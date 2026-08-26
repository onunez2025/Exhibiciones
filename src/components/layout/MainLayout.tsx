import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth.js';
import { useTheme } from '../../context/ThemeContext.js';
import { Sidebar } from './Sidebar.js';
import { cn } from '../../utils/cn.js';
import { Menu, X, Sun, Moon } from 'lucide-react';

const EXPANDED_WIDTH = '280px';
const COLLAPSED_WIDTH = '72px';
const COLLAPSED_KEY = 'exh_sidebar_collapsed';

export const MainLayout: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false); // mobile only
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
    const { theme, setTheme } = useTheme();
    const { t } = useTranslation();

    const isExpanded = sidebarOpen || !isCollapsed;
    const spacerWidth = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

    const handleToggle = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem(COLLAPSED_KEY, String(next));
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#050F1A] flex flex-col justify-center items-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-sm font-bold text-cb-text-secondary uppercase tracking-widest animate-pulse">{t('common.loading')}</p>
            </div>
        );
    }

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return (
        <div className="h-screen bg-[#F8FAFC] dark:bg-[#020617] text-foreground flex overflow-hidden">
            <div
                className={cn('fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md lg:hidden transition-all duration-500', sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')}
                onClick={() => setSidebarOpen(false)}
            />

            <div className="hidden lg:block shrink-0 transition-[width] duration-300 ease-in-out" style={{ width: spacerWidth }} />

            <aside
                className={cn('fixed inset-y-0 left-0 z-[70] transition-[transform,width] duration-300 ease-in-out', sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}
                style={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
            >
                <button
                    type="button"
                    onClick={handleToggle}
                    className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-20 h-10 w-5 rounded-r-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-l-0 border-border/40 shadow-[2px_0_8px_rgba(0,0,0,0.08)] items-center justify-center text-muted-foreground hover:text-primary transition-all duration-200 cursor-pointer"
                >
                    {isExpanded ? '‹' : '›'}
                </button>

                <div className="h-full p-4">
                    <div className="h-full flex flex-col overflow-hidden relative border border-white dark:border-white/5 shadow-2xl rounded-[2.5rem] bg-cb-bg">
                        <button type="button" onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 z-10 p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all cursor-pointer lg:hidden">
                            <X className="w-6 h-6" />
                        </button>
                        <Sidebar className="flex-1" isExpanded={isExpanded} />
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative lg:pr-4 lg:pb-4">
                <header className="h-16 lg:h-20 shrink-0 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40">
                    <button type="button" onClick={() => setSidebarOpen(true)} className="p-3 -ml-3 text-muted-foreground hover:bg-white dark:hover:bg-white/5 rounded-2xl lg:hidden shadow-sm transition-all cursor-pointer">
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="flex items-center p-1.5 gap-2 rounded-[2rem] border bg-card/80 backdrop-blur-xl border-cb-border shadow-cb-level-2">
                        <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 rounded-full transition-all cursor-pointer">
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    </div>
                </header>

                <main className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar px-4 lg:px-8 pb-6">
                    <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col min-h-0">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
