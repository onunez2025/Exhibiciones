import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { SIATC_THEME } from '../utils/siatc-theme.js';

export interface ComingSoonPageProps {
    titleKey: string;
    icon: LucideIcon;
}

// Placeholder reutilizable para módulos que aún no se construyen —
// evita 4 archivos casi idénticos mientras Exhibiciones/Checklist/
// Tickets/Información siguen siendo sub-proyectos futuros.
export function ComingSoonPage({ titleKey, icon: Icon }: ComingSoonPageProps) {
    const { t } = useTranslation();

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div>
                    <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t(titleKey)}</h1>
                    <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('coming_soon.subtitle')}</p>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="flex-1 flex items-center justify-center p-16 text-center">
                    <div className="max-w-sm space-y-4 flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Icon className="w-7 h-7" />
                        </div>
                        <p className="text-sm text-cb-text-secondary">{t('coming_soon.message')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ComingSoonPage;
