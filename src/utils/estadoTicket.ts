export interface EstadoTicketEstilo {
    badge: string;
    accent: string;
}

const ESTADO_TICKET_ESTILOS: Record<string, EstadoTicketEstilo> = {
    '01': { badge: 'bg-amber-500/15 text-amber-700 border-amber-400/30', accent: 'before:bg-amber-400' },
    '02': { badge: 'bg-blue-500/15 text-blue-700 border-blue-400/30', accent: 'before:bg-blue-400' },
    '03': { badge: 'bg-indigo-500/15 text-indigo-700 border-indigo-400/30', accent: 'before:bg-indigo-400' },
    '04': { badge: 'bg-violet-500/15 text-violet-700 border-violet-400/30', accent: 'before:bg-violet-400' },
    '05': { badge: 'bg-purple-500/15 text-purple-700 border-purple-400/30', accent: 'before:bg-purple-400' },
    '06': { badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30', accent: 'before:bg-emerald-400' },
    '00': { badge: 'bg-rose-500/15 text-rose-700 border-rose-400/30', accent: 'before:bg-rose-400' },
};

const ESTADO_TICKET_FALLBACK: EstadoTicketEstilo = {
    badge: 'bg-muted text-cb-text-secondary border-cb-border',
    accent: 'before:bg-cb-border',
};

const ESTADO_TICKET_LABELS: Record<string, string> = {
    '01': 'tickets_bandeja.estado_01',
    '02': 'tickets_bandeja.estado_02',
    '03': 'tickets_bandeja.estado_03',
    '04': 'tickets_bandeja.estado_04',
    '05': 'tickets_bandeja.estado_05',
    '06': 'tickets_bandeja.estado_06',
    '00': 'tickets_bandeja.estado_00',
};

export function getEstadoTicketEstilo(estadoCodigo: string): EstadoTicketEstilo {
    return ESTADO_TICKET_ESTILOS[estadoCodigo] ?? ESTADO_TICKET_FALLBACK;
}

export function getEstadoTicketLabelKey(estadoCodigo: string): string {
    return ESTADO_TICKET_LABELS[estadoCodigo] ?? '';
}
