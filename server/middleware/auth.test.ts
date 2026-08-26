// server/middleware/auth.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/security.js';

describe('JWT secret handling', () => {
    afterEach(() => {
        delete process.env.JWT_SECRET;
        delete process.env.NODE_ENV;
    });

    it('a token signed with the real (quoted) secret verifies against the cleaned value', () => {
        process.env.JWT_SECRET = '"my-quoted-secret-value"';
        const token = jwt.sign({ id: 1 }, getJwtSecret(), { expiresIn: '1h' });
        const decoded = jwt.verify(token, getJwtSecret()) as { id: number };
        expect(decoded.id).toBe(1);
    });

    it('a token signed with a different secret fails verification', () => {
        process.env.JWT_SECRET = 'secret-a';
        const token = jwt.sign({ id: 1 }, getJwtSecret(), { expiresIn: '1h' });
        process.env.JWT_SECRET = 'secret-b';
        expect(() => jwt.verify(token, getJwtSecret())).toThrow();
    });

    it('falls back to the development secret when unset outside production', () => {
        const token = jwt.sign({ id: 1 }, getJwtSecret(), { expiresIn: '1h' });
        const decoded = jwt.verify(token, getJwtSecret()) as { id: number };
        expect(decoded.id).toBe(1);
    });

    it('throws when unset in production', () => {
        process.env.NODE_ENV = 'production';
        expect(() => getJwtSecret()).toThrow();
    });
});
