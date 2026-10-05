import { describe, expect, it } from 'vitest';
import { roleLockReason } from './roles';

describe('roleLockReason', () => {
    it('lets a Super Admin toggle every role of someone else', () => {
        for (const role of [
            'super_admin',
            'direksi',
            'hr',
            'kepala_divisi',
            'anggota',
        ] as const) {
            expect(
                roleLockReason(role, {
                    canAssignPrivilegedRoles: true,
                    editingSelf: false,
                }),
            ).toBeNull();
        }
    });

    it('locks super_admin, direksi and hr for HR', () => {
        const hr = { canAssignPrivilegedRoles: false, editingSelf: false };

        expect(roleLockReason('super_admin', hr)).not.toBeNull();
        expect(roleLockReason('direksi', hr)).not.toBeNull();
        expect(roleLockReason('hr', hr)).not.toBeNull();
        expect(roleLockReason('kepala_divisi', hr)).toBeNull();
        expect(roleLockReason('anggota', hr)).toBeNull();
    });

    it('locks every role when editing yourself', () => {
        expect(
            roleLockReason('anggota', {
                canAssignPrivilegedRoles: true,
                editingSelf: true,
            }),
        ).toBe('peran sendiri tidak bisa diubah');
    });
});
