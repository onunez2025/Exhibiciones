import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle, Check, X } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { cn } from '../utils/cn.js';
import type { ExhibicionDetalle, ChecklistCatalogoResponse, ChecklistCatalogoCategoria, CrearChecklistInput, CrearChecklistResponse } from '../types/index.js';

interface Respuesta {
    desconforme: boolean;
    motivo: string;
}

export function ChecklistCrearPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [exhibicion, setExhibicion] = useState<ExhibicionDetalle | null>(null);
    const [catalogo, setCatalogo] = useState<ChecklistCatalogoCategoria[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({});
    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');

    useEffect(() => {
        Promise.all([
            apiClient.get<ExhibicionDetalle>(`/exhibiciones/${id}`),
            apiClient.get<ChecklistCatalogoResponse>('/exhibiciones/catalogo-checklist'),
        ])
            .then(([exhibicionData, catalogoData]) => {
                setExhibicion(exhibicionData);
                setCatalogo(catalogoData.categorias);
            })
            .catch(() => setError(t('checklist_crear.error_cargar')))
            .finally(() => setLoading(false));
    }, [id, t]);

    const totalItems = useMemo(() => catalogo?.reduce((acc, cat) => acc + cat.items.length, 0) ?? 0, [catalogo]);

    const puedeGuardar = useMemo(() => {
        if (!catalogo || Object.keys(respuestas).length !== totalItems) return false;
        return !guardando && catalogo.every(cat => cat.items.every(item => {
            const r = respuestas[item.visualCodigo];
            if (!r) return false;
            if (r.desconforme && r.motivo.trim() === '') return false;
            return true;
        }));
    }, [catalogo, respuestas, totalItems, guardando]);

    const setRespuesta = (visualCodigo: string, desconforme: boolean) => {
        setRespuestas(prev => ({ ...prev, [visualCodigo]: { desconforme, motivo: prev[visualCodigo]?.motivo ?? '' } }));
    };

    const setMotivo = (visualCodigo: string, motivo: string) => {
        setRespuestas(prev => ({ ...prev, [visualCodigo]: { desconforme: prev[visualCodigo]?.desconforme ?? true, motivo } }));
    };

    const volver = () => navigate(`/exhibiciones/${id}`, { viewTransition: true });

    const handleGuardar = async () => {
        if (!catalogo) return;
        setGuardando(true);
        setErrorGuardar('');
        try {
            const items = catalogo.flatMap(cat => cat.items.map(item => {
                const r = respuestas[item.visualCodigo];
                return { visualCodigo: item.visualCodigo, desconforme: r.desconforme, motivo: r.desconforme ? r.motivo.trim() : null };
            }));
            await apiClient.post<CrearChecklistResponse>(`/exhibiciones/${id}/checklist`, { items } satisfies CrearChecklistInput);
            navigate(`/exhibiciones/${id}`, { viewTransition: true });
        } catch (err) {
            setErrorGuardar(err instanceof Error ? err.message : t('checklist_crear.error_guardar'));
        } finally {
            setGuardando(false);
        }
    };

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
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('checklist_crear.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>{exhibicion?.nroExhibicion ?? ''}</p>
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
                            <button type="button" onClick={volver} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}>
                                {t('checklist_crear.volver')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && exhibicion && catalogo && (
                        <div className="max-w-2xl space-y-4">
                            <div className="grid grid-cols-2 gap-3 p-4 bg-card border border-cb-border rounded-xl">
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_crear.campo_tienda')}</p>
                                    <p className="text-sm text-cb-text-primary">{exhibicion.clienteNombre}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_crear.campo_sucursal')}</p>
                                    <p className="text-sm text-cb-text-primary">{exhibicion.sucursalNombre}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('checklist_crear.campo_exhibicion')}</p>
                                    <p className="text-sm text-cb-text-primary">{exhibicion.nroExhibicion} - {exhibicion.nombre}</p>
                                </div>
                            </div>

                            {catalogo.map(categoria => (
                                <div key={categoria.tipoId} className="bg-card border border-cb-border rounded-xl overflow-hidden">
                                    <div className="px-4 py-2.5 bg-muted text-xs font-black uppercase tracking-wider text-cb-text-secondary">
                                        {categoria.tipoNombre}
                                    </div>
                                    <div className="divide-y divide-cb-border">
                                        {categoria.items.map(item => {
                                            const r = respuestas[item.visualCodigo];
                                            return (
                                                <div key={item.visualCodigo} className="p-4 space-y-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sm font-semibold text-cb-text-primary">{item.nombre}</span>
                                                        <div className="flex gap-2 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setRespuesta(item.visualCodigo, false)}
                                                                className={cn(
                                                                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors duration-150 cursor-pointer',
                                                                    r && !r.desconforme
                                                                        ? 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30'
                                                                        : 'bg-card text-cb-text-secondary border-cb-border hover:bg-muted'
                                                                )}
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> {t('checklist_crear.conforme')}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setRespuesta(item.visualCodigo, true)}
                                                                className={cn(
                                                                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors duration-150 cursor-pointer',
                                                                    r?.desconforme
                                                                        ? 'bg-rose-500/15 text-rose-700 border-rose-400/30'
                                                                        : 'bg-card text-cb-text-secondary border-cb-border hover:bg-muted'
                                                                )}
                                                            >
                                                                <X className="w-3.5 h-3.5" /> {t('checklist_crear.no_conforme')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {r?.desconforme && (
                                                        <textarea
                                                            value={r.motivo}
                                                            onChange={(e) => setMotivo(item.visualCodigo, e.target.value)}
                                                            placeholder={t('checklist_crear.motivo_placeholder')}
                                                            maxLength={150}
                                                            rows={2}
                                                            autoFocus
                                                            className="block w-full px-3 py-2 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm resize-none"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {errorGuardar && (
                                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {errorGuardar}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleGuardar}
                                disabled={!puedeGuardar}
                                className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                            >
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('checklist_crear.accion_guardar')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChecklistCrearPage;
