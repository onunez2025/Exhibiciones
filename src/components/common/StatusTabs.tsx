import { cn } from '../../utils/cn.js';

export interface StatusTabOption<T extends string | number> {
    id: T;
    label: string;
    badgeCount?: number;
}

export interface StatusTabsProps<T extends string | number> {
    tabs: StatusTabOption<T>[];
    activeTab: T;
    onChange: (tabId: T) => void;
}

export function StatusTabs<T extends string | number>({
    tabs,
    activeTab,
    onChange,
}: StatusTabsProps<T>) {
    return (
        <div className="overflow-x-auto custom-scrollbar -mx-1 px-1 py-1">
            <div className="inline-flex items-center gap-1 p-1 bg-muted/60 border border-cb-border rounded-xl min-w-full sm:min-w-0">
                {tabs.map(tab => {
                    const isActive = tab.id === activeTab;
                    return (
                        <button
                            key={String(tab.id)}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer whitespace-nowrap flex-1 sm:flex-initial justify-center',
                                isActive
                                    ? 'bg-card text-primary font-bold shadow-xs border border-cb-border/60'
                                    : 'text-cb-text-secondary font-medium hover:text-cb-text-primary hover:bg-card/40'
                            )}
                        >
                            <span>{tab.label}</span>
                            {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                                <span className={cn(
                                    'text-[10px] font-black px-1.5 py-0.2 rounded-full',
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-muted text-cb-text-secondary'
                                )}>
                                    {tab.badgeCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default StatusTabs;
