import type { CSSProperties } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth.js';
import { useDialog } from '../../context/DialogContext.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';
import { LayoutDashboard, LogOut, Globe, Image, ListChecks, Ticket, Info } from 'lucide-react';

const APP_NAME = 'Exhibiciones';
const APP_DESC = 'Grupo Sole';

export interface SidebarProps {
    className?: string;
    isExpanded: boolean;
    // Se llama al hacer click en cualquier link de navegación — MainLayout
    // lo usa para cerrar el drawer en mobile. En desktop es un no-op inocuo
    // (sidebarOpen ya es false ahí, cerrarlo "de nuevo" no hace nada visible).
    onNavigate?: () => void;
}

const ICON_ACTIVE = 'flex items-center justify-center w-9 h-9 mx-auto rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-300';
const ICON_INACTIVE = 'flex items-center justify-center w-9 h-9 mx-auto rounded-xl text-cb-text-secondary hover:bg-primary/10 hover:text-primary transition-all duration-300 cursor-pointer';

export function Sidebar({ className, isExpanded, onNavigate }: SidebarProps) {
    const { user, logout } = useAuth();
    const { confirm } = useDialog();
    const location = useLocation();
    const { t, i18n } = useTranslation();

    const toggleLanguage = () => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');

    const handleLogout = async () => {
        const ok = await confirm({
            title: t('auth.logout_confirm_title'),
            message: t('auth.logout_confirm_message'),
            variant: 'danger',
            confirmLabel: t('common.logout'),
        });
        if (ok) logout();
    };

    const menuItems = [
        { path: '/dashboard', name: t('nav.dashboard'), icon: LayoutDashboard },
        { path: '/exhibiciones', name: t('nav.exhibiciones'), icon: Image },
        { path: '/checklist', name: t('nav.checklist'), icon: ListChecks },
        { path: '/tickets', name: t('nav.tickets'), icon: Ticket },
        { path: '/informacion', name: t('nav.informacion'), icon: Info },
        // TODO (sub-proyectos futuros): agrega los items de menú de cada módulo real aquí
    ];

    const userInitial = (user?.full_name || user?.username || '?').trim().charAt(0).toUpperCase();
    const isProfileActive = location.pathname === '/perfil';

    return (
        <div className={cn(SIATC_THEME.LAYOUT.SIDEBAR_INNER, className)}>
            <div className={cn(
                'border-b border-border/50 bg-gradient-to-br from-primary/5 to-transparent transition-all duration-300',
                isExpanded ? 'p-4 gap-3 flex items-center' : 'px-1 py-4 flex flex-col items-center gap-2'
            )}>
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 text-primary-foreground font-black text-sm">
                    S
                </div>
                <div className={cn(
                    'flex flex-col min-w-0 overflow-hidden transition-all duration-300',
                    isExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0 pointer-events-none'
                )}>
                    <h1 className="font-bold text-base leading-none tracking-tight text-foreground uppercase truncate">{APP_NAME}</h1>
                    <p className="text-[9px] font-black text-primary tracking-[0.05em] uppercase mt-1 opacity-70">{APP_DESC}</p>
                </div>
            </div>

            <nav className={cn('flex-1 overflow-y-auto custom-scrollbar transition-all duration-300', isExpanded ? 'px-3 py-6 space-y-1.5' : 'px-1 py-4 space-y-2')}>
                {isExpanded && (
                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] px-4 py-2 uppercase opacity-40">
                        {t('nav.main_menu')}
                    </p>
                )}
                {menuItems.map((item, i) => {
                    // No solo el match exacto — un módulo con vistas de
                    // detalle (ej. /exhibiciones/:id) debe seguir resaltando
                    // su item de menú padre (/exhibiciones), no solo cuando
                    // el pathname es idéntico.
                    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                    const Icon = item.icon;
                    // Stagger de entrada — solo se ve una vez, al montar el
                    // sidebar (no en cada navegación, no en cada click).
                    const style = { '--enter-delay': `${i * 40}ms` } as CSSProperties;
                    if (!isExpanded) {
                        return (
                            <NavLink key={item.path} to={item.path} title={item.name} viewTransition style={style} onClick={onNavigate} className={cn(isActive ? ICON_ACTIVE : ICON_INACTIVE, 'enter-fade-up')}>
                                <Icon className="w-5 h-5 shrink-0" />
                            </NavLink>
                        );
                    }
                    return (
                        <NavLink key={item.path} to={item.path} viewTransition style={style} onClick={onNavigate} className={cn(isActive ? SIATC_THEME.LAYOUT.SIDEBAR_ITEM_ACTIVE : SIATC_THEME.LAYOUT.SIDEBAR_ITEM_INACTIVE, 'enter-fade-up')}>
                            <div className="flex items-center gap-3 relative z-10">
                                <Icon className="w-5 h-5 shrink-0" />
                                <span className="tracking-tight">{item.name}</span>
                            </div>
                        </NavLink>
                    );
                })}
            </nav>

            <div className={cn('border-t border-border/50 shrink-0 transition-all duration-300', isExpanded ? 'p-3' : 'p-2 flex justify-center')}>
                {isExpanded ? (
                    <NavLink
                        to="/perfil"
                        viewTransition
                        onClick={onNavigate}
                        className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors duration-200',
                            isProfileActive ? 'bg-primary/10' : 'hover:bg-muted'
                        )}
                    >
                        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 text-primary-foreground font-black text-sm">
                            {userInitial}
                        </div>
                        <div className="min-w-0 text-left">
                            <p className="text-xs font-bold text-cb-text-primary truncate">{user?.full_name || user?.username}</p>
                            <p className="text-[10px] text-cb-text-secondary truncate">{user?.role_name}</p>
                        </div>
                    </NavLink>
                ) : (
                    <NavLink
                        to="/perfil"
                        title={user?.full_name || user?.username}
                        viewTransition
                        onClick={onNavigate}
                        className={cn(
                            'flex items-center justify-center w-9 h-9 mx-auto rounded-xl bg-primary text-primary-foreground font-black text-xs shrink-0 transition-shadow duration-200',
                            isProfileActive && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-cb-bg'
                        )}
                    >
                        {userInitial}
                    </NavLink>
                )}
            </div>

            <div className={cn('border-t border-border/50 bg-muted/20 shrink-0 transition-all duration-300', isExpanded ? 'p-4 space-y-2' : 'p-2 flex flex-col items-center gap-2')}>
                {isExpanded ? (
                    <>
                        <button type="button" onClick={toggleLanguage} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white rounded-2xl transition-[color,background-color] duration-150 active:scale-[0.97] cursor-pointer">
                            <Globe className="w-4 h-4 text-primary" />
                            <span className="uppercase tracking-widest">{t('nav.current_language')}</span>
                        </button>
                        <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-2xl transition-[background-color] duration-150 active:scale-[0.97] uppercase tracking-[0.2em] cursor-pointer">
                            <LogOut className="w-4 h-4" />
                            {t('common.logout')}
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={toggleLanguage} title={t('nav.change_language')} className="flex items-center justify-center w-9 h-9 mx-auto rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary transition-[color,background-color] duration-150 active:scale-[0.97] cursor-pointer">
                            <Globe className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={handleLogout} title={t('common.logout')} className="flex items-center justify-center w-9 h-9 mx-auto rounded-xl text-rose-500 hover:bg-rose-50 transition-[background-color] duration-150 active:scale-[0.97] cursor-pointer">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default Sidebar;
