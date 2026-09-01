export function calcularPorcentajeConformidad(total: number, conformes: number): number {
    if (total <= 0) return 100;
    return Math.round((conformes / total) * 100);
}

export function calcularTotalPendientes(
    checklistsPendientes: number,
    exhibicionesPendientes: number,
    ticketsPendientes: number
): number {
    return Math.max(0, checklistsPendientes) + Math.max(0, exhibicionesPendientes) + Math.max(0, ticketsPendientes);
}
