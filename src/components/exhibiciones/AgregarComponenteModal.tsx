import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { apiClient } from '../../services/apiClient.js';
import type { AgregarComponenteInput, CatalogoComponentesResponse, ComponenteCatalogoItem, ExhibicionComponenteItem } from '../../types/index.js';

export interface AgregarComponenteModalProps {
    exhibicionId: number;
    tipo: 1 | 2;
    onClose: () => void;
    onAgregado: (tipo: 1 | 2, item: ExhibicionComponenteItem) => void;
}

// Mismo patrón visual que DialogContext (modal-overlay-in/modal-content-in,
// SIATC_THEME.TOKENS.MODAL_OVERLAY/COMPONENTS.MODAL_CONTENT) — sin cerrar
// al hacer click afuera, igual que ese modal.
export function AgregarComponenteModal({ exhibicionId, tipo, onClose, onAgregado }: AgregarComponenteModalProps) {
    const { t } = useTranslation();
    const [catalogo, setCatalogo] = useState<ComponenteCatalogoItem[] | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [codigoSeleccionado, setCodigoSeleccionado] = useState('');
    const [cantidad, setCantidad] = useState('1');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        apiClient.get<CatalogoComponentesResponse>('/exhibiciones/catalogo-componentes')
            .then(data => setCatalogo(tipo === 1 ? data.productos : data.carcasas))
            .catch(() => setError(t('exhibicion_detalle.error_cargar_catalogo')));
    }, [tipo, t]);

    const filtrados = useMemo(() => {
        if (!catalogo) return [];
        const q = busqueda.trim().toLowerCase();
        const base = q ? catalogo.filter(c => c.nombre.toLowerCase().includes(q)) : catalogo;
        return base.slice(0, 50);
    }, [catalogo, busqueda]);

    const cantidadNum = Number(cantidad);
    const puedeGuardar = codigoSeleccionado !== '' && Number.isInteger(cantidadNum) && cantidadNum > 0 && !guardando;

    const handleAgregar = async () => {
        setGuardando(true);
        setError('');
        try {
            const item = await apiClient.post<ExhibicionComponenteItem>(`/exhibiciones/${exhibicionId}/componentes`, {
                tipo, codigoProducto: codigoSeleccionado, cantidad: cantidadNum,
            } satisfies AgregarComponenteInput);
            onAgregado(tipo, item);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('exhibicion_detalle.error_agregar_componente'));
        } finally {
            setGuardando(false);
        }
    };

    const titulo = tipo === 1 ? t('exhibicion_detalle.accion_agregar_producto') : t('exhibicion_detalle.accion_agregar_carcasa');

    return (
        <div className={cn('fixed inset-0 z-[150] flex items-center justify-center p-4 modal-overlay-in', SIATC_THEME.TOKENS.MODAL_OVERLAY)}>
            <div className={SIATC_THEME.COMPONENTS.MODAL_CONTENT + ' w-full max-w-sm modal-content-in'}>
                <div className="px-6 py-5 border-b border-cb-border flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider">{titulo}</h3>
                    <button type="button" onClick={onClose} className="text-cb-text-secondary hover:text-primary cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cb-neutral">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder={t('exhibicion_detalle.buscar_producto_placeholder')}
                            className="block w-full pl-9 pr-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl outline-none text-sm"
                        />
                    </div>

                    {!catalogo && !error && (
                        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                    )}

                    {catalogo && (
                        <div className="max-h-48 overflow-y-auto custom-scrollbar border border-cb-border rounded-xl divide-y divide-cb-border">
                            {filtrados.length === 0 && (
                                <p className="px-3 py-4 text-sm text-cb-text-secondary text-center">{t('exhibicion_detalle.sin_resultados')}</p>
                            )}
                            {filtrados.map(c => (
                                <button
                                    key={c.codigo}
                                    type="button"
                                    onClick={() => setCodigoSeleccionado(c.codigo)}
                                    className={cn(
                                        'w-full text-left px-3 py-2 text-xs cursor-pointer transition-colors duration-100',
                                        codigoSeleccionado === c.codigo ? 'bg-primary/10 text-primary font-bold' : 'text-cb-text-primary hover:bg-muted'
                                    )}
                                >
                                    {c.nombre}
                                </button>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5">
                            {t('exhibicion_detalle.columna_cantidad')}
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            className="w-24 px-3 py-2 border border-cb-border rounded-xl text-sm outline-none"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className={cn(SIATC_THEME.FORM.FOOTER, 'mt-0')}>
                        <button type="button" onClick={onClose} className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, 'flex-1 cursor-pointer')}>
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleAgregar}
                            disabled={!puedeGuardar}
                            className={cn(SIATC_THEME.COMPONENTS.BUTTON_PRIMARY, 'flex-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed')}
                        >
                            {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('exhibicion_detalle.accion_agregar')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AgregarComponenteModal;
