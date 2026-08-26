import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import type { ExhibicionFoto } from '../../types/index.js';

export interface DetalleFotosTabProps {
    fotos: ExhibicionFoto[];
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

export function DetalleFotosTab({ fotos }: DetalleFotosTabProps) {
    const { t } = useTranslation();
    const principal = fotos.find(f => f.esFotoPrincipal);
    const resto = fotos.filter(f => !f.esFotoPrincipal);

    if (fotos.length === 0) {
        return <p className="text-sm text-cb-text-secondary text-center py-12">{t('exhibicion_detalle.sin_fotos')}</p>;
    }

    return (
        <div className="space-y-4">
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
        </div>
    );
}

export default DetalleFotosTab;
