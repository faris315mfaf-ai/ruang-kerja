import { describe, expect, it } from 'vite-plus/test';
import type { RecapDayCell, RecapDayKind } from '@/types/attendance';
import { monthNotes } from './month-notes';

function cell(
    date: string,
    kind: RecapDayKind,
    extra: Partial<RecapDayCell> = {},
): RecapDayCell {
    return {
        date,
        kind,
        isWorkday: true,
        holidayName: null,
        dayId: null,
        statusLabel: null,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        workMinutes: 0,
        overtimeMinutes: 0,
        isSuspicious: false,
        shiftName: null,
        checkIn: null,
        checkOut: null,
        ...extra,
    };
}

describe('monthNotes', () => {
    it('skips ordinary days and keeps exceptions in date order', () => {
        const notes = monthNotes([
            cell('2026-09-01', 'present'),
            cell('2026-09-02', 'late', { lateMinutes: 12 }),
            cell('2026-09-03', 'leave', { statusLabel: 'Cuti' }),
            cell('2026-09-05', 'off', { isWorkday: false }),
            cell('2026-09-07', 'absent', { statusLabel: 'Alpha' }),
        ]);

        expect(notes.map((note) => [note.date, note.kind, note.tone])).toEqual([
            ['2026-09-02', 'Terlambat 12 menit', 'warning'],
            ['2026-09-03', 'Cuti', 'info'],
            ['2026-09-07', 'Alpha', 'danger'],
        ]);
    });

    it('notes approved overtime and flagged days on a normal day', () => {
        const [note] = monthNotes([
            cell('2026-09-08', 'present', {
                overtimeMinutes: 120,
                isSuspicious: true,
            }),
        ]);

        expect(note.kind).toBe('Lembur 2 jam');
        expect(note.text).toBe(
            'Lembur disetujui 2 jam. Sinyal tidak biasa, ditinjau HR.',
        );
    });
});
