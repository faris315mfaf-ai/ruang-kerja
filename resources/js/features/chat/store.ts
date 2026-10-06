import { router } from '@inertiajs/react';
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { ApiError } from '@/features/tasks/lib/api';
import { chatApi } from './api';
import { parseMessage, toggleReaction } from './lib';
import type {
    Channel,
    ChannelMember,
    ChatProps,
    ChatState,
    ChatTask,
    Message,
    MessageAttachment,
} from './types';

/**
 * Obrolan store: hydrated from the Inertia props of /obrolan and
 * /obrolan/{channel} (ChatController), mutated optimistically through the
 * JSON endpoints (chatApi, rolled back with a toast on failure) and kept
 * fresh by the realtime events of `private-chat.{id}` (realtime.ts).
 * Components keep calling the same functions as in the prototype.
 */
const EMPTY: ChatState = {
    viewerId: '',
    people: [],
    channels: [],
    messages: [],
    tasks: [],
    driveFiles: [],
    typing: {},
    hasMore: false,
};

let state: ChatState = EMPTY;
let hydratedFrom: ChatProps | null = null;
let currentChannelId: string | null = null;
let sequence = 0;
const listeners = new Set<() => void>();
const readTimers = new Map<string, number>();
let inboxTimer: number | null = null;

function emit(next: ChatState): void {
    state = next;
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

export function getChatState(): ChatState {
    return state;
}

/** Channel open on this page (null on /obrolan). */
export function currentChannel(): string | null {
    return currentChannelId;
}

function mergeTasks(current: ChatTask[], incoming: ChatTask[]): ChatTask[] {
    const byId = new Map(current.map((task) => [task.id, task]));
    incoming.forEach((task) => byId.set(task.id, task));

    return [...byId.values()];
}

/**
 * Replaces the store with fresh page props (each Inertia visit or reload).
 * Presence (online dots) and searched tasks survive the swap.
 */
export function hydrateChat(props: ChatProps): ChatState {
    if (props === hydratedFrom) {
        return state;
    }

    hydratedFrom = props;
    currentChannelId = props.current?.channel_id ?? null;
    const online = new Set(
        state.people
            .filter((person) => person.online)
            .map((person) => person.id),
    );

    state = {
        viewerId: props.viewer_id,
        people: props.people.map((person) => ({
            ...person,
            online: person.online || online.has(person.id),
        })),
        channels: props.channels.map((channel) =>
            channel.id === currentChannelId
                ? { ...channel, unread_count: 0 }
                : channel,
        ),
        messages: props.current?.messages ?? [],
        tasks: mergeTasks(state.tasks, props.current?.tasks ?? []),
        driveFiles: [],
        typing: {},
        hasMore: props.current?.has_more ?? false,
    };

    return state;
}

/** Page hook: the store, re-hydrated whenever Inertia sends new props. */
export function useChatStore(props: ChatProps): ChatState {
    const snapshot = useSyncExternalStore(
        subscribe,
        getChatState,
        getChatState,
    );

    return props === hydratedFrom ? snapshot : hydrateChat(props);
}

/** For components that only read (the page passes `state` down). */
export function useChatState(): ChatState {
    return useSyncExternalStore(subscribe, getChatState, getChatState);
}

function fail(error: unknown, fallback: string): void {
    toast.error(
        error instanceof Error && error.message ? error.message : fallback,
    );
}

function upsertMessage(message: Message, replacing?: string): Message[] {
    const id = replacing ?? message.id;
    const index = state.messages.findIndex(
        (item) => item.id === id || item.id === message.id,
    );

    if (index === -1) {
        return [...state.messages, message];
    }

    const next = [...state.messages];
    next[index] = message;

    return next.filter(
        (item, position) => position === index || item.id !== message.id,
    );
}

function updateChannel(
    channelId: string,
    update: (channel: Channel) => Channel,
): Channel[] {
    return state.channels.map((channel) =>
        channel.id === channelId ? update(channel) : channel,
    );
}

function updateMember(
    channelId: string,
    userId: string,
    update: (member: ChannelMember) => ChannelMember,
): Channel[] {
    return updateChannel(channelId, (channel) => ({
        ...channel,
        members: channel.members.map((member) =>
            member.user_id === userId ? update(member) : member,
        ),
    }));
}

function withPreview(channels: Channel[], message: Message): Channel[] {
    if (message.parent_id !== null) {
        return channels;
    }

    return channels.map((channel) =>
        channel.id === message.channel_id
            ? {
                  ...channel,
                  last_message: {
                      id: message.id,
                      user_id: message.user_id,
                      body_text: message.body_text,
                      created_at: message.created_at,
                      deleted: message.deleted_at !== null,
                  },
              }
            : channel,
    );
}

/** ULIDs sort by time; temporary ids ("tmp-…") are never a read pointer. */
function newer(id: string, than: string | null): boolean {
    return !id.startsWith('tmp-') && (than === null || id > than);
}

/** The viewer has seen everything loaded in the open channel. */
export function markRead(channelId: string): void {
    const latest = state.messages
        .filter(
            (message) =>
                message.channel_id === channelId &&
                !message.id.startsWith('tmp-'),
        )
        .map((message) => message.id)
        .sort()
        .at(-1);
    const channel = state.channels.find((item) => item.id === channelId);
    const member = channel?.members.find(
        (item) => item.user_id === state.viewerId,
    );

    if (!latest || !member || !newer(latest, member.last_read_message_id)) {
        return;
    }

    emit({
        ...state,
        channels: updateMember(channelId, state.viewerId, (item) => ({
            ...item,
            last_read_message_id: latest,
        })).map((item) =>
            item.id === channelId ? { ...item, unread_count: 0 } : item,
        ),
    });

    window.clearTimeout(readTimers.get(channelId));
    readTimers.set(
        channelId,
        window.setTimeout(() => {
            readTimers.delete(channelId);
            void chatApi.read(channelId).catch(() => {});
        }, 600),
    );
}

/**
 * Sends a message (shown at once, replaced by the server copy). Returns the
 * optimistic message so the composer can clear and scroll.
 */
export function sendMessage(
    channelId: string,
    text: string,
    attachments: MessageAttachment[] = [],
    parentId: string | null = null,
): Message {
    sequence += 1;
    const body =
        text.trim() === ''
            ? null
            : parseMessage(text, state.people, state.tasks);
    const temp: Message = {
        id: `tmp-${Date.now().toString(36)}-${sequence}`,
        channel_id: channelId,
        user_id: state.viewerId,
        parent_id: parentId,
        body,
        body_text: text.trim(),
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        reactions: [],
        attachments,
    };

    emit({
        ...state,
        messages: [...state.messages, temp],
        channels: withPreview(state.channels, temp),
    });

    chatApi
        .send(
            channelId,
            body,
            attachments.map((file) => file.id),
            parentId,
        )
        .then(({ message, tasks }) => {
            emit({
                ...state,
                messages: upsertMessage(message, temp.id),
                tasks: mergeTasks(state.tasks, tasks),
                channels: withPreview(
                    updateMember(channelId, state.viewerId, (member) =>
                        newer(message.id, member.last_read_message_id)
                            ? { ...member, last_read_message_id: message.id }
                            : member,
                    ),
                    message,
                ),
            });
        })
        .catch((error: ApiError) => {
            emit({
                ...state,
                messages: state.messages.filter((item) => item.id !== temp.id),
            });
            fail(error, 'Pesan gagal terkirim. Coba lagi.');
        });

    return temp;
}

/** Optimistic change of one message, rolled back when the request fails. */
function mutateMessage(
    messageId: string,
    change: (message: Message) => Message,
    request: () => Promise<{ message: Message; tasks: ChatTask[] }>,
    failure: string,
): void {
    const previous = state.messages.find((message) => message.id === messageId);

    if (!previous || messageId.startsWith('tmp-')) {
        return;
    }

    emit({ ...state, messages: upsertMessage(change(previous)) });

    request()
        .then(({ message, tasks }) =>
            emit({
                ...state,
                messages: upsertMessage(message),
                tasks: mergeTasks(state.tasks, tasks),
                channels: withPreview(state.channels, message),
            }),
        )
        .catch((error: ApiError) => {
            emit({ ...state, messages: upsertMessage(previous) });
            fail(error, failure);
        });
}

export function editMessage(messageId: string, text: string): void {
    const body = parseMessage(text, state.people, state.tasks);

    mutateMessage(
        messageId,
        (message) => ({
            ...message,
            body,
            body_text: text.trim(),
            edited_at: new Date().toISOString(),
        }),
        () => chatApi.edit(messageId, body),
        'Perubahan pesan gagal disimpan.',
    );
}

export function deleteMessage(messageId: string): void {
    mutateMessage(
        messageId,
        (message) => ({
            ...message,
            body: null,
            body_text: '',
            attachments: [],
            reactions: [],
            deleted_at: new Date().toISOString(),
        }),
        () => chatApi.destroy(messageId),
        'Pesan gagal dihapus.',
    );
}

export function reactToMessage(messageId: string, emoji: string): void {
    mutateMessage(
        messageId,
        (message) => ({
            ...message,
            reactions: toggleReaction(message.reactions, emoji, state.viewerId),
        }),
        () => chatApi.react(messageId, emoji),
        'Reaksi gagal disimpan.',
    );
}

export function setMuted(channelId: string, muted: boolean): void {
    const previous = state.channels;
    const isMember = state.channels
        .find((channel) => channel.id === channelId)
        ?.members.some((member) => member.user_id === state.viewerId);

    emit({
        ...state,
        channels: isMember
            ? updateMember(channelId, state.viewerId, (member) => ({
                  ...member,
                  muted,
              }))
            : updateChannel(channelId, (channel) => ({
                  ...channel,
                  members: [
                      ...channel.members,
                      {
                          user_id: state.viewerId,
                          last_read_message_id: null,
                          muted,
                          role: 'member',
                      },
                  ],
              })),
    });

    chatApi.mute(channelId, muted).catch((error: ApiError) => {
        emit({ ...state, channels: previous });
        fail(error, 'Pengaturan bisu gagal disimpan.');
    });
}

/** Older page of the open channel ("Muat pesan sebelumnya"). */
export async function loadOlder(): Promise<void> {
    const channelId = currentChannelId;
    const oldest = state.messages
        .filter(
            (message) =>
                message.channel_id === channelId &&
                message.parent_id === null &&
                !message.id.startsWith('tmp-'),
        )
        .map((message) => message.id)
        .sort()[0];

    if (!channelId || !oldest) {
        return;
    }

    try {
        const page = await chatApi.older(channelId, oldest);
        const known = new Set(state.messages.map((message) => message.id));

        emit({
            ...state,
            messages: [
                ...page.messages.filter((message) => !known.has(message.id)),
                ...state.messages,
            ],
            tasks: mergeTasks(state.tasks, page.tasks),
            hasMore: page.has_more,
        });
    } catch (error) {
        fail(error, 'Pesan sebelumnya gagal dimuat.');
    }
}

/** Drive picker: files every reader of the channel can open. */
export async function loadDriveFiles(query = ''): Promise<void> {
    if (!currentChannelId) {
        return;
    }

    try {
        const { files } = await chatApi.driveFiles(currentChannelId, query);
        emit({ ...state, driveFiles: files });
    } catch (error) {
        fail(error, 'Daftar file Drive gagal dimuat.');
    }
}

/** "#" suggestions: tasks the viewer can see, merged into `tasks`. */
export async function searchTasks(query: string): Promise<void> {
    try {
        const { tasks } = await chatApi.tasks(query);
        emit({ ...state, tasks: mergeTasks(state.tasks, tasks) });
    } catch {
        // Suggestions are optional; typing goes on.
    }
}

export type NewChannelInput = {
    name: string;
    topic: string;
    isPrivate: boolean;
    memberIds: string[];
};

/** Lower-case, dashes, max 40 characters ("Acara Q4" → "acara-q4"); same rule as CreateChannel. */
export function slugifyChannelName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

/** Creates a channel; resolves with its id (throws ApiError with an Indonesian message). */
export async function createChannel(input: NewChannelInput): Promise<string> {
    const { id } = await chatApi.createChannel({
        name: input.name,
        topic: input.topic.trim() || null,
        private: input.isPrivate,
        member_ids: input.memberIds,
    });

    return id;
}

/** Existing DM/group with exactly these people, or a new one; resolves with its id. */
export async function openDirect(userIds: string[]): Promise<string> {
    const { id } = await chatApi.openDirect(userIds);

    return id;
}

/* ---- Realtime (realtime.ts) -------------------------------------------- */

/** A message of the open channel changed on the server: fetch and merge it. */
export async function refreshMessage(messageId: string): Promise<void> {
    try {
        const { message, tasks } = await chatApi.message(messageId);

        if (message.channel_id !== currentChannelId) {
            return;
        }

        emit({
            ...state,
            messages: upsertMessage(message),
            tasks: mergeTasks(state.tasks, tasks),
            channels: withPreview(state.channels, message),
            typing: {
                ...state.typing,
                [message.parent_id
                    ? `thread:${message.parent_id}`
                    : message.channel_id]: [],
            },
        });
    } catch {
        // Gone or no longer visible (404): the next reload drops it.
    }
}

export function applyRead(
    channelId: string,
    userId: string,
    pointer: string | null,
): void {
    if (!pointer) {
        return;
    }

    emit({
        ...state,
        channels: updateMember(channelId, userId, (member) =>
            newer(pointer, member.last_read_message_id)
                ? { ...member, last_read_message_id: pointer }
                : member,
        ),
    });
}

export function setTyping(key: string, userIds: string[]): void {
    emit({ ...state, typing: { ...state.typing, [key]: userIds } });
}

export function setOnline(userIds: Set<string>): void {
    emit({
        ...state,
        people: state.people.map((person) => ({
            ...person,
            online: userIds.has(person.id),
        })),
    });
}

/** Another channel changed (unread badge, preview): reload the sidebar props, debounced. */
export function reloadInbox(): void {
    if (inboxTimer !== null) {
        window.clearTimeout(inboxTimer);
    }

    inboxTimer = window.setTimeout(() => {
        inboxTimer = null;
        router.reload({ only: ['chat'] });
    }, 800);
}

/** Tests: empty store. */
export function resetChatState(next: ChatState = EMPTY): void {
    state = next;
    hydratedFrom = null;
    currentChannelId = null;
    listeners.forEach((listener) => listener());
}
