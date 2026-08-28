import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff, Plus, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';
import type { AgregarFotoInput, ExhibicionFoto } from '../../types/index.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';

export interface DetalleFotosTabProps {
    exhibicionId: number;
    fotos: ExhibicionFoto[];
    onFotoAgregada: (foto: ExhibicionFoto) => void;
}

// Una URL de foto vencida (SAS expirado) o un blob borrado no debe romper
// el layout de la grilla — se reemplaza por un placeholder en vez de dejar
// un ícono roto del navegador.
function Foto({ url, className }: { url: string; className: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) {
        return (
            <div className={`${className} flex items-center justify-center bg-muted text-cb-text-secondary`}>
                <ImageOff className="w-6 h-6" />
            </div>
        );
    }
    return <img src={url} onError={() => setFailed(true)} className={`${className} object-cover`} alt="" />;
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

export function DetalleFotosTab({ exhibicionId, fotos, onFotoAgregada }: DetalleFotosTabProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [subiendo, setSubiendo] = useState(false);
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

    return (
        <div className="space-y-4">
            <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleArchivoSeleccionado} className="hidden" />
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
                            <Foto url={principal.url} className="w-full max-w-xs rounded-xl border border-cb-border" />
                        </div>
                    )}
                    {resto.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-1.5">{t('exhibicion_detalle.foto_componente')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {resto.map(foto => (
                                    <Foto key={foto.id} url={foto.url} className="aspect-square rounded-xl border border-cb-border" />
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
