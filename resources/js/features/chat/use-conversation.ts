import { useEffect, useMemo, useState } from 'react';
import { searchMessages } from './lib';
import { markRead } from './store';
import type { ChatState, Message } from './types';

/**
 * Shared data of one open conversation (desktop pane and phone screen):
 * top-level messages, in-channel search and the open thread. Marks the
 * channel read while it is on screen.
 */
export function useConversation(state: ChatState, channelId: string | null) {
    const channel =
        state.channels.find((item) => item.id === channelId) ?? null;
    const messages = useMemo(
        () =>
            state.messages.filter(
                (message) =>
                    message.channel_id === channelId &&
                    message.parent_id === null,
            ),
        [state.messages, channelId],
    );
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [cursor, setCursor] = useState(0);
    const [threadId, setThreadId] = useState<string | null>(null);
    const [prevChannel, setPrevChannel] = useState(channelId);

    // Reset per-conversation UI when switching channels (render-time reset).
    if (prevChannel !== channelId) {
        setPrevChannel(channelId);
        setQuery('');
        setSearching(false);
        setCursor(0);
        setThreadId(null);
    }

    const matchIds = useMemo(
        () => (searching ? searchMessages(messages, query) : []),
        [messages, query, searching],
    );
    const matches = useMemo(() => new Set(matchIds), [matchIds]);
    const thread: Message | null =
        state.messages.find((message) => message.id === threadId) ?? null;

    useEffect(() => {
        if (channelId) {
            markRead(channelId);
        }
    }, [channelId, messages.length]);

    const jump = (step: 1 | -1) => {
        if (matchIds.length === 0) {
            return;
        }

        const next = (cursor + step + matchIds.length) % matchIds.length;
        setCursor(next);
        document
            .getElementById(`pesan-${matchIds[next]}`)
            ?.scrollIntoView({ block: 'center' });
    };

    return {
        channel,
        messages,
        search: {
            open: searching,
            setOpen: (open: boolean) => {
                setSearching(open);

                if (!open) {
                    setQuery('');
                    setCursor(0);
                }
            },
            query,
            setQuery: (value: string) => {
                setQuery(value);
                setCursor(0);
            },
            matches,
            count: matchIds.length,
            cursor,
            jump,
        },
        thread,
        openThread: (message: Message) => setThreadId(message.id),
        closeThread: () => setThreadId(null),
    };
}

export type Conversation = ReturnType<typeof useConversation>;
