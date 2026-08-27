import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { DetallePrincipalTab } from '../components/exhibiciones/DetallePrincipalTab.js';
import { DetalleComponentesTab } from '../components/exhibiciones/DetalleComponentesTab.js';
import { DetalleFotosTab } from '../components/exhibiciones/DetalleFotosTab.js';
import type { ExhibicionDetalle } from '../types/index.js';

type TabKey = 'principal' | 'componentes' | 'fotos';

export function ExhibicionDetallePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [tab, setTab] = useState<TabKey>('principal');
    const [detalle, setDetalle] = useState<ExhibicionDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await apiClient.get<ExhibicionDetalle>(`/exhibiciones/${id}`);
            setDetalle(data);
        } catch {
            setError(t('exhibicion_detalle.error_cargar'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => { cargar(); }, [cargar]);

    const handleAprobado = (estadoId: 1 | 2) => {
        setDetalle(prev => (prev ? { ...prev, estadoId, canAprobar: estadoId === 1 } : prev));
    };

    const volver = () => navigate('/exhibiciones', { viewTransition: true });

    const TABS: { key: TabKey; label: string }[] = [
        { key: 'principal', label: t('exhibicion_detalle.tab_principal') },
        { key: 'componentes', label: t('exhibicion_detalle.tab_componentes') },
        { key: 'fotos', label: t('exhibicion_detalle.tab_fotos') },
    ];

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    {/* Flecha "volver", no el hamburger de MobileMenuButton —
                        esta es una vista drill-down, no un módulo del menú. */}
                    <button
                        type="button"
                        onClick={volver}
                        className="p-2 -ml-2 text-muted-foreground hover:bg-white hover:text-primary rounded-xl transition-colors duration-150 active:scale-90 cursor-pointer"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{detalle?.nroExhibicion ?? t('exhibicion_detalle.title')}</h1>
                        {/* PAGE_SUBTITLE_VISIBLE (no PAGE_SUBTITLE) — acá el
                            nombre es el dato principal que identifica el
                            registro, no una descripción decorativa; no debe
                            desaparecer en mobile. */}
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>{detalle?.nombre ?? ''}</p>
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
                                {t('exhibicion_detalle.volver_lista')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && detalle && (
                        <>
                            <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
                                {TABS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setTab(key)}
                                        className={
                                            tab === key
                                                ? 'px-3.5 py-2.5 rounded-lg text-xs font-bold bg-card text-primary shadow-sm cursor-pointer'
                                                : 'px-3.5 py-2.5 rounded-lg text-xs font-bold text-cb-text-secondary hover:text-primary transition-colors duration-150 cursor-pointer'
                                        }
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {tab === 'principal' && <DetallePrincipalTab detalle={detalle} onAprobado={handleAprobado} />}
                            {tab === 'componentes' && <DetalleComponentesTab carcasas={detalle.componentes.carcasas} productos={detalle.componentes.productos} />}
                            {tab === 'fotos' && <DetalleFotosTab fotos={detalle.fotos} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExhibicionDetallePage;
