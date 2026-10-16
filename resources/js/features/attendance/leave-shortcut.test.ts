import { describe, expect, it } from 'vite-plus/test';
import type { LeaveShortcut } from '@/types/attendance';
import {
    cutoffPassed,
    cutoffText,
    shortcutQuery,
    shortcutView,
} from './leave-shortcut';

// Office time is UTC+7: 04:59 UTC = 11:59 WIB.
const at = (utc: string) => new Date(`2026-10-14T${utc}Z`);

const shortcut = (overrides: Partial<LeaveShortcut> = {}): LeaveShortcut => ({
    available: true,
    sickCutoff: '12:00',
    permitCutoff: '12:00',
    sickClosed: false,
    permitClosed: false,
    sickType: { id: 's', code: 'SKT', name: 'Sakit' },
    permitType: { id: 'i', code: 'IZN', name: 'Izin' },
    closedReason: null,
    pending: null,
    ...overrides,
});

describe('cutoffPassed', () => {
    it('is exclusive of the cutoff minute in office time', () => {
        expect(cutoffPassed('12:00', at('04:59:59'))).toBe(false);
        expect(cutoffPassed('12:00', at('05:00:00'))).toBe(true);
        expect(cutoffPassed('12:00', at('08:30:00'))).toBe(true);
        expect(cutoffPassed(null, at('16:00:00'))).toBe(false);
    });

    it('formats the cutoff in Indonesian clock style', () => {
        expect(cutoffText('12:00')).toBe('12.00');
    });
});

describe('shortcutView', () => {
    it('offers both choices with the cutoff hint before 12.00', () => {
        const view = shortcutView(shortcut(), at('02:30:00'));

        expect(view.kind).toBe('available');
        expect(
            view.kind === 'available' && view.choices.map((c) => c.label),
        ).toEqual(['Sakit', 'Izin']);
        expect(view.kind === 'available' && view.hint).toBe(
            'Batas pengajuan hari ini pukul 12.00.',
        );
    });

    it('closes a choice when the clock passes the cutoff after load', () => {
        const view = shortcutView(shortcut(), at('05:01:00'));

        expect(view).toEqual({
            kind: 'closed',
            reason: 'Batas pengajuan sakit/izin pukul 12.00 sudah lewat.',
        });
    });

    it('keeps the choice whose cutoff is later', () => {
        const view = shortcutView(
            shortcut({ permitCutoff: '14:00' }),
            at('06:30:00'), // 13:30 WIB
        );

        expect(
            view.kind === 'available' && view.choices.map((c) => c.kind),
        ).toEqual(['permit']);
    });

    it('has no hint without any cutoff', () => {
        const view = shortcutView(
            shortcut({ sickCutoff: null, permitCutoff: null }),
            at('10:00:00'),
        );

        expect(view.kind === 'available' && view.hint).toBeNull();
    });

    it('prefers the waiting request, then the server reason, else hides', () => {
        const pending = {
            id: 'r1',
            number: 'SKT-2026-10-0001',
            typeLabel: 'Sakit',
            status: 'pending',
            statusLabel: 'Menunggu',
        };

        expect(
            shortcutView(
                shortcut({ available: false, pending }),
                at('02:00:00'),
            ),
        ).toEqual({ kind: 'pending', pending });
        expect(
            shortcutView(
                shortcut({ available: false, closedReason: 'Sudah lewat.' }),
                at('09:00:00'),
            ),
        ).toEqual({ kind: 'closed', reason: 'Sudah lewat.' });
        expect(
            shortcutView(shortcut({ available: false }), at('02:00:00')),
        ).toEqual({
            kind: 'hidden',
        });
        expect(shortcutView(undefined, at('02:00:00'))).toEqual({
            kind: 'hidden',
        });
    });

    it('builds the deep link query with the office date', () => {
        const view = shortcutView(shortcut(), at('02:30:00'));
        const choice = view.kind === 'available' ? view.choices[0] : null;

        expect(choice && shortcutQuery(choice, at('18:30:00'))).toEqual({
            jenis: 'SKT',
            // 18:30 UTC is already the next day in WIB.
            tanggal: '2026-10-15',
        });
    });
});
