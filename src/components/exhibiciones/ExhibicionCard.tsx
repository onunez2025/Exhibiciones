import { useTranslation } from 'react-i18next';
import { Eye, ListChecks, Ticket } from 'lucide-react';
import type { Exhibicion } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';

export interface ExhibicionCardProps {
    exhibicion: Exhibicion;
    onAction: (action: 'ver' | 'checklist' | 'ticket') => void;
}

const ESTADO_BADGE: Record<1 | 2, string> = {
    1: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    2: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
};

export function ExhibicionCard({ exhibicion, onAction }: ExhibicionCardProps) {
    const { t } = useTranslation();
    const fecha = new Date(exhibicion.fechaCrea);
    const fechaTexto = Number.isNaN(fecha.getTime())
        ? ''
        : fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
          ' ' + fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const estadoLabel = exhibicion.estadoId === 1
        ? t('exhibiciones_lista.estado_pendiente')
        : t('exhibiciones_lista.estado_aprobado');

    return (
        <div className="border border-cb-border rounded-2xl p-4 space-y-3 bg-card">
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-cb-text-primary">
                    {exhibicion.nroExhibicion} - {exhibicion.nombre}
                    {fechaTexto && <span className="font-normal text-cb-text-secondary"> ({fechaTexto})</span>}
                </p>
                <span className={cn('shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border', ESTADO_BADGE[exhibicion.estadoId])}>
                    {estadoLabel}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">{t('exhibiciones_lista.campo_tienda')}</p>
                    <p className="text-cb-text-primary truncate">{exhibicion.clienteNombre}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">{t('exhibiciones_lista.campo_sucursal')}</p>
                    <p className="text-cb-text-primary truncate">{exhibicion.sucursalNombre}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">{t('exhibiciones_lista.campo_tipo')}</p>
                    <p className="text-cb-text-primary truncate">{exhibicion.tipoNombre ?? '—'}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">{t('exhibiciones_lista.campo_ubicacion')}</p>
                    <p className="text-cb-text-primary truncate">{exhibicion.ubicacionNombre ?? '—'}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => onAction('ver')} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <Eye className="w-4 h-4" /> {t('exhibiciones_lista.accion_ver')}
                </button>
                <button type="button" onClick={() => onAction('checklist')} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <ListChecks className="w-4 h-4" /> {t('exhibiciones_lista.accion_checklist')}
                </button>
                <button type="button" onClick={() => onAction('ticket')} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer'}>
                    <Ticket className="w-4 h-4" /> {t('exhibiciones_lista.accion_ticket')}
                </button>
            </div>
        </div>
    );
}

export default ExhibicionCard;
