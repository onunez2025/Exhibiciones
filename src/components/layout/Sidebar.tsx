import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth.js';
import { useDialog } from '../../context/DialogContext.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';
import { LayoutDashboard, LogOut, Globe } from 'lucide-react';

const APP_NAME = 'Exhibiciones';
const APP_DESC = 'Grupo Sole';

export interface SidebarProps {
    className?: string;
    isExpanded: boolean;
}

const ICON_ACTIVE = 'flex items-center justify-center w-9 h-9 mx-auto rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-300';
const ICON_INACTIVE = 'flex items-center justify-center w-9 h-9 mx-auto rounded-xl text-cb-text-secondary hover:bg-primary/10 hover:text-primary transition-all duration-300 cursor-pointer';

export function Sidebar({ className, isExpanded }: SidebarProps) {
    const { logout } = useAuth();
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

    // TODO (sub-proyectos futuros): agrega los items de menú de cada módulo aquí
    const menuItems = [
        { path: '/dashboard', name: t('nav.dashboard'), icon: LayoutDashboard },
    ];

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
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    if (!isExpanded) {
                        return (
                            <NavLink key={item.path} to={item.path} title={item.name} className={isActive ? ICON_ACTIVE : ICON_INACTIVE}>
                                <Icon className="w-5 h-5 shrink-0" />
                            </NavLink>
                        );
                    }
                    return (
                        <NavLink key={item.path} to={item.path} className={isActive ? SIATC_THEME.LAYOUT.SIDEBAR_ITEM_ACTIVE : SIATC_THEME.LAYOUT.SIDEBAR_ITEM_INACTIVE}>
                            <div className="flex items-center gap-3 relative z-10">
                                <Icon className="w-5 h-5 shrink-0" />
                                <span className="tracking-tight">{item.name}</span>
                            </div>
                        </NavLink>
                    );
                })}
            </nav>

            <div className={cn('border-t border-border/50 bg-muted/20 shrink-0 transition-all duration-300', isExpanded ? 'p-4 space-y-2' : 'p-2 flex flex-col items-center gap-2')}>
                {isExpanded ? (
                    <>
                        <button type="button" onClick={toggleLanguage} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-white/5 rounded-2xl transition-all cursor-pointer">
                            <Globe className="w-4 h-4 text-primary" />
                            <span className="uppercase tracking-widest">{t('nav.current_language')}</span>
                        </button>
                        <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl transition-all uppercase tracking-[0.2em] cursor-pointer">
                            <LogOut className="w-4 h-4" />
                            {t('common.logout')}
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={toggleLanguage} title={t('nav.change_language')} className="flex items-center justify-center w-9 h-9 mx-auto rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all cursor-pointer">
                            <Globe className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={handleLogout} title={t('common.logout')} className="flex items-center justify-center w-9 h-9 mx-auto rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default Sidebar;
