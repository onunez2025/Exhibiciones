import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Ticket } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { getEstadoTicketEstilo } from '../../utils/estadoTicket.js';
import type { DashboardChecklistReciente, DashboardTicketReciente } from '../../types/index.js';

interface ChecklistsRecientesProps {
    items: DashboardChecklistReciente[];
    loading?: boolean;
}

export function ChecklistsRecientesList({ items, loading }: ChecklistsRecientesProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="border border-cb-border bg-card rounded-2xl shadow-cb-level-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-cb-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <ClipboardCheck className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-bold text-cb-text-primary">
                        {t('dashboard.ultimos_checklists')}
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/checklist')}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                >
                    {t('dashboard.ver_todos')} <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="divide-y divide-cb-border flex-1">
                {loading && (
                    <div className="p-8 text-center text-xs text-cb-text-secondary animate-pulse">
                        {t('dashboard.cargando')}
                    </div>
                )}

                {!loading && items.length === 0 && (
                    <div className="p-8 text-center text-xs text-cb-text-secondary">
                        {t('dashboard.sin_checklists')}
                    </div>
                )}

                {!loading && items.map(c => {
                    const fecha = new Date(c.fechaCrea);
                    const fechaTexto = !Number.isNaN(fecha.getTime())
                        ? fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
                        : '';

                    return (
                        <div
                            key={c.id}
                            onClick={() => navigate(`/checklist/${c.id}`)}
                            className="p-3 hover:bg-muted/40 transition-colors duration-150 cursor-pointer flex items-center justify-between gap-3 group"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-primary">#{c.checklistNumber}</span>
                                    <span className={cn(
                                        'text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border',
                                        c.conforme
                                            ? 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30'
                                            : 'bg-rose-500/15 text-rose-700 border-rose-400/30'
                                    )}>
                                        {c.conforme ? t('checklists_bandeja.conforme') : t('checklists_bandeja.no_conforme')}
                                    </span>
                                </div>
                                <p className="text-xs text-cb-text-primary font-medium truncate mt-0.5">
                                    {c.exhibicionNombre}
                                </p>
                                <p className="text-[10px] text-cb-text-secondary truncate">
                                    {c.clienteNombre} · {fechaTexto}
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-cb-text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface TicketsRecientesProps {
    items: DashboardTicketReciente[];
    loading?: boolean;
}

export function TicketsRecientesList({ items, loading }: TicketsRecientesProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="border border-cb-border bg-card rounded-2xl shadow-cb-level-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-cb-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <Ticket className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-bold text-cb-text-primary">
                        {t('dashboard.ultimos_tickets')}
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/tickets')}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                >
                    {t('dashboard.ver_todos')} <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="divide-y divide-cb-border flex-1">
                {loading && (
                    <div className="p-8 text-center text-xs text-cb-text-secondary animate-pulse">
                        {t('dashboard.cargando')}
                    </div>
                )}

                {!loading && items.length === 0 && (
                    <div className="p-8 text-center text-xs text-cb-text-secondary">
                        {t('dashboard.sin_tickets')}
                    </div>
                )}

                {!loading && items.map(tkt => {
                    const fecha = new Date(tkt.fechaCrea);
                    const fechaTexto = !Number.isNaN(fecha.getTime())
                        ? fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
                        : '';
                    const estilo = getEstadoTicketEstilo(tkt.estadoCodigo);

                    return (
                        <div
                            key={tkt.numero}
                            onClick={() => navigate(`/tickets/${tkt.numero}`)}
                            className="p-3 hover:bg-muted/40 transition-colors duration-150 cursor-pointer flex items-center justify-between gap-3 group"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-primary">#{tkt.numero}</span>
                                    <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border', estilo.badge)}>
                                        {tkt.estadoNombre || tkt.estadoCodigo}
                                    </span>
                                </div>
                                <p className="text-xs text-cb-text-primary font-medium truncate mt-0.5">
                                    {tkt.tipoNombre}
                                </p>
                                <p className="text-[10px] text-cb-text-secondary truncate">
                                    {tkt.clienteNombre || tkt.exhibicionNombre || '—'} · {fechaTexto}
                                </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-cb-text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
