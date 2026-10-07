/**
 * Video RuangKerja (LiveKit) — props of /rapat/{id}/gabung (pre-join) and
 * /rapat/{id}/ruang (room), produced by MeetingVideoController and
 * App\Http\Resources\Meetings\VideoPresenter. Times are ISO strings (UTC).
 */
import type { Person, PersonId } from '../types';

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
};

export type VideoRoomProps = {
    viewer: { id: PersonId; name: string; avatar_url?: string | null };
    meeting: {
        id: string;
        title: string;
        occurrence_date: string;
        starts_at: string;
        ends_at: string;
        href: string;
        minutes_href: string;
        organizer_id: PersonId;
    };
    people: Person[];
    video: VideoSummary;
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

/** Participant metadata set by the server in the access token. */
export type ParticipantMeta = {
    avatar_url: string | null;
    organizer: boolean;
};
