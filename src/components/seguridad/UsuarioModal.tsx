import { useState, useEffect } from 'react';
import { X, Loader2, UserPlus, UserCheck } from 'lucide-react';
import type { UsuarioListItem, RolItem, UsuarioCrearPayload, UsuarioEditarPayload } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';

interface UsuarioModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (payload: UsuarioCrearPayload | UsuarioEditarPayload, isEdit: boolean) => Promise<void>;
    usuarioToEdit?: UsuarioListItem | null;
    roles: RolItem[];
}

export function UsuarioModal({ isOpen, onClose, onSave, usuarioToEdit, roles }: UsuarioModalProps) {
    const isEdit = !!usuarioToEdit;

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [celular, setCelular] = useState('');
    const [rolId, setRolId] = useState<number>(1);
    const [zona, setZona] = useState('LIMA');
    const [activo, setActivo] = useState(true);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (usuarioToEdit) {
            setUsername(usuarioToEdit.username);
            setFullName(usuarioToEdit.fullName);
            setEmail(usuarioToEdit.email || '');
            setCelular(usuarioToEdit.celular || '');
            setRolId(usuarioToEdit.rolId);
            setZona(usuarioToEdit.zona || 'LIMA');
            setActivo(usuarioToEdit.activo);
            setPassword('');
        } else {
            setUsername('');
            setPassword('');
            setFullName('');
            setEmail('');
            setCelular('');
            setRolId(roles[0]?.id || 1);
            setZona('LIMA');
            setActivo(true);
        }
        setError('');
    }, [usuarioToEdit, roles, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!fullName.trim()) {
            setError('El nombre completo es requerido.');
            return;
        }

        if (!isEdit) {
            if (!username.trim() || username.length < 3) {
                setError('El usuario debe tener al menos 3 caracteres.');
                return;
            }
            if (!password || password.length < 6) {
                setError('La contraseña debe tener al menos 6 caracteres.');
                return;
            }
        }

        setLoading(true);
        try {
            if (isEdit) {
                await onSave({
                    fullName: fullName.trim(),
                    email: email.trim() || undefined,
                    celular: celular.trim() || undefined,
                    rolId,
                    zona: zona.trim() || undefined,
                    activo,
                }, true);
            } else {
                await onSave({
                    username: username.trim().toLowerCase(),
                    password,
                    fullName: fullName.trim(),
                    email: email.trim() || undefined,
                    celular: celular.trim() || undefined,
                    rolId,
                    zona: zona.trim() || undefined,
                }, false);
            }
            onClose();
        } catch (err: unknown) {
            console.error('[UsuarioModal] Error saving:', err);
            setError((err as { message?: string })?.message || 'Error al guardar el usuario.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className={cn('bg-card border border-cb-border w-full max-w-md overflow-hidden shadow-cb-level-3 flex flex-col max-h-[90vh]', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-cb-border">
                    <div className="flex items-center gap-2">
                        {isEdit ? <UserCheck className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
                        <h2 className="text-sm font-black text-cb-text-primary">
                            {isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-cb-text-secondary hover:text-cb-text-primary p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
                    {error && (
                        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    {!isEdit && (
                        <div>
                            <label className="block text-xs font-bold text-cb-text-secondary mb-1">Usuario (@login) *</label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="ej. jpromotor"
                                className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary"
                            />
                        </div>
                    )}

                    {!isEdit && (
                        <div>
                            <label className="block text-xs font-bold text-cb-text-secondary mb-1">Contraseña Inicial *</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-cb-text-secondary mb-1">Nombre Completo *</label>
                        <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="ej. Juan Pérez Alva"
                            className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-cb-text-secondary mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="usuario@sole.com.pe"
                                className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-cb-text-secondary mb-1">Celular</label>
                            <input
                                type="tel"
                                value={celular}
                                onChange={(e) => setCelular(e.target.value)}
                                placeholder="999 999 999"
                                className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-cb-text-secondary mb-1">Rol en el Sistema *</label>
                            <select
                                value={rolId}
                                onChange={(e) => setRolId(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary cursor-pointer"
                            >
                                {roles.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-cb-text-secondary mb-1">Zona Geográfica</label>
                            <select
                                value={zona}
                                onChange={(e) => setZona(e.target.value)}
                                className="w-full px-3 py-2 bg-muted/30 border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none focus:border-primary cursor-pointer"
                            >
                                <option value="LIMA">Lima Metropolitana</option>
                                <option value="NORTE">Zona Norte</option>
                                <option value="SUR">Zona Sur</option>
                                <option value="CENTRO">Zona Centro</option>
                                <option value="ORIENTE">Zona Oriente</option>
                                <option value="NACIONAL">Nacional</option>
                            </select>
                        </div>
                    </div>

                    {isEdit && (
                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="checkActivo"
                                checked={activo}
                                onChange={(e) => setActivo(e.target.checked)}
                                className="w-4 h-4 rounded text-primary focus:ring-primary/20 cursor-pointer"
                            />
                            <label htmlFor="checkActivo" className="text-xs font-medium text-cb-text-primary cursor-pointer">
                                Usuario Activo (Permitir acceso a la plataforma)
                            </label>
                        </div>
                    )}

                    {/* Footer */}
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
                            {isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default UsuarioModal;
