import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Lightbulb,
    Sparkles,
    Tag,
    ShieldCheck,
    CheckCircle2,
    AlertTriangle,
    Store,
    ListChecks,
    Ticket,
    PlusCircle,
    ChevronDown,
    ChevronUp,
    LifeBuoy,
    Mail,
    Clock,
    LayoutGrid,
    Workflow,
    HelpCircle,
} from 'lucide-react';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { MobileMenuButton } from '../components/layout/MobileMenuButton.js';
import { StatusTabs, type StatusTabOption } from '../components/common/StatusTabs.js';
import { cn } from '../utils/cn.js';

type TabId = 'estandares' | 'flujo' | 'faq';

export function InformacionPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabId>('estandares');
    const [openFaq, setOpenFaq] = useState<number | null>(1);

    const tabs: StatusTabOption<TabId>[] = [
        { id: 'estandares', label: t('informacion_hub.tab_estandares') },
        { id: 'flujo', label: t('informacion_hub.tab_flujo') },
        { id: 'faq', label: t('informacion_hub.tab_faq') },
    ];

    const toggleFaq = (id: number) => {
        setOpenFaq(prev => (prev === id ? null : id));
    };

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            {/* Header con Menú Hamburguesa en Mobile */}
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    <MobileMenuButton />
                    <div>
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('informacion_hub.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('informacion_hub.subtitle')}</p>
                    </div>
                </div>
            </div>

            {/* Contenedor Principal */}
            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    {/* Pestañas Rápidas */}
                    <StatusTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

                    {/* ============================================================ */}
                    {/* PESTAÑA 1: ESTÁNDARES DE VISUAL MERCHANDISING               */}
                    {/* ============================================================ */}
                    {activeTab === 'estandares' && (
                        <div className="space-y-6">
                            {/* Reglas de Oro */}
                            <div className="space-y-3">
                                <div>
                                    <h2 className="text-sm font-black text-cb-text-primary uppercase tracking-wide flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-primary" />
                                        {t('informacion_hub.estandares_titulo')}
                                    </h2>
                                    <p className="text-xs text-cb-text-secondary mt-0.5">
                                        {t('informacion_hub.estandares_sub')}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Regla 1: Iluminación */}
                                    <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1 relative overflow-hidden', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                                                <Lightbulb className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold text-cb-text-primary">
                                                    {t('informacion_hub.regla_1_titulo')}
                                                </h3>
                                                <p className="text-xs text-cb-text-secondary mt-1 leading-relaxed">
                                                    {t('informacion_hub.regla_1_desc')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Regla 2: Carcasas y Limpieza */}
                                    <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1 relative overflow-hidden', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center shrink-0">
                                                <Sparkles className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold text-cb-text-primary">
                                                    {t('informacion_hub.regla_2_titulo')}
                                                </h3>
                                                <p className="text-xs text-cb-text-secondary mt-1 leading-relaxed">
                                                    {t('informacion_hub.regla_2_desc')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Regla 3: POP y Precios */}
                                    <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1 relative overflow-hidden', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                                <Tag className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold text-cb-text-primary">
                                                    {t('informacion_hub.regla_3_titulo')}
                                                </h3>
                                                <p className="text-xs text-cb-text-secondary mt-1 leading-relaxed">
                                                    {t('informacion_hub.regla_3_desc')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Regla 4: Integridad */}
                                    <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1 relative overflow-hidden', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                                                <ShieldCheck className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold text-cb-text-primary">
                                                    {t('informacion_hub.regla_4_titulo')}
                                                </h3>
                                                <p className="text-xs text-cb-text-secondary mt-1 leading-relaxed">
                                                    {t('informacion_hub.regla_4_desc')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Criterios Conforme / No Conforme */}
                            <div className="space-y-3">
                                <h2 className="text-sm font-black text-cb-text-primary uppercase tracking-wide flex items-center gap-2">
                                    <ListChecks className="w-4 h-4 text-primary" />
                                    {t('informacion_hub.criterios_evaluacion_titulo')}
                                </h2>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Conforme */}
                                    <div className={cn('bg-emerald-500/5 border border-emerald-500/20 p-4 shadow-cb-level-1', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-1">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            {t('informacion_hub.conforme_criterio_titulo')}
                                        </div>
                                        <p className="text-xs text-cb-text-secondary leading-relaxed">
                                            {t('informacion_hub.conforme_criterio_desc')}
                                        </p>
                                    </div>

                                    {/* No Conforme */}
                                    <div className={cn('bg-red-500/5 border border-red-500/20 p-4 shadow-cb-level-1', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="flex items-center gap-2 text-red-700 font-bold text-xs mb-1">
                                            <AlertTriangle className="w-4 h-4 text-red-600" />
                                            {t('informacion_hub.no_conforme_criterio_titulo')}
                                        </div>
                                        <p className="text-xs text-cb-text-secondary leading-relaxed">
                                            {t('informacion_hub.no_conforme_criterio_desc')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Tipos de Módulos */}
                            <div className="space-y-3">
                                <h2 className="text-sm font-black text-cb-text-primary uppercase tracking-wide flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4 text-primary" />
                                    {t('informacion_hub.tipos_mueble_titulo')}
                                </h2>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div className="bg-card border border-cb-border px-3.5 py-2.5 rounded-xl flex items-center gap-3">
                                        <Store className="w-4 h-4 text-primary/70 shrink-0" />
                                        <span className="text-xs text-cb-text-primary font-medium">{t('informacion_hub.tipo_pared')}</span>
                                    </div>
                                    <div className="bg-card border border-cb-border px-3.5 py-2.5 rounded-xl flex items-center gap-3">
                                        <Store className="w-4 h-4 text-primary/70 shrink-0" />
                                        <span className="text-xs text-cb-text-primary font-medium">{t('informacion_hub.tipo_isla')}</span>
                                    </div>
                                    <div className="bg-card border border-cb-border px-3.5 py-2.5 rounded-xl flex items-center gap-3">
                                        <Store className="w-4 h-4 text-primary/70 shrink-0" />
                                        <span className="text-xs text-cb-text-primary font-medium">{t('informacion_hub.tipo_cabecera')}</span>
                                    </div>
                                    <div className="bg-card border border-cb-border px-3.5 py-2.5 rounded-xl flex items-center gap-3">
                                        <Store className="w-4 h-4 text-primary/70 shrink-0" />
                                        <span className="text-xs text-cb-text-primary font-medium">{t('informacion_hub.tipo_podium')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* PESTAÑA 2: FLUJO OPERATIVO Y MANUAL                          */}
                    {/* ============================================================ */}
                    {activeTab === 'flujo' && (
                        <div className="space-y-6">
                            {/* Flujograma 3 Pasos */}
                            <div className="space-y-3">
                                <div>
                                    <h2 className="text-sm font-black text-cb-text-primary uppercase tracking-wide flex items-center gap-2">
                                        <Workflow className="w-4 h-4 text-primary" />
                                        {t('informacion_hub.flujo_titulo')}
                                    </h2>
                                    <p className="text-xs text-cb-text-secondary mt-0.5">
                                        {t('informacion_hub.flujo_sub')}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* Paso 1 */}
                                    <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1 relative', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-sm mb-3">
                                            1
                                        </div>
                                        <h3 className="text-xs font-bold text-cb-text-primary flex items-center gap-1.5">
                                            <PlusCircle className="w-3.5 h-3.5 text-primary" />
                                            {t('informacion_hub.paso_1_titulo')}
                                        </h3>
                                        <p className="text-xs text-cb-text-secondary mt-1.5 leading-relaxed">
                                            {t('informacion_hub.paso_1_desc')}
                                        </p>
                                    </div>

                                    {/* Paso 2 */}
                                    <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1 relative', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-sm mb-3">
                                            2
                                        </div>
                                        <h3 className="text-xs font-bold text-cb-text-primary flex items-center gap-1.5">
                                            <ListChecks className="w-3.5 h-3.5 text-primary" />
                                            {t('informacion_hub.paso_2_titulo')}
                                        </h3>
                                        <p className="text-xs text-cb-text-secondary mt-1.5 leading-relaxed">
                                            {t('informacion_hub.paso_2_desc')}
                                        </p>
                                    </div>

                                    {/* Paso 3 */}
                                    <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1 relative', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-sm mb-3">
                                            3
                                        </div>
                                        <h3 className="text-xs font-bold text-cb-text-primary flex items-center gap-1.5">
                                            <Ticket className="w-3.5 h-3.5 text-primary" />
                                            {t('informacion_hub.paso_3_titulo')}
                                        </h3>
                                        <p className="text-xs text-cb-text-secondary mt-1.5 leading-relaxed">
                                            {t('informacion_hub.paso_3_desc')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Cuadro Comparativo */}
                            <div className="space-y-3">
                                <h2 className="text-sm font-black text-cb-text-primary uppercase tracking-wide flex items-center gap-2">
                                    <HelpCircle className="w-4 h-4 text-primary" />
                                    {t('informacion_hub.comparativa_titulo')}
                                </h2>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Columna Checklist */}
                                    <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="flex items-center gap-2 border-b border-cb-border pb-2.5 mb-3">
                                            <ListChecks className="w-4 h-4 text-primary" />
                                            <h3 className="text-xs font-bold text-cb-text-primary">
                                                {t('informacion_hub.comparativa_checklist_col')}
                                            </h3>
                                        </div>
                                        <ul className="space-y-2 text-xs text-cb-text-secondary">
                                            <li className="flex items-start gap-2">
                                                <span className="text-primary font-bold">•</span>
                                                <span>{t('informacion_hub.comparativa_checklist_item1')}</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-primary font-bold">•</span>
                                                <span>{t('informacion_hub.comparativa_checklist_item2')}</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-primary font-bold">•</span>
                                                <span>{t('informacion_hub.comparativa_checklist_item3')}</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Columna Ticket */}
                                    <div className={cn('bg-card border border-cb-border p-4 shadow-cb-level-1', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <div className="flex items-center gap-2 border-b border-cb-border pb-2.5 mb-3">
                                            <Ticket className="w-4 h-4 text-primary" />
                                            <h3 className="text-xs font-bold text-cb-text-primary">
                                                {t('informacion_hub.comparativa_ticket_col')}
                                            </h3>
                                        </div>
                                        <ul className="space-y-2 text-xs text-cb-text-secondary">
                                            <li className="flex items-start gap-2">
                                                <span className="text-primary font-bold">•</span>
                                                <span>{t('informacion_hub.comparativa_ticket_item1')}</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-primary font-bold">•</span>
                                                <span>{t('informacion_hub.comparativa_ticket_item2')}</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-primary font-bold">•</span>
                                                <span>{t('informacion_hub.comparativa_ticket_item3')}</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* PESTAÑA 3: PREGUNTAS FRECUENTES (FAQ) Y SOPORTE              */}
                    {/* ============================================================ */}
                    {activeTab === 'faq' && (
                        <div className="space-y-6">
                            {/* Acordeón de FAQs */}
                            <div className="space-y-3">
                                <div>
                                    <h2 className="text-sm font-black text-cb-text-primary uppercase tracking-wide flex items-center gap-2">
                                        <HelpCircle className="w-4 h-4 text-primary" />
                                        {t('informacion_hub.faq_titulo')}
                                    </h2>
                                </div>

                                <div className="space-y-2.5">
                                    {/* FAQ 1 */}
                                    <div className={cn('bg-card border border-cb-border overflow-hidden transition-all duration-200', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <button
                                            type="button"
                                            onClick={() => toggleFaq(1)}
                                            className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="text-xs font-bold text-cb-text-primary pr-2">
                                                {t('informacion_hub.faq_1_q')}
                                            </span>
                                            {openFaq === 1 ? <ChevronUp className="w-4 h-4 text-primary shrink-0" /> : <ChevronDown className="w-4 h-4 text-cb-text-secondary shrink-0" />}
                                        </button>
                                        {openFaq === 1 && (
                                            <div className="px-3.5 pb-3.5 text-xs text-cb-text-secondary leading-relaxed border-t border-cb-border/60 pt-2.5">
                                                {t('informacion_hub.faq_1_a')}
                                            </div>
                                        )}
                                    </div>

                                    {/* FAQ 2 */}
                                    <div className={cn('bg-card border border-cb-border overflow-hidden transition-all duration-200', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <button
                                            type="button"
                                            onClick={() => toggleFaq(2)}
                                            className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="text-xs font-bold text-cb-text-primary pr-2">
                                                {t('informacion_hub.faq_2_q')}
                                            </span>
                                            {openFaq === 2 ? <ChevronUp className="w-4 h-4 text-primary shrink-0" /> : <ChevronDown className="w-4 h-4 text-cb-text-secondary shrink-0" />}
                                        </button>
                                        {openFaq === 2 && (
                                            <div className="px-3.5 pb-3.5 text-xs text-cb-text-secondary leading-relaxed border-t border-cb-border/60 pt-2.5">
                                                {t('informacion_hub.faq_2_a')}
                                            </div>
                                        )}
                                    </div>

                                    {/* FAQ 3 */}
                                    <div className={cn('bg-card border border-cb-border overflow-hidden transition-all duration-200', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <button
                                            type="button"
                                            onClick={() => toggleFaq(3)}
                                            className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="text-xs font-bold text-cb-text-primary pr-2">
                                                {t('informacion_hub.faq_3_q')}
                                            </span>
                                            {openFaq === 3 ? <ChevronUp className="w-4 h-4 text-primary shrink-0" /> : <ChevronDown className="w-4 h-4 text-cb-text-secondary shrink-0" />}
                                        </button>
                                        {openFaq === 3 && (
                                            <div className="px-3.5 pb-3.5 text-xs text-cb-text-secondary leading-relaxed border-t border-cb-border/60 pt-2.5">
                                                {t('informacion_hub.faq_3_a')}
                                            </div>
                                        )}
                                    </div>

                                    {/* FAQ 4 */}
                                    <div className={cn('bg-card border border-cb-border overflow-hidden transition-all duration-200', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                        <button
                                            type="button"
                                            onClick={() => toggleFaq(4)}
                                            className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="text-xs font-bold text-cb-text-primary pr-2">
                                                {t('informacion_hub.faq_4_q')}
                                            </span>
                                            {openFaq === 4 ? <ChevronUp className="w-4 h-4 text-primary shrink-0" /> : <ChevronDown className="w-4 h-4 text-cb-text-secondary shrink-0" />}
                                        </button>
                                        {openFaq === 4 && (
                                            <div className="px-3.5 pb-3.5 text-xs text-cb-text-secondary leading-relaxed border-t border-cb-border/60 pt-2.5">
                                                {t('informacion_hub.faq_4_a')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Tarjeta de Soporte */}
                            <div className={cn('bg-primary/5 border border-primary/20 p-4 shadow-cb-level-1', SIATC_THEME.TOKENS.RADIUS.CARD)}>
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                        <LifeBuoy className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <h3 className="text-xs font-bold text-primary">
                                            {t('informacion_hub.soporte_titulo')}
                                        </h3>
                                        <p className="text-xs text-cb-text-secondary">
                                            {t('informacion_hub.soporte_sub')}
                                        </p>
                                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-xs text-cb-text-primary">
                                            <div className="flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                                                <span className="font-bold">{t('informacion_hub.soporte_email_label')}</span>
                                                <a href={`mailto:${t('informacion_hub.soporte_email')}`} className="text-primary hover:underline truncate">
                                                    {t('informacion_hub.soporte_email')}
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-cb-text-secondary">
                                                <Clock className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                                <span>{t('informacion_hub.soporte_horario')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default InformacionPage;
