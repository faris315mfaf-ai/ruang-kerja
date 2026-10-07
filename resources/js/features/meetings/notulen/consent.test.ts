import { describe, expect, it } from 'vitest';
import { autoMinutesOn, consentLines } from './consent';
import type { NotulenSummary } from './types';

const base = {
    available: true,
    auto_minutes: true,
    notice_points: [] as string[],
    retention_days: 90,
    llm: { enabled: true, provider: 'DeepSeek', outside_indonesia: true },
} as unknown as NotulenSummary;

describe('consentLines', () => {
    it('uses the server notice points when present (UU PDP text)', () => {
        expect(
            consentLines({ ...base, notice_points: ['Audio dihapus.'] }),
        ).toEqual(['Audio dihapus.']);
    });

    it('builds the three facts from the props otherwise', () => {
        expect(consentLines(base)).toEqual([
            'Suara Anda ditranskrip setelah rapat; audio dihapus setelah transkripsi.',
            'Transkrip disimpan 90 hari, hanya untuk peserta.',
            'Ringkasan diproses DeepSeek di luar Indonesia.',
        ]);
        expect(
            consentLines({
                ...base,
                llm: { ...base.llm, outside_indonesia: false },
            }),
        ).toHaveLength(2);
    });
});

describe('autoMinutesOn', () => {
    it('needs both the server and the meeting switch', () => {
        expect(autoMinutesOn(base)).toBe(true);
        expect(autoMinutesOn({ ...base, available: false })).toBe(false);
        expect(autoMinutesOn(null)).toBe(false);
    });
});
