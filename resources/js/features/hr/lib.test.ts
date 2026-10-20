import { describe, expect, it } from 'vite-plus/test';
import {
    addDays,
    assignmentProgress,
    assignmentStatusText,
    dueLabel,
    durationLabel,
    monthGrid,
    monthLabel,
    recipientCount,
    recipientOptions,
    recipientPayload,
    searchRecipients,
    shiftMonth,
    statusChips,
    waitingLabel,
    weekOf,
} from './lib';
import type { AssignmentPickers, AssignmentRow } from './types';

const pickers: AssignmentPickers = {
    people: [
        { id: 'u1', name: 'Bayu Saputra', division: 'Operasional' },
        { id: 'u2', name: 'Lina Marlina', division: 'Keuangan' },
        { id: 'u3', name: 'Arif Nugroho', division: 'Programming' },
    ],
    divisions: [
        { id: 'd1', name: 'Keuangan', people: 8 },
        { id: 'd2', name: 'Operasional', people: 12 },
    ],
    teams: [
        { id: 't1', name: 'Gudang', division: 'Operasional', people: 4 },
        { id: 't2', name: 'Web', division: 'Programming', people: 3 },
    ],
};

const row = (overrides: Partial<AssignmentRow> = {}): AssignmentRow => ({
    id: 'x',
    key: 'PHR-1',
    title: 'Tugas',
    url: '/w/PHR/tasks/1',
    assignees: [],
    assignee_count: 0,
    due_date: null,
    status: 'not_started',
    status_label: 'Belum mulai',
    overdue_days: 0,
    checklist: { done: 0, total: 0 },
    completed_at: null,
    ...overrides,
});

describe('Ruang HR calendar helpers', () => {
    it('builds Monday-first weeks covering the month', () => {
        const weeks = monthGrid('2026-10');

        // 1 Oct 2026 is a Thursday, 31 Oct a Saturday.
        expect(weeks[0][0]).toBe('2026-09-28');
        expect(weeks.at(-1)?.at(-1)).toBe('2026-11-01');
        expect(weeks).toHaveLength(5);
        expect(weeks.every((week) => week.length === 7)).toBe(true);

        // February 2027 starts on a Monday and ends on a Sunday.
        expect(monthGrid('2027-02')).toHaveLength(4);
    });

    it('shifts months across years and labels them', () => {
        expect(shiftMonth('2026-12', 1)).toBe('2027-01');
        expect(shiftMonth('2026-01', -1)).toBe('2025-12');
        expect(monthLabel('2026-10')).toBe('Oktober 2026');
        expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
        expect(weekOf('2026-10-22')[0]).toBe('2026-10-19');
        expect(dueLabel('2026-10-16')).toBe('Jum, 16 Okt');
    });

    it('formats waiting time and durations', () => {
        const now = new Date('2026-10-20T10:00:00Z');

        expect(waitingLabel('2026-10-20T09:30:00Z', now)).toBe('baru masuk');
        expect(waitingLabel('2026-10-19T08:00:00Z', now)).toBe(
            'menunggu 26 jam',
        );
        expect(waitingLabel('2026-10-15T10:00:00Z', now)).toBe(
            'menunggu 5 hari',
        );
        expect(waitingLabel(null, now)).toBeNull();
        expect(durationLabel(45)).toBe('45 menit');
        expect(durationLabel(130)).toBe('2 jam 10 menit');
        expect(durationLabel(120)).toBe('2 jam');
    });
});

describe('Ruang HR assignments', () => {
    it('maps the counts to chips in the mockup order', () => {
        expect(
            statusChips({
                all: 14,
                not_started: 3,
                in_progress: 6,
                overdue: 3,
                done: 2,
            }).map((chip) => `${chip.label} ${chip.count}`),
        ).toEqual([
            'Semua 14',
            'Belum mulai 3',
            'Dikerjakan 6',
            'Terlambat 3',
            'Selesai 2',
        ]);
    });

    it('labels overdue rows and computes checklist progress', () => {
        expect(
            assignmentStatusText(
                row({
                    status: 'overdue',
                    overdue_days: 4,
                    status_label: 'Terlambat',
                }),
            ),
        ).toBe('Terlambat 4 hari');
        expect(assignmentStatusText(row())).toBe('Belum mulai');
        expect(
            assignmentProgress(row({ checklist: { done: 1, total: 4 } })),
        ).toBe(25);
        expect(assignmentProgress(row({ status: 'done' }))).toBe(100);
    });
});

describe('Ruang HR recipients', () => {
    const options = recipientOptions(pickers);

    it('searches people, divisions and teams, skipping chosen ones', () => {
        expect(searchRecipients(options, 'keu', []).map((o) => o.id)).toEqual([
            'd1',
            'u2',
        ]);
        expect(
            searchRecipients(options, 'keu', [
                { type: 'division', id: 'd1' },
            ]).map((o) => o.id),
        ).toEqual(['u2']);
    });

    it('counts people once when a person or team sits in a chosen division', () => {
        expect(
            recipientCount(
                [
                    { type: 'division', id: 'd2' },
                    { type: 'team', id: 't1' },
                    { type: 'user', id: 'u1' },
                    { type: 'user', id: 'u2' },
                ],
                options,
            ),
        ).toEqual({ count: 13, approximate: false });
    });

    it('marks the count approximate when a team and separate people may overlap', () => {
        expect(
            recipientCount(
                [
                    { type: 'team', id: 't2' },
                    { type: 'user', id: 'u3' },
                ],
                options,
            ),
        ).toEqual({ count: 4, approximate: true });
        expect(recipientCount([], options)).toEqual({
            count: 0,
            approximate: false,
        });
    });

    it('builds the request body', () => {
        expect(
            recipientPayload([
                { type: 'user', id: 'u1' },
                { type: 'division', id: 'd1' },
                { type: 'team', id: 't1' },
            ]),
        ).toEqual({ user_ids: ['u1'], division_ids: ['d1'], team_ids: ['t1'] });
    });
});
