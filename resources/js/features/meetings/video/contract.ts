/**
 * Adapter between the room props of the backend (docs/fitur/rapat-video-
 * kontrak.md) and the "Notulen Hidup" UI. `normalizeRoom()` turns the props
 * into one complete shape: keys the backend does not send yet are derived
 * from what it does send (people, attendance, meeting) and endpoints it does
 * not offer are `null`, so the UI hides those actions instead of failing.
 * Pure and tested (contract.test.ts).
 */
import type { Meeting, Minutes, Person, PersonId } from '../types';
import type { NotulenSummary } from '../notulen/types';
import type {
    AgendaSection,
    NotesSource,
    NotJoined,
    RoomCan,
    RoomFeatures,
    RoomMinutes,
    RoomParticipant,
    SpeakingTotals,
    VideoRoomProps,
} from './types';

export type Room = {
    viewer: VideoRoomProps['viewer'];
    meeting: VideoRoomProps['meeting'];
    people: Person[];
    video: VideoRoomProps['video'];
    participants: RoomParticipant[];
    minutes: RoomMinutes | null;
    notesSource: NotesSource | null;
    speaking: SpeakingTotals | null;
    features: RoomFeatures;
    can: RoomCan;
    channel: string | null;
    notulen: NotulenSummary | null;
    links: {
        notesSource: string | null;
        speaking: string | null;
        attendance: string | null;
        call: string | null;
        readmit: string | null;
        hand: string | null;
        attributes: string | null;
    };
};

const TONES = ['blue', 'teal', 'amber'] as const;

/** Same hash as avatarTone() in components/ui/avatar.tsx. */
export function toneOf(name: string): RoomParticipant['tone'] {
    let hash = 0;

    for (const char of name) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }

    return TONES[hash % TONES.length];
}

export function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    return (
        (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : '')
    ).toUpperCase();
}

/** Participants from `people` when the backend has no `participants` yet. */
function deriveParticipants(room: VideoRoomProps): RoomParticipant[] {
    const { organizer_id: organizer, minute_taker_id: taker } = room.meeting;
    const rank = (id: PersonId) =>
        id === organizer ? 0 : id === taker ? 1 : 2;

    return [...room.people]
        .sort(
            (a, b) =>
                rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, 'id'),
        )
        .map((person, seat) => {
            const roles: RoomParticipant['roles'] = [];

            if (person.id === organizer) {
                roles.push('organizer');
            }

            if (person.id === taker) {
                roles.push('minute_taker');
            }

            return {
                ...person,
                first_name: person.name.split(' ')[0] ?? person.name,
                initials: initialsOf(person.name),
                tone: toneOf(person.name),
                seat,
                roles,
                role_label:
                    roles.length === 2
                        ? 'Penyelenggara · Notulis'
                        : roles[0] === 'organizer'
                          ? 'Penyelenggara'
                          : roles[0] === 'minute_taker'
                            ? 'Notulis'
                            : null,
                rsvp: 'yes',
                optional: false,
            };
        });
}

export function normalizeRoom(
    room: VideoRoomProps,
    notulen: NotulenSummary | null = null,
): Room {
    const isOrganizer = room.video.is_organizer;
    const autoMinutes = Boolean(notulen?.available && notulen.auto_minutes);

    return {
        viewer: room.viewer,
        meeting: room.meeting,
        people: room.people,
        video: room.video,
        participants: room.participants ?? deriveParticipants(room),
        minutes: room.minutes ?? null,
        notesSource: room.notes_source ?? null,
        speaking: room.speaking ?? null,
        features: room.features ?? {
            video_configured: room.video.configured,
            realtime: false,
            subtitles: false,
            auto_minutes: autoMinutes,
            collab_minutes: false,
        },
        can: room.can ?? {
            edit_minutes: false,
            choose_notes_source: false,
            moderate: isOrganizer,
            call_participants: false,
            report_speaking: false,
        },
        channel: room.channel ?? null,
        notulen,
        links: {
            notesSource: room.links?.notes_source ?? null,
            speaking: room.links?.speaking ?? null,
            attendance: room.links?.attendance ?? null,
            call: room.links?.call ?? null,
            readmit: room.links?.readmit ?? null,
            hand: room.links?.hand ?? null,
            attributes: room.links?.attributes ?? null,
        },
    };
}

/**
 * Section navigator (contract §1.3) from the current minutes: agenda/extra
 * sections in document order, then the fixed Keputusan and Tindak lanjut
 * blocks. Without minutes: the meeting agenda.
 */
export function navigatorSections(
    minutes: Pick<Minutes, 'sections' | 'decisions' | 'action_items'> | null,
    agenda: string[] = [],
): AgendaSection[] {
    const sections =
        minutes?.sections ?? agenda.map((title) => ({ title, body: '' }));
    const agendaTitles = new Set(agenda);

    return [
        ...sections.map((section, index): AgendaSection => ({
            key: `section-${index}`,
            index,
            title: section.title,
            kind:
                agendaTitles.size === 0 || agendaTitles.has(section.title)
                    ? 'agenda'
                    : 'extra',
            has_notes: section.body.trim() !== '',
        })),
        {
            key: 'decisions',
            index: null,
            title: 'Keputusan',
            kind: 'decisions',
            has_notes: (minutes?.decisions.length ?? 0) > 0,
        },
        {
            key: 'action-items',
            index: null,
            title: 'Tindak lanjut',
            kind: 'action_items',
            has_notes: (minutes?.action_items.length ?? 0) > 0,
        },
    ];
}

/**
 * The room's minutes as the `MinutesProps` of features/meetings/use-minutes
 * (the existing minutes editor: autosave, versions, follow-ups → tasks).
 * Only the fields that hook reads are meaningful.
 */
export function minutesPropsFor(room: Room, minutes: RoomMinutes) {
    const meeting: Meeting = {
        id: room.meeting.id,
        key: minutes.doc.meeting_key,
        occurrence_date: room.meeting.occurrence_date,
        href: room.meeting.href,
        minutes_href: room.meeting.minutes_href,
        title: room.meeting.title,
        starts_at: room.meeting.starts_at,
        ends_at: room.meeting.ends_at,
        platform: 'video',
        location: null,
        join_url: null,
        organizer_id: room.meeting.organizer_id,
        minute_taker_id: room.meeting.minute_taker_id ?? null,
        workspace: room.meeting.workspace ?? null,
        participants: [],
        agenda: room.meeting.agenda ?? [],
        // useMinutes adds ?tanggal= for a series; always pass it in the room.
        recurrence: 'weekly',
        reminders: [],
        minutes_status: minutes.doc.status,
    };

    return {
        viewer_id: room.viewer.id,
        meeting,
        minutes: minutes.doc,
        people: room.people,
        workspaces: room.meeting.workspace ? [room.meeting.workspace] : [],
        can: { edit: minutes.can_edit, reopen: false },
    };
}

/** Attendance row of the Kehadiran panel. */
export type AttendanceRow =
    | {
          kind: 'joined';
          userId: PersonId;
          joinedAt: string;
          inRoom: boolean;
          lateMinutes: number;
          late: boolean;
      }
    | {
          kind: 'absent';
          userId: PersonId;
          rsvp: NotJoined['rsvp'];
          calledAt: string | null;
      }
    | { kind: 'removed'; userId: PersonId; removedAt: string | null };

/**
 * Joined people by join time (late when more than `grace` minutes after the
 * start, contract §4.1), then invitees who have not entered, then people the
 * organizer removed (audit R-04, "Izinkan masuk lagi"). Uses the
 * backend's `late_minutes` / `not_joined` when present, otherwise computes
 * them from the attendance and the participant list.
 */
export function attendanceRows(
    room: Pick<Room, 'video' | 'participants' | 'meeting'>,
): AttendanceRow[] {
    const grace = room.video.late_grace_minutes ?? 2;
    const start = Date.parse(room.meeting.starts_at);
    const joined: AttendanceRow[] = [...room.video.attendance]
        .sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at))
        .map((row) => {
            const late =
                row.late_minutes ??
                Math.max(
                    0,
                    Math.floor((Date.parse(row.joined_at) - start) / 60_000),
                );

            return {
                kind: 'joined',
                userId: row.user_id,
                joinedAt: row.joined_at,
                inRoom: row.in_room,
                lateMinutes: late,
                late: row.late ?? late > grace,
            };
        });
    const removed = room.video.removed ?? [];
    const banned = new Set(removed.map((row) => row.user_id));
    const present = new Set(room.video.attendance.map((row) => row.user_id));
    const absent: AttendanceRow[] = (
        room.video.not_joined ??
        room.participants
            .filter((person) => !present.has(person.id))
            .map((person) => ({
                user_id: person.id,
                rsvp: person.rsvp,
                optional: person.optional,
                called_at: null,
            }))
    )
        .filter((row) => !banned.has(row.user_id))
        .map((row) => ({
            kind: 'absent',
            userId: row.user_id,
            rsvp: row.rsvp,
            calledAt: row.called_at,
        }));

    return [
        ...joined.filter((row) => !banned.has(row.userId)),
        ...absent,
        ...removed.map((row): AttendanceRow => ({
            kind: 'removed',
            userId: row.user_id,
            removedAt: row.removed_at,
        })),
    ];
}

/** Server totals (contract §3.1) as identity → ms. */
export function speakingTotals(speaking: SpeakingTotals | null) {
    return Object.fromEntries(
        (speaking?.people ?? []).map((row) => [row.user_id, row.ms]),
    );
}
