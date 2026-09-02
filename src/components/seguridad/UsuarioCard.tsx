import { Mail, Phone, MapPin, Edit, Key, Check, X, Clock } from 'lucide-react';
import type { UsuarioListItem } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';

interface UsuarioCardProps {
    usuario: UsuarioListItem;
    onEdit: (usuario: UsuarioListItem) => void;
    onChangePassword: (usuario: UsuarioListItem) => void;
    onToggleActivo: (usuario: UsuarioListItem) => void;
}

function getRolBadgeStyle(rolNombre: string | null) {
    const rol = (rolNombre || '').toLowerCase();
    if (rol.includes('admin')) return 'bg-red-500/10 text-red-600 border-red-500/20';
    if (rol.includes('trade')) return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    if (rol.includes('supervis')) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    if (rol.includes('ejecutiv')) return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'; // Promotoría
}

export function UsuarioCard({ usuario, onEdit, onChangePassword, onToggleActivo }: UsuarioCardProps) {

    const ultimoLoginTexto = usuario.ultimoLogin
        ? new Date(usuario.ultimoLogin).toLocaleDateString('es-PE', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
          })
        : 'Nunca';

    return (
        <div
            className={cn(
                'relative border border-cb-border bg-card px-4 py-3 shadow-cb-level-1 transition-all duration-200',
                !usuario.activo && 'opacity-60 bg-muted/30',
                SIATC_THEME.TOKENS.RADIUS.CARD
            )}
        >
            {/* Fila 1: Avatar + Usuario/Nombre (izq) y Rol + Estado (der) */}
            <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {usuario.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-primary truncate">@{usuario.username}</span>
                        </div>
                        <p className="text-xs font-semibold text-cb-text-primary truncate">{usuario.fullName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', getRolBadgeStyle(usuario.rolNombre))}>
                        {usuario.rolNombre || 'Sin rol'}
                    </span>
                    <span
                        className={cn(
                            'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1',
                            usuario.activo
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-600 border-red-500/20'
                        )}
                    >
                        {usuario.activo ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
            </div>

            {/* Fila 2: Detalles (Email, Celular, Zona, Último Login) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 pl-10 text-[11px] text-cb-text-secondary border-t border-cb-border/40 pt-2">
                <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 text-primary/70 shrink-0" />
                    <span className="truncate">{usuario.email || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3 h-3 text-primary/70 shrink-0" />
                    <span className="truncate">{usuario.celular || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3 h-3 text-primary/70 shrink-0" />
                    <span className="truncate">{usuario.zona || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                    <Clock className="w-3 h-3 text-primary/70 shrink-0" />
                    <span className="truncate" title={`Último login: ${ultimoLoginTexto}`}>
                        {ultimoLoginTexto}
                    </span>
                </div>
            </div>

            {/* Fila 3: Botones de Acción */}
            <div className="flex items-center justify-end gap-1.5 mt-2 border-t border-cb-border/40 pt-2">
                <button
                    type="button"
                    onClick={() => onToggleActivo(usuario)}
                    className={cn(
                        'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1',
                        usuario.activo
                            ? 'text-red-600 hover:bg-red-500/10'
                            : 'text-emerald-600 hover:bg-emerald-500/10'
                    )}
                >
                    {usuario.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button
                    type="button"
                    onClick={() => onChangePassword(usuario)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-cb-text-secondary hover:text-primary hover:bg-muted transition-colors cursor-pointer flex items-center gap-1"
                >
                    <Key className="w-3 h-3" />
                    Contraseña
                </button>
                <button
                    type="button"
                    onClick={() => onEdit(usuario)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-1"
                >
                    <Edit className="w-3 h-3" />
                    Editar
                </button>
            </div>
        </div>
    );
}

export default UsuarioCard;
