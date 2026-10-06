import type { DriveFileKind } from '@/features/drive/types';
import type { RichDoc, TaskReferenceInfo } from '@/features/tasks/editor/types';

/**
 * Obrolan (Fase 2, F2-1) props, sent by App\Http\Resources\Chat\ChatPresenter.
 * Shapes follow docs/DATABASE.md §7 (`channels`, `channel_members`,
 * `messages`); fields marked "derived" are computed server side.
 */

export type ChatPerson = {
    id: string;
    name: string;
    avatar: string | null;
    /** Position title ("Ketua Tim Gudang"). */
    title: string;
    /** Presence (Reverb presence channel in production). */
    online: boolean;
};

/** channels.type */
export type ChannelType = 'workspace' | 'public' | 'private' | 'dm' | 'group';

/** channel_members row. */
export type ChannelMember = {
    user_id: string;
    last_read_message_id: string | null;
    muted: boolean;
    role: 'owner' | 'admin' | 'member';
};

/** channels row + members + workspace summary (derived). */
export type Channel = {
    id: string;
    workspace_id: string | null;
    /** Derived: workspace of a `workspace` channel. */
    workspace: { key: string; name: string; color: string } | null;
    type: ChannelType;
    /** Null for DMs and small groups (named after the members). */
    name: string | null;
    topic: string | null;
    created_by: string;
    created_at: string;
    archived_at: string | null;
    members: ChannelMember[];
    /** Derived: top-level messages of others after the viewer's read pointer. */
    unread_count?: number;
    /** Derived: newest top-level message (sidebar preview). */
    last_message?: ChannelPreview | null;
    /** Derived: the viewer may send / moderate here (ChannelPolicy). */
    can_post?: boolean;
    can_manage?: boolean;
};

/** Newest top-level message of a channel, without its body. */
export type ChannelPreview = {
    id: string;
    user_id: string | null;
    body_text: string;
    created_at: string | null;
    deleted: boolean;
};

/** Attachment of a message (attachments → drive_files, source = drive). */
export type MessageAttachment = {
    id: string;
    name: string;
    kind: DriveFileKind;
    web_view_link: string;
    size_bytes: number | null;
    owner_email: string | null;
};

/** reactions rows grouped per emoji. */
export type MessageReaction = {
    emoji: string;
    user_ids: string[];
};

/** messages row + reactions + attachments. */
export type Message = {
    id: string;
    channel_id: string;
    user_id: string;
    /** Thread root; null for top-level messages. */
    parent_id: string | null;
    body: RichDoc | null;
    body_text: string;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
    reactions: MessageReaction[];
    attachments: MessageAttachment[];
};

/** Task referenced as "#PLQ-18" (visible to the viewer). */
export type ChatTask = TaskReferenceInfo & { id: string };

export type ChatState = {
    viewerId: string;
    people: ChatPerson[];
    channels: Channel[];
    messages: Message[];
    tasks: ChatTask[];
    driveFiles: MessageAttachment[];
    /** channel id (or `thread:<message id>`) → people typing. */
    typing: Record<string, string[]>;
    /** Older messages exist for the open channel ("Muat pesan sebelumnya"). */
    hasMore?: boolean;
};

/** Inertia props of /obrolan and /obrolan/{channel} (ChatController). */
export type ChatProps = {
    viewer_id: string;
    people: ChatPerson[];
    channels: Channel[];
    current: {
        channel_id: string;
        messages: Message[];
        tasks: ChatTask[];
        has_more: boolean;
        can_post: boolean;
        can_manage: boolean;
    } | null;
};
