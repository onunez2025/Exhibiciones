import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Store,
    ClipboardCheck,
    Ticket,
    Clock,
    PlusCircle,
    CheckSquare,
    RefreshCw,
    AlertCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { apiClient } from '../services/apiClient.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { MobileMenuButton } from '../components/layout/MobileMenuButton.js';
import { KPICard } from '../components/dashboard/KPICard.js';
import { ChecklistsRecientesList, TicketsRecientesList } from '../components/dashboard/ActividadRecienteList.js';
import type { DashboardResumenResponse } from '../types/index.js';

export function DashboardPage() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [data, setData] = useState<DashboardResumenResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const cargar = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.get<DashboardResumenResponse>('/dashboard/resumen');
            setData(res);
        } catch (err) {
            console.error('[Dashboard] error cargando resumen:', err);
            setError(t('dashboard.error_cargar'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const nombreUsuario = user?.full_name?.split(' ')[0] || user?.username || 'Usuario';
    const fechaHoy = new Date().toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const kpis = data?.kpis;
    const totalTareasPendientes = (kpis?.checklistsPendientes ?? 0) + (kpis?.exhibicionesPendientes ?? 0);

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2">
                        <MobileMenuButton />
                        <div>
                            <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('dashboard.title')}</h1>
                            <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('dashboard.subtitle')}</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={cargar}
                        disabled={loading}
                        title={t('dashboard.reintentar')}
                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-cb-border text-cb-text-secondary hover:text-primary hover:bg-primary/10 transition-colors duration-150 active:scale-95 cursor-pointer disabled:opacity-40"
                    >
                        <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                    </button>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    {/* Banner de Bienvenida y Fecha */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-card border border-cb-border rounded-2xl shadow-cb-level-1">
                        <div>
                            <h2 className="text-lg sm:text-xl font-black text-cb-text-primary">
                                {t('dashboard.welcome', { name: nombreUsuario })} 👋
                            </h2>
                            <p className="text-xs text-cb-text-secondary mt-0.5">
                                {user?.role_name || 'Operaciones'} · Sole Perú
                            </p>
                        </div>
                        <div className="text-xs font-semibold text-cb-text-secondary capitalize bg-muted/60 px-3 py-1.5 rounded-xl border border-cb-border self-start sm:self-auto">
                            {fechaHoy}
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold enter-fade-up">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                            <button
                                type="button"
                                onClick={cargar}
                                className="ml-auto underline cursor-pointer text-xs"
                            >
                                {t('dashboard.reintentar')}
                            </button>
                        </div>
                    )}

                    {/* Grilla de 4 KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard
                            title={t('dashboard.kpi_exhibiciones_activas')}
                            value={kpis?.exhibicionesActivas ?? 0}
                            subtitle={t('dashboard.kpi_exhibiciones_pendientes_sub', { count: kpis?.exhibicionesPendientes ?? 0 })}
                            icon={Store}
                            colorVariant="primary"
                            loading={loading}
                            onClick={() => navigate('/exhibiciones')}
                        />
                        <KPICard
                            title={t('dashboard.kpi_checklists_total')}
                            value={kpis?.checklistsTotal ?? 0}
                            subtitle={t('dashboard.kpi_conformidad_sub', { percent: kpis?.porcentajeConformidad ?? 100 })}
                            icon={ClipboardCheck}
                            colorVariant="emerald"
                            loading={loading}
                            onClick={() => navigate('/checklist')}
                        />
                        <KPICard
                            title={t('dashboard.kpi_tickets_pendientes')}
                            value={kpis?.ticketsPendientes ?? 0}
                            subtitle={t('dashboard.kpi_tickets_atendidos_sub', { count: kpis?.ticketsAtendidos ?? 0 })}
                            icon={Ticket}
                            colorVariant="amber"
                            loading={loading}
                            onClick={() => navigate('/tickets')}
                        />
                        <KPICard
                            title={t('dashboard.kpi_tareas_pendientes')}
                            value={totalTareasPendientes}
                            subtitle={t('dashboard.kpi_tareas_pendientes_sub')}
                            icon={Clock}
                            colorVariant="purple"
                            loading={loading}
                            onClick={() => navigate('/checklist')}
                        />
                    </div>

                    {/* Accesos Rápidos */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-black text-cb-text-secondary uppercase tracking-wider">
                            {t('dashboard.accesos_rapidos')}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/exhibiciones/nueva')}
                                className="flex items-center gap-3 p-3.5 rounded-xl border border-cb-border bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-150 cursor-pointer shadow-cb-level-1 text-left group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150">
                                    <PlusCircle className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-cb-text-primary group-hover:text-primary transition-colors">
                                        {t('dashboard.accion_nueva_exhibicion')}
                                    </p>
                                    <p className="text-[10px] text-cb-text-secondary">
                                        {t('dashboard.accion_nueva_exhibicion_desc')}
                                    </p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/checklist')}
                                className="flex items-center gap-3 p-3.5 rounded-xl border border-cb-border bg-card hover:bg-muted/40 hover:border-emerald-500/40 transition-all duration-150 cursor-pointer shadow-cb-level-1 text-left group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150">
                                    <CheckSquare className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-cb-text-primary group-hover:text-emerald-600 transition-colors">
                                        {t('dashboard.accion_ver_checklists')}
                                    </p>
                                    <p className="text-[10px] text-cb-text-secondary">
                                        {t('dashboard.accion_ver_checklists_desc')}
                                    </p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/tickets')}
                                className="flex items-center gap-3 p-3.5 rounded-xl border border-cb-border bg-card hover:bg-muted/40 hover:border-amber-500/40 transition-all duration-150 cursor-pointer shadow-cb-level-1 text-left group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150">
                                    <Ticket className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-cb-text-primary group-hover:text-amber-600 transition-colors">
                                        {t('dashboard.accion_ver_tickets')}
                                    </p>
                                    <p className="text-[10px] text-cb-text-secondary">
                                        {t('dashboard.accion_ver_tickets_desc')}
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Grilla de Actividad Reciente (2 Columnas) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <ChecklistsRecientesList
                            items={data?.ultimosChecklists ?? []}
                            loading={loading}
                        />
                        <TicketsRecientesList
                            items={data?.ultimosTickets ?? []}
                            loading={loading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
