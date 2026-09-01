import { describe, it, expect } from 'vitest';
import {
    getEstadoTicketEstilo,
    getEstadoTicketLabelKey,
} from './estadoTicket.js';

describe('estadoTicket', () => {
    it('returns amber style for estado 01 (Nuevo/Pendiente)', () => {
        const estilo = getEstadoTicketEstilo('01');
        expect(estilo.badge).toContain('amber');
        expect(estilo.accent).toContain('amber');
        expect(getEstadoTicketLabelKey('01')).toBe('tickets_bandeja.estado_01');
    });

    it('returns blue style for estado 02 (Aprobado Supervisor)', () => {
        const estilo = getEstadoTicketEstilo('02');
        expect(estilo.badge).toContain('blue');
        expect(estilo.accent).toContain('blue');
        expect(getEstadoTicketLabelKey('02')).toBe('tickets_bandeja.estado_02');
    });

    it('returns purple style for estado 05 (Atendido Trade)', () => {
        const estilo = getEstadoTicketEstilo('05');
        expect(estilo.badge).toContain('purple');
        expect(estilo.accent).toContain('purple');
        expect(getEstadoTicketLabelKey('05')).toBe('tickets_bandeja.estado_05');
    });

    it('returns emerald style for estado 06 (Cerrado)', () => {
        const estilo = getEstadoTicketEstilo('06');
        expect(estilo.badge).toContain('emerald');
        expect(estilo.accent).toContain('emerald');
        expect(getEstadoTicketLabelKey('06')).toBe('tickets_bandeja.estado_06');
    });

    it('returns rose style for estado 00 (Anulado)', () => {
        const estilo = getEstadoTicketEstilo('00');
        expect(estilo.badge).toContain('rose');
        expect(estilo.accent).toContain('rose');
        expect(getEstadoTicketLabelKey('00')).toBe('tickets_bandeja.estado_00');
    });

    it('returns fallback for unknown estado', () => {
        const estilo = getEstadoTicketEstilo('999');
        expect(estilo.badge).toContain('muted');
        expect(getEstadoTicketLabelKey('999')).toBe('');
    });
});
