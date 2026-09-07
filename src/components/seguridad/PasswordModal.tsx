import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Key, Loader2 } from 'lucide-react';
import type { UsuarioListItem } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';

interface PasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onResetPassword: (userId: number, newPassword: string) => Promise<void>;
    usuario: UsuarioListItem | null;
}

export function PasswordModal({ isOpen, onClose, onResetPassword, usuario }: PasswordModalProps) {
    const { t } = useTranslation();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setNewPassword('');
        setConfirmPassword('');
        setError('');
    }, [isOpen]);

    if (!isOpen || !usuario) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError(t('seguridad.password_error_min_length'));
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('seguridad.password_error_no_coinciden'));
            return;
        }

        setLoading(true);
        try {
            await onResetPassword(usuario.id, newPassword);
            onClose();
        } catch (err: unknown) {
            console.error('[PasswordModal] Error:', err);
            setError((err as { message?: string })?.message || t('seguridad.password_error_generico'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className={cn('bg-card border border-cb-border w-full max-w-sm overflow-hidden shadow-cb-level-3', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-cb-border">
                    <div className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-primary" />
                        <div>
                            <h2 className="text-sm font-black text-cb-text-primary">{t('seguridad.password_titulo')}</h2>
                            <p className="text-[11px] text-cb-text-secondary">{t('seguridad.password_para_usuario', { username: usuario.username })}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-cb-text-secondary hover:text-cb-text-primary p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
                    {error && (
                        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-cb-text-secondary mb-1">{t('seguridad.campo_password_nueva')}</label>
                        <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder={t('seguridad.campo_password_nueva_placeholder')}
                            className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-cb-text-secondary mb-1">{t('seguridad.campo_password_confirmar')}</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t('seguridad.campo_password_confirmar_placeholder')}
                            className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-cb-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-xl border border-cb-border text-xs font-medium text-cb-text-secondary hover:bg-muted transition-colors cursor-pointer"
                        >
                            {t('seguridad.accion_cancelar')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(SIATC_THEME.COMPONENTS.BUTTON_PRIMARY, 'cursor-pointer text-xs flex items-center gap-1.5')}
                        >
                            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {t('seguridad.accion_actualizar_password')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PasswordModal;
