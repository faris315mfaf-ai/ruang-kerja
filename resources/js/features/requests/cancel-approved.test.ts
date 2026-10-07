import { describe, expect, it } from 'vitest';
import type { CancelPreview, LeaveTypeInfo } from '@/types/requests';
import { cancelEffects, formatDateList } from './cancel-approved';

const request = {
    type: { name: 'Cuti tahunan' } as LeaveTypeInfo,
    user: { id: 'u1', name: 'Rizky Aditya', avatar: null },
};

const preview = (overrides: Partial<CancelPreview> = {}): CancelPreview => ({
    refund_days: null,
    balance_year: null,
    attendance: {
        removed_dates: [],
        unlinked_dates: [],
        overtime_date: null,
        correction_date: null,
        blocker: null,
    },
    past_dates: [],
    blocker: null,
    reason_min: 10,
    reason_max: 500,
    ...overrides,
});

describe('formatDateList', () => {
    it('groups days per month and puts the year once', () => {
        expect(formatDateList(['2026-10-14', '2026-10-12', '2026-10-13'])).toBe(
            '12, 13, 14 Okt 2026',
        );
        expect(formatDateList(['2026-09-30', '2026-10-01'])).toBe(
            '30 Sep, 1 Okt 2026',
        );
        expect(formatDateList(['2026-12-31', '2027-01-04'])).toBe(
            '31 Des 2026, 4 Jan 2027',
        );
    });

    it('shortens long lists and ignores duplicates', () => {
        expect(
            formatDateList([
                '2026-10-12',
                '2026-10-13',
                '2026-10-13',
                '2026-10-14',
                '2026-10-15',
                '2026-10-16',
                '2026-10-19',
                '2026-10-20',
            ]),
        ).toBe('12, 13, 14, 15, 16 Okt 2026 dan 2 tanggal lain');
        expect(formatDateList([])).toBe('');
    });
});

describe('cancelEffects', () => {
    it('lists the refund, removed rows and the notice to the requester', () => {
        const result = cancelEffects(
            request,
            preview({
                refund_days: 2.5,
                balance_year: 2026,
                attendance: {
                    ...preview().attendance,
                    removed_dates: ['2026-10-12', '2026-10-13'],
                    unlinked_dates: ['2026-10-14'],
                },
            }),
        );

        expect(result.effects).toEqual([
            'Saldo cuti tahunan 2026 dikembalikan 2,5 hari.',
            'Catatan absensi 12, 13 Okt 2026 dihapus.',
            'Hari yang tetap masuk (14 Okt 2026) menjadi kehadiran biasa.',
            'Rizky Aditya dan penyetuju diberi tahu. Alasan Anda hanya tampil di aplikasi.',
        ]);
        expect(result.pastWarning).toBeNull();
        expect(result.blocker).toBeNull();
    });

    it('warns about past dates that turn into Alpha, not about overtime', () => {
        const absence = cancelEffects(
            request,
            preview({
                attendance: {
                    ...preview().attendance,
                    removed_dates: ['2026-10-01', '2026-10-12'],
                },
                past_dates: ['2026-10-01'],
            }),
        );
        const overtime = cancelEffects(
            request,
            preview({
                attendance: {
                    ...preview().attendance,
                    overtime_date: '2026-10-02',
                },
                past_dates: ['2026-10-02'],
            }),
        );

        expect(absence.pastWarning).toBe(
            '1 Okt 2026 sudah lewat. Absensinya dihitung ulang sekarang: tanpa check-in, hari itu menjadi Alpha.',
        );
        expect(overtime.pastWarning).toBeNull();
        expect(overtime.effects[0]).toBe(
            'Menit lembur 2 Okt 2026 dihitung ulang tanpa pengajuan ini.',
        );
    });

    it('describes a correction, or passes the blocker through', () => {
        const correction = preview({
            attendance: {
                ...preview().attendance,
                correction_date: '2026-10-02',
            },
            past_dates: ['2026-10-02'],
        });

        expect(cancelEffects(request, correction).effects[0]).toBe(
            'Jam absensi 2 Okt 2026 dikembalikan seperti sebelum koreksi.',
        );

        const blocked = cancelEffects(request, {
            ...correction,
            blocker: 'Absensi tanggal 2026-10-02 sudah berubah.',
        });

        expect(blocked.blocker).toBe(
            'Absensi tanggal 2026-10-02 sudah berubah.',
        );
        expect(blocked.pastWarning).toBeNull();
        expect(blocked.effects[0]).toBe(
            'Tidak ada saldo atau catatan absensi yang berubah.',
        );
    });
});
