import { describe, it, expect } from 'vitest';
import { validarTicketCrear } from './ticketCrear.js';

const TIPOS = [1, 2, 3, 6, 7];
const COMPONENTES = [101, 102, 103];

function body(overrides: Record<string, unknown> = {}) {
    return { tipoId: 7, motivo: 'Reposición de accesorios faltantes', componentes: [], ...overrides };
}

describe('validarTicketCrear', () => {
    it('accepts a valid ticket with no componentes', () => {
        const result = validarTicketCrear(body(), TIPOS, COMPONENTES);
        expect(result).toEqual({
            valido: true,
            datos: { tipoId: 7, motivo: 'Reposición de accesorios faltantes', componentes: [] },
        });
    });

    it('accepts a valid ticket with componentes, trims motivo', () => {
        const result = validarTicketCrear(
            body({ motivo: '  Cambiar carcasa dañada  ', componentes: [{ componenteId: 101, cantidad: 2 }] }),
            TIPOS, COMPONENTES
        );
        expect(result).toEqual({
            valido: true,
            datos: { tipoId: 7, motivo: 'Cambiar carcasa dañada', componentes: [{ componenteId: 101, cantidad: 2 }] },
        });
    });

    it('accepts multiple distinct componentes', () => {
        const result = validarTicketCrear(
            body({ componentes: [{ componenteId: 101, cantidad: 1 }, { componenteId: 103, cantidad: 5 }] }),
            TIPOS, COMPONENTES
        );
        expect(result.valido).toBe(true);
    });

    it('rejects a tipoId not in the active catalog', () => {
        expect(validarTicketCrear(body({ tipoId: 99 }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'Tipo de ticket inválido.' });
    });

    it('rejects a missing or non-numeric tipoId', () => {
        expect(validarTicketCrear(body({ tipoId: 'x' }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'Tipo de ticket inválido.' });
    });

    it('rejects an empty or whitespace-only motivo', () => {
        expect(validarTicketCrear(body({ motivo: '   ' }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'El motivo es obligatorio.' });
    });

    it('rejects a motivo longer than 200 characters', () => {
        expect(validarTicketCrear(body({ motivo: 'x'.repeat(201) }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'El motivo no puede superar los 200 caracteres.' });
    });

    it('rejects a componenteId not in the exhibición\'s own componentes', () => {
        expect(validarTicketCrear(body({ componentes: [{ componenteId: 999, cantidad: 1 }] }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'Componente inválido.' });
    });

    it('rejects a duplicated componenteId', () => {
        expect(validarTicketCrear(
            body({ componentes: [{ componenteId: 101, cantidad: 1 }, { componenteId: 101, cantidad: 2 }] }),
            TIPOS, COMPONENTES
        )).toEqual({ valido: false, error: 'Componente duplicado.' });
    });

    it('rejects a cantidad that is zero, negative, or not an integer', () => {
        expect(validarTicketCrear(body({ componentes: [{ componenteId: 101, cantidad: 0 }] }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'La cantidad debe ser un número entero mayor a 0.' });
        expect(validarTicketCrear(body({ componentes: [{ componenteId: 101, cantidad: 1.5 }] }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'La cantidad debe ser un número entero mayor a 0.' });
    });

    it('rejects componentes that is not an array', () => {
        expect(validarTicketCrear(body({ componentes: 'no' }), TIPOS, COMPONENTES))
            .toEqual({ valido: false, error: 'Datos inválidos.' });
    });

    it('rejects a non-object body', () => {
        expect(validarTicketCrear(null, TIPOS, COMPONENTES)).toEqual({ valido: false, error: 'Datos inválidos.' });
        expect(validarTicketCrear('x', TIPOS, COMPONENTES)).toEqual({ valido: false, error: 'Datos inválidos.' });
    });
});
