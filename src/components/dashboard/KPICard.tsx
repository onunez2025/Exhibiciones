import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';

export interface KPICardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: LucideIcon;
    colorVariant?: 'primary' | 'emerald' | 'amber' | 'purple';
    onClick?: () => void;
    loading?: boolean;
}

const COLOR_MAP = {
    primary: {
        bg: 'bg-primary/10 text-primary',
        accent: 'before:bg-primary',
        subtext: 'text-primary font-semibold',
    },
    emerald: {
        bg: 'bg-emerald-500/10 text-emerald-600',
        accent: 'before:bg-emerald-500',
        subtext: 'text-emerald-600 font-semibold',
    },
    amber: {
        bg: 'bg-amber-500/10 text-amber-600',
        accent: 'before:bg-amber-500',
        subtext: 'text-amber-600 font-semibold',
    },
    purple: {
        bg: 'bg-purple-500/10 text-purple-600',
        accent: 'before:bg-purple-500',
        subtext: 'text-purple-600 font-semibold',
    },
};

export function KPICard({
    title,
    value,
    subtitle,
    icon: Icon,
    colorVariant = 'primary',
    onClick,
    loading = false,
}: KPICardProps) {
    const colors = COLOR_MAP[colorVariant];

    return (
        <div
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
            className={cn(
                'relative border border-cb-border bg-card p-4 shadow-cb-level-1',
                "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 before:rounded-l-[inherit]",
                colors.accent,
                SIATC_THEME.TOKENS.RADIUS.CARD,
                onClick && 'cursor-pointer hover:shadow-cb-level-2 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20'
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-cb-text-secondary uppercase tracking-wider truncate">
                        {title}
                    </p>
                    {loading ? (
                        <div className="h-8 w-20 bg-muted/60 rounded-md animate-pulse my-1" />
                    ) : (
                        <h3 className="text-2xl sm:text-3xl font-black text-cb-text-primary mt-1 tracking-tight">
                            {value}
                        </h3>
                    )}
                    <p className={cn('text-xs mt-1 truncate', colors.subtext)}>
                        {subtitle}
                    </p>
                </div>

                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', colors.bg)}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
        </div>
    );
}

export default KPICard;
