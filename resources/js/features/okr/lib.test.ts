import { describe, expect, it } from 'vitest';
import { OBJECTIVES, OKR_TODAY, OWNERS } from './fixtures';
import {
    aggregate,
    applyCheckin,
    applyKrDraft,
    draftFromKr,
    filterObjectives,
    formatKrValue,
    groupByDivision,
    krChartSeries,
    krProgress,
    krRawProgress,
    quarterElapsed,
    quarterLabel,
    quarterOf,
    quarterRange,
    quarterWeek,
    statusFor,
    summarizeObjective,
    validateKrDraft,
    weightedProgress,
} from './lib';
import { parsePreviewState } from './preview';
import type { KeyResult } from './types';

const kr = (over: Partial<KeyResult> = {}): KeyResult => ({
    id: 'kr',
    objective_id: 'o',
    title: 'KR',
    unit: 'number',
    unit_label: '',
    start_value: 0,
    target_value: 100,
    current_value: 50,
    weight: 1,
    owner: OWNERS[0],
    tasks: [],
    checkins: [],
    ...over,
});

describe('quarters', () => {
    it('knows the date range and length', () => {
        expect(quarterRange('2026-Q4')).toEqual({
            start: '2026-10-01',
            end: '2026-12-31',
        });
        expect(quarterRange('2026-Q1')).toEqual({
            start: '2026-01-01',
            end: '2026-03-31',
        });
        expect(quarterOf('2026-10-05')).toBe('2026-Q4');
        expect(quarterLabel('2026-Q4', true)).toBe('Q4 2026 · Okt–Des');
    });

    it('measures elapsed share and week', () => {
        expect(quarterElapsed('2026-Q4', '2026-10-05')).toBeCloseTo(5 / 92, 5);
        expect(quarterElapsed('2026-Q4', '2026-09-01')).toBe(0);
        expect(quarterElapsed('2026-Q3', '2026-10-05')).toBe(1);
        expect(quarterWeek('2026-Q4', '2026-10-05')).toEqual({
            week: 1,
            weeks: 14,
        });
        expect(quarterWeek('2026-Q4', '2026-10-08')).toEqual({
            week: 2,
            weeks: 14,
        });
    });
});

describe('progress', () => {
    it('handles rising, falling and flat targets', () => {
        expect(krProgress(kr())).toBe(0.5);
        expect(
            krProgress(
                kr({ start_value: 14, target_value: 4, current_value: 9 }),
            ),
        ).toBe(0.5);
        expect(
            krRawProgress(
                kr({ start_value: 14, target_value: 4, current_value: 19 }),
            ),
        ).toBe(-0.5);
        expect(
            krProgress(
                kr({ start_value: 14, target_value: 4, current_value: 19 }),
            ),
        ).toBe(0);
        expect(krProgress(kr({ current_value: 140 }))).toBe(1);
        expect(
            krRawProgress(
                kr({ start_value: 5, target_value: 5, current_value: 5 }),
            ),
        ).toBe(1);
    });

    it('averages by weight', () => {
        const items = [
            kr({ current_value: 100, weight: 3 }),
            kr({ current_value: 0, weight: 1 }),
        ];

        expect(weightedProgress(items)).toBe(0.75);
        expect(weightedProgress([])).toBe(0);
        // zero weights fall back to equal shares
        expect(
            weightedProgress(items.map((item) => ({ ...item, weight: 0 }))),
        ).toBe(0.5);
        // raw lets a regression pull the average below the clamped one
        const regressed = [
            kr({ current_value: -50 }),
            kr({ current_value: 50 }),
        ];

        expect(weightedProgress(regressed)).toBe(0.25);
        expect(weightedProgress(regressed, true)).toBe(0);
    });

    it('derives the status from the gap to elapsed time', () => {
        expect(statusFor(0.5, 0.55)).toBe('on_track');
        expect(statusFor(0.5, 0.6)).toBe('on_track');
        expect(statusFor(0.5, 0.7)).toBe('at_risk');
        expect(statusFor(0.5, 0.75)).toBe('at_risk');
        expect(statusFor(0.5, 0.8)).toBe('behind');
        expect(statusFor(-0.3, 0.05)).toBe('behind');
    });

    it('gives the fixtures a mix of statuses', () => {
        const q4 = filterObjectives(OBJECTIVES, {
            quarter: '2026-Q4',
            division: 'all',
        });
        const statuses = q4.map((o) => summarizeObjective(o, OKR_TODAY).status);

        expect(statuses).toContain('on_track');
        expect(statuses).toContain('at_risk');
        expect(statuses).toContain('behind');
        expect(summarizeObjective(q4[0], OKR_TODAY)).toMatchObject({
            status: 'at_risk',
            regressed: 1,
        });

        const q3 = filterObjectives(OBJECTIVES, {
            quarter: '2026-Q3',
            division: 'all',
        });

        expect(q3.map((o) => summarizeObjective(o, OKR_TODAY).status)).toEqual([
            'on_track',
            'behind',
            'on_track',
            'at_risk',
        ]);
    });

    it('aggregates and groups', () => {
        const ops = filterObjectives(OBJECTIVES, {
            quarter: '2026-Q4',
            division: 'div-ops',
        });

        expect(ops.map((o) => o.id)).toEqual(['q4-ops-1', 'q4-ops-2']);
        expect(aggregate([], OKR_TODAY)).toEqual({
            progress: 0,
            counts: { on_track: 0, at_risk: 0, behind: 0 },
            keyResults: 0,
        });
        expect(aggregate(ops, OKR_TODAY).keyResults).toBe(5);
        expect(groupByDivision(OBJECTIVES).map((g) => g.division.code)).toEqual(
            ['OPS', 'PRG', 'IMP', 'ANL', 'BRD', 'HR'],
        );
    });
});

describe('chart series', () => {
    it('plots the plan and actual values up to the current week', () => {
        const target = kr({
            start_value: 0,
            target_value: 140,
            current_value: 20,
            checkins: [
                {
                    id: 'c1',
                    key_result_id: 'kr',
                    date: '2026-10-02',
                    value: 20,
                    confidence: 7,
                    note: null,
                    author: OWNERS[0],
                },
            ],
        });
        const rows = krChartSeries(target, '2026-Q4', '2026-10-05');

        expect(rows).toHaveLength(15);
        expect(rows[0]).toEqual({ week: 0, plan: 0, actual: 0 });
        expect(rows[1]).toEqual({ week: 1, plan: 10, actual: 20 });
        expect(rows[2].actual).toBeNull();
        expect(rows[14].plan).toBe(140);
    });
});

describe('key result form', () => {
    it('validates the draft', () => {
        const draft = draftFromKr(null, 'u-dimas');

        expect(validateKrDraft(draft)).toMatchObject({
            title: expect.any(String),
            target_value: 'Isi angka target.',
        });
        expect(
            validateKrDraft({
                ...draft,
                title: 'Bug kritis nol',
                target_value: '0',
            }),
        ).toEqual({ target_value: 'Target harus berbeda dari nilai awal.' });
        expect(
            validateKrDraft({
                ...draft,
                title: 'Cakupan test',
                unit: 'percent',
                target_value: '120',
                weight: '0',
                owner_id: '',
            }),
        ).toEqual({
            target_value: 'Persen harus 0–100.',
            weight: 'Bobot bilangan bulat 1–100.',
            owner_id: 'Pilih pemilik.',
        });
        expect(
            validateKrDraft({
                ...draft,
                title: 'Lead time',
                start_value: '6,5',
                target_value: '4',
            }),
        ).toEqual({});
    });

    it('applies drafts and check-ins', () => {
        const draft = {
            ...draftFromKr(null, 'u-sari'),
            title: '  Unit terlatih ',
            unit_label: 'unit',
            start_value: '3',
            target_value: '8',
            current_value: '1.250',
            weight: '30',
        };
        const created = applyKrDraft(draft, null, {
            objectiveId: 'o1',
            owners: OWNERS,
            id: 'new',
        });

        expect(created).toMatchObject({
            id: 'new',
            title: 'Unit terlatih',
            current_value: 1250,
            weight: 30,
            owner: { id: 'u-sari' },
        });
        expect(
            draftFromKr({ ...created, start_value: 6.5 }, 'x').start_value,
        ).toBe('6,5');

        const updated = applyCheckin(created, {
            id: 'c1',
            date: '2026-10-05',
            value: 6,
            confidence: 8,
            note: null,
            author: OWNERS[0],
        });

        expect(updated.current_value).toBe(6);
        expect(updated.checkins).toHaveLength(1);
        expect(updated.checkins[0].key_result_id).toBe('new');
    });

    it('formats values per unit', () => {
        expect(formatKrValue(92, 'percent', '')).toBe('92%');
        expect(formatKrValue(6.5, 'days', '')).toBe('6,5 hari');
        expect(formatKrValue(1250, 'number', 'skenario')).toBe(
            '1.250 skenario',
        );
    });

    it('reads the forced preview state from the URL', () => {
        expect(parsePreviewState('/okr?keadaan=kosong')).toBe('kosong');
        expect(parsePreviewState('/okr?keadaan=apa')).toBe('normal');
        expect(parsePreviewState('/okr')).toBe('normal');
    });
});
