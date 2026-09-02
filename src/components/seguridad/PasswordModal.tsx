import { useState, useEffect } from 'react';
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
            setError('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            await onResetPassword(usuario.id, newPassword);
            onClose();
        } catch (err: unknown) {
            console.error('[PasswordModal] Error:', err);
            setError((err as { message?: string })?.message || 'No se pudo cambiar la contraseña.');
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
                            <h2 className="text-sm font-black text-cb-text-primary">Resetear Contraseña</h2>
                            <p className="text-[11px] text-cb-text-secondary">Para @{usuario.username}</p>
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
                        <label className="block text-xs font-bold text-cb-text-secondary mb-1">Nueva Contraseña</label>
                        <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-cb-text-secondary mb-1">Confirmar Contraseña</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repite la nueva contraseña"
                            className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-cb-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-xl border border-cb-border text-xs font-medium text-cb-text-secondary hover:bg-muted transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(SIATC_THEME.COMPONENTS.BUTTON_PRIMARY, 'cursor-pointer text-xs flex items-center gap-1.5')}
                        >
                            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Actualizar Contraseña
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PasswordModal;
