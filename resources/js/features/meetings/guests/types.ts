/**
 * External guests of a Video RuangKerja meeting (no account, personal link +
 * waiting room). Shapes = docs/sesi/rapat-tamu-eksternal.md §3-§5. Times are
 * ISO strings (UTC).
 */

/** Guest status for one occurrence (public side adds the link states). */
export type GuestStatus =
    | 'none'
    | 'waiting'
    | 'admitted'
    | 'denied'
    | 'removed'
    /** Link expired. */
    | 'expired'
    /** Meeting over / canceled, or the join window is shut. */
    | 'closed'
    /** Link not known (404). Client-side only. */
    | 'unknown';

export type GuestWindowState = 'early' | 'open' | 'closed';

export type GuestWindow = {
    state: GuestWindowState;
    opens_at: string;
    closes_at: string;
};

/** GET /api/tamu/{token}/info (also the page prop `guest`). */
export type GuestInfo = {
    status: GuestStatus;
    status_label: string;
    window?: GuestWindow | null;
    meeting?: {
        title: string;
        starts_at: string;
        ends_at: string;
        occurrence_date?: string;
        organizer_name?: string | null;
    } | null;
    guest?: { name: string | null };
    features?: { video_configured: boolean };
    poll_seconds?: number;
    notice_points?: string[];
};

/** GET /api/tamu/{token}/status. */
export type GuestStatusReply = {
    status: GuestStatus;
    status_label: string;
    /** `early` · `open` · `closed`, null once expired/closed. */
    window: GuestWindowState | null;
};

/** POST /api/tamu/{token}/token. */
export type GuestVideoToken = {
    url: string;
    token: string;
    room: string;
    identity: string;
    name: string;
    expires_at: string;
    occurrence_date: string;
    role: 'guest';
    can: {
        moderate: false;
        call_participants: false;
        edit_minutes: false;
    };
};

/** Page props of meetings/guest. */
export type GuestPageProps = {
    token: string | null;
    guest: GuestInfo;
};

// ---------------------------------------------------------------------------
// Organizer / internal side
// ---------------------------------------------------------------------------

export type OrganizerGuestStatus =
    | 'none'
    | 'waiting'
    | 'admitted'
    | 'denied'
    | 'removed';

/** One row of GET /rapat/{id}/tamu (organizer only: carries the link). */
export type OrganizerGuest = {
    id: string;
    email: string;
    name: string | null;
    link_url: string;
    link_expires_at: string | null;
    link_expired: boolean;
    link_rotated_at: string | null;
    status: OrganizerGuestStatus;
    status_label: string;
    requested_at: string | null;
    admitted_at: string | null;
    in_room: boolean;
    /** LiveKit identity `guest:{id}`. */
    identity: string;
};

export type GuestListReply = {
    occurrence_date: string;
    window: GuestWindow | null;
    limit: number;
    guests: OrganizerGuest[];
};

/** One waiting guest (GET …/video/ruang-tunggu). */
export type LobbyEntry = {
    id: string;
    name: string | null;
    email: string | null;
    requested_at: string | null;
    identity: string;
};

export type LobbyReply = {
    occurrence_date: string;
    window: GuestWindow | null;
    waiting: LobbyEntry[];
    waiting_count: number;
};

/** Guest row of the attendance (prop `video.guests`). */
export type GuestAttendee = {
    participant_id: string;
    name: string;
    joined_at: string;
    left_at: string | null;
    duration_seconds: number;
    in_room: boolean;
    sessions: number;
};
