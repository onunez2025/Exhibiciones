import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import type { ChecklistsFiltros } from '../../types/index.js';

export interface ChecklistFiltrosPanelProps {
    open: boolean;
    filtros: ChecklistsFiltros;
    onApply: (filtros: ChecklistsFiltros) => void;
    onClear: () => void;
}

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

export function ChecklistFiltrosPanel({ open, filtros, onApply, onClear }: ChecklistFiltrosPanelProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ChecklistsFiltros>(filtros);

    useEffect(() => {
        setDraft(filtros);
    }, [filtros]);

    if (!open) return null;

    return (
        <div className="border border-cb-border rounded-2xl p-4 bg-muted/30 space-y-4 enter-fade-up">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label className={LABEL_CLASS}>{t('checklist_bandeja.filtro_conformidad')}</label>
                    <select
                        className={INPUT_CLASS}
                        value={draft.conforme ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, conforme: (e.target.value as 'si' | 'no') || undefined }))}
                    >
                        <option value="">{t('checklist_bandeja.filtro_todos')}</option>
                        <option value="si">{t('checklist_bandeja.conforme')}</option>
                        <option value="no">{t('checklist_bandeja.no_conforme')}</option>
                    </select>
                </div>
                <div>
                    <label className={LABEL_CLASS}>{t('checklist_bandeja.filtro_tienda')}</label>
                    <input
                        type="text"
                        className={INPUT_CLASS}
                        value={draft.tienda ?? ''}
                        onChange={(e) => setDraft(d => ({ ...d, tienda: e.target.value || undefined }))}
                        placeholder={t('checklist_bandeja.filtro_tienda_placeholder')}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={LABEL_CLASS}>{t('checklist_bandeja.filtro_fecha_desde')}</label>
                        <input
                            type="date"
                            className={INPUT_CLASS}
                            value={draft.fechaDesde ?? ''}
                            onChange={(e) => setDraft(d => ({ ...d, fechaDesde: e.target.value || undefined }))}
                        />
                    </div>
                    <div>
                        <label className={LABEL_CLASS}>{t('checklist_bandeja.filtro_fecha_hasta')}</label>
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
                    {t('checklist_bandeja.filtro_aplicar')}
                </button>
                <button
                    type="button"
                    onClick={() => { setDraft({}); onClear(); }}
                    className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}
                >
                    {t('checklist_bandeja.filtro_limpiar')}
                </button>
            </div>
        </div>
    );
}

export default ChecklistFiltrosPanel;
