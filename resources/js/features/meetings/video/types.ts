/**
 * Video RuangKerja "Notulen Hidup" (arah C) — props of /rapat/{id}/gabung
 * (pre-join) and /rapat/{id}/ruang (room). Shape = docs/fitur/rapat-video-
 * kontrak.md (agent rapatbe). Keys added by that contract are optional here
 * so the pages keep working against the older backend; `normalizeRoom()`
 * (contract.ts) fills the gaps. Times are ISO strings (UTC).
 */
import type { GuestAttendee } from '../guests/types';
import type { NotulenSummary } from '../notulen/types';
import type { ActionItem, Minutes, Person, PersonId, Rsvp } from '../types';

/** Who was in the video room of the occurrence (LiveKit webhooks). */
export type VideoAttendee = {
    user_id: PersonId;
    joined_at: string;
    /** Last leave, null while still in the room. */
    left_at: string | null;
    /** Total over all sessions (an open session counts until now). */
    duration_seconds: number;
    in_room: boolean;
    sessions: number;
    /** Whole minutes between the start and the first join (contract §4.1). */
    late_minutes?: number;
    late?: boolean;
};

/** Invited employee who has not entered the room yet (contract §4.1). */
export type NotJoined = {
    user_id: PersonId;
    rsvp: Rsvp;
    optional: boolean;
    called_at: string | null;
};

export type VideoSummary = {
    /** LiveKit URL + key + secret set on the server. */
    configured: boolean;
    join_href: string;
    room_href: string;
    token_url: string;
    /** Join window: 15 min before start until 2 h after end. */
    opens_at: string;
    closes_at: string;
    is_organizer: boolean;
    /** Invited (organizer, minute taker, participant) and not canceled. */
    can_join: boolean;
    denied_reason: string | null;
    attendance: VideoAttendee[];
    in_room: number;
    not_joined?: NotJoined[];
    late_grace_minutes?: number;
    /** Removed by the organizer, no token until re-admitted (audit R-04). */
    removed?: RemovedParticipant[];
    /** External guests who were in the room (not counted in `in_room`). */
    guests?: GuestAttendee[];
};

export type RemovedParticipant = {
    user_id: PersonId;
    removed_by: PersonId | null;
    removed_at: string | null;
};

/** "X sedang menyunting" (autosave mode). */
export type MinutesEditingHolder = {
    user_id: PersonId;
    name: string;
    since: string;
    expires_at: string;
};

/** GET minutes.collab.token_url (collab mode). */
export type MinutesCollabToken = {
    document: string;
    token: string;
    url: string;
    can_edit: boolean;
    expires_in: number;
};

/** POST links.attributes — own LiveKit attributes through the server (R-05). */
export type OwnAttributes = Partial<
    Record<'hand' | 'rk_minutes_at' | 'rk_notulen_optout', string>
>;

export type RoomMeeting = {
    id: string;
    title: string;
    occurrence_date: string;
    starts_at: string;
    ends_at: string;
    href: string;
    minutes_href: string;
    organizer_id: PersonId;
    minute_taker_id?: PersonId | null;
    agenda?: string[];
    is_recurring?: boolean;
    workspace?: { id: string; key: string; name: string } | null;
};

/** contract §1.2 */
export type RoomParticipant = Person & {
    first_name: string;
    initials: string;
    tone: 'blue' | 'teal' | 'amber';
    /** Stable index for collaborator colours (cursorTone). */
    seat: number;
    roles: ('organizer' | 'minute_taker')[];
    role_label: string | null;
    rsvp: Rsvp;
    optional: boolean;
};

/** contract §1.3 — section navigator on the left. */
export type AgendaSection = {
    key: string;
    index: number | null;
    title: string;
    kind: 'agenda' | 'extra' | 'decisions' | 'action_items';
    has_notes: boolean;
};

export type NotesSourceKind = 'continue' | 'template' | 'blank';

/** contract §1.4 — the minutes document in the centre. */
export type RoomMinutes = {
    /** collab = Yjs (every invited person edits); autosave = one editor. */
    mode: 'autosave' | 'collab';
    collab: null | { token_url: string; url: string };
    doc: Minutes & { source?: NotesSourceKind | null };
    can_edit: boolean;
    can_finalize: boolean;
    can_edit_attendance?: boolean;
    /** autosave: who is typing (hint only). */
    editing?: MinutesEditingHolder | null;
    links: {
        page: string;
        data: string;
        save: string;
        finalize: string;
        items: string;
        tasks: string;
        /** autosave: POST { active } heartbeat while the editor has focus. */
        editing?: string;
    };
};

/** Open follow-up of the previous occurrence (pre-join amber card). */
export type OpenFollowUp = ActionItem & { overdue: boolean };

/** contract §2.1 */
export type NotesSource = {
    chosen: NotesSourceKind | null;
    chosen_by: PersonId | null;
    chosen_at: string | null;
    can_choose: boolean;
    suggested: NotesSourceKind;
    previous: {
        occurrence_date: string;
        href: string;
        status: 'draft' | 'final';
        open_count: number;
    } | null;
    open_follow_ups: OpenFollowUp[];
    template: {
        key: string;
        /** "Templat Rapat mingguan" / "Templat {judul rapat}". */
        label: string;
        sections: string[];
        blocks: string[];
    } | null;
};

/** contract §3.1 */
export type SpeakingTotals = {
    occurrence_date: string;
    total_ms: number;
    updated_at: string | null;
    people: { user_id: PersonId; ms: number; share: number }[];
    silent: PersonId[];
    mine_ms?: number;
    interval_seconds?: number;
};

export type RoomFeatures = {
    video_configured: boolean;
    realtime: boolean;
    subtitles: boolean;
    auto_minutes: boolean;
    collab_minutes: boolean;
};

export type RoomCan = {
    edit_minutes: boolean;
    choose_notes_source: boolean;
    moderate: boolean;
    call_participants: boolean;
    report_speaking: boolean;
};

export type RoomLinks = {
    token: string;
    notes_source: string;
    speaking: string;
    attendance: string;
    /** Contains the placeholder `{user}`. */
    call: string;
    /** Contains `{user}`: organizer's "Izinkan masuk lagi". */
    readmit?: string;
    /** POST { raised } → { hand }. */
    hand?: string;
    /** POST { attributes: OwnAttributes } → { attributes }. */
    attributes?: string;
    join: string;
    room: string;
};

/** `room` prop of meetings/join and meetings/room (contract §1.1). */
export type VideoRoomProps = {
    viewer: { id: PersonId; name: string; avatar_url?: string | null };
    meeting: RoomMeeting;
    people: Person[];
    video: VideoSummary;
    participants?: RoomParticipant[];
    agenda?: AgendaSection[];
    minutes?: RoomMinutes | null;
    notes_source?: NotesSource | null;
    speaking?: SpeakingTotals | null;
    features?: RoomFeatures;
    can?: RoomCan;
    channel?: string;
    links?: RoomLinks;
};

/** Page props of meetings/join and meetings/room. */
export type RoomPageProps = {
    room: VideoRoomProps;
    notulen?: NotulenSummary | null;
};

/** POST /rapat/{id}/video/token. */
export type VideoToken = {
    url: string;
    token: string;
    room: string;
    identity: string;
    name: string;
    expires_at: string;
};
