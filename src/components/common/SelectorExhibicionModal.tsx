import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Store, ChevronRight, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';
import type { Exhibicion, ExhibicionesListResponse } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';
import { getEstadoEstilo } from '../../utils/estadoExhibicion.js';

interface SelectorExhibicionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (exhibicionId: number) => void;
    title: string;
    subtitle?: string;
    actionLabel?: string;
}

export function SelectorExhibicionModal({
    isOpen,
    onClose,
    onSelect,
    title,
    subtitle,
    actionLabel = 'Continuar',
}: SelectorExhibicionModalProps) {
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [exhibiciones, setExhibiciones] = useState<Exhibicion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setSearchInput('');
            setSearch('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch exhibits
    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        setLoading(true);
        setError('');

        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('pageSize', '25');
        if (search) params.set('search', search);

        apiClient.get<ExhibicionesListResponse>(`/exhibiciones?${params.toString()}`)
            .then(data => {
                if (active) {
                    setExhibiciones(data.items || []);
                }
            })
            .catch(err => {
                if (active) {
                    console.error('[SelectorExhibicionModal] Error:', err);
                    setError('No se pudieron cargar las exhibiciones.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [isOpen, search]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className={cn('bg-card border border-cb-border w-full max-w-xl max-h-[90vh] overflow-hidden shadow-cb-level-3 flex flex-col', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-cb-border bg-card">
                    <div>
                        <h2 className="text-sm sm:text-base font-black text-cb-text-primary flex items-center gap-2">
                            <Store className="w-4 h-4 text-primary" />
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="text-xs text-cb-text-secondary mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-cb-text-secondary hover:text-cb-text-primary p-1.5 rounded-xl hover:bg-muted transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-cb-border bg-muted/20">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Buscar por cliente, tienda o código #..."
                            className="block w-full pl-10 pr-9 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary outline-none text-xs sm:text-sm"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => setSearchInput('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-cb-neutral hover:text-cb-text-primary cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* List of Exhibits */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2 bg-cb-bg">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-2 text-cb-text-secondary">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <span className="text-xs font-medium">Buscando exhibiciones...</span>
                        </div>
                    ) : error ? (
                        <div className="py-12 text-center text-red-600 text-xs font-semibold">
                            {error}
                        </div>
                    ) : exhibiciones.length === 0 ? (
                        <div className="py-16 text-center text-cb-text-secondary">
                            <Store className="w-8 h-8 mx-auto mb-2 text-cb-neutral opacity-50" />
                            <p className="text-xs font-medium">No se encontraron exhibiciones para esa búsqueda.</p>
                            <p className="text-[11px] text-cb-text-secondary mt-1">Prueba con otro nombre de tienda o código.</p>
                        </div>
                    ) : (
                        exhibiciones.map((ex) => {
                            const estilo = getEstadoEstilo(ex.estadoId);
                            const estadoLabel = ex.estadoId === 1 ? 'Pendiente' : 'Aprobada';
                            return (
                                <div
                                    key={ex.id}
                                    onClick={() => onSelect(ex.id)}
                                    className={cn(
                                        'group border border-cb-border bg-card p-3 rounded-xl shadow-cb-level-1 hover:border-primary hover:shadow-cb-level-2 transition-all duration-150 cursor-pointer flex items-center justify-between gap-3',
                                        'active:scale-[0.99]'
                                    )}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[11px] font-black text-primary font-mono tracking-tight">
                                                #{ex.nroExhibicion}
                                            </span>
                                            <span className={cn('text-[9px] font-black uppercase px-2 py-0.5 rounded-full border', estilo.badge)}>
                                                {estadoLabel}
                                            </span>
                                        </div>

                                        <p className="text-xs font-bold text-cb-text-primary truncate group-hover:text-primary transition-colors">
                                            {ex.sucursalNombre || ex.nombre}
                                        </p>

                                        <div className="flex items-center gap-1.5 text-[11px] text-cb-text-secondary mt-1 truncate">
                                            <MapPin className="w-3 h-3 shrink-0 text-primary/70" />
                                            <span className="truncate">{ex.clienteNombre}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 text-primary font-bold text-xs group-hover:translate-x-0.5 transition-transform">
                                        <span className="hidden sm:inline text-[11px]">{actionLabel}</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-cb-border bg-card flex items-center justify-between text-xs text-cb-text-secondary">
                    <span>{exhibiciones.length} exhibiciones encontradas</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-xl border border-cb-border text-cb-text-secondary hover:bg-muted transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SelectorExhibicionModal;
