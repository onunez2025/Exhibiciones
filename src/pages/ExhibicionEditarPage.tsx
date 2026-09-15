import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { DetalleComponentesTab } from '../components/exhibiciones/DetalleComponentesTab.js';
import { DetalleFotosTab } from '../components/exhibiciones/DetalleFotosTab.js';
import type {
    ExhibicionDetalle, ExhibicionesOpcionesCrear, EditarExhibicionInput, EditarExhibicionResponse,
    ExhibicionComponenteItem, ExhibicionFoto,
} from '../types/index.js';

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

export function ExhibicionEditarPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [detalle, setDetalle] = useState<ExhibicionDetalle | null>(null);
    const [opciones, setOpciones] = useState<ExhibicionesOpcionesCrear | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorCargar, setErrorCargar] = useState('');

    const [nombre, setNombre] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [piso, setPiso] = useState('');
    const [pisoDetalleId, setPisoDetalleId] = useState('');

    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');
    const [guardadoOk, setGuardadoOk] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        setErrorCargar('');
        try {
            const [detalleData, opcionesData] = await Promise.all([
                apiClient.get<ExhibicionDetalle>(`/exhibiciones/${id}`),
                apiClient.get<ExhibicionesOpcionesCrear>('/exhibiciones/opciones-crear'),
            ]);
            setDetalle(detalleData);
            setOpciones(opcionesData);
            setNombre(detalleData.nombre);
            setTipoId(String(detalleData.tipoId));
            setPiso(detalleData.piso ?? '');
            setPisoDetalleId(detalleData.pisoDetalleId ? String(detalleData.pisoDetalleId) : '');
        } catch {
            setErrorCargar(t('exhibicion_editar.error_cargar'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => { cargar(); }, [cargar]);

    const volver = () => navigate(`/exhibiciones/${id}`, { viewTransition: true });

    const puedeGuardar = nombre.trim() !== '' && tipoId !== '' && !guardando;

    const handleGuardar = async () => {
        if (!id) return;
        setGuardando(true);
        setErrorGuardar('');
        setGuardadoOk(false);
        try {
            const actualizado = await apiClient.put<EditarExhibicionResponse>(`/exhibiciones/${id}`, {
                nombre: nombre.trim(),
                tipoId: Number(tipoId),
                piso: piso.trim() || null,
                pisoDetalleId: pisoDetalleId ? Number(pisoDetalleId) : null,
            } satisfies EditarExhibicionInput);
            setDetalle(prev => (prev ? { ...prev, ...actualizado } : prev));
            setGuardadoOk(true);
        } catch (err) {
            setErrorGuardar(err instanceof Error ? err.message : t('exhibicion_editar.error_guardar'));
        } finally {
            setGuardando(false);
        }
    };

    const handleComponenteAgregado = (tipo: 1 | 2, item: ExhibicionComponenteItem) => {
        setDetalle(prev => {
            if (!prev) return prev;
            const componentes = tipo === 1
                ? { ...prev.componentes, productos: [...prev.componentes.productos, item] }
                : { ...prev.componentes, carcasas: [...prev.componentes.carcasas, item] };
            return { ...prev, componentes };
        });
    };

    const handleComponenteQuitado = (itemId: number) => {
        setDetalle(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                componentes: {
                    carcasas: prev.componentes.carcasas.filter(c => c.id !== itemId),
                    productos: prev.componentes.productos.filter(p => p.id !== itemId),
                },
            };
        });
    };

    const handleFotoAgregada = (foto: ExhibicionFoto) => {
        setDetalle(prev => (prev ? { ...prev, fotos: [...prev.fotos, foto] } : prev));
    };

    const handleFotoEliminada = (fotoId: number) => {
        setDetalle(prev => (prev ? { ...prev, fotos: prev.fotos.filter(f => f.id !== fotoId) } : prev));
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
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('exhibicion_editar.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>{t('exhibicion_editar.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    {loading && (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    )}

                    {!loading && errorCargar && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {errorCargar}
                        </div>
                    )}

                    {!loading && !errorCargar && detalle && detalle.estadoId !== 1 && (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <AlertCircle className="w-8 h-8 text-amber-500" />
                            <p className="text-sm font-bold text-cb-text-primary">{t('exhibicion_editar.no_pendiente_titulo')}</p>
                            <p className="text-xs text-cb-text-secondary max-w-xs">{t('exhibicion_editar.no_pendiente_mensaje')}</p>
                            <button type="button" onClick={volver} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}>
                                {t('exhibicion_detalle.volver_lista')}
                            </button>
                        </div>
                    )}

                    {!loading && !errorCargar && detalle && detalle.estadoId === 1 && opciones && (
                        <>
                            <div className="max-w-xl space-y-4">
                                <div>
                                    <label className={LABEL_CLASS}>{t('exhibicion_editar.campo_nombre')}</label>
                                    <input type="text" className={INPUT_CLASS} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>{t('exhibicion_editar.campo_tipo')}</label>
                                    <select className={INPUT_CLASS} value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                                        <option value="">{t('exhibicion_crear.selecciona')}</option>
                                        {opciones.tipos.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>{t('exhibicion_detalle.campo_piso')}</label>
                                    <input type="text" className={INPUT_CLASS} value={piso} onChange={(e) => setPiso(e.target.value)} />
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>{t('exhibicion_detalle.campo_detalle_ubicacion')}</label>
                                    <select className={INPUT_CLASS} value={pisoDetalleId} onChange={(e) => setPisoDetalleId(e.target.value)}>
                                        <option value="">{t('exhibicion_crear.selecciona')}</option>
                                        {opciones.pisoDetalles.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                    </select>
                                </div>

                                {errorGuardar && (
                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {errorGuardar}
                                    </div>
                                )}
                                {guardadoOk && (
                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        {t('exhibicion_editar.guardado_ok')}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleGuardar}
                                    disabled={!puedeGuardar}
                                    className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                                >
                                    {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {t('exhibicion_editar.accion_guardar')}
                                </button>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">{t('exhibicion_editar.seccion_componentes')}</h2>
                                <DetalleComponentesTab
                                    exhibicionId={detalle.id}
                                    carcasas={detalle.componentes.carcasas}
                                    productos={detalle.componentes.productos}
                                    onComponenteAgregado={handleComponenteAgregado}
                                    onComponenteQuitado={handleComponenteQuitado}
                                />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">{t('exhibicion_editar.seccion_fotos')}</h2>
                                <DetalleFotosTab
                                    exhibicionId={detalle.id}
                                    fotos={detalle.fotos}
                                    onFotoAgregada={handleFotoAgregada}
                                    onFotoEliminada={handleFotoEliminada}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExhibicionEditarPage;
