import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatApi } from './api';
import {
    getChatState,
    hydrateChat,
    markRead,
    reactToMessage,
    resetChatState,
    sendMessage,
} from './store';
import type { ChatProps, Message } from './types';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('./api', () => ({
    chatApi: {
        send: vi.fn(),
        react: vi.fn(),
        read: vi.fn(() => Promise.resolve({ last_read_message_id: null })),
    },
    chatUrl: (id: string | null) => (id ? `/obrolan/${id}` : '/obrolan'),
}));

const CHANNEL = '01k0000000000000000000chan';

function message(
    id: string,
    userId: string,
    extra: Partial<Message> = {},
): Message {
    return {
        id,
        channel_id: CHANNEL,
        user_id: userId,
        parent_id: null,
        body: null,
        body_text: 'Halo',
        created_at: '2026-10-06T02:00:00Z',
        edited_at: null,
        deleted_at: null,
        reactions: [],
        attachments: [],
        ...extra,
    };
}

function props(): ChatProps {
    return {
        viewer_id: 'me',
        people: [
            {
                id: 'me',
                name: 'Dimas Pratama',
                avatar: null,
                title: '',
                online: false,
            },
            {
                id: 'sari',
                name: 'Sari Wulandari',
                avatar: null,
                title: '',
                online: false,
            },
        ],
        channels: [
            {
                id: CHANNEL,
                workspace_id: null,
                workspace: null,
                type: 'dm',
                name: null,
                topic: null,
                created_by: 'me',
                created_at: '2026-10-01T00:00:00Z',
                archived_at: null,
                members: [
                    {
                        user_id: 'me',
                        last_read_message_id: null,
                        muted: false,
                        role: 'member',
                    },
                    {
                        user_id: 'sari',
                        last_read_message_id: null,
                        muted: false,
                        role: 'member',
                    },
                ],
                unread_count: 3,
                last_message: null,
                can_post: true,
                can_manage: false,
            },
        ],
        current: {
            channel_id: CHANNEL,
            messages: [message('01k0000000000000000000msg1', 'sari')],
            tasks: [],
            has_more: true,
            can_post: true,
            can_manage: false,
        },
    };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('chat store', () => {
    beforeEach(() => {
        resetChatState();
        vi.mocked(chatApi.send).mockReset();
        vi.mocked(chatApi.react).mockReset();
    });

    it('hydrates from props, clearing the unread count of the open channel', () => {
        const state = hydrateChat(props());

        expect(state.viewerId).toBe('me');
        expect(state.channels[0].unread_count).toBe(0);
        expect(state.messages).toHaveLength(1);
        expect(state.hasMore).toBe(true);
        expect(hydrateChat(props())).not.toBe(state); // new props object → fresh state
    });

    it('shows a sent message at once and swaps in the server copy', async () => {
        hydrateChat(props());
        const saved = message('01k0000000000000000000msg2', 'me', {
            body_text: 'Siap',
        });
        vi.mocked(chatApi.send).mockResolvedValue({
            message: saved,
            tasks: [],
        });

        const temp = sendMessage(CHANNEL, 'Siap');

        expect(temp.id.startsWith('tmp-')).toBe(true);
        expect(getChatState().messages.map((item) => item.id)).toContain(
            temp.id,
        );

        await flush();

        const ids = getChatState().messages.map((item) => item.id);
        expect(ids).toContain(saved.id);
        expect(ids).not.toContain(temp.id);
        expect(
            getChatState().channels[0].members.find(
                (member) => member.user_id === 'me',
            )?.last_read_message_id,
        ).toBe(saved.id);
        expect(getChatState().channels[0].last_message?.id).toBe(saved.id);
    });

    it('removes the optimistic message when sending fails', async () => {
        hydrateChat(props());
        vi.mocked(chatApi.send).mockRejectedValue(
            new Error('Pesan tidak boleh kosong.'),
        );

        sendMessage(CHANNEL, 'x');
        await flush();

        expect(getChatState().messages).toHaveLength(1);
    });

    it('rolls a reaction back when the server refuses it', async () => {
        hydrateChat(props());
        vi.mocked(chatApi.react).mockRejectedValue(new Error('Tidak boleh'));

        reactToMessage('01k0000000000000000000msg1', '👍');
        expect(getChatState().messages[0].reactions).toEqual([
            { emoji: '👍', user_ids: ['me'] },
        ]);

        await flush();
        expect(getChatState().messages[0].reactions).toEqual([]);
    });

    it('moves the read pointer to the newest loaded message only forward', () => {
        hydrateChat(props());

        markRead(CHANNEL);

        expect(
            getChatState().channels[0].members.find(
                (member) => member.user_id === 'me',
            )?.last_read_message_id,
        ).toBe('01k0000000000000000000msg1');
    });
});
