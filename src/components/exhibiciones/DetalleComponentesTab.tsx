import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { ExhibicionComponenteItem } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { AgregarComponenteModal } from './AgregarComponenteModal.js';

export interface DetalleComponentesTabProps {
    exhibicionId: number;
    carcasas: ExhibicionComponenteItem[];
    productos: ExhibicionComponenteItem[];
    onComponenteAgregado: (tipo: 1 | 2, item: ExhibicionComponenteItem) => void;
}

function Grupo({ titulo, items, columnaCantidad }: { titulo: string; items: ExhibicionComponenteItem[]; columnaCantidad: string }) {
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
                        // items-start (no items-center) — un nombre largo se
                        // envuelve a 2-3 líneas en pantallas angostas; con
                        // centrado vertical la cantidad quedaba flotando en
                        // medio del bloque de texto en vez de alineada arriba.
                        <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                            <span className="text-cb-text-primary">{item.nombre ?? '—'}</span>
                            <span className="font-bold text-cb-text-primary shrink-0">{item.cantidad}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function DetalleComponentesTab({ exhibicionId, carcasas, productos, onComponenteAgregado }: DetalleComponentesTabProps) {
    const { t } = useTranslation();
    const [modalTipo, setModalTipo] = useState<1 | 2 | null>(null);

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

            <Grupo titulo={t('exhibicion_detalle.tab_carcasas')} items={carcasas} columnaCantidad={t('exhibicion_detalle.columna_cantidad')} />
            <Grupo titulo={t('exhibicion_detalle.tab_productos')} items={productos} columnaCantidad={t('exhibicion_detalle.columna_cantidad')} />

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
