import { describe, expect, it } from 'vitest';
import {
    emptyRow,
    formFromReport,
    hoursText,
    reportPayload,
    statusText,
    submitProblems,
} from './lib';
import type { DailyReportData } from './types';

const report: DailyReportData = {
    id: 'r1',
    date: '2026-10-07',
    status: 'draft',
    submitted_at: null,
    updated_at: null,
    editable: true,
    summary: 'Ringkas',
    blockers: null,
    notes: null,
    items_count: 1,
    hours: 2,
    items: [
        {
            id: 'i1',
            task_id: 't1',
            task_key: 'PRJ-1',
            task_title: 'Rekap',
            is_task: true,
            progress_note: 'Separuh',
            percent: 50,
            hours: 2,
            move_status_id: null,
            status_category_after: null,
        },
    ],
};

describe('daily report form', () => {
    it('round-trips the stored report into the request body', () => {
        const state = formFromReport(report);

        expect(state.items[0]).toMatchObject({
            task_id: 't1',
            percent: '50',
            hours: '2',
            move_status_id: '',
        });
        expect(reportPayload('2026-10-07', state)).toEqual({
            report_date: '2026-10-07',
            summary: 'Ringkas',
            blockers: '',
            notes: '',
            items: [
                {
                    task_id: 't1',
                    progress_note: 'Separuh',
                    percent: 50,
                    hours: 2,
                    move_status_id: null,
                },
            ],
        });
    });

    it('sends empty numbers as null, comma decimals as numbers, no move for other work', () => {
        const row = {
            ...emptyRow(null),
            progress_note: 'Rapat',
            hours: '1,5',
            move_status_id: 's1',
        };
        const body = reportPayload('2026-10-07', {
            summary: '',
            blockers: '',
            notes: '',
            items: [row],
        });

        expect(body.items[0]).toEqual({
            task_id: null,
            progress_note: 'Rapat',
            percent: null,
            hours: 1.5,
            move_status_id: null,
        });
    });

    it('lists what blocks sending', () => {
        expect(
            submitProblems({ summary: '', blockers: '', notes: '', items: [] }),
        ).toHaveLength(1);
        expect(
            submitProblems({
                summary: '',
                blockers: '',
                notes: '',
                items: [emptyRow('t1')],
            }),
        ).toEqual(['Setiap pekerjaan butuh catatan progres.']);
        expect(
            submitProblems({
                summary: '',
                blockers: '',
                notes: '',
                items: [{ ...emptyRow(), progress_note: 'ok' }],
            }),
        ).toEqual([]);
    });

    it('labels the status and hours', () => {
        expect(statusText('missing', null)).toBe('Belum lapor');
        expect(statusText('draft', null)).toBe('Draf');
        expect(statusText('submitted', '2026-10-07T09:05:00Z')).toBe(
            'Terkirim pukul 16.05',
        );
        expect(hoursText(2.5)).toBe('2,5 jam');
        expect(hoursText(null)).toBeNull();
    });

    it('gives each new row its own key', () => {
        expect(emptyRow().key).not.toBe(emptyRow().key);
    });
});
