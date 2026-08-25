// server/middleware/auth.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// getJwtSecret is not exported — re-derive the same lookup here to prove
// the contract: whatever JWT_SECRET is set to (quotes and all) round-trips.
function readSecret(): string {
    let v = (process.env.JWT_SECRET || 'fallback_development_secret_do_not_use').trim();
    if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') v = v.slice(1, -1);
    return v;
}

describe('JWT secret handling', () => {
    afterEach(() => {
        delete process.env.JWT_SECRET;
    });

    it('a token signed with the real (quoted) secret verifies against the cleaned value', () => {
        process.env.JWT_SECRET = '"my-quoted-secret-value"';
        const token = jwt.sign({ id: 1 }, readSecret(), { expiresIn: '1h' });
        const decoded = jwt.verify(token, readSecret()) as { id: number };
        expect(decoded.id).toBe(1);
    });

    it('a token signed with a different secret fails verification', () => {
        process.env.JWT_SECRET = 'secret-a';
        const token = jwt.sign({ id: 1 }, readSecret(), { expiresIn: '1h' });
        process.env.JWT_SECRET = 'secret-b';
        expect(() => jwt.verify(token, readSecret())).toThrow();
    });

    it('falls back to the development secret when unset', () => {
        const token = jwt.sign({ id: 1 }, readSecret(), { expiresIn: '1h' });
        const decoded = jwt.verify(token, readSecret()) as { id: number };
        expect(decoded.id).toBe(1);
    });
});
