// Estados de una exhibición: 1 = Pendiente, 2 = Aprobado (0 = Anulado nunca
// llega hasta acá salvo acceso directo por URL a la vista de detalle). No
// hay catálogo real en la base para estos dos valores (ver spec de
// Exhibiciones-Lista) — son constantes de UI compartidas entre la tarjeta
// de la lista y la vista de detalle.
export interface EstadoEstilo {
    badge: string;
    accent: string;
}

const ESTADO_ESTILOS: Record<1 | 2, EstadoEstilo> = {
    1: { badge: 'bg-amber-500/15 text-amber-700 border-amber-400/30', accent: 'before:bg-amber-400' },
    2: { badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30', accent: 'before:bg-emerald-400' },
};

const ESTADO_ESTILO_FALLBACK: EstadoEstilo = { badge: 'bg-muted text-cb-text-secondary border-cb-border', accent: 'before:bg-cb-border' };

export function getEstadoEstilo(estadoId: number): EstadoEstilo {
    return estadoId === 1 || estadoId === 2 ? ESTADO_ESTILOS[estadoId] : ESTADO_ESTILO_FALLBACK;
}

// Devuelve la clave de i18n (namespace exhibiciones_lista, ya usado por la
// lista) o '' si el estado no es 1 ni 2 — quien llama decide el fallback
// visual ('—').
export function getEstadoLabelKey(estadoId: number): string {
    if (estadoId === 1) return 'exhibiciones_lista.estado_pendiente';
    if (estadoId === 2) return 'exhibiciones_lista.estado_aprobado';
    return '';
}
