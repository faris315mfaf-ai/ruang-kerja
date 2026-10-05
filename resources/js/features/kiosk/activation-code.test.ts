import { describe, expect, it } from 'vite-plus/test';
import {
    formatActivationCode,
    isCompleteActivationCode,
} from './activation-code';

describe('formatActivationCode', () => {
    it('upper-cases and groups the code', () => {
        expect(formatActivationCode('abcd2345')).toBe('ABCD-2345');
    });

    it('does not add the dash before the fifth character', () => {
        expect(formatActivationCode('abc')).toBe('ABC');
        expect(formatActivationCode('abcd')).toBe('ABCD');
        expect(formatActivationCode('abcd2')).toBe('ABCD-2');
    });

    it('drops spaces, dashes and symbols and caps the length', () => {
        expect(formatActivationCode(' ab-cd 23_45 99')).toBe('ABCD-2345');
        expect(formatActivationCode('ABCD-2345')).toBe('ABCD-2345');
    });

    it('is stable when re-formatting its own output', () => {
        const once = formatActivationCode('wxyz9876');
        expect(formatActivationCode(once)).toBe(once);
    });
});

describe('isCompleteActivationCode', () => {
    it('needs all eight characters', () => {
        expect(isCompleteActivationCode('ABCD-234')).toBe(false);
        expect(isCompleteActivationCode('ABCD-2345')).toBe(true);
    });
});
