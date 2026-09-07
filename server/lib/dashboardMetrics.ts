// null cuando total <= 0 — "todavía no hay checklists" es un estado
// distinto de "100% de conformidad", y confundirlos le muestra a un
// supervisor un número perfecto que en realidad no significa nada (ver
// revisión final del 2026-09-07: un fallo de carga o una base vacía
// renderizaban "100% de conformidad global" como si fuera real).
export function calcularPorcentajeConformidad(total: number, conformes: number): number | null {
    if (total <= 0) return null;
    return Math.round((conformes / total) * 100);
}
