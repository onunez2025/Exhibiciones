import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertCircle, Plus, ImageOff } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useDialog } from '../context/DialogContext.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { cn } from '../utils/cn.js';
import type {
    ExhibicionDetalle, TiposTicketResponse, TipoTicketOpcion,
    CrearTicketInput, CrearTicketResponse, AgregarFotoTicketInput, TicketFoto,
} from '../types/index.js';

type TabKey = 'principal' | 'componentes' | 'fotos';

const INPUT_CLASS = 'block w-full px-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm';
const LABEL_CLASS = 'block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-1.5';

// Convierte un File a base64 + contentType — mismo helper ya usado en
// DetalleFotosTab, duplicado acá porque no vale la pena extraer un módulo
// compartido para 12 líneas usadas en solo 2 sitios (YAGNI).
function leerArchivoComoBase64(file: File): Promise<{ base64: string; contentType: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const resultado = reader.result as string;
            const [prefijo, base64] = resultado.split(',');
            const match = /data:(.*);base64/.exec(prefijo);
            resolve({ base64, contentType: match ? match[1] : file.type });
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function Foto({ url }: { url: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) {
        return (
            <div className="aspect-square rounded-xl border border-cb-border flex items-center justify-center bg-muted text-cb-text-secondary">
                <ImageOff className="w-6 h-6" />
            </div>
        );
    }
    return <img src={url} onError={() => setFailed(true)} className="aspect-square rounded-xl border border-cb-border object-cover" alt="" />;
}

export function TicketCrearPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { alert } = useDialog();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [tab, setTab] = useState<TabKey>('principal');
    const [exhibicion, setExhibicion] = useState<ExhibicionDetalle | null>(null);
    const [tipos, setTipos] = useState<TipoTicketOpcion[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [tipoId, setTipoId] = useState('');
    const [motivo, setMotivo] = useState('');
    const [cantidades, setCantidades] = useState<Record<number, string>>({});

    const [numero, setNumero] = useState<string | null>(null);
    const [fotos, setFotos] = useState<TicketFoto[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const [errorFoto, setErrorFoto] = useState('');

    const cargar = useCallback(() => {
        setLoading(true);
        setError('');
        Promise.all([
            apiClient.get<ExhibicionDetalle>(`/exhibiciones/${id}`),
            apiClient.get<TiposTicketResponse>('/exhibiciones/tipos-ticket'),
        ])
            .then(([exhibicionData, tiposData]) => {
                setExhibicion(exhibicionData);
                setTipos(tiposData.tipos);
            })
            .catch(() => setError(t('ticket_crear.error_cargar')))
            .finally(() => setLoading(false));
    }, [id, t]);

    useEffect(() => { cargar(); }, [cargar]);

    const volver = () => navigate(`/exhibiciones/${id}`, { viewTransition: true });

    // Deshabilitado si el catálogo de tipos llega vacío (no debería pasar
    // con datos sanos, pero un formulario sin ningún tipo elegible no debe
    // dejar crear un ticket sin sentido — mismo guard ya aplicado en
    // Checklist-Crear tras su revisión final).
    const puedeGuardar = (tipos?.length ?? 0) > 0 && tipoId !== '' && motivo.trim() !== '' && !guardando;

    const handleGuardar = async () => {
        if (!exhibicion) return;
        setGuardando(true);
        setErrorGuardar('');
        try {
            const componentes = [...exhibicion.componentes.carcasas, ...exhibicion.componentes.productos]
                .map(item => ({ componenteId: item.id, cantidad: Number(cantidades[item.id] ?? 0) }))
                .filter(c => c.cantidad > 0);

            const data = await apiClient.post<CrearTicketResponse>(`/exhibiciones/${id}/tickets`, {
                tipoId: Number(tipoId),
                motivo: motivo.trim(),
                componentes,
            } satisfies CrearTicketInput);

            setNumero(data.numero);
            setTab('fotos');
        } catch (err) {
            setErrorGuardar(err instanceof Error ? err.message : t('ticket_crear.error_guardar'));
        } finally {
            setGuardando(false);
        }
    };

    const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !numero) return;

        if (file.size > 8 * 1024 * 1024) {
            setErrorFoto(t('ticket_crear.error_foto_grande'));
            return;
        }

        setSubiendoFoto(true);
        setErrorFoto('');
        try {
            const { base64, contentType } = await leerArchivoComoBase64(file);
            const foto = await apiClient.post<TicketFoto>(`/exhibiciones/${id}/tickets/${numero}/fotos`, {
                archivoBase64: base64,
                contentType,
            } satisfies AgregarFotoTicketInput);
            setFotos(prev => [...prev, foto]);
        } catch (err) {
            setErrorFoto(err instanceof Error ? err.message : t('ticket_crear.error_agregar_foto'));
        } finally {
            setSubiendoFoto(false);
        }
    };

    const handleFinalizar = async () => {
        await alert(t('ticket_crear.guardado_titulo'), t('ticket_crear.guardado_mensaje', { numero }));
        navigate(`/exhibiciones/${id}`, { viewTransition: true });
    };

    const TABS: { key: TabKey; label: string }[] = [
        { key: 'principal', label: t('ticket_crear.tab_principal') },
        { key: 'componentes', label: t('ticket_crear.tab_componentes') },
        { key: 'fotos', label: t('ticket_crear.tab_fotos') },
    ];

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
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('ticket_crear.title')}</h1>
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
                            <button type="button" onClick={cargar} className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}>
                                {t('ticket_crear.reintentar')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && exhibicion && tipos && (
                        <div className="max-w-2xl space-y-4">
                            <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
                                {TABS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setTab(key)}
                                        disabled={key === 'fotos' && !numero}
                                        className={cn(
                                            'px-3.5 py-2.5 rounded-lg text-xs font-bold transition-colors duration-150',
                                            tab === key ? 'bg-card text-primary shadow-sm cursor-pointer' : 'text-cb-text-secondary hover:text-primary cursor-pointer',
                                            key === 'fotos' && !numero && 'opacity-40 cursor-not-allowed hover:text-cb-text-secondary'
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {numero && (
                                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-700 text-sm font-semibold">
                                    <span>{t('ticket_crear.ticket_creado', { numero })}</span>
                                    <button
                                        type="button"
                                        onClick={handleFinalizar}
                                        className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' cursor-pointer shrink-0'}
                                    >
                                        {t('ticket_crear.accion_finalizar')}
                                    </button>
                                </div>
                            )}

                            {tab === 'principal' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3 p-4 bg-card border border-cb-border rounded-xl">
                                        <div>
                                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('ticket_crear.campo_tienda')}</p>
                                            <p className="text-sm text-cb-text-primary">{exhibicion.clienteNombre}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('ticket_crear.campo_sucursal')}</p>
                                            <p className="text-sm text-cb-text-primary">{exhibicion.sucursalNombre}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-0.5">{t('ticket_crear.campo_exhibicion')}</p>
                                            <p className="text-sm text-cb-text-primary">{exhibicion.nroExhibicion} - {exhibicion.nombre}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={LABEL_CLASS}>{t('ticket_crear.campo_tipo')}</label>
                                        <select className={INPUT_CLASS} value={tipoId} onChange={(e) => setTipoId(e.target.value)} disabled={numero !== null}>
                                            <option value="">{t('ticket_crear.selecciona')}</option>
                                            {tipos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className={LABEL_CLASS}>{t('ticket_crear.campo_motivo')}</label>
                                        <textarea
                                            value={motivo}
                                            onChange={(e) => setMotivo(e.target.value)}
                                            placeholder={t('ticket_crear.motivo_placeholder')}
                                            maxLength={200}
                                            rows={3}
                                            disabled={numero !== null}
                                            className={INPUT_CLASS + ' resize-none'}
                                        />
                                    </div>

                                    {errorGuardar && (
                                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            {errorGuardar}
                                        </div>
                                    )}

                                    {!numero && (
                                        <button
                                            type="button"
                                            onClick={handleGuardar}
                                            disabled={!puedeGuardar}
                                            className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                                        >
                                            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                            {t('ticket_crear.accion_guardar')}
                                        </button>
                                    )}
                                </div>
                            )}

                            {tab === 'componentes' && (
                                <div className="space-y-4">
                                    {[...exhibicion.componentes.carcasas, ...exhibicion.componentes.productos].length === 0 ? (
                                        <p className="text-sm text-cb-text-secondary text-center py-8">{t('ticket_crear.sin_componentes')}</p>
                                    ) : (
                                        <ul className="border border-cb-border rounded-xl divide-y divide-cb-border">
                                            {[...exhibicion.componentes.carcasas, ...exhibicion.componentes.productos].map(item => (
                                                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                                    <span className="text-cb-text-primary">{item.nombre ?? '—'}</span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        disabled={numero !== null}
                                                        value={cantidades[item.id] ?? ''}
                                                        onChange={(e) => setCantidades(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                        placeholder="0"
                                                        className="w-20 px-2 py-1.5 bg-card text-cb-text-primary border border-cb-border rounded-lg text-sm text-right"
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {tab === 'fotos' && numero && (
                                <div className="space-y-4">
                                    <div>
                                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleArchivoSeleccionado} className="hidden" />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={subiendoFoto}
                                            className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                                        >
                                            {subiendoFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            {t('ticket_crear.accion_agregar_foto')}
                                        </button>
                                    </div>

                                    {errorFoto && (
                                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                                            {errorFoto}
                                        </div>
                                    )}

                                    {fotos.length === 0 ? (
                                        <p className="text-sm text-cb-text-secondary text-center py-8">{t('ticket_crear.sin_fotos')}</p>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {fotos.map(foto => <Foto key={foto.id} url={foto.url} />)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TicketCrearPage;
