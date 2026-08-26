import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, ListChecks, Ticket, Image as ImageIcon, Store, Tag, MapPin, MoreVertical } from 'lucide-react';
import type { Exhibicion } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { cn } from '../../utils/cn.js';

export interface ExhibicionCardProps {
    exhibicion: Exhibicion;
    onAction: (action: 'ver' | 'checklist' | 'ticket') => void;
}

// Colores de estado semánticos (ámbar/verde) — no son "decoración", son la
// convención universal de pendiente/aprobado.
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
        <div className="flex items-start gap-1.5 min-w-0">
            <Icon className="w-3.5 h-3.5 text-primary/70 shrink-0 mt-0.5" />
            <div className="min-w-0">
                <p className="text-[9px] font-bold text-cb-text-secondary uppercase tracking-wide leading-tight">{label}</p>
                <p className="text-xs text-cb-text-primary leading-tight break-words">{value}</p>
            </div>
        </div>
    );
}

export function ExhibicionCard({ exhibicion, onAction }: ExhibicionCardProps) {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Cierra el menú al hacer click fuera — patrón estándar de dropdown,
    // no hay otro en el codebase todavía así que se implementa acá.
    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const handleAction = (action: 'ver' | 'checklist' | 'ticket') => {
        setMenuOpen(false);
        onAction(action);
    };

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
                'relative border border-cb-border bg-card px-4 py-3 shadow-cb-level-1',
                'hover:shadow-cb-level-2 hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200',
                "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-[inherit]",
                SIATC_THEME.TOKENS.RADIUS.CARD,
                estadoStyle.accent
            )}
        >
            {/* Fila 1: ícono de módulo · nro · nombre · badge de estado · menú de acciones */}
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-primary shrink-0">{exhibicion.nroExhibicion}</span>
                {/* min-w-0 (no un piso fijo) — en pantallas angostas
                    ícono+nro+badge+menú ya casi llenan el ancho; si el
                    nombre exige un mínimo, el botón de menú se empuja
                    fuera de la tarjeta en vez de truncar el nombre. */}
                <span className="text-sm font-semibold text-cb-text-primary truncate flex-1 min-w-0">{exhibicion.nombre}</span>
                <span className={cn('shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', estadoStyle.badge)}>
                    {estadoLabel}
                </span>

                {/* Menú de acciones — reemplaza los 3 botones sueltos, que en
                    mobile competían por espacio con los campos de info y se
                    cortaban. Un solo botón, siempre cabe. */}
                <div className="relative shrink-0" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => setMenuOpen(v => !v)}
                        aria-label={t('exhibiciones_lista.acciones')}
                        aria-expanded={menuOpen}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-cb-text-secondary hover:bg-muted hover:text-primary transition-colors duration-150 active:scale-90 cursor-pointer"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                        <div className="dropdown-in absolute right-0 top-full mt-1 z-20 w-40 py-1.5 bg-card border border-cb-border rounded-xl shadow-cb-level-3">
                            <button type="button" onClick={() => handleAction('ver')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-cb-text-primary hover:bg-muted transition-colors duration-100 cursor-pointer">
                                <Eye className="w-3.5 h-3.5 text-cb-text-secondary" /> {t('exhibiciones_lista.accion_ver')}
                            </button>
                            <button type="button" onClick={() => handleAction('checklist')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-cb-text-primary hover:bg-muted transition-colors duration-100 cursor-pointer">
                                <ListChecks className="w-3.5 h-3.5 text-cb-text-secondary" /> {t('exhibiciones_lista.accion_checklist')}
                            </button>
                            <button type="button" onClick={() => handleAction('ticket')} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-cb-text-primary hover:bg-muted transition-colors duration-100 cursor-pointer">
                                <Ticket className="w-3.5 h-3.5 text-cb-text-secondary" /> {t('exhibiciones_lista.accion_ticket')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {fechaTexto && (
                <p className="text-[10px] text-cb-text-secondary mt-1 pl-9">{fechaTexto}</p>
            )}

            {/* Fila 2: campos de info — grilla propia (2 columnas en mobile,
                4 en sm+). */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 mt-2 pl-9">
                <InfoField icon={Store} label={t('exhibiciones_lista.campo_tienda')} value={exhibicion.clienteNombre} />
                <InfoField icon={Store} label={t('exhibiciones_lista.campo_sucursal')} value={exhibicion.sucursalNombre} />
                <InfoField icon={Tag} label={t('exhibiciones_lista.campo_tipo')} value={exhibicion.tipoNombre ?? '—'} />
                <InfoField icon={MapPin} label={t('exhibiciones_lista.campo_ubicacion')} value={exhibicion.ubicacionNombre ?? '—'} />
            </div>
        </div>
    );
}

export default ExhibicionCard;
