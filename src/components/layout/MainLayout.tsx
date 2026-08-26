import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth.js';
import { Sidebar } from './Sidebar.js';
import { cn } from '../../utils/cn.js';
import { X } from 'lucide-react';
import type { LayoutOutletContext } from './MobileMenuButton.js';

const EXPANDED_WIDTH = '280px';
const COLLAPSED_WIDTH = '72px';
const COLLAPSED_KEY = 'exh_sidebar_collapsed';

export const MainLayout: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false); // mobile only
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
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
            <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center items-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-sm font-bold text-cb-text-secondary uppercase tracking-widest animate-pulse">{t('common.loading')}</p>
            </div>
        );
    }

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return (
        <div className="h-screen bg-[#F8FAFC] text-foreground flex overflow-hidden">
            <div
                className={cn('fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md lg:hidden transition-opacity duration-300 ease-out', sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')}
                onClick={() => setSidebarOpen(false)}
            />

            <div className="hidden lg:block shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]" style={{ width: spacerWidth }} />

            <aside
                className={cn('fixed inset-y-0 left-0 z-[70] transition-[transform,width] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]', sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}
                style={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
            >
                <button
                    type="button"
                    onClick={handleToggle}
                    className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-20 h-10 w-5 rounded-r-xl bg-white/90 backdrop-blur-sm border border-l-0 border-border/40 shadow-[2px_0_8px_rgba(0,0,0,0.08)] items-center justify-center text-muted-foreground hover:text-primary transition-colors duration-150 active:scale-90 cursor-pointer"
                >
                    {isExpanded ? '‹' : '›'}
                </button>

                <div className="h-full p-4">
                    <div className="h-full flex flex-col overflow-hidden relative border border-white shadow-2xl rounded-[2.5rem] bg-cb-bg">
                        <button type="button" onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 z-10 p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-colors duration-150 active:scale-90 cursor-pointer lg:hidden">
                            <X className="w-6 h-6" />
                        </button>
                        <Sidebar className="flex-1" isExpanded={isExpanded} onNavigate={() => setSidebarOpen(false)} />
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative lg:pr-4 lg:pb-4">
                {/* Sin barra fija propia — el botón de menú vive junto al
                    título de cada página (ver MobileMenuButton), así en
                    mobile quedan en la misma fila en vez de uno arriba del
                    otro. openMobileMenu llega a las páginas vía el contexto
                    del Outlet, no por una prop-drilling manual por cada ruta. */}
                <main className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar px-4 lg:px-8 pt-4 lg:pt-8 pb-6">
                    <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col min-h-0">
                        <Outlet context={{ openMobileMenu: () => setSidebarOpen(true) } satisfies LayoutOutletContext} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
