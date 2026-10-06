import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect } from 'react';
import {
    useConnectionMode,
    usePolling,
} from '@/features/tasks/realtime/connection';
import {
    applyRead,
    currentChannel,
    getChatState,
    markRead,
    refreshMessage,
    reloadInbox,
    setOnline,
    setTyping,
} from './store';

/** Payloads of App\Events\Chat\* on `private-chat.{id}` (ids only). */
type MessageSignal = {
    channel_id: string;
    message_id: string;
    parent_id: string | null;
};
type ReadSignal = {
    channel_id: string;
    user_id: string;
    last_read_message_id: string | null;
};
type TypingWhisper = { user_id: string; thread_id: string | null };
type Member = { id: string };

const TYPING_MS = 4_000;
const typingTimers = new Map<string, number>();
let lastWhisper = 0;

function showTyping(key: string, userId: string): void {
    const current = getChatState().typing[key] ?? [];

    if (!current.includes(userId)) {
        setTyping(key, [...current, userId]);
    }

    const timerKey = `${key}|${userId}`;
    window.clearTimeout(typingTimers.get(timerKey));
    typingTimers.set(
        timerKey,
        window.setTimeout(() => {
            typingTimers.delete(timerKey);
            setTyping(
                key,
                (getChatState().typing[key] ?? []).filter(
                    (id) => id !== userId,
                ),
            );
        }, TYPING_MS),
    );
}

/** Tell the other people in the channel that the viewer is typing (at most every 2.5 s). */
export function whisperTyping(
    channelId: string,
    threadId: string | null = null,
): void {
    const now = Date.now();

    if (now - lastWhisper < 2_500 || !echoIsConfigured()) {
        return;
    }

    lastWhisper = now;

    try {
        echo()
            .private(`chat.${channelId}`)
            .whisper('typing', {
                user_id: getChatState().viewerId,
                thread_id: threadId,
            } satisfies TypingWhisper);
    } catch {
        // Not connected: typing hints are best effort.
    }
}

/**
 * Realtime for the Obrolan pages: events of the open channel, typing
 * whispers, presence of the company (online dots) and activity in other
 * channels (sidebar). Without a WebSocket connection the sidebar and the
 * open channel reload every 30 s instead.
 */
export function useChatRealtime(
    viewerId: string,
    companyId: string | null,
    channelId: string | null,
): void {
    const mode = useConnectionMode();

    usePolling(mode === 'polling' && viewerId !== '', reloadInbox);

    useEffect(() => {
        if (!channelId || !echoIsConfigured()) {
            return;
        }

        const name = `chat.${channelId}`;
        const onMessage = (signal: MessageSignal) => {
            void refreshMessage(signal.message_id).then(() => {
                if (
                    signal.parent_id === null &&
                    document.visibilityState === 'visible'
                ) {
                    markRead(signal.channel_id);
                }
            });
        };
        const onRead = (signal: ReadSignal) =>
            applyRead(
                signal.channel_id,
                signal.user_id,
                signal.last_read_message_id,
            );
        const onTyping = (whisper: TypingWhisper) => {
            if (whisper.user_id !== viewerId) {
                showTyping(
                    whisper.thread_id
                        ? `thread:${whisper.thread_id}`
                        : channelId,
                    whisper.user_id,
                );
            }
        };

        try {
            const channel = echo().private(name);
            channel.listen('.message.posted', onMessage);
            channel.listen('.message.updated', onMessage);
            channel.listen('.message.deleted', onMessage);
            channel.listen('.read.updated', onRead);
            channel.listenForWhisper('typing', onTyping);

            return () => {
                echo().leave(name);
            };
        } catch {
            return undefined;
        }
    }, [channelId, viewerId]);

    useEffect(() => {
        if (!viewerId || !echoIsConfigured()) {
            return;
        }

        // The user channel is shared with notifications: only stop our listener.
        const onActivity = (signal: { channel_id: string }) => {
            if (signal.channel_id !== currentChannel()) {
                reloadInbox();
            }
        };

        try {
            const channel = echo().private(`App.Models.User.${viewerId}`);
            channel.listen('.chat.activity', onActivity);

            return () => {
                channel.stopListening('.chat.activity', onActivity);
            };
        } catch {
            return undefined;
        }
    }, [viewerId]);

    useEffect(() => {
        if (!companyId || !echoIsConfigured()) {
            return;
        }

        const name = `chat-online.${companyId}`;
        let online = new Set<string>();
        const publish = () => setOnline(new Set(online));

        try {
            echo()
                .join(name)
                .here((members: Member[]) => {
                    online = new Set(members.map((member) => member.id));
                    publish();
                })
                .joining((member: Member) => {
                    online.add(member.id);
                    publish();
                })
                .leaving((member: Member) => {
                    online.delete(member.id);
                    publish();
                });

            return () => {
                echo().leave(name);
            };
        } catch {
            return undefined;
        }
    }, [companyId]);
}
