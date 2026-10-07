import { describe, expect, it } from 'vitest';
import {
    initialSetPasswordMode,
    MASKED_PASSWORD,
    setPasswordModes,
} from './set-password-modes';

describe('setPasswordModes', () => {
    it('offers the default password first when it is available', () => {
        expect(setPasswordModes(true).map((mode) => mode.value)).toEqual([
            'default',
            'manual',
        ]);
        expect(setPasswordModes(true)[0].label).toBe('Sandi bawaan');
        expect(initialSetPasswordMode(true)).toBe('default');
    });

    it('offers only typing a password when the default is off', () => {
        expect(setPasswordModes(false)).toEqual([
            { value: 'manual', label: 'Ketik sendiri' },
        ]);
        expect(initialSetPasswordMode(false)).toBe('manual');
    });

    it('never offers a random generator', () => {
        const values = [
            ...setPasswordModes(true),
            ...setPasswordModes(false),
        ].map((mode) => mode.value as string);

        expect(values).not.toContain('generate');
    });

    it('masks with a fixed length', () => {
        expect(MASKED_PASSWORD).toHaveLength(10);
        expect(MASKED_PASSWORD).not.toMatch(/[A-Za-z0-9]/);
    });
});
