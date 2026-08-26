import { describe, it, expect, afterEach } from 'vitest';
import { buildConfig } from './db.js';

describe('buildConfig', () => {
    const keys = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

    afterEach(() => {
        keys.forEach(k => delete process.env[k]);
    });

    it('reads all four connection fields from env, quotes stripped', () => {
        process.env.DB_SERVER = 'soledbserver.database.windows.net';
        process.env.DB_NAME = 'soledb-puntoventa';
        process.env.DB_USER = 'soledbserveradmin';
        process.env.DB_PASSWORD = '"@Fake#Pass,1"';

        const config = buildConfig();

        expect(config.server).toBe('soledbserver.database.windows.net');
        expect(config.database).toBe('soledb-puntoventa');
        expect(config.user).toBe('soledbserveradmin');
        expect(config.password).toBe('@Fake#Pass,1');
    });

    it('defaults to empty strings when env vars are unset', () => {
        const config = buildConfig();
        expect(config.server).toBe('');
        expect(config.database).toBe('');
    });

    it('always encrypts and never trusts an unverified server certificate', () => {
        const config = buildConfig();
        expect(config.options?.encrypt).toBe(true);
        expect(config.options?.trustServerCertificate).toBe(false);
    });
});
