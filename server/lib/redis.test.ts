import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isRedisAvailable, recordRedisFailure } from './redis.js';

describe('circuit breaker', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    it('is available before any failure is recorded', () => {
        expect(isRedisAvailable()).toBe(true);
    });

    it('becomes unavailable immediately after a failure', () => {
        recordRedisFailure();
        expect(isRedisAvailable()).toBe(false);
    });

    it('becomes available again after the cooldown window elapses', () => {
        vi.useFakeTimers();
        recordRedisFailure();
        expect(isRedisAvailable()).toBe(false);

        vi.advanceTimersByTime(15_001); // cooldown is 15s
        expect(isRedisAvailable()).toBe(true);

        vi.useRealTimers();
    });

    it('stays unavailable just before the cooldown window elapses', () => {
        vi.useFakeTimers();
        recordRedisFailure();
        vi.advanceTimersByTime(14_999);
        expect(isRedisAvailable()).toBe(false);
        vi.useRealTimers();
    });
});
