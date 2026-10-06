import { describe, expect, it } from 'vitest';
import {
    BUSY,
    HOLIDAYS,
    LEAVES,
    ME,
    MEETINGS,
    MINUTES,
    NOW,
    PEOPLE,
    TASKS_DUE,
    TODAY,
} from './fixtures';
import type { MeetingFormValues } from './lib';
import { searchPeople } from './people-picker';
import {
    actionStatus,
    addDays,
    blankMinutes,
    buildCalendarEntries,
    convertToTasks,
    dueLabel,
    entriesOn,
    findConflicts,
    isoWeekNumber,
    meetingPhase,
    meetingsOn,
    minutesProblems,
    minutesProgress,
    monthGrid,
    nextMeeting,
    officeDate,
    officeInstant,
    openActionsFor,
    phaseLabel,
    rangeTitle,
    shortDate,
    suggestFreeSlot,
    toggleLayer,
    validateMeetingForm,
    weekDates,
} from './lib';

const now = Date.parse(NOW);
const byId = (id: string) => MEETINGS.find((meeting) => meeting.id === id)!;

describe('office dates', () => {
    it('reads instants in the office timezone', () => {
        expect(officeDate('2026-10-04T18:00:00Z')).toBe('2026-10-05');
        expect(officeDate(NOW)).toBe(TODAY);
    });

    it('builds Monday-first weeks and months', () => {
        expect(weekDates('2026-10-07')).toEqual([
            '2026-10-05',
            '2026-10-06',
            '2026-10-07',
            '2026-10-08',
            '2026-10-09',
        ]);
        expect(weekDates('2026-10-11', 7).at(-1)).toBe('2026-10-11');

        const october = monthGrid(2026, 10);

        expect(october[0][0]).toBe('2026-09-28');
        expect(october.at(-1)!.at(-1)).toBe('2026-11-01');
        expect(october.every((week) => week.length === 7)).toBe(true);
    });

    it('formats short dates, ranges and week numbers', () => {
        expect(shortDate('2026-10-05')).toBe('Sen, 5 Okt');
        expect(rangeTitle(weekDates(TODAY))).toBe('5–9 Oktober 2026');
        expect(isoWeekNumber(TODAY)).toBe(41);
        expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    });
});

describe('meeting phases', () => {
    it('marks the 10.30 meeting as soon at 10.25 and live later', () => {
        const meeting = byId('koordinasi-q4');

        expect(meetingPhase(meeting, now)).toBe('soon');
        expect(phaseLabel(meeting, now)).toBe('Mulai 5 menit lagi');

        const later = Date.parse('2026-10-05T10:42:00+07:00');

        expect(meetingPhase(meeting, later)).toBe('live');
        expect(phaseLabel(meeting, later)).toBe(
            'Sedang berlangsung · 12 menit',
        );
        expect(meetingPhase(byId('standup-ops'), now)).toBe('done');
    });

    it('picks the next meeting of the viewer for the hero', () => {
        const mine = MEETINGS.filter((m) =>
            m.participants.some((p) => p.user_id === ME),
        );

        expect(nextMeeting(mine, now)?.id).toBe('koordinasi-q4');
        expect(meetingsOn(mine, TODAY).map((m) => m.id)).toEqual([
            'standup-ops',
            'koordinasi-q4',
            'review-vendor',
            'sinkron-gudang',
        ]);
    });
});

describe('scheduling', () => {
    it('finds conflicts from meetings and Google Calendar busy blocks', () => {
        const conflicts = findConflicts(
            ['dimas', 'bayu'],
            officeInstant('2026-10-06', '13:30'),
            officeInstant('2026-10-06', '14:30'),
            MEETINGS,
            BUSY,
        );

        expect(conflicts.map((c) => [c.user_id, c.title])).toEqual([
            ['bayu', 'Rapat lain'],
            ['dimas', '1-on-1 dengan Hendra Wijaya'],
        ]);
    });

    it('suggests the first slot where everyone is free', () => {
        expect(
            suggestFreeSlot(
                ['dimas', 'bayu'],
                '2026-10-06',
                '13:30',
                60,
                MEETINGS,
                BUSY,
            ),
        ).toBe('14:30');
        expect(
            suggestFreeSlot(
                ['dimas'],
                '2026-10-06',
                '16:30',
                60,
                MEETINGS,
                BUSY,
            ),
        ).toBeNull();
    });

    const base: MeetingFormValues = {
        title: 'Review vendor logistik',
        date: '2026-10-06',
        start: '13:30',
        duration: 60,
        platform: 'meet',
        zoomUrl: '',
        zoomPasscode: '',
        room: '',
        participants: ['dimas', 'bayu'],
        agenda: ['Evaluasi pengiriman'],
        recurrence: 'none',
        reminders: [15, 5],
        minuteTakerId: 'dimas',
        workspace: 'OPS',
    };

    it('accepts a complete form', () => {
        expect(validateMeetingForm(base, now, ME)).toEqual({});
    });

    it('explains every missing or invalid field', () => {
        const errors = validateMeetingForm(
            {
                ...base,
                title: ' ',
                date: '2026-10-02',
                participants: ['dimas'],
                platform: 'zoom',
                zoomUrl: 'zoom.us/rapat',
                agenda: ['  '],
            },
            now,
            ME,
        );

        expect(Object.keys(errors).sort()).toEqual([
            'agenda',
            'date',
            'participants',
            'title',
            'zoomUrl',
        ]);
        expect(
            validateMeetingForm(
                { ...base, date: TODAY, start: '09:00' },
                now,
                ME,
            ).start,
        ).toMatch(/sudah lewat/);
        expect(
            validateMeetingForm({ ...base, platform: 'room' }, now, ME).room,
        ).toBe('Pilih ruangan.');
        expect(
            validateMeetingForm(
                {
                    ...base,
                    platform: 'zoom',
                    zoomUrl: 'https://us02web.zoom.us/j/81234567890',
                },
                now,
                ME,
            ),
        ).toEqual({});
    });
});

describe('minutes & follow-ups', () => {
    it('lists my open follow-ups, most urgent first', () => {
        expect(openActionsFor(MINUTES, ME).map((a) => a.text)).toEqual([
            'Konfirmasi anggaran vendor video ke Putri',
            'Kirim jadwal servis 2 kendaraan ke vendor',
            'Uji beban server SIMRS',
            'Siapkan materi presentasi untuk Direksi',
        ]);
    });

    it('derives status, due labels and progress', () => {
        const record = MINUTES.find(
            (m) => m.meeting_id === 'rapat-direksi-28sep',
        )!;

        expect(minutesProgress(record)).toEqual({ done: 4, total: 6, pct: 67 });
        expect(
            actionStatus(
                { ...record.action_items[4], due_date: '2026-10-02' },
                TODAY,
            ),
        ).toBe('late');
        expect(actionStatus(record.action_items[0], TODAY)).toBe('done');
        expect(dueLabel('2026-10-04', TODAY)).toBe('Lewat 1 hari');
        expect(dueLabel('2026-10-06', TODAY)).toBe('Besok');
        expect(dueLabel('2026-10-07', TODAY)).toBe('Rab, 7 Okt');
    });

    it('turns follow-ups into tasks with the workspace sequence', () => {
        const record = MINUTES[0];
        const ids = record.action_items.map((item) => item.id);
        const result = convertToTasks(record.action_items, ids, 'OPS', 156);

        expect(result.created).toEqual(['OPS-156', 'OPS-157']);
        expect(result.nextNumber).toBe(158);
        expect(result.items.map((i) => i.task_key)).toEqual([
            'OPS-142',
            'OPS-156',
            'OPS-157',
            'OPS-151',
        ]);
    });
});

describe('finalising minutes', () => {
    it('lists what blocks finalising', () => {
        const record = MINUTES[0];

        expect(minutesProblems(record)).toEqual([]);
        expect(
            minutesProblems({
                attendance: record.attendance.map((mark) => ({
                    ...mark,
                    present: false,
                })),
                action_items: [
                    { ...record.action_items[0], text: ' ', due_date: '' },
                ],
            }),
        ).toEqual([
            'Tandai minimal satu peserta yang hadir.',
            'Tindak lanjut 1 belum diisi.',
            'Tindak lanjut 1 belum punya tenggat.',
        ]);
    });

    it('starts a draft from the agenda of a meeting without minutes', () => {
        const draft = blankMinutes(byId('review-vendor'), NOW);

        expect(draft.sections.map((s) => s.title)).toEqual(
            byId('review-vendor').agenda,
        );
        expect(draft.attendance.map((a) => a.user_id)).toEqual([
            'dimas',
            'bayu',
            'rizky',
            'fitri',
        ]);
        expect(draft.task_prefix).toBe('OPS');
    });
});

describe('people search', () => {
    it('matches name, title or division and skips chosen people', () => {
        expect(
            searchPeople(PEOPLE, 'gudang', ['sari']).map((p) => p.id),
        ).toEqual(['andi', 'hadi']);
        expect(searchPeople(PEOPLE, '  ', [])).toEqual([]);
        expect(searchPeople(PEOPLE, 'direktur', []).map((p) => p.id)).toEqual([
            'hendra',
            'agus',
        ]);
    });
});

describe('calendar layers', () => {
    const entries = buildCalendarEntries({
        meetings: MEETINGS,
        tasks: TASKS_DUE,
        leaves: LEAVES,
        holidays: HOLIDAYS,
        people: PEOPLE,
        personId: ME,
        today: TODAY,
    });

    it('spreads multi-day leave and filters by layer', () => {
        const tuesday = entriesOn(entries, '2026-10-06', ['leave']);

        expect(tuesday.map((e) => e.title)).toEqual(['Nadia · Cuti tahunan']);
        expect(
            entriesOn(entries, '2026-10-08', ['meetings', 'tasks']).map(
                (e) => e.layer,
            ),
        ).toEqual(['tasks', 'meetings']);
        expect(entries.some((e) => e.id === 'task-OPS-138')).toBe(false);
        expect(entries.find((e) => e.id === 'task-PLQ-19')?.overdue).toBe(true);
    });

    it('never switches off the last layer', () => {
        expect(toggleLayer(['meetings'], 'meetings')).toEqual(['meetings']);
        expect(toggleLayer(['meetings'], 'holidays')).toEqual([
            'meetings',
            'holidays',
        ]);
        expect(toggleLayer(['meetings', 'tasks'], 'tasks')).toEqual([
            'meetings',
        ]);
    });
});
