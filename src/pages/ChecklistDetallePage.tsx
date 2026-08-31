import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle, Check, X, CheckCircle2, Trash2 } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useDialog } from '../context/DialogContext.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { cn } from '../utils/cn.js';
import {
    getEstadoChecklistEstilo,
    getEstadoChecklistLabelKey,
    getConformeEstilo,
    getConformeLabelKey,
} from '../utils/estadoChecklist.js';
import type { ChecklistDetalle, AtenderChecklistResponse, AnularChecklistResponse } from '../types/index.js';

export function ChecklistDetallePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { alert, confirm } = useDialog();

    const [checklist, setChecklist] = useState<ChecklistDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [atendiendo, setAtendiendo] = useState(false);
    const [anulando, setAnulando] = useState(false);

    const cargar = useCallback(() => {
        setLoading(true);
        setError('');
        apiClient.get<ChecklistDetalle>(`/checklists/${id}`)
            .then(data => setChecklist(data))
            .catch(() => setError(t('checklist_bandeja.error_cargar_detalle')))
            .finally(() => setLoading(false));
    }, [id, t]);

    useEffect(() => { cargar(); }, [cargar]);

    const volver = () => navigate('/checklist', { viewTransition: true });

    const handleAtender = async () => {
        const ok = await confirm({
            title: t('checklist_bandeja.confirmar_atender_titulo'),
            message: t('checklist_bandeja.confirmar_atender_mensaje'),
            variant: 'primary',
        });
        if (!ok) return;

        setAtendiendo(true);
        try {
            await apiClient.post<AtenderChecklistResponse>(`/checklists/${id}/atender`);
            setChecklist(prev => prev ? { ...prev, estadoId: 2 } : prev);
            await alert(t('checklist_bandeja.title'), t('checklist_bandeja.atendido_exito'));
        } catch (err) {
            await alert(t('checklist_bandeja.title'), err instanceof Error ? err.message : t('checklist_bandeja.error_atender'));
        } finally {
            setAtendiendo(false);
        }
    };

    const handleAnular = async () => {
        const ok = await confirm({
            title: t('checklist_bandeja.confirmar_anular_titulo'),
            message: t('checklist_bandeja.confirmar_anular_mensaje'),
            variant: 'danger',
        });
        if (!ok) return;

        setAnulando(true);
        try {
            await apiClient.post<AnularChecklistResponse>(`/checklists/${id}/anular`);
            await alert(t('checklist_bandeja.title'), t('checklist_bandeja.anulado_exito'));
            navigate('/checklist', { viewTransition: true });
        } catch (err) {
            await alert(t('checklist_bandeja.title'), err instanceof Error ? err.message : t('checklist_bandeja.error_anular'));
        } finally {
            setAnulando(false);
        }
    };

    const fecha = checklist ? new Date(checklist.fechaCrea) : null;
    const fechaTexto = fecha && !Number.isNaN(fecha.getTime())
        ? fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
          ' ' + fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        : '';

    const estadoStyle = checklist ? getEstadoChecklistEstilo(checklist.estadoId) : null;
    const estadoLabelKey = checklist ? getEstadoChecklistLabelKey(checklist.estadoId) : '';
    const estadoLabel = estadoLabelKey ? t(estadoLabelKey) : '—';

    const conformeStyle = checklist ? getConformeEstilo(checklist.conforme) : null;
    const conformeLabel = checklist ? t(getConformeLabelKey(checklist.conforme)) : '';

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
                                {checklist ? `#${checklist.checklistNumber}` : t('checklist_bandeja.detalle_title')}
                            </h1>
                            {checklist && conformeStyle && (
                                <span className={cn('text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border', conformeStyle.badge)}>
                                    {conformeLabel}
                                </span>
                            )}
                            {checklist && estadoStyle && (
                                <span className={cn('text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border', estadoStyle.badge)}>
                                    {estadoLabel}
                                </span>
                            )}
                        </div>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>{fechaTexto}</p>
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
                                {t('checklist_bandeja.reintentar')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && checklist && (
                        <div className="max-w-3xl space-y-4">
                            {/* Resumen de contexto */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-card border border-cb-border rounded-xl">
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_bandeja.campo_tienda')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">{checklist.clienteNombre}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_bandeja.campo_sucursal')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">{checklist.sucursalNombre}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_bandeja.campo_exhibicion')}</p>
                                    <p className="text-sm text-cb-text-primary font-medium">{checklist.exhibicionNroExhibicion} — {checklist.exhibicionNombre}</p>
                                </div>
                            </div>

                            {/* Acciones de estado */}
                            <div className="flex flex-wrap items-center gap-3">
                                {checklist.estadoId === 1 && (
                                    <button
                                        type="button"
                                        onClick={handleAtender}
                                        disabled={atendiendo || anulando}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {atendiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        {t('checklist_bandeja.accion_atender')}
                                    </button>
                                )}

                                {checklist.estadoId > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleAnular}
                                        disabled={atendiendo || anulando}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {anulando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        {t('checklist_bandeja.accion_anular')}
                                    </button>
                                )}
                            </div>

                            {/* Categorías con ítems */}
                            <div className="space-y-4">
                                {checklist.categorias.map(cat => (
                                    <div key={cat.tipoId} className="border border-cb-border rounded-2xl p-4 bg-card space-y-3">
                                        <h2 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">
                                            {cat.tipoNombre}
                                        </h2>
                                        <ul className="divide-y divide-cb-border">
                                            {cat.items.map(item => (
                                                <li key={item.visualCodigo} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sm text-cb-text-primary font-medium">
                                                            {item.nombre}
                                                        </span>
                                                        {item.desconforme ? (
                                                            <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full shrink-0">
                                                                <X className="w-3.5 h-3.5" />
                                                                {t('checklist_bandeja.no_conforme')}
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                                                                <Check className="w-3.5 h-3.5" />
                                                                {t('checklist_bandeja.conforme')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.desconforme && item.motivo && (
                                                        <p className="text-xs text-cb-text-secondary bg-muted/50 p-2 rounded-lg border border-cb-border/60">
                                                            <span className="font-bold text-cb-text-primary">{t('checklist_bandeja.campo_motivo')}: </span>
                                                            {item.motivo}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChecklistDetallePage;
