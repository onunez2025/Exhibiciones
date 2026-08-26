import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import type { ExhibicionesFiltros, ExhibicionesFiltroOpciones } from '../../types/index.js';

export interface FiltrosPanelProps {
    open: boolean;
    filtros: ExhibicionesFiltros;
    onApply: (filtros: ExhibicionesFiltros) => void;
    onClear: () => void;
}

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

export function FiltrosPanel({ open, filtros, onApply, onClear }: FiltrosPanelProps) {
    const { t } = useTranslation();
    const [opciones, setOpciones] = useState<ExhibicionesFiltroOpciones | null>(null);
    const [draft, setDraft] = useState<ExhibicionesFiltros>(filtros);

    useEffect(() => {
        if (open && !opciones) {
            apiClient.get<ExhibicionesFiltroOpciones>('/exhibiciones/opciones-filtro')
                .then(setOpciones)
                .catch(() => setOpciones({ tipos: [], ubicaciones: [] }));
        }
    }, [open, opciones]);

    useEffect(() => {
        setDraft(filtros);
    }, [filtros]);

    if (!open) return null;

    return (
        <div className="border border-cb-border rounded-2xl p-4 bg-muted/30 space-y-4 enter-fade-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_tipo')}</label>
                    <select
                        className={INPUT_CLASS}
                        value={draft.tipo ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, tipo: e.target.value ? Number(e.target.value) : undefined }))}
                    >
                        <option value="">{t('exhibiciones_lista.filtro_todos')}</option>
                        {opciones?.tipos.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_estado')}</label>
                    <select
                        className={INPUT_CLASS}
                        value={draft.estado ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, estado: e.target.value ? (Number(e.target.value) as 1 | 2) : undefined }))}
                    >
                        <option value="">{t('exhibiciones_lista.filtro_todos')}</option>
                        <option value="1">{t('exhibiciones_lista.estado_pendiente')}</option>
                        <option value="2">{t('exhibiciones_lista.estado_aprobado')}</option>
                    </select>
                </div>
                <div>
                    <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_tienda')}</label>
                    <input
                        type="text"
                        className={INPUT_CLASS}
                        value={draft.tienda ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, tienda: e.target.value || undefined }))}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_fecha_desde')}</label>
                        <input
                            type="date"
                            className={INPUT_CLASS}
                            value={draft.fechaDesde ?? ''}
                            onChange={(e) => setDraft(d => ({ ...d, fechaDesde: e.target.value || undefined }))}
                        />
                    </div>
                    <div>
                        <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_fecha_hasta')}</label>
                        <input
                            type="date"
                            className={INPUT_CLASS}
                            value={draft.fechaHasta ?? ''}
                            onChange={(e) => setDraft(d => ({ ...d, fechaHasta: e.target.value || undefined }))}
                        />
                    </div>
                </div>
            </div>
            <div className={SIATC_THEME.FORM.FOOTER}>
                <button type="button" onClick={() => onApply(draft)} className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' cursor-pointer'}>
                    {t('exhibiciones_lista.filtro_aplicar')}
                </button>
                <button
                    type="button"
                    onClick={() => { setDraft({}); onClear(); }}
                    className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}
                >
                    {t('exhibiciones_lista.filtro_limpiar')}
                </button>
            </div>
        </div>
    );
}

export default FiltrosPanel;
