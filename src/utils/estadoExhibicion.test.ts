import { describe, it, expect } from 'vitest';
import { getEstadoEstilo, getEstadoLabelKey } from './estadoExhibicion.js';

describe('getEstadoEstilo', () => {
    it('returns the amber style for estado 1 (Pendiente)', () => {
        expect(getEstadoEstilo(1).accent).toBe('before:bg-amber-400');
    });

    it('returns the emerald style for estado 2 (Aprobado)', () => {
        expect(getEstadoEstilo(2).accent).toBe('before:bg-emerald-400');
    });

    it('returns a neutral fallback for an unrecognized estado', () => {
        expect(getEstadoEstilo(0)).toEqual({ badge: 'bg-muted text-cb-text-secondary border-cb-border', accent: 'before:bg-cb-border' });
        expect(getEstadoEstilo(99)).toEqual(getEstadoEstilo(0));
    });
});

describe('getEstadoLabelKey', () => {
    it('returns the pendiente key for estado 1', () => {
        expect(getEstadoLabelKey(1)).toBe('exhibiciones_lista.estado_pendiente');
    });

    it('returns the aprobado key for estado 2', () => {
        expect(getEstadoLabelKey(2)).toBe('exhibiciones_lista.estado_aprobado');
    });

    it('returns an empty string for an unrecognized estado', () => {
        expect(getEstadoLabelKey(0)).toBe('');
    });
});
