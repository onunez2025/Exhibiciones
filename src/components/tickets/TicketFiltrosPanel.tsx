import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import type { TicketsFiltros, TiposTicketResponse, TipoTicketOpcion } from '../../types/index.js';

export interface TicketFiltrosPanelProps {
    open: boolean;
    filtros: TicketsFiltros;
    onApply: (filtros: TicketsFiltros) => void;
    onClear: () => void;
}

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

export function TicketFiltrosPanel({ open, filtros, onApply, onClear }: TicketFiltrosPanelProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<TicketsFiltros>(filtros);
    const [tipos, setTipos] = useState<TipoTicketOpcion[]>([]);

    useEffect(() => {
        setDraft(filtros);
    }, [filtros]);

    useEffect(() => {
        if (!open) return;
        apiClient.get<TiposTicketResponse>('/exhibiciones/tipos-ticket')
            .then(data => setTipos(data.tipos))
            .catch(err => console.error('[TicketFiltrosPanel] error cargando tipos:', err));
    }, [open]);

    if (!open) return null;

    return (
        <div className="border border-cb-border rounded-2xl p-4 bg-muted/30 space-y-4 enter-fade-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Estado */}
                <div>
                    <label className={LABEL_CLASS}>{t('tickets_bandeja.filtro_estado')}</label>
                    <select
                        className={INPUT_CLASS}
                        value={draft.estado ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, estado: e.target.value || undefined }))}
                    >
                        <option value="">{t('tickets_bandeja.filtro_todos')}</option>
                        <option value="01">{t('tickets_bandeja.estado_01')}</option>
                        <option value="02">{t('tickets_bandeja.estado_02')}</option>
                        <option value="05">{t('tickets_bandeja.estado_05')}</option>
                        <option value="06">{t('tickets_bandeja.estado_06')}</option>
                    </select>
                </div>

                {/* Tipo de Ticket */}
                <div>
                    <label className={LABEL_CLASS}>{t('tickets_bandeja.filtro_tipo')}</label>
                    <select
                        className={INPUT_CLASS}
                        value={draft.tipoId ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, tipoId: e.target.value ? Number(e.target.value) : undefined }))}
                    >
                        <option value="">{t('tickets_bandeja.filtro_todos')}</option>
                        {tipos.map(tp => (
                            <option key={tp.id} value={tp.id}>{tp.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Tienda */}
                <div>
                    <label className={LABEL_CLASS}>{t('tickets_bandeja.filtro_tienda')}</label>
                    <input
                        type="text"
                        className={INPUT_CLASS}
                        value={draft.tienda ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, tienda: e.target.value || undefined }))}
                        placeholder={t('tickets_bandeja.filtro_tienda_placeholder')}
                    />
                </div>

                {/* Rango de fechas */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={LABEL_CLASS}>{t('tickets_bandeja.filtro_fecha_desde')}</label>
                        <input
                            type="date"
                            className={INPUT_CLASS}
                            value={draft.fechaDesde ?? ''}
                            onChange={(e) => setDraft(d => ({ ...d, fechaDesde: e.target.value || undefined }))}
                        />
                    </div>
                    <div>
                        <label className={LABEL_CLASS}>{t('tickets_bandeja.filtro_fecha_hasta')}</label>
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
                    {t('tickets_bandeja.filtro_aplicar')}
                </button>
                <button
                    type="button"
                    onClick={() => { setDraft({}); onClear(); }}
                    className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}
                >
                    {t('tickets_bandeja.filtro_limpiar')}
                </button>
            </div>
        </div>
    );
}

export default TicketFiltrosPanel;
