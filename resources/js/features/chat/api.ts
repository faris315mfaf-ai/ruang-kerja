import chat from '@/routes/chat';
import channelRoutes from '@/routes/chat/channels';
import messageRoutes from '@/routes/chat/messages';
import referenceRoutes from '@/routes/chat/references';
import type { RichDoc } from '@/features/tasks/editor/types';
import { requestJson } from '@/features/tasks/lib/api';
import type { ChatTask, Message, MessageAttachment } from './types';

type MessageResponse = { message: Message; tasks: ChatTask[] };
type PageResponse = {
    messages: Message[];
    tasks: ChatTask[];
    has_more: boolean;
};

/** JSON endpoints of routes/chat.php (ChannelController, MessageController). */
export const chatApi = {
    send: (
        channelId: string,
        body: RichDoc | null,
        attachmentIds: string[],
        parentId: string | null,
    ) =>
        requestJson<MessageResponse>(messageRoutes.store(channelId), {
            body,
            attachments: attachmentIds,
            parent_id: parentId,
        }),
    edit: (messageId: string, body: RichDoc | null) =>
        requestJson<MessageResponse>(messageRoutes.update(messageId), { body }),
    destroy: (messageId: string) =>
        requestJson<MessageResponse>(messageRoutes.destroy(messageId)),
    react: (messageId: string, emoji: string) =>
        requestJson<MessageResponse>(messageRoutes.react(messageId), { emoji }),
    message: (messageId: string) =>
        requestJson<MessageResponse>(messageRoutes.show(messageId)),
    older: (channelId: string, before: string) =>
        requestJson<PageResponse>(
            messageRoutes.index(channelId, { query: { sebelum: before } }),
        ),
    read: (channelId: string) =>
        requestJson<{ last_read_message_id: string | null }>(
            channelRoutes.read(channelId),
        ),
    mute: (channelId: string, muted: boolean) =>
        requestJson<{ muted: boolean }>(channelRoutes.mute(channelId), {
            muted,
        }),
    createChannel: (input: {
        name: string;
        topic: string | null;
        private: boolean;
        member_ids: string[];
    }) => requestJson<{ id: string }>(channelRoutes.store(), input),
    openDirect: (userIds: string[]) =>
        requestJson<{ id: string }>(channelRoutes.direct(), {
            user_ids: userIds,
        }),
    driveFiles: (channelId: string, query: string) =>
        requestJson<{ files: MessageAttachment[] }>(
            channelRoutes.files(channelId, {
                query: query ? { q: query } : {},
            }),
        ),
    tasks: (query: string) =>
        requestJson<{ tasks: ChatTask[] }>(
            referenceRoutes.tasks({ query: { q: query } }),
        ),
};

/** /obrolan or /obrolan/{id}. */
export function chatUrl(channelId: string | null): string {
    return channelId ? chat.show(channelId).url : chat.index().url;
}
