import { describe, expect, it } from 'vitest';
import { newAccountPasswordNote } from './new-account-password-note';

describe('newAccountPasswordNote', () => {
    it('mentions the default password and the forced change when configured', () => {
        const note = newAccountPasswordNote(true, ['anggota']);

        expect(note).toContain('kata sandi bawaan');
        expect(note).toContain('wajib menggantinya saat login pertama');
    });

    it('tells that a Super Admin never gets the default password', () => {
        expect(
            newAccountPasswordNote(true, ['anggota', 'super_admin']),
        ).toContain('Super Admin tidak mendapat kata sandi bawaan');
    });

    it('keeps the previous guidance while the feature is off', () => {
        const note = newAccountPasswordNote(false, ['anggota']);

        expect(note).toContain('Atur kata sandi');
        expect(note).not.toContain('bawaan');
    });
});
