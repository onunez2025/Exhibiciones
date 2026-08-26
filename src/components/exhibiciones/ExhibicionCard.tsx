import { useTranslation } from 'react-i18next';
import { Eye, ListChecks, Ticket } from 'lucide-react';
import type { Exhibicion } from '../../types/index.js';
import { cn } from '../../utils/cn.js';
import { getEstadoEstilo, getEstadoLabelKey } from '../../utils/estadoExhibicion.js';

export interface ExhibicionCardProps {
    exhibicion: Exhibicion;
    onAction: (action: 'ver' | 'checklist' | 'ticket') => void;
}

const BTN = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer';
const BTN_VER       = BTN + ' bg-primary/10 text-primary hover:bg-primary/20';
const BTN_CHECKLIST = BTN + ' bg-violet-500/10 text-violet-700 hover:bg-violet-500/20';
const BTN_TICKET    = BTN + ' bg-sky-500/10 text-sky-700 hover:bg-sky-500/20';

export function ExhibicionCard({ exhibicion, onAction }: ExhibicionCardProps) {
    const { t } = useTranslation();
    const fecha = new Date(exhibicion.fechaCrea);
    const fechaTexto = Number.isNaN(fecha.getTime())
        ? ''
        : fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });

    const estadoStyle   = getEstadoEstilo(exhibicion.estadoId);
    const estadoLabelKey = getEstadoLabelKey(exhibicion.estadoId);
    const estadoLabel   = estadoLabelKey ? t(estadoLabelKey) : '—';

    return (
        <div className="border border-cb-border rounded-xl px-4 py-2.5 bg-card hover:bg-cb-bg/40 transition-colors duration-150">

            {/* Fila 1: nro · nombre · badge · fecha */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-xs font-black text-primary shrink-0">{exhibicion.nroExhibicion}</span>
                <span className="text-sm font-semibold text-cb-text-primary truncate flex-1 min-w-0">{exhibicion.nombre}</span>
                <span className={cn('shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', estadoStyle.badge)}>
                    {estadoLabel}
                </span>
                {fechaTexto && (
                    <span className="text-[10px] text-cb-text-secondary shrink-0">{fechaTexto}</span>
                )}
            </div>

            {/* Fila 2: campos de info + botones a la derecha */}
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5">
                <span className="text-xs text-cb-text-secondary min-w-0">
                    <span className="font-semibold text-cb-text-primary">{t('exhibiciones_lista.campo_tienda')}:</span>{' '}
                    <span className="truncate">{exhibicion.clienteNombre}</span>
                </span>
                <span className="text-[10px] text-cb-border select-none">·</span>
                <span className="text-xs text-cb-text-secondary min-w-0">
                    <span className="font-semibold text-cb-text-primary">{t('exhibiciones_lista.campo_sucursal')}:</span>{' '}
                    <span className="truncate">{exhibicion.sucursalNombre}</span>
                </span>
                <span className="text-[10px] text-cb-border select-none">·</span>
                <span className="text-xs text-cb-text-secondary">
                    <span className="font-semibold text-cb-text-primary">{t('exhibiciones_lista.campo_tipo')}:</span>{' '}
                    {exhibicion.tipoNombre ?? '—'}
                </span>
                <span className="text-[10px] text-cb-border select-none">·</span>
                <span className="text-xs text-cb-text-secondary">
                    <span className="font-semibold text-cb-text-primary">{t('exhibiciones_lista.campo_ubicacion')}:</span>{' '}
                    {exhibicion.ubicacionNombre ?? '—'}
                </span>

                {/* empuja botones a la derecha */}
                <span className="flex-1 min-w-[8px]" />

                <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => onAction('ver')} className={BTN_VER}>
                        <Eye className="w-3 h-3" /> {t('exhibiciones_lista.accion_ver')}
                    </button>
                    <button type="button" onClick={() => onAction('checklist')} className={BTN_CHECKLIST}>
                        <ListChecks className="w-3 h-3" /> {t('exhibiciones_lista.accion_checklist')}
                    </button>
                    <button type="button" onClick={() => onAction('ticket')} className={BTN_TICKET}>
                        <Ticket className="w-3 h-3" /> {t('exhibiciones_lista.accion_ticket')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ExhibicionCard;
