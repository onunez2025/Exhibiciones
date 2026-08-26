import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { MobileMenuButton } from '../components/layout/MobileMenuButton.js';

export function PerfilPage() {
    const { t } = useTranslation();
    const { user } = useAuth();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const initial = (user?.full_name || user?.username || '?').trim().charAt(0).toUpperCase();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (newPassword.length < 6) {
            setError(t('perfil.min_length_error'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t('perfil.mismatch_error'));
            return;
        }

        setLoading(true);
        try {
            await apiClient.post('/auth/change-password', { currentPassword, newPassword });
            setSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('auth.error_generic'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    <MobileMenuButton />
                    <div>
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('perfil.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('perfil.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shrink-0 text-primary-foreground font-black text-2xl">
                            {initial}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-cb-text-primary truncate">{user?.full_name || user?.username}</h2>
                            <p className="text-sm text-cb-text-secondary truncate">{user?.role_name} · {user?.username}</p>
                        </div>
                    </div>

                    <div className="max-w-md">
                        <h3 className="text-xs font-black text-muted-foreground tracking-[0.2em] uppercase mb-4">
                            {t('perfil.change_password_title')}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="currentPassword" className="block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-2 ml-0.5">
                                    {t('perfil.current_password')}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                                        <Lock className="w-[18px] h-[18px]" />
                                    </div>
                                    <input
                                        id="currentPassword"
                                        type={showPasswords ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        autoComplete="current-password"
                                        required
                                        className="block w-full pl-11 pr-3 py-3 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-all outline-none text-sm font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="newPassword" className="block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-2 ml-0.5">
                                    {t('perfil.new_password')}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                                        <Lock className="w-[18px] h-[18px]" />
                                    </div>
                                    <input
                                        id="newPassword"
                                        type={showPasswords ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        autoComplete="new-password"
                                        required
                                        className="block w-full pl-11 pr-11 py-3 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-all outline-none text-sm font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords((v) => !v)}
                                        tabIndex={-1}
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-cb-neutral hover:text-primary transition-colors cursor-pointer"
                                        aria-label={showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                                    >
                                        {showPasswords ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-2 ml-0.5">
                                    {t('perfil.confirm_password')}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                                        <Lock className="w-[18px] h-[18px]" />
                                    </div>
                                    <input
                                        id="confirmPassword"
                                        type={showPasswords ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                        required
                                        className="block w-full pl-11 pr-3 py-3 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-all outline-none text-sm font-medium"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    {t('perfil.success')}
                                </div>
                            )}

                            <button type="submit" disabled={loading} className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full h-12'}>
                                {loading ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : t('common.save')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PerfilPage;
