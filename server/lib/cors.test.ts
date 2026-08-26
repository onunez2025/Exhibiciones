import { describe, it, expect } from 'vitest';
import { resolveCorsAllow } from './cors.js';

describe('resolveCorsAllow', () => {
    it('allows everything outside production', () => {
        expect(resolveCorsAllow({
            origin: 'https://evil.example.com',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'development',
            allowedOrigins: '',
        })).toBe(true);
    });

    it('allows requests with no Origin header (curl, server-to-server)', () => {
        expect(resolveCorsAllow({
            origin: undefined,
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: '',
        })).toBe(true);
    });

    it('allows same-origin requests even when ALLOWED_ORIGINS is empty', () => {
        expect(resolveCorsAllow({
            origin: 'https://exhibiciones.siatc.cloud',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: '',
        })).toBe(true);
    });

    it('allows an origin present in ALLOWED_ORIGINS', () => {
        expect(resolveCorsAllow({
            origin: 'https://console.siatc.cloud',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: 'https://console.siatc.cloud,https://other.siatc.cloud',
        })).toBe(true);
    });

    it('blocks a cross-origin request not in ALLOWED_ORIGINS', () => {
        expect(resolveCorsAllow({
            origin: 'https://evil.example.com',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: 'https://console.siatc.cloud',
        })).toBe(false);
    });

    it('trims whitespace around entries in ALLOWED_ORIGINS', () => {
        expect(resolveCorsAllow({
            origin: 'https://console.siatc.cloud',
            host: 'exhibiciones.siatc.cloud',
            nodeEnv: 'production',
            allowedOrigins: ' https://console.siatc.cloud , https://other.siatc.cloud ',
        })).toBe(true);
    });
});
