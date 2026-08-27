import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import type { ExhibicionesOpcionesCrear, CrearExhibicionInput, CrearExhibicionResponse } from '../types/index.js';

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

export function ExhibicionCrearPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [opciones, setOpciones] = useState<ExhibicionesOpcionesCrear | null>(null);
    const [loadingOpciones, setLoadingOpciones] = useState(true);
    const [errorOpciones, setErrorOpciones] = useState('');

    const [clienteCodigo, setClienteCodigo] = useState('');
    const [sucursalCodigo, setSucursalCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [piso, setPiso] = useState('');
    const [pisoDetalleId, setPisoDetalleId] = useState('');

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        apiClient.get<ExhibicionesOpcionesCrear>('/exhibiciones/opciones-crear')
            .then(setOpciones)
            .catch(() => setErrorOpciones(t('exhibicion_crear.error_cargar_opciones')))
            .finally(() => setLoadingOpciones(false));
    }, [t]);

    // Una tienda por VC_cliente_codigo — TB_EXHIBICION trae una fila por
    // cada combinación tienda+sucursal, así que una tienda con varias
    // sucursales aparece repetida en `opciones.tiendas`.
    const tiendas = useMemo(() => {
        const vistos = new Set<string>();
        return (opciones?.tiendas ?? []).filter(x => {
            if (vistos.has(x.clienteCodigo)) return false;
            vistos.add(x.clienteCodigo);
            return true;
        });
    }, [opciones]);

    const sucursales = useMemo(
        () => (opciones?.tiendas ?? []).filter(x => x.clienteCodigo === clienteCodigo),
        [opciones, clienteCodigo]
    );

    const puedeGuardar = clienteCodigo !== '' && sucursalCodigo !== '' && nombre.trim() !== '' && tipoId !== '' && !guardando;

    const volver = () => navigate('/exhibiciones', { viewTransition: true });

    const handleGuardar = async () => {
        const sucursal = sucursales.find(s => s.sucursalCodigo === sucursalCodigo);
        const tienda = tiendas.find(x => x.clienteCodigo === clienteCodigo);
        if (!sucursal || !tienda) return;

        setGuardando(true);
        setError('');
        try {
            const data = await apiClient.post<CrearExhibicionResponse>('/exhibiciones', {
                clienteCodigo: tienda.clienteCodigo,
                clienteNombre: tienda.clienteNombre,
                sucursalCodigo: sucursal.sucursalCodigo,
                sucursalNombre: sucursal.sucursalNombre,
                direccion: sucursal.direccion,
                nombre: nombre.trim(),
                tipoId: Number(tipoId),
                piso: piso.trim() || null,
                pisoDetalleId: pisoDetalleId ? Number(pisoDetalleId) : null,
            } satisfies CrearExhibicionInput);
            navigate(`/exhibiciones/${data.id}`, { viewTransition: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('exhibicion_crear.error_guardar'));
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
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('exhibicion_crear.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE_VISIBLE}>{t('exhibicion_crear.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    {loadingOpciones && (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    )}

                    {!loadingOpciones && errorOpciones && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {errorOpciones}
                        </div>
                    )}

                    {!loadingOpciones && !errorOpciones && opciones && (
                        <div className="max-w-xl space-y-4">
                            <div>
                                <label className={LABEL_CLASS}>{t('exhibicion_crear.campo_tienda')}</label>
                                <select
                                    className={INPUT_CLASS}
                                    value={clienteCodigo}
                                    onChange={(e) => { setClienteCodigo(e.target.value); setSucursalCodigo(''); }}
                                >
                                    <option value="">{t('exhibicion_crear.selecciona')}</option>
                                    {tiendas.map(x => <option key={x.clienteCodigo} value={x.clienteCodigo}>{x.clienteNombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>{t('exhibicion_crear.campo_sucursal')}</label>
                                <select
                                    className={INPUT_CLASS}
                                    value={sucursalCodigo}
                                    onChange={(e) => setSucursalCodigo(e.target.value)}
                                    disabled={!clienteCodigo}
                                >
                                    <option value="">{t('exhibicion_crear.selecciona')}</option>
                                    {sucursales.map(s => <option key={s.sucursalCodigo} value={s.sucursalCodigo}>{s.sucursalNombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>{t('exhibicion_crear.campo_nombre')}</label>
                                <input
                                    type="text"
                                    className={INPUT_CLASS}
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    placeholder={t('exhibicion_crear.campo_nombre_placeholder')}
                                />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>{t('exhibiciones_lista.filtro_tipo')}</label>
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

                            {error && (
                                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleGuardar}
                                disabled={!puedeGuardar}
                                className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                            >
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('exhibicion_crear.accion_guardar')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExhibicionCrearPage;
