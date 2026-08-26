import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50];

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
    const { t } = useTranslation();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const [pageInput, setPageInput] = useState(String(page));

    useEffect(() => setPageInput(String(page)), [page]);

    const commitPageInput = () => {
        const parsed = Math.min(totalPages, Math.max(1, Math.trunc(Number(pageInput)) || 1));
        setPageInput(String(parsed));
        if (parsed !== page) onPageChange(parsed);
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-cb-border mt-2">
            <div className="flex items-center gap-2 text-xs text-cb-text-secondary">
                <span>{t('exhibiciones_lista.por_pagina')}</span>
                <select
                    className="border border-cb-border rounded-lg px-2 py-1 text-sm bg-card cursor-pointer"
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                >
                    {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                </select>
                <span>{t('exhibiciones_lista.mostrando', { count: total === 0 ? 0 : Math.min(pageSize, total - (page - 1) * pageSize), total })}</span>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-cb-border text-cb-text-secondary hover:text-primary hover:bg-primary/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-cb-text-secondary px-1">
                    {t('exhibiciones_lista.pagina_de', { page, totalPages })}
                </span>
                <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={commitPageInput}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitPageInput(); }}
                    className="w-14 h-8 text-center border border-cb-border rounded-lg text-sm"
                />
                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-cb-border text-cb-text-secondary hover:text-primary hover:bg-primary/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default Pagination;
