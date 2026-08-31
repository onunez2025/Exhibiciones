import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { MobileMenuButton } from '../components/layout/MobileMenuButton.js';
import { ChecklistCard } from '../components/checklists/ChecklistCard.js';
import { ChecklistFiltrosPanel } from '../components/checklists/ChecklistFiltrosPanel.js';
import { Pagination } from '../components/exhibiciones/Pagination.js';
import type { ChecklistListItem, ChecklistsListResponse, ChecklistsFiltros } from '../types/index.js';

const DEFAULT_PAGE_SIZE = 20;

export function ChecklistsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [filtrosOpen, setFiltrosOpen] = useState(false);
    const [filtros, setFiltros] = useState<ChecklistsFiltros>({});
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    const [items, setItems] = useState<ChecklistListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [loadMoreError, setLoadMoreError] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const requestSeq = useRef(0);
    const fetchPage = useCallback(async (pageToLoad: number, append: boolean) => {
        const seq = ++requestSeq.current;
        if (append) { setLoadingMore(true); setLoadMoreError(false); }
        else { setLoading(true); setError(''); }
        try {
            const params = new URLSearchParams();
            params.set('page', String(pageToLoad));
            params.set('pageSize', String(pageSize));
            if (search) params.set('search', search);
            if (filtros.conforme) params.set('conforme', filtros.conforme);
            if (filtros.tienda) params.set('tienda', filtros.tienda);
            if (filtros.fechaDesde) params.set('fechaDesde', filtros.fechaDesde);
            if (filtros.fechaHasta) params.set('fechaHasta', filtros.fechaHasta);

            const data = await apiClient.get<ChecklistsListResponse>(`/checklists?${params.toString()}`);
            if (seq !== requestSeq.current) return;
            setTotal(data.total);
            setPage(data.page);
            setItems(prev => (append ? [...prev, ...data.items] : data.items));
        } catch (err) {
            if (seq !== requestSeq.current) return;
            console.error('[Checklists] fetch error:', err);
            if (append) setLoadMoreError(true); else setError(t('checklist_bandeja.error_cargar'));
        } finally {
            if (seq === requestSeq.current) {
                if (append) setLoadingMore(false); else setLoading(false);
            }
        }
    }, [pageSize, search, filtros, t]);

    useEffect(() => {
        setItems([]);
        setLoadMoreError(false);
        fetchPage(1, false);
    }, [search, filtros, pageSize, isDesktop]);

    const sentinelRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (isDesktop || loadMoreError || loadingMore) return;
        const el = sentinelRef.current;
        if (!el || items.length >= total) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) fetchPage(page + 1, true);
        }, { rootMargin: '200px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [isDesktop, items.length, total, loadingMore, loadMoreError, page, fetchPage]);

    const handleVer = (id: number) => {
        navigate(`/checklist/${id}`, { viewTransition: true });
    };

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    <MobileMenuButton />
                    <div>
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('checklist_bandeja.title')}</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('checklist_bandeja.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => setFiltrosOpen(v => !v)}
                            className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' gap-1.5 cursor-pointer shrink-0'}
                        >
                            <Filter className="w-4 h-4" /> {t('checklist_bandeja.filtros')}
                        </button>
                        <div className="flex gap-3 flex-1">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                                    <Search className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder={t('checklist_bandeja.search_placeholder')}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-[box-shadow,border-color] duration-200 ease-out outline-none text-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchPage(isDesktop ? page : 1, false)}
                                disabled={loading}
                                title={t('checklist_bandeja.reintentar')}
                                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-cb-border text-cb-text-secondary hover:text-primary hover:bg-primary/10 transition-colors duration-150 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                            </button>
                        </div>
                    </div>

                    <ChecklistFiltrosPanel
                        open={filtrosOpen}
                        filtros={filtros}
                        onApply={(f) => setFiltros(f)}
                        onClear={() => setFiltros({})}
                    />

                    {error && (
                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold enter-fade-up">
                            {error}
                        </div>
                    )}

                    {!error && !loading && items.length === 0 && (
                        <p className="text-sm text-cb-text-secondary text-center py-12">{t('checklist_bandeja.vacio')}</p>
                    )}

                    <div className="space-y-3">
                        {items.map(item => (
                            <ChecklistCard key={item.id} checklist={item} onVer={handleVer} />
                        ))}
                    </div>

                    {!isDesktop && items.length < total && (
                        <div ref={sentinelRef} className="flex justify-center py-4">
                            {loadMoreError ? (
                                <button
                                    type="button"
                                    onClick={() => fetchPage(page + 1, true)}
                                    className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY + ' cursor-pointer'}
                                >
                                    {t('checklist_bandeja.reintentar')}
                                </button>
                            ) : (
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            )}
                        </div>
                    )}
                </div>

                {isDesktop && total > 0 && (
                    <div className="px-4 pb-3 pt-1 border-t border-cb-border bg-card shrink-0">
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={(p) => fetchPage(p, false)}
                            onPageSizeChange={(size) => setPageSize(size)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChecklistsPage;
