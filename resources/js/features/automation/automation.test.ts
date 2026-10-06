import { describe, expect, it } from 'vitest';
import {
    boldSegments,
    isInQuietHours,
    renderTemplate,
    suggestWorkspaceKey,
    validateWorkspaceKey,
} from '@/features/automation/helpers';
import {
    computeMetrics,
    isEmptyPerformance,
    median,
    rate,
    weekBars,
} from '@/features/automation/performance';
import {
    formatPhone,
    maskPhone,
    normalizePhone,
} from '@/features/automation/phone';
import {
    describePattern,
    nextOccurrences,
    validateRecurring,
} from '@/features/automation/recurrence';
import type { RecurringForm } from '@/features/automation/recurrence';
import {
    decodeTarget,
    describeRule,
    encodeTarget,
    validateRule,
} from '@/features/automation/rules';
import type { RuleContext, RuleDraft } from '@/features/automation/rules';
import type { PeriodCounts } from '@/features/automation/types';

describe('normalizePhone', () => {
    it.each([
        ['0812-3456-7890', '+6281234567890'],
        ['+62 812 3456 7890', '+6281234567890'],
        ['6281234567890', '+6281234567890'],
        ['81234567890', '+6281234567890'],
        ['+62 0812 3456 789', '+628123456789'],
        ['(0812) 3456.7890', '+6281234567890'],
    ])('normalizes %s', (input, expected) => {
        const result = normalizePhone(input);

        expect(result.ok && result.e164).toBe(expected);
    });

    it.each([
        ['', 'Isi nomor WhatsApp Anda.'],
        ['0812abc', 'Nomor hanya boleh berisi angka.'],
        ['+1 415 555 0100', 'Hanya nomor Indonesia (+62) yang didukung.'],
        ['021-555-1234', 'Nomor ponsel diawali 08 atau +62 8.'],
        ['0812345', 'Nomor terlalu pendek.'],
        ['0812345678901234', 'Nomor terlalu panjang.'],
    ])('rejects %s', (input, error) => {
        expect(normalizePhone(input)).toEqual({ ok: false, error });
    });

    it('formats and masks for display', () => {
        expect(formatPhone('+6281234567890')).toBe('+62 812-3456-7890');
        expect(maskPhone('+6281234567890')).toBe('+62 812-••••-7890');
    });
});

describe('nextOccurrences', () => {
    // 5 Oct 2026 is a Monday.
    const from = '2026-10-05';

    it('daily on working days skips the weekend', () => {
        expect(
            nextOccurrences(
                {
                    pattern: { kind: 'daily', weekdays_only: true },
                    starts_on: '2026-10-01',
                    ends_on: null,
                },
                '2026-10-08',
            ),
        ).toEqual([
            '2026-10-08',
            '2026-10-09',
            '2026-10-12',
            '2026-10-13',
            '2026-10-14',
        ]);
    });

    it('weekly on chosen days', () => {
        expect(
            nextOccurrences(
                {
                    pattern: { kind: 'weekly', weekdays: [4, 1] },
                    starts_on: '2026-09-01',
                    ends_on: null,
                },
                from,
            ),
        ).toEqual([
            '2026-10-05',
            '2026-10-08',
            '2026-10-12',
            '2026-10-15',
            '2026-10-19',
        ]);
    });

    it('monthly clamps to the last day of short months', () => {
        expect(
            nextOccurrences(
                {
                    pattern: { kind: 'monthly', day_of_month: 31 },
                    starts_on: '2026-10-01',
                    ends_on: null,
                },
                from,
                4,
            ),
        ).toEqual(['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31']);
        expect(
            nextOccurrences(
                {
                    pattern: { kind: 'monthly', day_of_month: 30 },
                    starts_on: '2027-01-01',
                    ends_on: null,
                },
                '2027-01-01',
                2,
            ),
        ).toEqual(['2027-01-30', '2027-02-28']);
    });

    it('every N weeks is anchored on the start week', () => {
        // Start Wed 7 Oct: weeks of 5 Oct, 19 Oct, 2 Nov … on Friday.
        expect(
            nextOccurrences(
                {
                    pattern: {
                        kind: 'every_n_weeks',
                        interval: 2,
                        weekdays: [5],
                    },
                    starts_on: '2026-10-07',
                    ends_on: null,
                },
                from,
                3,
            ),
        ).toEqual(['2026-10-09', '2026-10-23', '2026-11-06']);
    });

    it('never goes before the start or past the end', () => {
        expect(
            nextOccurrences(
                {
                    pattern: { kind: 'weekly', weekdays: [1] },
                    starts_on: '2026-10-10',
                    ends_on: '2026-10-26',
                },
                from,
            ),
        ).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
    });

    it('returns nothing for invalid dates', () => {
        expect(
            nextOccurrences(
                {
                    pattern: { kind: 'daily', weekdays_only: false },
                    starts_on: '2026-02-30',
                    ends_on: null,
                },
                from,
            ),
        ).toEqual([]);
    });
});

describe('describePattern', () => {
    it('reads naturally in Indonesian', () => {
        expect(describePattern({ kind: 'daily', weekdays_only: true })).toBe(
            'Setiap hari kerja',
        );
        expect(describePattern({ kind: 'weekly', weekdays: [4, 1] })).toBe(
            'Setiap Senin dan Kamis',
        );
        expect(
            describePattern({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5] }),
        ).toBe('Setiap hari kerja');
        expect(describePattern({ kind: 'monthly', day_of_month: 25 })).toBe(
            'Setiap bulan tanggal 25',
        );
        expect(describePattern({ kind: 'monthly', day_of_month: 31 })).toBe(
            'Setiap akhir bulan',
        );
        expect(
            describePattern({
                kind: 'every_n_weeks',
                interval: 2,
                weekdays: [1, 3, 5],
            }),
        ).toBe('Setiap 2 minggu, hari Senin, Rabu dan Jumat');
    });
});

describe('validateRecurring', () => {
    const base: RecurringForm = {
        title: 'Rekap stok mingguan',
        workspace_id: 'ws-1',
        assignee_id: '',
        pattern: { kind: 'weekly', weekdays: [1] },
        starts_on: '2026-10-05',
        ends_on: '',
    };

    it('accepts a complete form', () => {
        expect(validateRecurring(base)).toEqual({});
    });

    it('reports each missing field', () => {
        expect(
            validateRecurring({
                ...base,
                title: '  ',
                workspace_id: '',
                pattern: { kind: 'weekly', weekdays: [] },
                starts_on: '',
            }),
        ).toEqual({
            title: 'Isi judul tugas.',
            workspace_id: 'Pilih workspace.',
            pattern: 'Pilih minimal satu hari.',
            starts_on: 'Isi tanggal mulai.',
        });
    });

    it('rejects an end before the start and empty windows', () => {
        expect(
            validateRecurring({ ...base, ends_on: '2026-10-01' }).ends_on,
        ).toBe('Tanggal berakhir harus setelah tanggal mulai.');
        // Tue 6 – Sun 11 Oct has no Monday.
        expect(
            validateRecurring({
                ...base,
                starts_on: '2026-10-06',
                ends_on: '2026-10-11',
            }).ends_on,
        ).toBe('Tidak ada jadwal di antara tanggal mulai dan berakhir.');
    });
});

describe('rules', () => {
    const ctx: RuleContext = {
        workspaces: [
            {
                id: 'ws-1',
                key: 'OPS',
                name: 'Divisi Operasional',
                color: 'teal',
            },
        ],
        labels: [{ id: 'lb-1', name: 'Ditinjau', color: 'violet' }],
        people: [{ id: 'u-1', name: 'Dimas Pratama' }],
    };
    const draft: RuleDraft = {
        name: 'Selesai → beri tahu Kadiv',
        workspace_id: 'ws-1',
        trigger: { type: 'task_moved', category: 'done' },
        condition: { type: 'priority', priority: 1 },
        actions: [
            { type: 'notify', target: { kind: 'user', id: 'u-1' } },
            { type: 'add_label', label_id: 'lb-1' },
        ],
    };

    it('describes a rule as one sentence', () => {
        expect(describeRule(ctx, draft)).toBe(
            'Jika tugas di Divisi Operasional pindah ke kolom Selesai dan prioritasnya Urgent, maka beri tahu Dimas Pratama dan tambah label "Ditinjau".',
        );
        expect(
            describeRule(ctx, {
                ...draft,
                trigger: { type: 'task_overdue' },
                condition: null,
                actions: [],
            }),
        ).toBe('Jika tugas di Divisi Operasional lewat tenggat, maka ….');
    });

    it('validates required pieces', () => {
        expect(validateRule(draft)).toEqual({});
        expect(
            validateRule({
                ...draft,
                name: '',
                trigger: { type: 'task_created_with_label', label_id: null },
                condition: { type: 'assignee', user_id: null },
                actions: [{ type: 'assign', user_id: null }],
            }),
        ).toEqual({
            name: 'Beri nama aturan.',
            trigger: 'Pilih label.',
            condition: 'Lengkapi kondisi atau hapus.',
            actions: { 0: 'Pilih tujuan aksi.' },
        });
        expect(validateRule({ ...draft, actions: [] }).actionsList).toBe(
            'Tambahkan minimal satu aksi.',
        );
    });

    it('blocks a move back into the triggering column', () => {
        expect(
            validateRule({
                ...draft,
                actions: [{ type: 'move_status', category: 'done' }],
            }).actions,
        ).toEqual({
            0: 'Aksi ini memicu aturan yang sama lagi. Pilih kolom lain.',
        });
    });

    it('round-trips notification targets', () => {
        for (const target of [
            { kind: 'user', id: 'u-1' },
            { kind: 'role', role: 'hr' },
            { kind: 'assignees' },
            { kind: 'watchers' },
        ] as const) {
            expect(decodeTarget(encodeTarget(target))).toEqual(target);
        }

        expect(decodeTarget('role:unknown')).toBeNull();
    });
});

describe('performance metrics', () => {
    const counts: PeriodCounts = {
        label: '8 minggu',
        due: 45,
        done_of_due: 37,
        done_with_due: 37,
        on_time: 33,
        lead_times: [1, 2, 3, 2.5, 4, 2.7],
        division_lead_time: 3.2,
        scheduled_days: 21,
        on_time_days: 20,
        attendance_label: 'September',
    };

    it('computes rates and medians', () => {
        expect(rate(37, 45)).toBe(82);
        expect(rate(1, 0)).toBeNull();
        expect(median([3, 1, 2])).toBe(2);
        expect(median([1, 2, 3, 4])).toBe(2.5);
        expect(median([])).toBeNull();
    });

    it('keeps each metric separate (no combined score)', () => {
        const metrics = computeMetrics(counts);

        expect(metrics.map((m) => [m.key, m.value])).toEqual([
            ['completion', '82%'],
            ['on_time', '89%'],
            ['lead_time', '2,6 hr'],
            ['attendance', '95%'],
        ]);
        expect(metrics[0].note).toBe('37 dari 45 tugas bertenggat selesai');
        expect(metrics.some((m) => /skor/i.test(m.label))).toBe(false);
    });

    it('shows dashes when there is no data', () => {
        const empty = {
            ...counts,
            due: 0,
            done_of_due: 0,
            done_with_due: 0,
            on_time: 0,
            lead_times: [],
        };

        expect(
            computeMetrics(empty)
                .slice(0, 3)
                .map((m) => m.value),
        ).toEqual(['–', '–', '–']);
        expect(
            isEmptyPerformance(empty, [
                { week_start: '2026-10-05', on_time: 0, late: 0 },
            ]),
        ).toBe(true);
    });

    it('scales week bars to the busiest week', () => {
        expect(
            weekBars(
                [
                    { week_start: '2026-09-28', on_time: 4, late: 1 },
                    { week_start: '2026-10-05', on_time: 2, late: 0 },
                ],
                100,
            ),
        ).toEqual([
            { week_start: '2026-09-28', total: 5, onTimeH: 80, lateH: 20 },
            { week_start: '2026-10-05', total: 2, onTimeH: 40, lateH: 0 },
        ]);
    });
});

describe('helpers', () => {
    it('renders provider templates', () => {
        expect(
            renderTemplate('Halo {{1}}, tugas {{2}}. {{3}}', [
                'Sari',
                'OPS-12',
            ]),
        ).toBe('Halo Sari, tugas OPS-12. {{3}}');
        expect(boldSegments('Tugas *OPS-12* baru')).toEqual([
            { text: 'Tugas ', bold: false },
            { text: 'OPS-12', bold: true },
            { text: ' baru', bold: false },
        ]);
    });

    it('checks quiet hours across midnight', () => {
        expect(isInQuietHours('22:15', '21:00', '06:00')).toBe(true);
        expect(isInQuietHours('05:59', '21:00', '06:00')).toBe(true);
        expect(isInQuietHours('06:00', '21:00', '06:00')).toBe(false);
        expect(isInQuietHours('13:00', '12:00', '14:00')).toBe(true);
    });

    it('validates and suggests workspace keys', () => {
        expect(suggestWorkspaceKey('Peluncuran Produk X')).toBe('PPX');
        expect(suggestWorkspaceKey('Gudang')).toBe('GUDA');
        expect(validateWorkspaceKey('PPX', ['OPS'])).toBeNull();
        expect(validateWorkspaceKey('OPS', ['OPS'])).toBe(
            'Kode sudah dipakai workspace lain.',
        );
        expect(validateWorkspaceKey('1AB', [])).toBe(
            'Kode 2–10 huruf besar/angka, diawali huruf.',
        );
    });
});

describe('previewStateFromUrl', () => {
    it('maps ?keadaan to a preview state', async () => {
        const { previewStateFromUrl } =
            await import('@/features/automation/preview-state');

        expect(previewStateFromUrl('/otomasi')).toBe('ready');
        expect(previewStateFromUrl('/otomasi?keadaan=kosong')).toBe('empty');
        expect(previewStateFromUrl('/kinerja?x=1&keadaan=galat')).toBe('error');
        expect(previewStateFromUrl('/kinerja?keadaan=memuat')).toBe('loading');
        expect(previewStateFromUrl('/kinerja?keadaan=aneh')).toBe('ready');
    });
});
