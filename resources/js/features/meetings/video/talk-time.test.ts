import { describe, expect, it } from 'vitest';
import {
    mergeTotals,
    recordSpeakers,
    startTalk,
    talkMinutes,
    talkRows,
    talkSummary,
    totalsAt,
} from './talk-time';

describe('recordSpeakers', () => {
    it('credits the previous speakers with the time between events', () => {
        let state = startTalk(0);
        state = recordSpeakers(state, ['dimas'], 1000);
        state = recordSpeakers(state, ['dimas', 'sari'], 4000);
        state = recordSpeakers(state, [], 6000);

        expect(state.totals).toEqual({ dimas: 5000, sari: 2000 });
    });

    it('caps long gaps (sleeping tab) and starts from saved totals', () => {
        let state = startTalk(0, { dimas: 60_000 });
        state = recordSpeakers(state, ['dimas'], 0);
        state = recordSpeakers(state, [], 120_000);

        expect(state.totals.dimas).toBe(70_000);
    });

    it('counts the running stretch for display without changing state', () => {
        const state = recordSpeakers(startTalk(0), ['yoga'], 1000);
        expect(totalsAt(state, 3500)).toEqual({ yoga: 2500 });
        expect(state.totals).toEqual({});
    });
});

describe('mergeTotals', () => {
    it('keeps the largest value per person', () => {
        expect(mergeTotals({ a: 10, b: 50 }, { a: 30, c: 5 })).toEqual({
            a: 30,
            b: 50,
            c: 5,
        });
    });
});

describe('talkRows and talkSummary', () => {
    const totals = {
        dimas: 432_000,
        sari: 246_000,
        rizky: 156_000,
        nadia: 120_000,
        hana: 78_000,
        bayu: 54_000,
    };
    const names: Record<string, string> = {
        dimas: 'Dimas',
        sari: 'Sari',
        yoga: 'Yoga',
        bayu: 'Bayu',
    };
    const rows = talkRows(totals, [...Object.keys(totals), 'yoga']);

    it('sorts by speaking time with shares and relative bars', () => {
        expect(rows.map((row) => row.id)).toEqual([
            'dimas',
            'sari',
            'rizky',
            'nadia',
            'hana',
            'bayu',
            'yoga',
        ]);
        expect(Math.round(rows[0].share * 100)).toBe(40);
        expect(rows[0].relative).toBe(1);
        expect(rows[0].dominant).toBe(true);
        expect(rows[1].dominant).toBe(false);
        expect(rows.at(-1)).toMatchObject({ id: 'yoga', ms: 0, share: 0 });
    });

    it('formats minutes like the mockup', () => {
        expect(talkMinutes(432_000)).toBe('7,2′');
        expect(talkMinutes(0)).toBe('0,0′');
    });

    it('summarizes the top speaker and who has not spoken', () => {
        const nameOf = (id: string) => names[id] ?? id;
        expect(talkSummary(rows, nameOf)).toBe(
            'Dimas bicara 40% waktu rapat. Yoga belum bicara.',
        );
        expect(
            talkSummary(
                talkRows({ dimas: 5000 }, ['dimas', 'yoga', 'bayu']),
                nameOf,
            ),
        ).toBe('Dimas bicara 100% waktu rapat. Yoga dan Bayu belum bicara.');
        expect(talkSummary(talkRows({}, ['yoga']), nameOf)).toBeNull();
    });
});
