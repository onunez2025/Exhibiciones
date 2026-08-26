import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { MobileMenuButton } from '../components/layout/MobileMenuButton.js';

export function DashboardPage() {
    const { user } = useAuth();
    const { t } = useTranslation();

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    <MobileMenuButton />
                    <div>
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('dashboard.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('dashboard.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="flex-1 flex items-center justify-center p-16 text-center">
                    <div className="max-w-sm space-y-2">
                        <h2 className="text-lg font-bold text-cb-text-primary">
                            {t('dashboard.welcome', { name: user?.full_name?.split(' ')[0] || user?.username })}
                        </h2>
                        <p className="text-sm text-cb-text-secondary">
                            {user?.role_name}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
