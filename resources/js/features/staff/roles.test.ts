import { describe, expect, it } from 'vitest';
import { isStaffOnly } from './roles';

describe('isStaffOnly', () => {
    it('is true for anggota only (and for no role at all)', () => {
        expect(isStaffOnly(['anggota'])).toBe(true);
        expect(isStaffOnly([])).toBe(true);
    });

    it.each(['kepala_divisi', 'hr', 'direksi', 'super_admin'])(
        'is false as soon as %s is held',
        (role) => {
            expect(isStaffOnly([role])).toBe(false);
            expect(isStaffOnly(['anggota', role])).toBe(false);
        },
    );
});
