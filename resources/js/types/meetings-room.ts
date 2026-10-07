/**
 * Ruang rapat "Notulen Hidup" (Video RuangKerja, arah C) — props and JSON of
 * /rapat/{id}/gabung, /rapat/{id}/ruang and the room endpoints. Contract:
 * docs/fitur/rapat-video-kontrak.md (owner: backend rapat). Produced by
 * App\Http\Controllers\Meetings\MeetingVideoController,
 * MeetingRoomController and App\Http\Resources\Meetings\RoomPresenter.
 * Times are ISO strings (UTC), dates are office dates "YYYY-MM-DD".
 */
import type {
    Minutes,
    Person,
    PersonId,
    Rsvp,
    WorkspaceRef,
} from '@/features/meetings/types';

// ---------------------------------------------------------------------------
// Participants & navigator
// ---------------------------------------------------------------------------

/** Same palette as avatarTone(name) in components/ui/avatar.tsx. */
export type AvatarToneName = 'blue' | 'teal' | 'amber';

export type RoomRole = 'organizer' | 'minute_taker';

/** Invited employee of the occurrence (organizer and minute taker always). */
export type RoomParticipant = {
    id: PersonId;
    name: string;
    first_name: string;
    initials: string;
    title: string;
    division: string;
    avatar_url: string | null;
    tone: AvatarToneName;
    /** Stable index for collaborator colours (cursorTone(seat)). */
    seat: number;
    roles: RoomRole[];
    /** "Penyelenggara", "Notulis", "Penyelenggara · Notulis" or null. */
    role_label: string | null;
    rsvp: Rsvp;
    optional: boolean;
};

export type AgendaSectionKind =
    | 'agenda'
    | 'extra'
    | 'decisions'
    | 'action_items';

/** Section navigator entry; `key` is the anchor id ("section-0", "decisions", "action-items"). */
export type AgendaSection = {
    key: string;
    /** Index in minutes.sections; null for the fixed blocks. */
    index: number | null;
    title: string;
    kind: AgendaSectionKind;
    has_notes: boolean;
};

// ---------------------------------------------------------------------------
// Minutes in the room
// ---------------------------------------------------------------------------

export type MinutesSource = 'continue' | 'template' | 'blank';

/** Minutes of the occurrence + how its notes were started (pre-join choice). */
export type RoomMinutesDoc = Minutes & { source: MinutesSource | null };

/** "X sedang menyunting" (autosave mode only). */
export type MinutesEditingHolder = {
    user_id: PersonId;
    name: string;
    since: string;
    expires_at: string;
};

export type RoomMinutes = {
    /**
     * collab = Yjs document on the collab server (FEATURE_NOTES + COLLAB_SECRET),
     * every invited person edits; autosave = minute taker/organizer, last write wins.
     */
    mode: 'collab' | 'autosave';
    /** collab mode: GET token_url → MinutesCollabToken; null in autosave mode. */
    collab: { token_url: string; url: string } | null;
    doc: RoomMinutesDoc;
    /** Text editing (per mode). */
    can_edit: boolean;
    /** Attendance + finalize: minute taker / organizer on a draft. */
    can_edit_attendance: boolean;
    can_finalize: boolean;
    /** autosave mode: who is typing (hint, never blocks); always null in collab mode. */
    editing: MinutesEditingHolder | null;
    links: {
        page: string;
        /** GET → { minutes } (refetch after minutes.updated). */
        data: string;
        /** PUT { attendance, sections, decisions } → { minutes }. */
        save: string;
        finalize: string;
        /** POST { text, assignee_id, due_date } → 201 { item }. */
        items: string;
        /** POST { item_ids, workspace_id? } → { created, minutes }. */
        tasks: string;
        /** POST { active } → { editing } (heartbeat every 15 s while focused). */
        editing: string;
    };
};

/** GET /rapat/{id}/notulen/kolaborasi (collab mode). */
export type MinutesCollabToken = {
    /** Yjs document name: "meeting-minutes.{minutes id}". */
    document: string;
    token: string;
    url: string;
    can_edit: boolean;
    expires_in: number;
};

/** GET /rapat/{id}/notulen/data. */
export type MinutesDataResponse = { minutes: RoomMinutesDoc };

// ---------------------------------------------------------------------------
// Notes source (pre-join)
// ---------------------------------------------------------------------------

export type OpenFollowUp = {
    id: string;
    text: string;
    assignee_id: PersonId | null;
    due_date: string | null;
    task_key: string | null;
    task_url?: string | null;
    done: boolean;
    /** Due before this occurrence's date. */
    overdue: boolean;
};

export type NotesSource = {
    chosen: MinutesSource | null;
    chosen_by: PersonId | null;
    chosen_at: string | null;
    /** Organizer / minute taker, draft minutes, nothing chosen yet. */
    can_choose: boolean;
    suggested: MinutesSource;
    /** Latest earlier minutes of the same meeting/series. */
    previous: {
        occurrence_date: string;
        href: string;
        status: 'draft' | 'final';
        open_count: number;
    } | null;
    open_follow_ups: OpenFollowUp[];
    template: {
        key: 'agenda';
        /** "Templat Rapat mingguan" / "Templat {judul rapat}". */
        label: string;
        sections: string[];
        blocks: string[];
    };
};

/** POST /rapat/{id}/video/sumber-notulen { source }. */
export type ChooseNotesSourceResponse = {
    /** false when a source had already been chosen (nothing duplicated). */
    applied: boolean;
    notes_source: NotesSource;
    minutes: RoomMinutesDoc;
};

// ---------------------------------------------------------------------------
// Speaking time
// ---------------------------------------------------------------------------

export type SpeakingShare = {
    user_id: PersonId;
    ms: number;
    /** Rounded percent of total_ms. */
    share: number;
};

export type SpeakingTotalsBase = {
    occurrence_date: string;
    total_ms: number;
    updated_at: string | null;
    /** Sorted by ms, descending. */
    people: SpeakingShare[];
    /** Joined (or reported) but 0 ms: "… belum bicara". */
    silent: PersonId[];
};

export type SpeakingTotals = SpeakingTotalsBase & {
    /** The viewer's stored total: seed the local counter with it. */
    mine_ms: number;
    /** Report period of the client. */
    interval_seconds: number;
};

/** POST /rapat/{id}/video/bicara { ms }. */
export type SpeakingReportResponse = SpeakingTotals & { accepted_ms: number };

// ---------------------------------------------------------------------------
// Attendance (Kehadiran) & Panggil
// ---------------------------------------------------------------------------

export type RoomAttendee = {
    user_id: PersonId;
    joined_at: string;
    left_at: string | null;
    duration_seconds: number;
    in_room: boolean;
    sessions: number;
    /** Whole minutes between the start and the first join (0 when on time). */
    late_minutes: number;
    /** late_minutes > late_grace_minutes → "Terlambat N mnt". */
    late: boolean;
};

export type NotJoined = {
    user_id: PersonId;
    rsvp: Rsvp;
    optional: boolean;
    /** Last "Panggil" of this occurrence. */
    called_at: string | null;
};

/** Removed by the organizer: no token for this occurrence until re-admitted (audit R-04). */
export type RemovedParticipant = {
    user_id: PersonId;
    removed_by: PersonId | null;
    removed_at: string | null;
};

/** DELETE /rapat/{id}/video/peserta/{user}/larangan (organizer). */
export type ReadmitResponse = { readmitted: boolean };

/** POST /rapat/{id}/video/tangan { raised } → attribute `hand` set by the server (ms, "" = lowered). */
export type RaiseHandResponse = { hand: string };

/**
 * POST /rapat/{id}/video/atribut { attributes } → { attributes }: own LiveKit
 * attributes through the server (tokens cannot set them, audit R-05). Keys:
 * hand (ms or ""), rk_minutes_at (section key, ≤ 64 chars [A-Za-z0-9_.:-]),
 * rk_notulen_optout ("0" | "1"); "" removes. Other keys → 422.
 */
export type OwnAttributes = Partial<
    Record<'hand' | 'rk_minutes_at' | 'rk_notulen_optout', string>
>;

/** GET /rapat/{id}/video/kehadiran. */
export type RoomAttendance = {
    attendance: RoomAttendee[];
    in_room: number;
    not_joined: NotJoined[];
    late_grace_minutes: number;
    removed: RemovedParticipant[];
};

/** POST /rapat/{id}/video/panggil/{user}; 429 adds retry_after (seconds). */
export type CallParticipantResponse = {
    called: { user_id: PersonId; called_at: string; called_by: PersonId };
};

export type CallRateLimited = { message: string; retry_after: number };

/** `video` prop (VideoPresenter) with the room additions. */
export type RoomVideoSummary = {
    configured: boolean;
    join_href: string;
    room_href: string;
    token_url: string;
    opens_at: string;
    closes_at: string;
    is_organizer: boolean;
    can_join: boolean;
    denied_reason: string | null;
} & RoomAttendance;

// ---------------------------------------------------------------------------
// Page props
// ---------------------------------------------------------------------------

export type RoomFeatures = {
    video_configured: boolean;
    /** Reverb broadcasting available; otherwise poll (contract §5). */
    realtime: boolean;
    /** Live subtitles (stage 2). Captions may still render when lk.transcription streams arrive. */
    subtitles: boolean;
    auto_minutes: boolean;
    collab_minutes: boolean;
};

export type RoomAbilities = {
    edit_minutes: boolean;
    choose_notes_source: boolean;
    moderate: boolean;
    call_participants: boolean;
    report_speaking: boolean;
};

export type RoomMeeting = {
    id: string;
    title: string;
    occurrence_date: string;
    starts_at: string;
    ends_at: string;
    href: string;
    minutes_href: string;
    organizer_id: PersonId;
    minute_taker_id: PersonId | null;
    agenda: string[];
    is_recurring: boolean;
    workspace: WorkspaceRef | null;
};

export type RoomProps = {
    viewer: { id: PersonId; name: string; avatar_url?: string | null };
    meeting: RoomMeeting;
    people: Person[];
    participants: RoomParticipant[];
    agenda: AgendaSection[];
    minutes: RoomMinutes;
    notes_source: NotesSource;
    speaking: SpeakingTotals;
    video: RoomVideoSummary;
    features: RoomFeatures;
    can: RoomAbilities;
    /** Private channel name: Echo.private(channel). */
    channel: string;
    links: {
        token: string;
        notes_source: string;
        speaking: string;
        attendance: string;
        /** Contains the placeholder "{user}". */
        call: string;
        /** Contains the placeholder "{user}" (organizer: "Izinkan masuk lagi"). */
        readmit: string;
        hand: string;
        /** POST { attributes: OwnAttributes }. */
        attributes: string;
        join: string;
        room: string;
    };
};

/**
 * Props of pages meetings/join and meetings/room. `notulen` = NotulenSummary
 * of docs/fitur/notulen-otomatis-kontrak.md §2.1 (null until that backend
 * is merged); typed loosely here, the notulen agent owns its shape.
 */
export type MeetingRoomPageProps = {
    room: RoomProps;
    notulen: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Broadcast events on private channel meeting.{id} (listen with a leading dot)
// ---------------------------------------------------------------------------

export type MeetingRoomEvents = {
    'speaking.updated': { occurrence_date: string; totals: SpeakingTotalsBase };
    'participant.called': {
        occurrence_date: string;
        user_id: PersonId;
        called_by: PersonId;
        called_at: string;
    };
    'minutes.source_chosen': {
        occurrence_date: string;
        source: MinutesSource;
        chosen_by: PersonId;
        chosen_at: string;
    };
    'minutes.updated': {
        occurrence_date: string;
        minutes_id: string;
        version: number;
        saved_at: string | null;
        updated_by: PersonId | null;
        status: 'draft' | 'final';
    };
    'minutes.editing': {
        occurrence_date: string;
        editing: MinutesEditingHolder | null;
    };
    'attendance.updated': {
        occurrence_date: string;
        user_id: PersonId | null;
        event: 'joined' | 'left' | 'finished';
    };
};
