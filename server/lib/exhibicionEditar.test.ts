import { describe, it, expect } from 'vitest';
import { validarExhibicionEditar } from './exhibicionEditar.js';

describe('validarExhibicionEditar', () => {
    const base = { nombre: 'Exhibición editada', tipoId: 5, piso: '2', pisoDetalleId: 3 };

    it('accepts a fully valid payload and trims the name', () => {
        const result = validarExhibicionEditar({ ...base, nombre: '  Exhibición editada  ' });
        expect(result).toEqual({ valido: true, datos: base });
    });

    it('rejects a missing or whitespace-only nombre', () => {
        expect(validarExhibicionEditar({ ...base, nombre: '' })).toEqual({ valido: false, error: 'El nombre de la exhibición es obligatorio.' });
        expect(validarExhibicionEditar({ ...base, nombre: '   ' })).toEqual({ valido: false, error: 'El nombre de la exhibición es obligatorio.' });
    });

    it('rejects a missing or non-numeric tipoId', () => {
        expect(validarExhibicionEditar({ ...base, tipoId: undefined })).toEqual({ valido: false, error: 'Selecciona un tipo de exhibición.' });
        expect(validarExhibicionEditar({ ...base, tipoId: 'abc' })).toEqual({ valido: false, error: 'Selecciona un tipo de exhibición.' });
    });

    it('treats piso and pisoDetalleId as optional — null when omitted', () => {
        const result = validarExhibicionEditar({ nombre: base.nombre, tipoId: base.tipoId });
        expect(result).toEqual({
            valido: true,
            datos: { nombre: base.nombre, tipoId: base.tipoId, piso: null, pisoDetalleId: null },
        });
    });

    it('rejects a pisoDetalleId that is present but not a valid positive number', () => {
        const result = validarExhibicionEditar({ ...base, pisoDetalleId: 'abc' });
        expect(result).toEqual({ valido: false, error: 'Detalle de ubicación inválido.' });
    });

    it('rejects a non-object body', () => {
        expect(validarExhibicionEditar(null)).toEqual({ valido: false, error: 'Datos inválidos.' });
        expect(validarExhibicionEditar('x')).toEqual({ valido: false, error: 'Datos inválidos.' });
    });
});
