import { useTranslation } from 'react-i18next';
import { Ticket, Eye } from 'lucide-react';
import type { TicketListItem } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';
import { getEstadoTicketEstilo, getEstadoTicketLabelKey } from '../../utils/estadoTicket.js';

export interface TicketCardProps {
    ticket: TicketListItem;
    onVer: (numero: string) => void;
}

function InfoField({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[9px] font-bold text-cb-text-secondary uppercase tracking-wide leading-tight">{label}</p>
            <p className="text-xs text-cb-text-primary leading-tight break-words truncate">{value || '—'}</p>
        </div>
    );
}

export function TicketCard({ ticket, onVer }: TicketCardProps) {
    const { t } = useTranslation();

    const fecha = new Date(ticket.fechaCrea);
    const fechaTexto = Number.isNaN(fecha.getTime())
        ? ''
        : fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
          ' ' + fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    const estadoStyle = getEstadoTicketEstilo(ticket.estadoCodigo);
    const estadoLabelKey = getEstadoTicketLabelKey(ticket.estadoCodigo);
    const estadoLabel = estadoLabelKey ? t(estadoLabelKey) : (ticket.estadoNombre || '—');

    return (
        <div
            className={cn(
                'relative border border-cb-border bg-card px-4 py-3 shadow-cb-level-1',
                'hover:shadow-cb-level-2 hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200',
                "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-[inherit]",
                SIATC_THEME.TOKENS.RADIUS.CARD,
                estadoStyle.accent
            )}
        >
            {/* Fila 1: Ícono + N° Ticket + Tipo + Estado Badge + Botón Ver */}
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Ticket className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-primary shrink-0">#{ticket.numero}</span>
                <span className="text-sm font-semibold text-cb-text-primary truncate flex-1 min-w-0">
                    {ticket.tipoNombre}
                </span>

                <span className={cn('shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', estadoStyle.badge)}>
                    {estadoLabel}
                </span>

                <button
                    type="button"
                    onClick={() => onVer(ticket.numero)}
                    aria-label={t('tickets_bandeja.accion_ver')}
                    title={t('tickets_bandeja.accion_ver')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-cb-text-secondary hover:bg-muted hover:text-primary transition-colors duration-150 active:scale-90 cursor-pointer shrink-0"
                >
                    <Eye className="w-4 h-4" />
                </button>
            </div>

            {fechaTexto && (
                <p className="text-[10px] text-cb-text-secondary mt-1 pl-9">{fechaTexto}</p>
            )}

            {/* Fila 2: Exhibición / Tienda */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 pl-9">
                <InfoField
                    label={t('tickets_bandeja.campo_exhibicion')}
                    value={ticket.exhibicionNroExhibicion ? `${ticket.exhibicionNroExhibicion} — ${ticket.exhibicionNombre}` : ticket.exhibicionNombre}
                />
                <InfoField label={t('tickets_bandeja.campo_tienda')} value={ticket.clienteNombre} />
            </div>

            {/* Motivo preview si existe */}
            {ticket.motivo && (
                <p className="text-xs text-cb-text-secondary mt-2 pl-9 line-clamp-1 italic">
                    "{ticket.motivo}"
                </p>
            )}
        </div>
    );
}

export default TicketCard;
