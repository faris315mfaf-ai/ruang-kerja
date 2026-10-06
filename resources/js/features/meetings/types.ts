/**
 * Meetings, minutes & calendar (PRD Fase 2 · F2-3). Shapes follow
 * docs/DATABASE.md §7 so the backend can later pass the same props:
 * - a meeting is a Google Calendar event mirrored in `calendar_events`
 *   (`google_event_id`, `calendar_id`, `meet_link`, `synced_at`), with the
 *   RuangKerja-side details (agenda, participants, minute taker) next to it;
 * - minutes live in `notes` (`content` jsonb snapshot) with history in
 *   `note_versions`; follow-ups become rows in `tasks`.
 * Timestamps are ISO strings with an offset (UTC on the server), dates are
 * office-timezone "YYYY-MM-DD" strings.
 */

export type PersonId = string;

export type Person = {
    id: PersonId;
    name: string;
    /** Job title shown in pickers ("Kepala Divisi Operasional"). */
    title: string;
    division: string;
};

/** Where the meeting happens. `client` = on site at a client (MgJadwal). */
export type Platform = 'meet' | 'zoom' | 'room' | 'client';

export type Rsvp = 'accepted' | 'tentative' | 'declined' | 'pending';

export type Participant = {
    /** Internal person id, or null for an external guest (email only). */
    user_id: PersonId | null;
    email?: string;
    rsvp: Rsvp;
    optional?: boolean;
};

export type Recurrence = 'none' | 'weekdays' | 'weekly' | 'mon_wed_fri';

export type MinutesStatus = 'none' | 'draft' | 'final';

export type RelatedDocument = {
    id: string;
    name: string;
    kind: 'doc' | 'sheet' | 'slide' | 'video' | 'pdf';
    /** "Drive · Divisi Operasional", "dari OPS-142". */
    source: string;
};

/** Mirror of the Google Calendar event (`calendar_events`). */
export type CalendarEventLink = {
    google_event_id: string;
    calendar_id: string;
    meet_link: string | null;
    synced_at: string;
};

export type Meeting = {
    /** Slug in the URL (/rapat/{id}). */
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    platform: Platform;
    /** Room name or client address for `room` / `client`. */
    location: string | null;
    /** Zoom join URL for `zoom` (Meet links come from `calendar_event`). */
    join_url: string | null;
    organizer_id: PersonId;
    minute_taker_id: PersonId | null;
    workspace: { key: string; name: string } | null;
    participants: Participant[];
    agenda: string[];
    recurrence: Recurrence;
    /** Minutes before start. */
    reminders: number[];
    calendar_event: CalendarEventLink | null;
    documents: RelatedDocument[];
    minutes_status: MinutesStatus;
    /** Short context line on agenda rows ("terkait PLQ-22"). */
    note?: string;
    /** Leadership/cross-division agenda (Jadwal & notulensi manajemen). */
    leadership?: boolean;
};

export type AttendanceMark = {
    user_id: PersonId;
    present: boolean;
    /** "cuti", "sakit" when absent for a known reason. */
    reason?: string;
};

export type MinutesSection = {
    title: string;
    body: string;
};

export type ActionItem = {
    id: string;
    text: string;
    assignee_id: PersonId;
    due_date: string;
    /** "OPS-142" once it became a task. */
    task_key: string | null;
    done: boolean;
};

/** Minutes of one meeting (`notes` + `note_versions`). */
export type Minutes = {
    meeting_id: string;
    status: Exclude<MinutesStatus, 'none'>;
    /** Last saved version time + number of versions in `note_versions`. */
    saved_at: string;
    version_count: number;
    /** Co-editor shown as "… ikut mengedit" (realtime presence). */
    co_editor_id: PersonId | null;
    attendance: AttendanceMark[];
    sections: MinutesSection[];
    decisions: string[];
    action_items: ActionItem[];
    /** Task key prefix for "Jadikan tugas" (workspace key). */
    task_prefix: string;
    /** Next task number in that workspace (sample sequence). */
    next_task_number: number;
};

/** A busy block on someone's calendar outside RuangKerja meetings. */
export type BusyBlock = {
    user_id: PersonId;
    starts_at: string;
    ends_at: string;
    title: string;
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

export type GoogleSync = {
    connected: boolean;
    account: string | null;
    last_synced_at: string | null;
};

export type TaskDue = {
    key: string;
    title: string;
    due_date: string;
    done: boolean;
};

export type ApprovedLeave = {
    id: string;
    user_id: PersonId;
    type: string;
    start_date: string;
    end_date: string;
};

export type Holiday = {
    date: string;
    name: string;
    type: 'national' | 'collective_leave' | 'company';
};
