import { describe, expect, it } from 'vitest';
import {
    attendanceRows,
    initialsOf,
    navigatorSections,
    normalizeRoom,
    speakingTotals,
} from './contract';
import type { VideoRoomProps } from './types';

const room: VideoRoomProps = {
    viewer: { id: 'sari', name: 'Sari Wulandari' },
    meeting: {
        id: 'm1',
        title: 'Rapat mingguan Operasional',
        occurrence_date: '2026-10-08',
        starts_at: '2026-10-08T02:00:00Z',
        ends_at: '2026-10-08T03:00:00Z',
        href: '/rapat/m1',
        minutes_href: '/rapat/m1/notulen',
        organizer_id: 'dimas',
        minute_taker_id: 'sari',
    },
    people: [
        { id: 'yoga', name: 'Yoga Pratama', title: '', division: '' },
        { id: 'sari', name: 'Sari Wulandari', title: '', division: '' },
        { id: 'dimas', name: 'Dimas Pratama', title: '', division: '' },
        { id: 'lukman', name: 'Lukman Hakim', title: '', division: '' },
    ],
    video: {
        configured: true,
        join_href: '/rapat/m1/gabung',
        room_href: '/rapat/m1/ruang',
        token_url: '/rapat/m1/video/token',
        opens_at: '2026-10-08T01:45:00Z',
        closes_at: '2026-10-08T05:00:00Z',
        is_organizer: false,
        can_join: true,
        denied_reason: null,
        in_room: 3,
        attendance: [
            {
                user_id: 'yoga',
                joined_at: '2026-10-08T02:11:30Z',
                left_at: null,
                duration_seconds: 60,
                in_room: true,
                sessions: 1,
            },
            {
                user_id: 'dimas',
                joined_at: '2026-10-08T01:59:00Z',
                left_at: null,
                duration_seconds: 900,
                in_room: true,
                sessions: 1,
            },
            {
                user_id: 'sari',
                joined_at: '2026-10-08T02:02:10Z',
                left_at: null,
                duration_seconds: 800,
                in_room: true,
                sessions: 1,
            },
        ],
    },
};

describe('normalizeRoom', () => {
    it('derives participants, roles and seats from people (older backend)', () => {
        const normalized = normalizeRoom(room);

        expect(
            normalized.participants.map((p) => [p.id, p.seat, p.role_label]),
        ).toEqual([
            ['dimas', 0, 'Penyelenggara'],
            ['sari', 1, 'Notulis'],
            ['lukman', 2, null],
            ['yoga', 3, null],
        ]);
        expect(normalized.participants[0]).toMatchObject({
            first_name: 'Dimas',
            initials: 'DP',
        });
        expect(normalized.links).toEqual({
            notesSource: null,
            speaking: null,
            attendance: null,
            call: null,
        });
        expect(normalized.can.call_participants).toBe(false);
        expect(normalized.features.video_configured).toBe(true);
    });

    it('turns auto minutes on only when the notulen server is available', () => {
        const notulen = {
            available: true,
            auto_minutes: true,
        } as Parameters<typeof normalizeRoom>[1];
        expect(normalizeRoom(room, notulen).features.auto_minutes).toBe(true);
        expect(normalizeRoom(room, null).features.auto_minutes).toBe(false);
    });

    it('builds initials from the first and last name', () => {
        expect(initialsOf('Hana Pratiwi Putri')).toBe('HP');
        expect(initialsOf('Yoga')).toBe('Y');
    });
});

describe('navigatorSections', () => {
    it('lists sections, marks extra ones and ends with the fixed blocks', () => {
        const sections = navigatorSections(
            {
                sections: [
                    { title: 'Rekap stok', body: 'Selisih 0,8%' },
                    { title: 'Tindak lanjut rapat lalu', body: '' },
                ],
                decisions: ['Servis tetap di Sinar Jaya'],
                action_items: [],
            },
            ['Rekap stok'],
        );

        expect(sections.map((s) => [s.key, s.kind, s.has_notes])).toEqual([
            ['section-0', 'agenda', true],
            ['section-1', 'extra', false],
            ['decisions', 'decisions', true],
            ['action-items', 'action_items', false],
        ]);
    });

    it('falls back to the meeting agenda without minutes', () => {
        expect(navigatorSections(null, ['A', 'B']).map((s) => s.title)).toEqual(
            ['A', 'B', 'Keputusan', 'Tindak lanjut'],
        );
    });
});

describe('attendanceRows', () => {
    it('orders by join time, marks lateness after the grace and lists absentees', () => {
        const rows = attendanceRows(normalizeRoom(room));

        expect(rows).toEqual([
            expect.objectContaining({
                userId: 'dimas',
                lateMinutes: 0,
                late: false,
            }),
            expect.objectContaining({
                userId: 'sari',
                lateMinutes: 2,
                late: false,
            }),
            expect.objectContaining({
                userId: 'yoga',
                lateMinutes: 11,
                late: true,
            }),
            {
                kind: 'absent',
                userId: 'lukman',
                rsvp: 'yes',
                calledAt: null,
            },
        ]);
    });

    it('prefers the server values when present', () => {
        const rows = attendanceRows(
            normalizeRoom({
                ...room,
                video: {
                    ...room.video,
                    attendance: [
                        {
                            ...room.video.attendance[0],
                            late_minutes: 4,
                            late: true,
                        },
                    ],
                    not_joined: [
                        {
                            user_id: 'lukman',
                            rsvp: 'no',
                            optional: false,
                            called_at: '2026-10-08T02:12:00Z',
                        },
                    ],
                },
            }),
        );

        expect(rows).toEqual([
            expect.objectContaining({ userId: 'yoga', lateMinutes: 4 }),
            expect.objectContaining({
                userId: 'lukman',
                rsvp: 'no',
                calledAt: '2026-10-08T02:12:00Z',
            }),
        ]);
    });
});

describe('speakingTotals', () => {
    it('maps the server totals by person', () => {
        expect(
            speakingTotals({
                occurrence_date: '2026-10-08',
                total_ms: 3,
                updated_at: null,
                people: [
                    { user_id: 'a', ms: 2, share: 67 },
                    { user_id: 'b', ms: 1, share: 33 },
                ],
                silent: [],
            }),
        ).toEqual({ a: 2, b: 1 });
        expect(speakingTotals(null)).toEqual({});
    });
});
