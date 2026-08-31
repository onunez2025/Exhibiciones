import { describe, it, expect } from 'vitest';
import {
    getEstadoChecklistEstilo,
    getEstadoChecklistLabelKey,
    getConformeEstilo,
    getConformeLabelKey,
} from './estadoChecklist.js';

describe('estadoChecklist', () => {
    it('returns amber style for estado 1 (Pendiente)', () => {
        const estilo = getEstadoChecklistEstilo(1);
        expect(estilo.badge).toContain('amber');
        expect(estilo.accent).toContain('amber');
        expect(getEstadoChecklistLabelKey(1)).toBe('checklist_bandeja.estado_pendiente');
    });

    it('returns emerald style for estado 2 (Atendido)', () => {
        const estilo = getEstadoChecklistEstilo(2);
        expect(estilo.badge).toContain('emerald');
        expect(estilo.accent).toContain('emerald');
        expect(getEstadoChecklistLabelKey(2)).toBe('checklist_bandeja.estado_atendido');
    });

    it('returns fallback style and empty label key for unknown estado', () => {
        const estilo = getEstadoChecklistEstilo(99);
        expect(estilo.badge).toContain('muted');
        expect(getEstadoChecklistLabelKey(99)).toBe('');
    });

    it('returns green badge for conforme = true', () => {
        const estilo = getConformeEstilo(true);
        expect(estilo.badge).toContain('emerald');
        expect(getConformeLabelKey(true)).toBe('checklist_bandeja.conforme');
    });

    it('returns rose badge for conforme = false', () => {
        const estilo = getConformeEstilo(false);
        expect(estilo.badge).toContain('rose');
        expect(getConformeLabelKey(false)).toBe('checklist_bandeja.no_conforme');
    });
});
