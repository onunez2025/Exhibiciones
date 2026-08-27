import { describe, it, expect } from 'vitest';
import { validarExhibicionCrear } from './exhibicionCrear.js';

describe('validarExhibicionCrear', () => {
    const base = {
        clienteCodigo: '0001000001', clienteNombre: 'Cliente Test',
        sucursalCodigo: '3000000001', sucursalNombre: 'Sucursal Test',
        direccion: 'Av. Siempre Viva 123', nombre: 'Exhibición de prueba',
        tipoId: 5, piso: '1', pisoDetalleId: 2,
    };

    it('accepts a fully valid payload and trims strings', () => {
        const result = validarExhibicionCrear({ ...base, nombre: '  Exhibición de prueba  ' });
        expect(result).toEqual({ valido: true, datos: base });
    });

    it('rejects a missing clienteCodigo', () => {
        const result = validarExhibicionCrear({ ...base, clienteCodigo: '' });
        expect(result).toEqual({ valido: false, error: 'Selecciona una tienda y sucursal.' });
    });

    it('rejects a missing sucursalCodigo', () => {
        const result = validarExhibicionCrear({ ...base, sucursalCodigo: undefined });
        expect(result).toEqual({ valido: false, error: 'Selecciona una tienda y sucursal.' });
    });

    it('rejects a missing or whitespace-only nombre', () => {
        expect(validarExhibicionCrear({ ...base, nombre: '' })).toEqual({ valido: false, error: 'El nombre de la exhibición es obligatorio.' });
        expect(validarExhibicionCrear({ ...base, nombre: '   ' })).toEqual({ valido: false, error: 'El nombre de la exhibición es obligatorio.' });
    });

    it('rejects a missing or non-numeric tipoId', () => {
        expect(validarExhibicionCrear({ ...base, tipoId: undefined })).toEqual({ valido: false, error: 'Selecciona un tipo de exhibición.' });
        expect(validarExhibicionCrear({ ...base, tipoId: 'abc' })).toEqual({ valido: false, error: 'Selecciona un tipo de exhibición.' });
    });

    it('treats piso, direccion and pisoDetalleId as optional — null when omitted', () => {
        const { clienteCodigo, clienteNombre, sucursalCodigo, sucursalNombre, nombre, tipoId } = base;
        const result = validarExhibicionCrear({ clienteCodigo, clienteNombre, sucursalCodigo, sucursalNombre, nombre, tipoId });
        expect(result).toEqual({
            valido: true,
            datos: { clienteCodigo, clienteNombre, sucursalCodigo, sucursalNombre, direccion: null, nombre, tipoId, piso: null, pisoDetalleId: null },
        });
    });

    it('rejects a pisoDetalleId that is present but not a valid positive number', () => {
        const result = validarExhibicionCrear({ ...base, pisoDetalleId: 'abc' });
        expect(result).toEqual({ valido: false, error: 'Detalle de ubicación inválido.' });
    });

    it('rejects a non-object body', () => {
        expect(validarExhibicionCrear(null)).toEqual({ valido: false, error: 'Datos inválidos.' });
        expect(validarExhibicionCrear('x')).toEqual({ valido: false, error: 'Datos inválidos.' });
    });
});
