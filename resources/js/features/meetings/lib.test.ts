import { describe, expect, it } from 'vitest';
import type { MeetingFormValues } from './lib';
import {
    actionStatus,
    dueLabel,
    entriesOn,
    isoWeekNumber,
    joinLink,
    meetingPhase,
    meetingsOn,
    minutesProblems,
    minutesProgress,
    monthGrid,
    nextMeeting,
    officeDate,
    phaseLabel,
    rangeTitle,
    rsvpCounts,
    shortDate,
    toggleLayer,
    validateMeetingForm,
    weekDates,
} from './lib';
import { searchPeople } from './people-picker';
import type { ActionItem, CalendarEntry, Meeting, Person } from './types';

/** Monday 5 Oct 2026, 10.25 WIB. */
const NOW = '2026-10-05T10:25:00+07:00';
const now = Date.parse(NOW);
const ME = '01dimas';

function meeting(overrides: Partial<Meeting> & { id: string }): Meeting {
    const date = (overrides.starts_at ?? '2026-10-05T10:30:00+07:00').slice(
        0,
        10,
    );

    return {
        key: `${overrides.id}:${date}`,
        occurrence_date: date,
        href: `/rapat/${overrides.id}`,
        minutes_href: `/rapat/${overrides.id}/notulen`,
        title: 'Rapat',
        starts_at: '2026-10-05T10:30:00+07:00',
        ends_at: '2026-10-05T11:30:00+07:00',
        platform: 'meet',
        location: null,
        join_url: 'https://meet.google.com/abc-defg-hij',
        organizer_id: ME,
        minute_taker_id: ME,
        workspace: null,
        participants: [
            { user_id: ME, rsvp: 'yes' },
            { user_id: '01rizky', rsvp: 'maybe' },
            { user_id: null, email: 'tamu@vendor.co.id', rsvp: 'pending' },
        ],
        agenda: ['Pembukaan'],
        recurrence: 'none',
        reminders: [15, 5],
        minutes_status: 'none',
        ...overrides,
    };
}

const standup = meeting({
    id: 'standup',
    starts_at: '2026-10-05T09:00:00+07:00',
    ends_at: '2026-10-05T09:30:00+07:00',
});
const q4 = meeting({ id: 'q4', title: 'Koordinasi peluncuran Q4' });
const tomorrow = meeting({
    id: 'vendor',
    starts_at: '2026-10-06T13:30:00+07:00',
    ends_at: '2026-10-06T14:30:00+07:00',
});
const MEETINGS = [tomorrow, q4, standup];

const item = (overrides: Partial<ActionItem>): ActionItem => ({
    id: 'a1',
    text: 'Rekap stok',
    assignee_id: ME,
    due_date: '2026-10-07',
    task_key: null,
    done: false,
    ...overrides,
});

describe('office dates', () => {
    it('reads instants in the office timezone', () => {
        expect(officeDate('2026-10-04T18:00:00Z')).toBe('2026-10-05');
        expect(officeDate(NOW)).toBe('2026-10-05');
    });

    it('builds Monday-first weeks and months', () => {
        expect(weekDates('2026-10-07')).toEqual([
            '2026-10-05',
            '2026-10-06',
            '2026-10-07',
            '2026-10-08',
            '2026-10-09',
        ]);
        const grid = monthGrid(2026, 10);
        expect(grid[0][0]).toBe('2026-09-28');
        expect(grid.at(-1)?.at(-1)).toBe('2026-11-01');
    });

    it('formats short dates, ranges and week numbers', () => {
        expect(shortDate('2026-10-05')).toBe('Sen, 5 Okt');
        expect(rangeTitle(weekDates('2026-10-05'))).toBe('5–9 Oktober 2026');
        expect(isoWeekNumber('2026-10-05')).toBe(41);
    });
});

describe('meeting phases', () => {
    it('marks the 10.30 meeting as soon at 10.25 and live later', () => {
        expect(meetingPhase(q4, now)).toBe('soon');
        expect(phaseLabel(q4, now)).toBe('Mulai 5 menit lagi');
        expect(meetingPhase(standup, now)).toBe('done');

        const later = Date.parse('2026-10-05T10:42:00+07:00');
        expect(meetingPhase(q4, later)).toBe('live');
        expect(phaseLabel(q4, later)).toBe('Sedang berlangsung · 12 menit');
    });

    it('picks the next meeting of the day for the hero', () => {
        expect(nextMeeting(MEETINGS, now)?.id).toBe('q4');
        expect(meetingsOn(MEETINGS, '2026-10-05').map((m) => m.id)).toEqual([
            'standup',
            'q4',
        ]);
    });

    it('counts RSVPs and only offers pasted online links', () => {
        expect(rsvpCounts(q4)).toEqual({ yes: 1, maybe: 1, no: 0, pending: 1 });
        expect(joinLink(q4)).toBe('https://meet.google.com/abc-defg-hij');
        expect(
            joinLink({ ...q4, platform: 'room', location: 'Lt. 3' }),
        ).toBeNull();
        expect(joinLink({ ...q4, join_url: null })).toBeNull();
    });
});

describe('scheduling form', () => {
    const valid: MeetingFormValues = {
        title: 'Review vendor logistik',
        date: '2026-10-06',
        start: '13:30',
        duration: 60,
        platform: 'zoom',
        joinUrl: 'https://zoom.us/j/81234567890',
        location: '',
        participants: [ME, '01rizky'],
        agenda: ['Evaluasi'],
        recurrence: 'none',
        recurrenceUntil: '',
        reminders: [15],
        minuteTakerId: ME,
        workspace: 'none',
        leadership: false,
        autoMinutes: false,
    };

    it('accepts a complete form', () => {
        expect(validateMeetingForm(valid, now, ME)).toEqual({});
        expect(
            validateMeetingForm(
                { ...valid, platform: 'meet', joinUrl: '' },
                now,
                ME,
            ),
        ).toEqual({});
    });

    it('explains every missing or invalid field', () => {
        const errors = validateMeetingForm(
            {
                ...valid,
                title: '',
                date: '2026-10-01',
                participants: [ME],
                joinUrl: 'zoom.us/123',
                agenda: [' '],
                recurrence: 'weekly',
                recurrenceUntil: '2026-09-30',
            },
            now,
            ME,
        );

        expect(Object.keys(errors).sort()).toEqual([
            'agenda',
            'date',
            'joinUrl',
            'participants',
            'recurrenceUntil',
            'title',
        ]);
        expect(
            validateMeetingForm(
                { ...valid, platform: 'room', location: ' ' },
                now,
                ME,
            ).location,
        ).toBe('Isi ruangan rapat.');
        expect(
            validateMeetingForm(
                { ...valid, platform: 'meet', joinUrl: 'http://meet' },
                now,
                ME,
            ).joinUrl,
        ).toContain('Meet');
    });

    it('keeps past dates when editing', () => {
        expect(
            validateMeetingForm({ ...valid, date: '2026-10-01' }, now, ME, true)
                .date,
        ).toBeUndefined();
    });
});

describe('minutes & follow-ups', () => {
    it('derives status, due labels and progress', () => {
        expect(
            actionStatus(item({ due_date: '2026-10-02' }), '2026-10-05'),
        ).toBe('late');
        expect(actionStatus(item({ due_date: null }), '2026-10-05')).toBe(
            'open',
        );
        expect(actionStatus(item({ done: true }), '2026-10-05')).toBe('done');
        expect(dueLabel('2026-10-05', '2026-10-05')).toBe('Hari ini');
        expect(dueLabel('2026-10-06', '2026-10-05')).toBe('Besok');
        expect(dueLabel('2026-10-02', '2026-10-05')).toBe('Lewat 3 hari');
        expect(dueLabel(null, '2026-10-05')).toBe('Tanpa tenggat');
        expect(
            minutesProgress({
                action_items: [item({ done: true }), item({ id: 'a2' })],
            }),
        ).toEqual({ done: 1, total: 2, pct: 50 });
    });

    it('lists what blocks finalising', () => {
        expect(
            minutesProblems({
                attendance: [{ user_id: ME, present: false }],
                action_items: [
                    item({ text: ' ', assignee_id: null, due_date: null }),
                ],
            }),
        ).toEqual([
            'Tandai minimal satu peserta yang hadir.',
            'Tindak lanjut 1 belum diisi.',
            'Tindak lanjut 1 belum punya penanggung jawab.',
            'Tindak lanjut 1 belum punya tenggat.',
        ]);
        expect(
            minutesProblems({
                attendance: [{ user_id: ME, present: true }],
                action_items: [item({})],
            }),
        ).toEqual([]);
    });
});

describe('people search', () => {
    const people: Person[] = [
        {
            id: ME,
            name: 'Dimas Pratama',
            title: 'Kepala Divisi',
            division: 'Operasional',
        },
        {
            id: '01bayu',
            name: 'Bayu Saputra',
            title: 'Staf Logistik',
            division: 'Operasional',
        },
        {
            id: '01maya',
            name: 'Maya Lestari',
            title: 'Staf Pemasaran',
            division: 'Pemasaran',
        },
    ];

    it('matches name, title or division and skips chosen people', () => {
        expect(searchPeople(people, 'operas', [ME]).map((p) => p.id)).toEqual([
            '01bayu',
        ]);
        expect(searchPeople(people, 'pemasaran', []).map((p) => p.id)).toEqual([
            '01maya',
        ]);
        expect(searchPeople(people, ' ', [])).toEqual([]);
    });
});

describe('calendar layers', () => {
    const entries: CalendarEntry[] = [
        {
            id: 'leave-1',
            layer: 'leave',
            date: '2026-10-05',
            end_date: '2026-10-07',
            title: 'Nadia · Cuti',
            meta: '',
        },
        {
            id: 'meeting-1',
            layer: 'meetings',
            date: '2026-10-06',
            starts_at: '2026-10-06T06:30:00Z',
            title: 'Rapat',
            meta: '',
        },
        {
            id: 'holiday-1',
            layer: 'holidays',
            date: '2026-10-06',
            title: 'Libur',
            meta: '',
        },
    ];

    it('spreads multi-day leave and filters by layer', () => {
        expect(
            entriesOn(entries, '2026-10-06', [
                'leave',
                'meetings',
                'holidays',
            ]).map((entry) => entry.id),
        ).toEqual(['holiday-1', 'leave-1', 'meeting-1']);
        expect(
            entriesOn(entries, '2026-10-08', ['leave', 'meetings', 'holidays']),
        ).toEqual([]);
        expect(
            entriesOn(entries, '2026-10-06', ['meetings']).map((e) => e.id),
        ).toEqual(['meeting-1']);
    });

    it('never switches off the last layer', () => {
        expect(toggleLayer(['tasks'], 'tasks')).toEqual(['tasks']);
        expect(toggleLayer(['tasks'], 'meetings')).toEqual([
            'meetings',
            'tasks',
        ]);
        expect(toggleLayer(['tasks', 'leave'], 'tasks')).toEqual(['leave']);
    });
});
