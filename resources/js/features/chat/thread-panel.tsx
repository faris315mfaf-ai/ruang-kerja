import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { cn, focusRing } from '@/lib/utils';
import { Composer } from './composer';
import { channelTitle } from './lib';
import { MessageList, TypingIndicator } from './message-list';
import { MessageRunView } from './message-run';
import { sendMessage } from './store';
import type { Channel, ChatState, Message } from './types';

function ThreadBody({
    root,
    channel,
    state,
    variant,
}: {
    root: Message;
    channel: Channel;
    state: ChatState;
    variant: 'desktop' | 'mobile';
}) {
    const replies = state.messages.filter(
        (message) => message.parent_id === root.id,
    );

    return (
        <div className="flex flex-col gap-3">
            <MessageRunView
                run={{ userId: root.user_id, messages: [root] }}
                state={state}
                variant={variant}
                inThread
            />
            <div className="flex items-center gap-3 text-[13px] font-bold tracking-[.06em] text-text-muted uppercase">
                <span>
                    {replies.length > 0
                        ? `${replies.length} balasan`
                        : 'Belum ada balasan'}
                </span>
                <span aria-hidden className="h-px flex-1 bg-divider" />
            </div>
            {replies.length > 0 && (
                <MessageList
                    messages={replies}
                    channel={channel}
                    state={state}
                    variant={variant}
                    inThread
                />
            )}
            <TypingIndicator state={state} typingKey={`thread:${root.id}`} />
        </div>
    );
}

/** Desktop/tablet right column: thread of one message. */
export function ThreadPanel({
    root,
    channel,
    state,
    onClose,
    className,
}: {
    root: Message;
    channel: Channel;
    state: ChatState;
    onClose: () => void;
    className?: string;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    const count = state.messages.filter(
        (message) => message.parent_id === root.id,
    ).length;

    useEffect(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    }, [count, root.id]);

    return (
        <aside
            aria-label="Thread"
            className={cn('flex min-h-0 flex-col', className)}
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    onClose();
                }
            }}
        >
            <header className="flex items-center gap-2 border-b border-divider px-5 py-3">
                <div className="min-w-0 flex-1">
                    <h2 className="text-[18px] font-bold text-text">Thread</h2>
                    <p className="truncate text-[14px] text-text-muted">
                        {channelTitle(channel, state.people, state.viewerId)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Tutup thread"
                    className={cn(
                        'flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text',
                        focusRing,
                    )}
                >
                    <X className="size-5" aria-hidden />
                </button>
            </header>
            <div
                ref={scroller}
                className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-2"
            >
                <ThreadBody
                    root={root}
                    channel={channel}
                    state={state}
                    variant="desktop"
                />
            </div>
            <div className="px-4 pt-1 pb-4">
                <Composer
                    key={root.id}
                    state={state}
                    threadId={root.id}
                    variant="desktop"
                    compact
                    autoFocus
                    placeholder="Balas di thread…"
                    onSend={(text, files) =>
                        sendMessage(channel.id, text, files, root.id)
                    }
                />
            </div>
        </aside>
    );
}

/** Phones: thread in a bottom sheet with the reply box at the bottom. */
export function ThreadSheet({
    root,
    channel,
    state,
    onOpenChange,
}: {
    root: Message | null;
    channel: Channel;
    state: ChatState;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <BottomSheet
            open={root !== null}
            onOpenChange={onOpenChange}
            title="Thread"
            description={channelTitle(channel, state.people, state.viewerId)}
            className="h-[88svh]"
            footer={
                root && (
                    <Composer
                        key={root.id}
                        state={state}
                        threadId={root.id}
                        variant="mobile"
                        compact
                        placeholder="Balas di thread…"
                        onSend={(text, files) =>
                            sendMessage(channel.id, text, files, root.id)
                        }
                    />
                )
            }
        >
            {root && (
                <ThreadBody
                    root={root}
                    channel={channel}
                    state={state}
                    variant="mobile"
                />
            )}
        </BottomSheet>
    );
}
