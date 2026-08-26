import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';
import { SIATC_THEME } from '../../utils/siatc-theme.js';
import { getEstadoEstilo, getEstadoLabelKey } from '../../utils/estadoExhibicion.js';
import { cn } from '../../utils/cn.js';
import type { ExhibicionDetalle, AprobarExhibicionResponse } from '../../types/index.js';

export interface DetallePrincipalTabProps {
    detalle: ExhibicionDetalle;
    onAprobado: (estadoId: 1 | 2) => void;
}

function Campo({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] font-black text-cb-text-secondary uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm text-cb-text-primary">{value}</p>
        </div>
    );
}

export function DetallePrincipalTab({ detalle, onAprobado }: DetallePrincipalTabProps) {
    const { t } = useTranslation();
    const [aprobando, setAprobando] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const estadoStyle = getEstadoEstilo(detalle.estadoId);
    const estadoLabelKey = getEstadoLabelKey(detalle.estadoId);

    const handleAprobar = async () => {
        setAprobando(true);
        setError('');
        try {
            const data = await apiClient.post<AprobarExhibicionResponse>(`/exhibiciones/${detalle.id}/aprobar`);
            setSuccess(true);
            onAprobado(data.estadoId);
        } catch (err) {
            // El backend manda un mensaje ya en español y seguro de mostrar
            // (409 "ya no está pendiente", o el genérico de safeError) — a
            // diferencia de la lista, acá sí se muestra err.message directo.
            setError(err instanceof Error ? err.message : t('exhibicion_detalle.error_aprobar'));
        } finally {
            setAprobando(false);
        }
    };

    return (
        <div className="space-y-4">
            <span className={cn('inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border', estadoStyle.badge)}>
                {estadoLabelKey ? t(estadoLabelKey) : '—'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label={t('exhibiciones_lista.campo_tienda')} value={detalle.clienteNombre} />
                <Campo label={t('exhibiciones_lista.campo_sucursal')} value={detalle.sucursalNombre} />
                <Campo label={t('exhibicion_detalle.campo_nombre')} value={detalle.nombre} />
                <Campo label={t('exhibiciones_lista.campo_tipo')} value={detalle.tipoNombre ?? '—'} />
                <Campo label={t('exhibicion_detalle.campo_piso')} value={detalle.piso ?? '—'} />
                <Campo label={t('exhibicion_detalle.campo_detalle_ubicacion')} value={detalle.pisoDetalleNombre ?? '—'} />
            </div>

            {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {t('exhibicion_detalle.aprobado_ok')}
                </div>
            )}

            {detalle.canAprobar && (
                <button
                    type="button"
                    onClick={handleAprobar}
                    disabled={aprobando}
                    className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY + ' w-full sm:w-auto gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'}
                >
                    {aprobando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {t('exhibicion_detalle.accion_revisado')}
                </button>
            )}
        </div>
    );
}

export default DetallePrincipalTab;
