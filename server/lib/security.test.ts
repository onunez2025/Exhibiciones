import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanEnv, safeError, sanitizeLog } from './security.js';

describe('cleanEnv', () => {
    const KEY = 'TEST_CLEAN_ENV_VAR';

    afterEach(() => {
        delete process.env[KEY];
    });

    it('returns the raw value when there are no surrounding quotes', () => {
        process.env[KEY] = '@Fake#Pass,1';
        expect(cleanEnv(KEY)).toBe('@Fake#Pass,1');
    });

    it('strips a single layer of surrounding double quotes', () => {
        process.env[KEY] = '"@Fake#Pass,1"';
        expect(cleanEnv(KEY)).toBe('@Fake#Pass,1');
    });

    it('strips a single layer of surrounding single quotes', () => {
        process.env[KEY] = "'hello world'";
        expect(cleanEnv(KEY)).toBe('hello world');
    });

    it('trims leading and trailing whitespace', () => {
        process.env[KEY] = '  spaced-value  ';
        expect(cleanEnv(KEY)).toBe('spaced-value');
    });

    it('returns an empty string when the var is unset', () => {
        expect(cleanEnv(KEY)).toBe('');
    });

    it('does not strip a quote that only appears on one side', () => {
        process.env[KEY] = '"unbalanced';
        expect(cleanEnv(KEY)).toBe('"unbalanced');
    });
});

describe('safeError', () => {
    beforeEach(() => {
        process.env.NODE_ENV = 'development';
    });
    afterEach(() => {
        delete process.env.NODE_ENV;
    });

    it('returns the real message outside production', () => {
        expect(safeError(new Error('boom'))).toBe('boom');
    });

    it('returns a generic message in production', () => {
        process.env.NODE_ENV = 'production';
        expect(safeError(new Error('secret connection string'))).toBe('Internal server error');
    });

    it('stringifies non-Error values outside production', () => {
        expect(safeError('plain string')).toBe('plain string');
    });
});

describe('sanitizeLog', () => {
    it('replaces control characters with ?', () => {
        expect(sanitizeLog('a\nb\tc')).toBe('a?b?c');
    });

    it('truncates values longer than maxLen', () => {
        const long = 'x'.repeat(250);
        const result = sanitizeLog(long, 200);
        expect(result.length).toBe(201); // 200 chars + ellipsis
        expect(result.endsWith('…')).toBe(true);
    });

    it('coerces non-string values', () => {
        expect(sanitizeLog(12345)).toBe('12345');
        expect(sanitizeLog(null)).toBe('');
    });
});
