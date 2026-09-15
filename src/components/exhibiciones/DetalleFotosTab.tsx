import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff, Plus, Loader2, X, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';
import type { AgregarFotoInput, ExhibicionFoto } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';

export interface DetalleFotosTabProps {
    exhibicionId: number;
    fotos: ExhibicionFoto[];
    onFotoAgregada: (foto: ExhibicionFoto) => void;
    onFotoEliminada?: (id: number) => void;
}

// Una URL de foto vencida (SAS expirado) o un blob borrado no debe romper
// el layout de la grilla — se reemplaza por un placeholder en vez de dejar
// un ícono roto del navegador.
function Foto({
    foto, className, onEliminar, eliminando,
}: {
    foto: ExhibicionFoto;
    className: string;
    onEliminar?: (id: number) => void;
    eliminando: boolean;
}) {
    const { t } = useTranslation();
    const [failed, setFailed] = useState(false);
    return (
        <div className="relative">
            {failed ? (
                <div className={`${className} flex items-center justify-center bg-muted text-cb-text-secondary`}>
                    <ImageOff className="w-6 h-6" />
                </div>
            ) : (
                <img src={foto.url} onError={() => setFailed(true)} className={`${className} object-cover`} alt="" />
            )}
            {onEliminar && (
                <button
                    type="button"
                    onClick={() => onEliminar(foto.id)}
                    disabled={eliminando}
                    title={t('exhibicion_detalle.accion_eliminar_foto')}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-rose-600 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                >
                    {eliminando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                </button>
            )}
        </div>
    );
}

// Convierte un File a base64 + contentType leyendo el data: URL que arma
// FileReader y separando el prefijo — API estándar del navegador, sin
// librerías nuevas.
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

export function DetalleFotosTab({ exhibicionId, fotos, onFotoAgregada, onFotoEliminada }: DetalleFotosTabProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [subiendo, setSubiendo] = useState(false);
    const [eliminandoId, setEliminandoId] = useState<number | null>(null);
    const [error, setError] = useState('');

    const principal = fotos.find(f => f.esFotoPrincipal);
    const resto = fotos.filter(f => !f.esFotoPrincipal);

    // La primera foto que se sube queda como "principal" automáticamente
    // (no hay un toggle manual en esta primera versión — mantiene el
    // formulario simple, YAGNI).
    const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // permite volver a elegir el mismo archivo después
        if (!file) return;

        if (file.size > 8 * 1024 * 1024) {
            setError(t('exhibicion_detalle.error_foto_grande'));
            return;
        }

        setSubiendo(true);
        setError('');
        try {
            const { base64, contentType } = await leerArchivoComoBase64(file);
            const foto = await apiClient.post<ExhibicionFoto>(`/exhibiciones/${exhibicionId}/fotos`, {
                archivoBase64: base64,
                contentType,
                esFotoPrincipal: !principal,
            } satisfies AgregarFotoInput);
            onFotoAgregada(foto);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('exhibicion_detalle.error_agregar_foto'));
        } finally {
            setSubiendo(false);
        }
    };

    const handleEliminar = async (id: number) => {
        setEliminandoId(id);
        setError('');
        try {
            await apiClient.delete(`/exhibiciones/${exhibicionId}/fotos/${id}`);
            onFotoEliminada?.(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('exhibicion_detalle.error_eliminar_foto'));
        } finally {
            setEliminandoId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleArchivoSeleccionado} className="hidden" />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={subiendo}
                    className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}
                >
                    {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {t('exhibicion_detalle.accion_agregar_foto')}
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {fotos.length === 0 ? (
                <p className="text-sm text-cb-text-secondary text-center py-8">{t('exhibicion_detalle.sin_fotos')}</p>
            ) : (
                <>
                    {principal && (
                        <div>
                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-1.5">{t('exhibicion_detalle.foto_principal')}</p>
                            <Foto
                                foto={principal}
                                className="w-full max-w-xs rounded-xl border border-cb-border"
                                onEliminar={onFotoEliminada ? handleEliminar : undefined}
                                eliminando={eliminandoId === principal.id}
                            />
                        </div>
                    )}
                    {resto.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-1.5">{t('exhibicion_detalle.foto_componente')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {resto.map(foto => (
                                    <Foto
                                        key={foto.id}
                                        foto={foto}
                                        className="aspect-square rounded-xl border border-cb-border"
                                        onEliminar={onFotoEliminada ? handleEliminar : undefined}
                                        eliminando={eliminandoId === foto.id}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default DetalleFotosTab;
