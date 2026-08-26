import { useTranslation } from 'react-i18next';
import { Eye, ListChecks, Ticket, Image as ImageIcon, Store, Tag, MapPin } from 'lucide-react';
import type { Exhibicion } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';

export interface ExhibicionCardProps {
    exhibicion: Exhibicion;
    onAction: (action: 'ver' | 'checklist' | 'ticket') => void;
}

// Colores de estado semánticos (ámbar/verde) — no son "decoración", son la
// convención universal de pendiente/aprobado. Distinto del error que se
// corrigió acá: los 3 botones de acción NO llevan colores propios, porque
// los 3 llevan al mismo lugar (Próximamente) — un color distinto por botón
// mentiría sobre que hacen cosas distintas.
const ESTADO_STYLES: Record<1 | 2, { badge: string; accent: string }> = {
    1: { badge: 'bg-amber-500/15 text-amber-700 border-amber-400/30', accent: 'before:bg-amber-400' },
    2: { badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30', accent: 'before:bg-emerald-400' },
};
// Si el backend alguna vez trae un estado que no es 1 ni 2 (no hay
// constraint en la base que lo impida, ver spec), no queremos que se
// muestre como "Aprobado" por accidente — degradamos a un estilo neutro.
const FALLBACK_ESTADO_STYLE = { badge: 'bg-muted text-cb-text-secondary border-cb-border', accent: 'before:bg-cb-border' };

function InfoField({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
    return (
        <div className="flex items-center gap-1.5 min-w-0 max-w-full">
            <Icon className="w-3.5 h-3.5 text-primary/70 shrink-0" />
            <span className="text-[10px] font-bold text-cb-text-secondary uppercase tracking-wide shrink-0">{label}</span>
            <span className="text-xs text-cb-text-primary truncate">{value}</span>
        </div>
    );
}

export function ExhibicionCard({ exhibicion, onAction }: ExhibicionCardProps) {
    const { t } = useTranslation();
    const fecha = new Date(exhibicion.fechaCrea);
    const fechaTexto = Number.isNaN(fecha.getTime())
        ? ''
        : fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
          ' ' + fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    const isKnownEstado = exhibicion.estadoId === 1 || exhibicion.estadoId === 2;
    const estadoStyle = isKnownEstado ? ESTADO_STYLES[exhibicion.estadoId] : FALLBACK_ESTADO_STYLE;
    const estadoLabel = exhibicion.estadoId === 1
        ? t('exhibiciones_lista.estado_pendiente')
        : exhibicion.estadoId === 2
            ? t('exhibiciones_lista.estado_aprobado')
            : '—';

    return (
        <div
            className={cn(
                'relative overflow-hidden border border-cb-border bg-card px-4 py-3 shadow-cb-level-1',
                'hover:shadow-cb-level-2 hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200',
                "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1",
                SIATC_THEME.TOKENS.RADIUS.CARD,
                estadoStyle.accent
            )}
        >
            {/* Fila 1: ícono de módulo · nro · nombre · badge de estado · fecha */}
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-primary shrink-0">{exhibicion.nroExhibicion}</span>
                <span className="text-sm font-semibold text-cb-text-primary truncate flex-1 min-w-[80px]">{exhibicion.nombre}</span>
                <span className={cn('shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', estadoStyle.badge)}>
                    {estadoLabel}
                </span>
                {fechaTexto && (
                    <span className="text-[10px] text-cb-text-secondary shrink-0">{fechaTexto}</span>
                )}
            </div>

            {/* Fila 2: campos de info (con ícono) + botones a la derecha */}
            <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mt-2 pl-9">
                <InfoField icon={Store} label={t('exhibiciones_lista.campo_tienda')} value={exhibicion.clienteNombre} />
                <InfoField icon={Store} label={t('exhibiciones_lista.campo_sucursal')} value={exhibicion.sucursalNombre} />
                <InfoField icon={Tag} label={t('exhibiciones_lista.campo_tipo')} value={exhibicion.tipoNombre ?? '—'} />
                <InfoField icon={MapPin} label={t('exhibiciones_lista.campo_ubicacion')} value={exhibicion.ubicacionNombre ?? '—'} />

                {/* empuja botones a la derecha */}
                <span className="flex-1 min-w-[8px]" />

                <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => onAction('ver')} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' h-7 px-2.5 gap-1.5 text-xs cursor-pointer'}>
                        <Eye className="w-3.5 h-3.5" /> {t('exhibiciones_lista.accion_ver')}
                    </button>
                    <button type="button" onClick={() => onAction('checklist')} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' h-7 px-2.5 gap-1.5 text-xs cursor-pointer'}>
                        <ListChecks className="w-3.5 h-3.5" /> {t('exhibiciones_lista.accion_checklist')}
                    </button>
                    <button type="button" onClick={() => onAction('ticket')} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' h-7 px-2.5 gap-1.5 text-xs cursor-pointer'}>
                        <Ticket className="w-3.5 h-3.5" /> {t('exhibiciones_lista.accion_ticket')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ExhibicionCard;
