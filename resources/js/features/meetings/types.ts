/**
 * Meetings, minutes & calendar (PRD Fase 2 · F2-3). Props of the pages,
 * produced by App\Http\Resources\Meetings\MeetingPresenter and the
 * App\Domain\Meetings\Queries classes (docs/DATABASE.md §7, tables
 * `meetings`, `meeting_participants`, `meeting_minutes`,
 * `meeting_minute_versions`, `meeting_action_items`). A recurring meeting is
 * one row expanded into occurrences on the server; each occurrence has its
 * own `key` and minutes. Timestamps are ISO strings (UTC), dates are
 * office-timezone "YYYY-MM-DD" strings. Google Calendar/Meet sync is on hold:
 * join links are pasted by the organizer.
 */

export type PersonId = string;

export type Person = {
    id: PersonId;
    name: string;
    /** Job title shown in pickers ("Kepala Divisi Operasional"). */
    title: string;
    division: string;
    avatar_url?: string | null;
};

/**
 * Where the meeting happens. `client` = on site at a client (MgJadwal);
 * `video` = Video RuangKerja, the built-in LiveKit room (no pasted link).
 */
export type Platform = 'meet' | 'zoom' | 'room' | 'client' | 'video';

export type Rsvp = 'yes' | 'maybe' | 'no' | 'pending';

export type Participant = {
    /** Internal person id, or null for an external guest (email only). */
    user_id: PersonId | null;
    email?: string | null;
    rsvp: Rsvp;
    optional?: boolean;
    /**
     * External guest row only, and only for who manages guests (the organizer):
     * the guest's participant id and typed name. Absent for everyone else.
     */
    guest_id?: string;
    guest_name?: string | null;
};

export type Recurrence = 'none' | 'weekdays' | 'weekly' | 'mon_wed_fri';

export type MinutesStatus = 'none' | 'draft' | 'final';

export type WorkspaceRef = { id: string; key: string; name: string };

/** One occurrence of a meeting (the meeting itself or one date of a series). */
export type Meeting = {
    /** Meeting (series) ULID — /rapat/{id}. */
    id: string;
    /** Unique per occurrence: "{id}:{date}". */
    key: string;
    occurrence_date: string;
    /** /rapat/{id} (+ ?tanggal= for a series). */
    href: string;
    minutes_href: string;
    title: string;
    description?: string | null;
    starts_at: string;
    ends_at: string;
    platform: Platform;
    /** Room name or client address for `room` / `client`. */
    location: string | null;
    /** Meet or Zoom link pasted by the organizer. */
    join_url: string | null;
    organizer_id: PersonId;
    minute_taker_id: PersonId | null;
    workspace: WorkspaceRef | null;
    participants: Participant[];
    agenda: string[];
    recurrence: Recurrence;
    recurrence_until?: string | null;
    /** Minutes before start. */
    reminders: number[];
    /** Leadership/cross-division agenda (Jadwal & notulensi manajemen). */
    leadership?: boolean;
    /** "Notulen otomatis" switched on (video meetings only). */
    auto_minutes?: boolean;
    canceled?: boolean;
    minutes_status: MinutesStatus;
};

export type AttendanceMark = {
    user_id: PersonId;
    present: boolean;
    /** "cuti", "sakit" when absent for a known reason. */
    reason?: string | null;
};

export type MinutesSection = {
    title: string;
    body: string;
};

export type ActionItem = {
    id: string;
    text: string;
    assignee_id: PersonId | null;
    due_date: string | null;
    /** "OPS-142" once it became a task. */
    task_key: string | null;
    task_url?: string | null;
    done: boolean;
};

/** Minutes of one occurrence (a blank draft has `id` null). */
export type Minutes = {
    id: string | null;
    meeting_id: string;
    meeting_key: string;
    href: string;
    status: Exclude<MinutesStatus, 'none'>;
    /** Last save (null before the first one) + number of versions. */
    saved_at: string | null;
    version_count: number;
    finalized_at?: string | null;
    /** Co-editor shown as "… ikut mengedit" (realtime presence, not yet). */
    co_editor_id: PersonId | null;
    attendance: AttendanceMark[];
    sections: MinutesSection[];
    decisions: string[];
    action_items: ActionItem[];
};

/** Open follow-up of the viewer on /rapat. */
export type FollowUp = ActionItem & {
    meeting_id: string;
    meeting_title: string;
    minutes_href: string;
};

export type CalendarLayer = 'meetings' | 'tasks' | 'leave' | 'holidays';

/** One item on the calendar grid / agenda. */
export type CalendarEntry = {
    id: string;
    layer: CalendarLayer;
    /** First office date "YYYY-MM-DD". */
    date: string;
    /** Last office date for multi-day items (leave). */
    end_date?: string;
    title: string;
    /** For timed items (meetings). */
    starts_at?: string;
    ends_at?: string;
    meta: string;
    href?: string;
    /** Task past its due date and still open. */
    overdue?: boolean;
};

/** Schedule conflict of a participant (GET /rapat/bentrok). */
export type Conflict = {
    user_id: PersonId;
    title: string;
    starts_at: string;
    ends_at: string;
};

// ---------------------------------------------------------------------------
// Page props
// ---------------------------------------------------------------------------

export type AgendaProps = {
    viewer_id: PersonId;
    week_start: string;
    meetings: Meeting[];
    follow_ups: FollowUp[];
    people: Person[];
};

export type MeetingFormMeeting = {
    id: string;
    title: string;
    date: string;
    start: string;
    duration: number;
    platform: Platform;
    join_url: string | null;
    location: string | null;
    participants: string[];
    agenda: string[];
    recurrence: Recurrence;
    recurrence_until: string | null;
    reminders: number[];
    minute_taker_id: PersonId | null;
    workspace_id: string | null;
    leadership: boolean;
    /** "Notulen otomatis" (only kept for platform `video`). */
    auto_minutes?: boolean;
    /** Typed names of external guests, keyed by lower-case e-mail (prefills the form). */
    guest_names?: Record<string, string>;
};

export type MeetingFormProps = {
    viewer_id: PersonId;
    people: Person[];
    workspaces: WorkspaceRef[];
    can_lead: boolean;
    durations: number[];
    meeting: MeetingFormMeeting | null;
    /** LiveKit configured: "Video RuangKerja" is offered (and the default). */
    video_enabled: boolean;
    /** Transcription server configured: offer the "Notulen otomatis" toggle for video meetings. */
    auto_minutes_enabled?: boolean;
};

export type MeetingDetailProps = {
    viewer_id: PersonId;
    meeting: Meeting;
    people: Person[];
    can: {
        update: boolean;
        respond: boolean;
        write_minutes: boolean;
        /** Guest list with links (organizer of a video meeting). Absent on an older server. */
        manage_guests?: boolean;
        /** Waiting room (everyone invited to the video meeting). Absent on an older server. */
        manage_lobby?: boolean;
    };
};

export type MinutesProps = {
    viewer_id: PersonId;
    meeting: Meeting;
    minutes: Minutes;
    people: Person[];
    workspaces: WorkspaceRef[];
    can: { edit: boolean; reopen: boolean };
};

export type CalendarProps = {
    year: number;
    month: number;
    from: string;
    to: string;
    entries: CalendarEntry[];
};

export type ScheduleProps = {
    viewer_id: PersonId;
    week_start: string;
    meetings: Meeting[];
    minutes: Minutes[];
    people: Person[];
};
