import { useSyncExternalStore } from 'react';
import { AUTO_REPLIES, initialChatState } from './fixtures';
import { parseMessage, prototypeNow, toggleReaction } from './lib';
import type {
    Channel,
    ChannelMember,
    ChatState,
    Message,
    MessageAttachment,
} from './types';

/**
 * Client-only store for the Obrolan preview. It lives in the module so sent
 * messages, read state and new channels survive Inertia visits between
 * /obrolan and /obrolan/{channel} (a full reload restores the samples). In
 * production this is server props + Reverb events on `private-channel.{id}`.
 */
let state: ChatState = initialChatState();
const listeners = new Set<() => void>();
let sequence = 0;
let demoStarted = false;

function emit(next: ChatState): void {
    state = next;
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    startDemo();

    return () => listeners.delete(listener);
}

export function useChatState(): ChatState {
    return useSyncExternalStore(
        subscribe,
        () => state,
        () => state,
    );
}

export function getChatState(): ChatState {
    return state;
}

function nextId(prefix: string): string {
    sequence += 1;

    return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

function updateChannel(
    channelId: string,
    update: (channel: Channel) => Channel,
): void {
    emit({
        ...state,
        channels: state.channels.map((channel) =>
            channel.id === channelId ? update(channel) : channel,
        ),
    });
}

function updateMember(
    channelId: string,
    userId: string,
    update: (member: ChannelMember) => ChannelMember,
): void {
    updateChannel(channelId, (channel) => ({
        ...channel,
        members: channel.members.map((member) =>
            member.user_id === userId ? update(member) : member,
        ),
    }));
}

function setTyping(key: string, userIds: string[]): void {
    emit({ ...state, typing: { ...state.typing, [key]: userIds } });
}

function latestTopLevelId(channelId: string): string | null {
    return (
        state.messages
            .filter(
                (message) =>
                    message.channel_id === channelId &&
                    message.parent_id === null,
            )
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .at(-1)?.id ?? null
    );
}

/** The viewer has seen everything in the channel. */
export function markRead(channelId: string): void {
    const latest = latestTopLevelId(channelId);
    const member = state.channels
        .find((channel) => channel.id === channelId)
        ?.members.find((item) => item.user_id === state.viewerId);

    if (!latest || !member || member.last_read_message_id === latest) {
        return;
    }

    updateMember(channelId, state.viewerId, (item) => ({
        ...item,
        last_read_message_id: latest,
    }));
}

function postAs(
    userId: string,
    channelId: string,
    text: string,
    attachments: MessageAttachment[] = [],
    parentId: string | null = null,
): Message {
    const message: Message = {
        id: nextId('m'),
        channel_id: channelId,
        user_id: userId,
        parent_id: parentId,
        body: parseMessage(text, state.people, state.tasks),
        body_text: text.trim(),
        created_at: prototypeNow().toISOString(),
        edited_at: null,
        deleted_at: null,
        reactions: [],
        attachments,
    };

    emit({ ...state, messages: [...state.messages, message] });

    if (parentId === null) {
        updateMember(channelId, userId, (member) => ({
            ...member,
            last_read_message_id: message.id,
        }));
    }

    return message;
}

/**
 * Sends a message (optimistic, like the real page would before the server
 * confirms), then simulates: other members read it, and someone replies.
 */
export function sendMessage(
    channelId: string,
    text: string,
    attachments: MessageAttachment[] = [],
    parentId: string | null = null,
): Message {
    const message = postAs(
        state.viewerId,
        channelId,
        text,
        attachments,
        parentId,
    );
    const channel = state.channels.find((item) => item.id === channelId);
    const others =
        channel?.members.filter(
            (member) => member.user_id !== state.viewerId,
        ) ?? [];
    const online = others.filter(
        (member) =>
            state.people.find((person) => person.id === member.user_id)?.online,
    );

    // Online members read it shortly after.
    window.setTimeout(() => {
        for (const member of online) {
            if (parentId === null) {
                updateMember(channelId, member.user_id, (item) => ({
                    ...item,
                    last_read_message_id: message.id,
                }));
            }
        }
    }, 1500);

    const reply = AUTO_REPLIES[channelId];
    const typingKey = parentId ? `thread:${parentId}` : channelId;

    if (reply && others.some((member) => member.user_id === reply.userId)) {
        window.setTimeout(() => setTyping(typingKey, [reply.userId]), 1800);
        window.setTimeout(() => {
            setTyping(typingKey, []);
            postAs(reply.userId, channelId, reply.text, [], parentId);

            if (parentId === null) {
                // The viewer is looking at the channel when the reply lands.
                markRead(channelId);
            }
        }, 4200);
    }

    return message;
}

export function editMessage(messageId: string, text: string): void {
    emit({
        ...state,
        messages: state.messages.map((message) =>
            message.id === messageId
                ? {
                      ...message,
                      body: parseMessage(text, state.people, state.tasks),
                      body_text: text.trim(),
                      edited_at: prototypeNow().toISOString(),
                  }
                : message,
        ),
    });
}

export function deleteMessage(messageId: string): void {
    emit({
        ...state,
        messages: state.messages.map((message) =>
            message.id === messageId
                ? {
                      ...message,
                      body: null,
                      body_text: '',
                      attachments: [],
                      reactions: [],
                      deleted_at: prototypeNow().toISOString(),
                  }
                : message,
        ),
    });
}

export function reactToMessage(messageId: string, emoji: string): void {
    emit({
        ...state,
        messages: state.messages.map((message) =>
            message.id === messageId
                ? {
                      ...message,
                      reactions: toggleReaction(
                          message.reactions,
                          emoji,
                          state.viewerId,
                      ),
                  }
                : message,
        ),
    });
}

export function setMuted(channelId: string, muted: boolean): void {
    updateMember(channelId, state.viewerId, (member) => ({
        ...member,
        muted,
    }));
}

export type NewChannelInput = {
    name: string;
    topic: string;
    isPrivate: boolean;
    memberIds: string[];
};

/** Lower-case, dashes, max 40 characters ("Acara Q4" → "acara-q4"). */
export function slugifyChannelName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

export function createChannel(input: NewChannelInput): string {
    const id = nextId('c');
    const channel: Channel = {
        id,
        workspace_id: null,
        workspace: null,
        type: input.isPrivate ? 'private' : 'public',
        name: slugifyChannelName(input.name),
        topic: input.topic.trim() || null,
        created_by: state.viewerId,
        created_at: prototypeNow().toISOString(),
        archived_at: null,
        members: [state.viewerId, ...input.memberIds].map((userId, index) => ({
            user_id: userId,
            last_read_message_id: null,
            muted: false,
            role: index === 0 ? 'owner' : 'member',
        })),
    };

    emit({ ...state, channels: [...state.channels, channel] });

    return id;
}

/** Existing DM/group with exactly these people, or a new one. */
export function openDirect(userIds: string[]): string {
    const wanted = [...new Set([state.viewerId, ...userIds])].sort();
    const existing = state.channels.find(
        (channel) =>
            (channel.type === 'dm' || channel.type === 'group') &&
            channel.members
                .map((member) => member.user_id)
                .sort()
                .join() === wanted.join(),
    );

    if (existing) {
        return existing.id;
    }

    const id = nextId('dm');
    const channel: Channel = {
        id,
        workspace_id: null,
        workspace: null,
        type: wanted.length > 2 ? 'group' : 'dm',
        name: null,
        topic: null,
        created_by: state.viewerId,
        created_at: prototypeNow().toISOString(),
        archived_at: null,
        members: wanted.map((userId) => ({
            user_id: userId,
            last_read_message_id: null,
            muted: false,
            role: userId === state.viewerId ? 'owner' : 'member',
        })),
    };

    emit({ ...state, channels: [...state.channels, channel] });

    return id;
}

/** One-off ambient activity: Rizky finishes typing in the project channel. */
function startDemo(): void {
    if (demoStarted || typeof window === 'undefined') {
        return;
    }

    demoStarted = true;
    window.setTimeout(() => {
        setTyping('plq', []);
        postAs(
            'u-rizky',
            'plq',
            'Sudah saya update di PLQ-21: 200 kursi, vendor konfirmasi besok pagi.',
        );
    }, 7000);
}

/** Tests: back to the samples. */
export function resetChatState(): void {
    state = initialChatState();
    demoStarted = true;
    listeners.forEach((listener) => listener());
}
