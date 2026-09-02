import { useState, useEffect } from 'react';
import { Shield, Save, Loader2, Info, Users, Sparkles } from 'lucide-react';
import type { RolItem, PermisoItem } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';
import { apiClient } from '../../services/apiClient.js';

interface MatrizPermisosProps {
    roles: RolItem[];
    permisos: PermisoItem[];
}

export function MatrizPermisos({ roles, permisos }: MatrizPermisosProps) {
    const [selectedRolId, setSelectedRolId] = useState<number>(roles[0]?.id || 1);
    const [selectedPermisoIds, setSelectedPermisoIds] = useState<number[]>([]);
    const [loadingPermisos, setLoadingPermisos] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

    const selectedRol = roles.find(r => r.id === selectedRolId);
    const isAdmin = (selectedRol?.nombre || '').toLowerCase() === 'administrador';

    // Cargar permisos del rol seleccionado
    useEffect(() => {
        if (!selectedRolId) return;
        setSaveMessage(null);
        setLoadingPermisos(true);

        apiClient.get<number[]>(`/roles/${selectedRolId}/permisos`)
            .then(data => {
                setSelectedPermisoIds(data || []);
            })
            .catch(err => {
                console.error('[MatrizPermisos] Error loading permissions:', err);
                setSelectedPermisoIds([]);
            })
            .finally(() => setLoadingPermisos(false));
    }, [selectedRolId]);

    // Agrupar permisos por módulo
    const modulos = Array.from(new Set(permisos.map(p => p.modulo)));

    const handleTogglePermiso = (id: number) => {
        if (isAdmin) return;
        setSelectedPermisoIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (modulo: string) => {
        if (isAdmin) return;
        const moduloIds = permisos.filter(p => p.modulo === modulo).map(p => p.id);
        setSelectedPermisoIds(prev => Array.from(new Set([...prev, ...moduloIds])));
    };

    const handleDeselectAll = (modulo: string) => {
        if (isAdmin) return;
        const moduloIds = new Set(permisos.filter(p => p.modulo === modulo).map(p => p.id));
        setSelectedPermisoIds(prev => prev.filter(id => !moduloIds.has(id)));
    };

    const handleSave = async () => {
        if (isAdmin) return;
        setSaving(true);
        setSaveMessage(null);
        try {
            await apiClient.put(`/roles/${selectedRolId}/permisos`, {
                permisoIds: selectedPermisoIds,
            });
            setSaveMessage({ text: 'Matriz de permisos actualizada correctamente.', type: 'ok' });
            setTimeout(() => setSaveMessage(null), 4000);
        } catch (err: unknown) {
            console.error('[MatrizPermisos] Save error:', err);
            setSaveMessage({ text: 'No se pudo guardar la matriz de permisos.', type: 'err' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Selector de Roles */}
            <div className="space-y-2">
                <label className="text-xs font-black text-cb-text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-primary" />
                    Selecciona un Rol para configurar sus accesos:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {roles.map(r => {
                        const isSelected = r.id === selectedRolId;
                        return (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => setSelectedRolId(r.id)}
                                className={cn(
                                    'p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[72px]',
                                    isSelected
                                        ? 'bg-card border-primary text-primary shadow-cb-level-1 ring-2 ring-primary/15'
                                        : 'bg-card/60 border-cb-border text-cb-text-secondary hover:bg-card hover:text-cb-text-primary'
                                )}
                            >
                                <span className="text-xs font-bold truncate">{r.nombre}</span>
                                <div className="flex items-center gap-1 text-[10px] text-cb-text-secondary mt-1">
                                    <Users className="w-3 h-3 text-primary/70" />
                                    <span>{r.totalUsuarios} usuarios</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Panel de Descripción y Guardar */}
            {selectedRol && (
                <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-cb-text-primary">{selectedRol.nombre}</span>
                            {isAdmin && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                                    Super Admin
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-cb-text-secondary mt-0.5">{selectedRol.descripcion || 'Sin descripción'}</p>
                    </div>

                    {!isAdmin && (
                        <div className="flex items-center gap-2 shrink-0">
                            {saveMessage && (
                                <span
                                    className={cn(
                                        'text-xs font-semibold px-2.5 py-1 rounded-lg',
                                        saveMessage.type === 'ok' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                                    )}
                                >
                                    {saveMessage.text}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || loadingPermisos}
                                className={cn(SIATC_THEME.COMPONENTS.BUTTON_PRIMARY, 'cursor-pointer text-xs flex items-center gap-1.5')}
                            >
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Guardar Permisos
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Alerta Informativa si es Admin */}
            {isAdmin && (
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5 text-xs text-primary">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold">Acceso Total Irrevocable:</span> Por diseño de seguridad, el rol Administrador posee todos los permisos habilitados de forma permanente.
                    </div>
                </div>
            )}

            {/* Matriz de Permisos Agrupados por Módulo */}
            {loadingPermisos ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-cb-text-secondary">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs">Cargando permisos del rol...</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {modulos.map(modulo => {
                        const moduloPermisos = permisos.filter(p => p.modulo === modulo);
                        const todosAsignados = moduloPermisos.every(p => selectedPermisoIds.includes(p.id) || isAdmin);

                        return (
                            <div
                                key={modulo}
                                className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1 space-y-3', SIATC_THEME.TOKENS.RADIUS.CARD)}
                            >
                                {/* Cabecera del Módulo */}
                                <div className="flex items-center justify-between border-b border-cb-border/60 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                                        <h3 className="text-xs font-black text-cb-text-primary uppercase tracking-wide">
                                            Módulo: {modulo}
                                        </h3>
                                        <span className="text-[10px] font-bold text-cb-text-secondary">
                                            ({moduloPermisos.filter(p => selectedPermisoIds.includes(p.id) || isAdmin).length} de {moduloPermisos.length})
                                        </span>
                                    </div>

                                    {!isAdmin && (
                                        <div className="flex items-center gap-2 text-[10px]">
                                            <button
                                                type="button"
                                                onClick={() => (todosAsignados ? handleDeselectAll(modulo) : handleSelectAll(modulo))}
                                                className="text-primary hover:underline font-semibold cursor-pointer"
                                            >
                                                {todosAsignados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Grilla de Permisos */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {moduloPermisos.map(p => {
                                        const activo = selectedPermisoIds.includes(p.id) || isAdmin;
                                        return (
                                            <div
                                                key={p.id}
                                                onClick={() => handleTogglePermiso(p.id)}
                                                className={cn(
                                                    'p-2.5 rounded-xl border transition-all duration-150 flex items-start gap-2.5',
                                                    isAdmin ? 'cursor-default opacity-85' : 'cursor-pointer',
                                                    activo
                                                        ? 'bg-primary/5 border-primary/30 text-cb-text-primary'
                                                        : 'bg-muted/30 border-cb-border/60 text-cb-text-secondary hover:bg-muted/50'
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={activo}
                                                    disabled={isAdmin}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 rounded text-primary mt-0.5 cursor-pointer disabled:cursor-default shrink-0"
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold leading-tight text-cb-text-primary">{p.accion}</p>
                                                    {p.descripcion && (
                                                        <p className="text-[11px] text-cb-text-secondary mt-0.5 leading-snug line-clamp-2">
                                                            {p.descripcion}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default MatrizPermisos;
