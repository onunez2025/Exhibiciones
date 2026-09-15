import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';
import type { ExhibicionComponenteItem } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { AgregarComponenteModal } from './AgregarComponenteModal.js';

export interface DetalleComponentesTabProps {
    exhibicionId: number;
    carcasas: ExhibicionComponenteItem[];
    productos: ExhibicionComponenteItem[];
    onComponenteAgregado: (tipo: 1 | 2, item: ExhibicionComponenteItem) => void;
    onComponenteQuitado?: (id: number) => void;
}

function Grupo({
    titulo, items, columnaCantidad, onQuitar, quitandoId,
}: {
    titulo: string;
    items: ExhibicionComponenteItem[];
    columnaCantidad: string;
    onQuitar?: (id: number) => void;
    quitandoId: number | null;
}) {
    const { t } = useTranslation();
    return (
        <div>
            <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-t-xl text-xs font-black uppercase tracking-wider text-cb-text-secondary">
                <span>{titulo}</span>
                <span>{columnaCantidad}</span>
            </div>
            {items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-cb-text-secondary text-center border border-t-0 border-cb-border rounded-b-xl">—</p>
            ) : (
                <ul className="border border-t-0 border-cb-border rounded-b-xl divide-y divide-cb-border">
                    {items.map(item => (
                        <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                            <span className="text-cb-text-primary">{item.nombre ?? '—'}</span>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold text-cb-text-primary">{item.cantidad}</span>
                                {onQuitar && (
                                    <button
                                        type="button"
                                        onClick={() => onQuitar(item.id)}
                                        disabled={quitandoId === item.id}
                                        title={t('exhibicion_detalle.accion_quitar')}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                                    >
                                        {quitandoId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function DetalleComponentesTab({ exhibicionId, carcasas, productos, onComponenteAgregado, onComponenteQuitado }: DetalleComponentesTabProps) {
    const { t } = useTranslation();
    const [modalTipo, setModalTipo] = useState<1 | 2 | null>(null);
    const [quitandoId, setQuitandoId] = useState<number | null>(null);
    const [errorQuitar, setErrorQuitar] = useState('');

    const handleQuitar = async (id: number) => {
        setQuitandoId(id);
        setErrorQuitar('');
        try {
            await apiClient.delete(`/exhibiciones/${exhibicionId}/componentes/${id}`);
            onComponenteQuitado?.(id);
        } catch (err) {
            setErrorQuitar(err instanceof Error ? err.message : t('exhibicion_detalle.error_quitar_componente'));
        } finally {
            setQuitandoId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <button type="button" onClick={() => setModalTipo(2)} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <Plus className="w-4 h-4" /> {t('exhibicion_detalle.accion_agregar_carcasa')}
                </button>
                <button type="button" onClick={() => setModalTipo(1)} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <Plus className="w-4 h-4" /> {t('exhibicion_detalle.accion_agregar_producto')}
                </button>
            </div>

            {errorQuitar && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorQuitar}
                </div>
            )}

            <Grupo
                titulo={t('exhibicion_detalle.tab_carcasas')}
                items={carcasas}
                columnaCantidad={t('exhibicion_detalle.columna_cantidad')}
                onQuitar={onComponenteQuitado ? handleQuitar : undefined}
                quitandoId={quitandoId}
            />
            <Grupo
                titulo={t('exhibicion_detalle.tab_productos')}
                items={productos}
                columnaCantidad={t('exhibicion_detalle.columna_cantidad')}
                onQuitar={onComponenteQuitado ? handleQuitar : undefined}
                quitandoId={quitandoId}
            />

            {modalTipo !== null && (
                <AgregarComponenteModal
                    exhibicionId={exhibicionId}
                    tipo={modalTipo}
                    onClose={() => setModalTipo(null)}
                    onAgregado={onComponenteAgregado}
                />
            )}
        </div>
    );
}

export default DetalleComponentesTab;
