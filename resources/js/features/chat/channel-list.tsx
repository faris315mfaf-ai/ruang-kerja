import { Link } from '@inertiajs/react';
import { BellOff, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn, focusRing } from '@/lib/utils';
import { ChannelAvatar } from './channel-avatar';
import {
    channelLastMessage,
    channelTitle,
    groupChannels,
    listTime,
    previewText,
    unreadCount,
} from './lib';
import type { Channel, ChatState } from './types';

type Props = {
    state: ChatState;
    activeId: string | null;
    variant: 'desktop' | 'mobile';
};

function sortByActivity(channels: Channel[], state: ChatState): Channel[] {
    return [...channels].sort((a, b) => {
        // Channels without messages go last.
        const left = channelLastMessage(a, state.messages)?.created_at ?? '';
        const right = channelLastMessage(b, state.messages)?.created_at ?? '';

        return right.localeCompare(left);
    });
}

/**
 * Conversations grouped Workspace · Channel · Pesan langsung (newest
 * activity first), with unread counts, mute and presence.
 */
export function ChannelList({ state, activeId, variant }: Props) {
    const [query, setQuery] = useState('');
    const now = new Date();
    const mobile = variant === 'mobile';

    const sections = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const channels = state.channels.filter(
            (channel) =>
                needle === '' ||
                channelTitle(channel, state.people, state.viewerId)
                    .toLowerCase()
                    .includes(needle),
        );

        return groupChannels(channels).map((section) => ({
            ...section,
            channels: sortByActivity(section.channels, state),
        }));
    }, [query, state]);

    return (
        <div className="flex min-h-0 flex-col">
            <div className={cn(mobile ? 'pb-3' : 'px-4 pb-3')}>
                <label className="relative block">
                    <span className="sr-only">Cari obrolan</span>
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-text-subtle"
                    />
                    <Input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Cari obrolan"
                        className={cn('pl-10', mobile && 'h-12 rounded-lg')}
                    />
                </label>
            </div>

            {sections.length === 0 && (
                <p className="px-5 py-6 text-center text-[15px] text-text-muted">
                    Tidak ada obrolan yang cocok dengan “{query}”.
                </p>
            )}

            {sections.map((section) => (
                <section
                    key={section.key}
                    aria-labelledby={`chat-section-${section.key}`}
                    className={cn(
                        mobile &&
                            'mb-4 overflow-hidden rounded-panel border border-border bg-surface shadow-card',
                    )}
                >
                    <h2
                        id={`chat-section-${section.key}`}
                        className={cn(
                            'text-[13px] font-bold tracking-[.06em] text-text-muted uppercase',
                            mobile ? 'px-5 pt-4 pb-1' : 'px-5 pt-3 pb-1.5',
                        )}
                    >
                        {section.label}
                    </h2>
                    <ul className={cn(mobile && 'divide-y divide-divider')}>
                        {section.channels.map((channel) => {
                            const member = channel.members.find(
                                (item) => item.user_id === state.viewerId,
                            );
                            const unread = unreadCount(
                                channel,
                                state.messages,
                                state.viewerId,
                            );
                            const last = channelLastMessage(
                                channel,
                                state.messages,
                            );
                            const direct =
                                channel.type === 'dm' ||
                                channel.type === 'group';
                            const title = channelTitle(
                                channel,
                                state.people,
                                state.viewerId,
                            );
                            const active = channel.id === activeId;
                            const typing =
                                (state.typing[channel.id] ?? []).length > 0;

                            return (
                                <li key={channel.id}>
                                    <Link
                                        href={`/obrolan/${channel.id}`}
                                        preserveScroll={!mobile}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        aria-label={`${title}${unread > 0 ? `, ${unread} belum dibaca` : ''}${member?.muted ? ', dibisukan' : ''}`}
                                        className={cn(
                                            'flex items-center gap-3 transition-colors duration-120 ease-brand',
                                            mobile
                                                ? 'min-h-[72px] px-5 py-2.5 active:bg-surface-2'
                                                : 'mx-2 min-h-14 rounded-control px-3 py-2 hover:bg-surface-2',
                                            active &&
                                                'bg-link-soft hover:bg-link-soft',
                                            focusRing,
                                            'focus-visible:ring-inset',
                                        )}
                                    >
                                        <ChannelAvatar
                                            channel={channel}
                                            people={state.people}
                                            viewerId={state.viewerId}
                                            size={mobile ? 'md' : 'sm'}
                                        />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className={cn(
                                                        'min-w-0 flex-1 truncate',
                                                        mobile
                                                            ? 'text-[17px] leading-6'
                                                            : 'text-[15px] leading-5',
                                                        unread > 0 &&
                                                            !member?.muted
                                                            ? 'font-bold text-text'
                                                            : 'font-semibold text-text',
                                                    )}
                                                >
                                                    {title}
                                                </span>
                                                {last && (
                                                    <span className="shrink-0 text-[13px] text-text-muted tnum">
                                                        {listTime(
                                                            last.created_at,
                                                            now,
                                                        )}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className={cn(
                                                        'min-w-0 flex-1 truncate',
                                                        mobile
                                                            ? 'text-[15px] leading-[22px]'
                                                            : 'text-[14px] leading-5',
                                                        typing
                                                            ? 'font-semibold text-link'
                                                            : 'text-text-muted',
                                                    )}
                                                >
                                                    {typing
                                                        ? 'sedang mengetik…'
                                                        : previewText(
                                                              last,
                                                              state.people,
                                                              state.viewerId,
                                                              direct,
                                                          )}
                                                </span>
                                                {member?.muted && (
                                                    <BellOff
                                                        aria-hidden
                                                        className="size-4 shrink-0 text-text-subtle"
                                                    />
                                                )}
                                                {unread > 0 &&
                                                    (member?.muted ? (
                                                        <span
                                                            aria-hidden
                                                            className="size-2.5 shrink-0 rounded-full bg-border-strong"
                                                        />
                                                    ) : (
                                                        <Badge
                                                            variant="count"
                                                            aria-hidden
                                                            className="h-[22px] min-w-[22px] px-1.5 text-[13px]"
                                                        >
                                                            {unread}
                                                        </Badge>
                                                    ))}
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}
