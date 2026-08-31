export interface EstadoEstilo {
    badge: string;
    accent: string;
}

const ESTADO_ESTILOS: Record<number, EstadoEstilo> = {
    1: { badge: 'bg-amber-500/15 text-amber-700 border-amber-400/30', accent: 'before:bg-amber-400' },
    2: { badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30', accent: 'before:bg-emerald-400' },
};

const ESTADO_FALLBACK: EstadoEstilo = {
    badge: 'bg-muted text-cb-text-secondary border-cb-border',
    accent: 'before:bg-cb-border',
};

export function getEstadoChecklistEstilo(estadoId: number): EstadoEstilo {
    return ESTADO_ESTILOS[estadoId] ?? ESTADO_FALLBACK;
}

export function getEstadoChecklistLabelKey(estadoId: number): string {
    if (estadoId === 1) return 'checklist_bandeja.estado_pendiente';
    if (estadoId === 2) return 'checklist_bandeja.estado_atendido';
    return '';
}

export function getConformeEstilo(conforme: boolean): { badge: string } {
    return conforme
        ? { badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30' }
        : { badge: 'bg-rose-500/15 text-rose-700 border-rose-400/30' };
}

export function getConformeLabelKey(conforme: boolean): string {
    return conforme ? 'checklist_bandeja.conforme' : 'checklist_bandeja.no_conforme';
}
