import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import {
    groupMessages,
    otherMembers,
    readers,
    receiptLabel,
    typingLabel,
} from './lib';
import { MessageRunView } from './message-run';
import type { RunHandlers } from './message-run';
import { loadOlder } from './store';
import type { Channel, ChatState, Message } from './types';

/** "Rizky sedang mengetik…" with three pulsing dots (still with reduced motion). */
export function TypingIndicator({
    state,
    typingKey,
    className,
}: {
    state: ChatState;
    typingKey: string;
    className?: string;
}) {
    const names = (state.typing[typingKey] ?? [])
        .filter((id) => id !== state.viewerId)
        .map((id) => state.people.find((person) => person.id === id)?.name)
        .filter((name): name is string => name !== undefined);
    const label = typingLabel(names);

    return (
        <p
            aria-live="polite"
            className={cn(
                'flex min-h-6 items-center gap-2 text-[14px] text-text-muted',
                className,
            )}
        >
            {label && (
                <>
                    <span aria-hidden className="flex items-center gap-[3px]">
                        {[0, 1, 2].map((dot) => (
                            <span
                                key={dot}
                                className="size-1.5 animate-pulse rounded-full bg-text-subtle"
                                style={{ animationDelay: `${dot * 180}ms` }}
                            />
                        ))}
                    </span>
                    {label}
                </>
            )}
        </p>
    );
}

/** Read receipt for the viewer's latest message in the list. */
export function receiptsFor(
    messages: Message[],
    channel: Channel,
    state: ChatState,
): Record<string, string> {
    const mine = messages
        .filter(
            (message) =>
                message.user_id === state.viewerId && !message.deleted_at,
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .at(-1);

    if (!mine || mine.parent_id !== null) {
        return {};
    }

    const recipients = otherMembers(channel, state.people, state.viewerId);

    return {
        [mine.id]: receiptLabel(
            readers(mine, channel, state.messages, state.people),
            recipients.length,
            channel.type === 'dm',
        ),
    };
}

/** Messages grouped per day (sticky divider) and per sender. */
export function MessageList({
    messages,
    channel,
    state,
    variant,
    matches,
    inThread = false,
    onOpenThread,
    onOpenActions,
}: RunHandlers & {
    messages: Message[];
    channel: Channel;
    state: ChatState;
    variant: 'desktop' | 'mobile';
    matches?: Set<string>;
    inThread?: boolean;
}) {
    const groups = groupMessages(messages, new Date());
    const receipts = receiptsFor(messages, channel, state);
    const [loadingOlder, setLoadingOlder] = useState(false);

    const older = () => {
        setLoadingOlder(true);
        void loadOlder().finally(() => setLoadingOlder(false));
    };

    return (
        <div className="flex flex-col gap-1">
            {!inThread && state.hasMore && (
                <div className="flex justify-center py-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={older}
                        disabled={loadingOlder}
                    >
                        {loadingOlder && <Spinner />}
                        Muat pesan sebelumnya
                    </Button>
                </div>
            )}
            {groups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                    <div
                        className={cn(
                            'z-[5] flex justify-center py-2',
                            !inThread &&
                                (variant === 'mobile'
                                    ? 'sticky top-[calc(var(--app-bar-height)+env(safe-area-inset-top))]'
                                    : 'sticky top-0'),
                        )}
                    >
                        <h3 className="rounded-full border border-border bg-surface px-3 py-1 text-[13px] font-bold text-text-muted shadow-card">
                            {group.label}
                        </h3>
                    </div>
                    <div className="flex flex-col gap-4">
                        {group.runs.map((run) => (
                            <MessageRunView
                                key={run.messages[0].id}
                                run={run}
                                state={state}
                                variant={variant}
                                matches={matches}
                                receipts={receipts}
                                inThread={inThread}
                                onOpenThread={onOpenThread}
                                onOpenActions={onOpenActions}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
