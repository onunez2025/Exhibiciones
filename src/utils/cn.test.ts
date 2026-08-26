import { describe, it, expect } from 'vitest';
import { cn } from './cn.js';

describe('cn', () => {
    it('joins plain class strings', () => {
        expect(cn('a', 'b')).toBe('a b');
    });

    it('drops falsy values', () => {
        expect(cn('a', false, null, undefined, 'b')).toBe('a b');
    });

    it('merges conflicting Tailwind classes, keeping the last one', () => {
        expect(cn('px-2', 'px-4')).toBe('px-4');
    });
});
