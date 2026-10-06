import { describe, expect, it } from 'vitest';
import {
    firstName,
    formatKpiValue,
    isRoleKey,
    kpiSuffix,
    progressTone,
    rowMeta,
    scheduleDay,
    shortGreeting,
    tileTone,
    withoutHidden,
} from './lib';

// Mon 5 Oct 2026, 09.00 WIB.
const NOW = new Date('2026-10-05T02:00:00Z');

describe('isRoleKey', () => {
    it('accepts the 8 SPKD jobs only', () => {
        expect(isRoleKey('dirut')).toBe(true);
        expect(isRoleKey('analis')).toBe(true);
        expect(isRoleKey('bendahara')).toBe(false);
    });
});

describe('KPI formatting', () => {
    it('formats counts, percents and missing values', () => {
        expect(formatKpiValue({ value: 1250, unit: 'count' })).toBe('1.250');
        expect(formatKpiValue({ value: 77.4, unit: 'percent' })).toBe('77%');
        expect(formatKpiValue({ value: null, unit: 'percent' })).toBe('–');
    });

    it('shows the whole as a suffix', () => {
        expect(kpiSuffix({ total: 47 })).toBe('/ 47');
        expect(kpiSuffix({ total: null })).toBeUndefined();
    });

    it('marks only a non-zero warm KPI as alarming on the phone', () => {
        expect(tileTone('warm', 3)).toBe('late');
        expect(tileTone('warm', 0)).toBe('neutral');
        expect(tileTone('plain', 5)).toBe('neutral');
    });
});

describe('rowMeta', () => {
    it('appends a relative date or a calendar date', () => {
        expect(
            rowMeta(
                {
                    meta: 'Diajukan Agus',
                    at: { value: '2026-10-03T02:00:00Z', style: 'relative' },
                },
                NOW,
            ),
        ).toBe('Diajukan Agus · 2 hari lalu');
        expect(
            rowMeta({
                meta: 'CUT-2026-10-0001 · 2 hari',
                at: { value: '2026-10-12T00:00:00+07:00', style: 'date' },
            }),
        ).toBe('CUT-2026-10-0001 · 2 hari · Sen, 12 Okt 2026');
    });

    it('keeps the meta alone without a date', () => {
        expect(rowMeta({ meta: 'OPS-12', at: null })).toBe('OPS-12');
    });
});

describe('scheduleDay', () => {
    it('names today and tomorrow, else a short date', () => {
        expect(scheduleDay('2026-10-05', NOW)).toBe('Hari ini');
        expect(scheduleDay('2026-10-06', NOW)).toBe('Besok');
        expect(scheduleDay('2026-10-08', NOW)).toBe('Kam, 8 Okt');
    });
});

describe('progressTone', () => {
    it('follows the PRD M10 variance flag', () => {
        expect(progressTone(30, 50)).toBe('danger');
        expect(progressTone(45, 52)).toBe('warning');
        expect(progressTone(72, 70)).toBe('brand');
        expect(progressTone(null, 50)).toBe('brand');
    });
});

describe('helpers', () => {
    it('takes the first name', () => {
        expect(firstName('Hendra Wijaya')).toBe('Hendra');
        expect(firstName('  Rahmawati ')).toBe('Rahmawati');
        expect(firstName(null)).toBe('');
    });

    it('shortens the greeting for phones', () => {
        expect(shortGreeting(NOW)).toBe('Pagi');
    });

    it('hides optimistically decided items', () => {
        const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

        expect(withoutHidden(items, new Set(['b']))).toEqual([
            { id: 'a' },
            { id: 'c' },
        ]);
    });
});
