import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Trash2, Package, Image as ImageIcon, X } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useDialog } from '../context/DialogContext.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { cn } from '../utils/cn.js';
import { getEstadoTicketEstilo, getEstadoTicketLabelKey } from '../utils/estadoTicket.js';
import type { TicketDetalle, AtenderTicketResponse, AnularTicketResponse } from '../types/index.js';

export function TicketDetallePage() {
    const { numero } = useParams<{ numero: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { alert, confirm } = useDialog();

    const [ticket, setTicket] = useState<TicketDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [atendiendo, setAtendiendo] = useState(false);
    const [anulando, setAnulando] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    const cargar = useCallback(() => {
        if (!numero) return;
        setLoading(true);
        setError('');
        apiClient.get<TicketDetalle>(`/tickets/${numero}`)
            .then(data => setTicket(data))
            .catch(() => setError(t('tickets_bandeja.error_cargar_detalle')))
            .finally(() => setLoading(false));
    }, [numero, t]);

    useEffect(() => { cargar(); }, [cargar]);

    const volver = () => navigate('/tickets', { viewTransition: true });

    const handleAtender = async () => {
        if (!ticket) return;
        const ok = await confirm({
            title: t('tickets_bandeja.confirmar_atender_titulo'),
            message: t('tickets_bandeja.confirmar_atender_mensaje'),
            variant: 'primary',
        });
        if (!ok) return;

        setAtendiendo(true);
        try {
            const res = await apiClient.post<AtenderTicketResponse>(`/tickets/${ticket.numero}/atender`);
            setTicket(prev => prev ? { ...prev, estadoCodigo: res.estadoCodigo, estadoNombre: res.estadoNombre } : prev);
            await alert(t('tickets_bandeja.title'), t('tickets_bandeja.atendido_exito'));
        } catch (err) {
            await alert(t('tickets_bandeja.title'), err instanceof Error ? err.message : t('tickets_bandeja.error_atender'));
        } finally {
            setAtendiendo(false);
        }
    };

    const handleAnular = async () => {
        if (!ticket) return;
        const ok = await confirm({
            title: t('tickets_bandeja.confirmar_anular_titulo'),
            message: t('tickets_bandeja.confirmar_anular_mensaje'),
            variant: 'danger',
        });
        if (!ok) return;

        setAnulando(true);
        try {
            await apiClient.post<AnularTicketResponse>(`/tickets/${ticket.numero}/anular`);
            await alert(t('tickets_bandeja.title'), t('tickets_bandeja.anulado_exito'));
            navigate('/tickets', { viewTransition: true });
        } catch (err) {
            await alert(t('tickets_bandeja.title'), err instanceof Error ? err.message : t('tickets_bandeja.error_anular'));
        } finally {
            setAnulando(false);
        }
    };

    const fecha = ticket ? new Date(ticket.fechaCrea) : null;
    const fechaTexto = fecha && !Number.isNaN(fecha.getTime())
        ? fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
          ' ' + fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        : '';

    const estadoStyle = ticket ? getEstadoTicketEstilo(ticket.estadoCodigo) : null;
    const estadoLabelKey = ticket ? getEstadoTicketLabelKey(ticket.estadoCodigo) : '';
    const estadoLabel = estadoLabelKey ? t(estadoLabelKey) : (ticket?.estadoNombre || '—');

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={volver}
                        className="p-2 -ml-2 text-muted-foreground hover:bg-white hover:text-primary rounded-xl transition-colors duration-150 active:scale-90 cursor-pointer"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>
                                {ticket ? `#${ticket.numero}` : t('tickets_bandeja.detalle_title')}
                            </h1>
                            {ticket && estadoStyle && (
                                <span className={cn('text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border', estadoStyle.badge)}>
                                    {estadoLabel}
                                </span>
                            )}
                        </div>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>
                            {ticket ? `${ticket.tipoNombre} · ${fechaTexto}` : ''}
                        </p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    {loading && (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex flex-col items-center gap-3 py-16">
                            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                            <button type="button" onClick={cargar} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}>
                                {t('tickets_bandeja.reintentar')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && ticket && (
                        <div className="max-w-3xl space-y-4">
                            {/* Resumen de contexto */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-card border border-cb-border rounded-xl">
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('tickets_bandeja.campo_tienda')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">{ticket.clienteNombre || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('tickets_bandeja.campo_sucursal')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">{ticket.sucursalNombre || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('tickets_bandeja.campo_exhibicion')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">
                                        {ticket.exhibicionNroExhibicion ? `${ticket.exhibicionNroExhibicion} — ${ticket.exhibicionNombre}` : (ticket.exhibicionNombre || '—')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('tickets_bandeja.campo_usuario')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">{ticket.usuarioCrea || '—'}</p>
                                </div>
                            </div>

                            {/* Acciones de estado */}
                            <div className="flex flex-wrap items-center gap-3">
                                {ticket.estadoCodigo !== '05' && ticket.estadoCodigo !== '06' && (
                                    <button
                                        type="button"
                                        onClick={handleAtender}
                                        disabled={atendiendo || anulando}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {atendiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        {t('tickets_bandeja.accion_atender')}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={handleAnular}
                                    disabled={atendiendo || anulando}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {anulando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    {t('tickets_bandeja.accion_anular')}
                                </button>
                            </div>

                            {/* Motivo / Observación */}
                            <div className="p-4 bg-card border border-cb-border rounded-xl space-y-1.5">
                                <h2 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">
                                    {t('tickets_bandeja.campo_motivo')}
                                </h2>
                                <p className="text-sm text-cb-text-primary leading-relaxed whitespace-pre-wrap">
                                    {ticket.motivo || '—'}
                                </p>
                            </div>

                            {/* Componentes solicitados */}
                            {ticket.componentes.length > 0 && (
                                <div className="p-4 bg-card border border-cb-border rounded-xl space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-primary" />
                                        <h2 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">
                                            {t('tickets_bandeja.seccion_componentes')} ({ticket.componentes.length})
                                        </h2>
                                    </div>
                                    <ul className="divide-y divide-cb-border">
                                        {ticket.componentes.map(c => (
                                            <li key={c.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                                                <div>
                                                    <span className="text-xs font-mono font-bold text-primary mr-2">[{c.codigo}]</span>
                                                    <span className="text-sm text-cb-text-primary font-medium">{c.nombre}</span>
                                                </div>
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-cb-text-secondary border border-cb-border">
                                                    Cant: {c.cantidad}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Fotos adjuntas */}
                            <div className="p-4 bg-card border border-cb-border rounded-xl space-y-3">
                                <div className="flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-primary" />
                                    <h2 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">
                                        {t('tickets_bandeja.seccion_fotos')} ({ticket.fotos.length})
                                    </h2>
                                </div>
                                {ticket.fotos.length === 0 ? (
                                    <p className="text-xs text-cb-text-secondary py-4 text-center">{t('tickets_bandeja.sin_fotos')}</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {ticket.fotos.map(foto => (
                                            <button
                                                key={foto.id}
                                                type="button"
                                                onClick={() => setLightboxUrl(foto.url)}
                                                className="group relative aspect-square rounded-xl overflow-hidden border border-cb-border bg-muted focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                                            >
                                                <img
                                                    src={foto.url}
                                                    alt="Foto ticket"
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                    loading="lazy"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Lightbox para fotos */}
            {lightboxUrl && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs enter-fade"
                    onClick={() => setLightboxUrl(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
                        <button
                            type="button"
                            onClick={() => setLightboxUrl(null)}
                            className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <img
                            src={lightboxUrl}
                            alt="Foto ticket ampliada"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default TicketDetallePage;
