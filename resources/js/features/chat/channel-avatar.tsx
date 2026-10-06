import { Hash, Lock } from 'lucide-react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { paletteGradient } from '@/lib/palette';
import { cn } from '@/lib/utils';
import { otherMembers } from './lib';
import type { Channel, ChatPerson } from './types';

const SIZES = {
    sm: {
        box: 'size-9 rounded-[10px] text-[13px]',
        icon: 'size-[18px]',
        dot: 'size-2.5',
    },
    md: {
        box: 'size-11 rounded-[13px] text-[15px]',
        icon: 'size-5',
        dot: 'size-3',
    },
    lg: {
        box: 'size-14 rounded-lg text-[19px]',
        icon: 'size-7',
        dot: 'size-3.5',
    },
} as const;

/** Green presence dot with a surface ring ("online"). */
export function PresenceDot({
    online,
    className,
}: {
    online: boolean;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'absolute right-0 bottom-0 rounded-full ring-2 ring-surface',
                online ? 'bg-fill-teal' : 'bg-border-strong',
                className,
            )}
        />
    );
}

/**
 * Leading tile of a channel row: workspace = gradient tile with its key,
 * channel = "#" / lock tile, DM = avatar + presence, group = two avatars.
 */
export function ChannelAvatar({
    channel,
    people,
    viewerId,
    size = 'md',
}: {
    channel: Channel;
    people: ChatPerson[];
    viewerId: string;
    size?: keyof typeof SIZES;
}) {
    const dims = SIZES[size];

    if (channel.type === 'workspace' && channel.workspace) {
        return (
            <span
                aria-hidden
                className={cn(
                    'flex shrink-0 items-center justify-center font-extrabold text-on-brand',
                    dims.box,
                    paletteGradient(channel.workspace.color),
                )}
            >
                {channel.workspace.key.slice(0, 3)}
            </span>
        );
    }

    if (channel.type === 'public' || channel.type === 'private') {
        const Icon = channel.type === 'private' ? Lock : Hash;

        return (
            <span
                aria-hidden
                className={cn(
                    'flex shrink-0 items-center justify-center bg-surface-2 text-text-muted',
                    dims.box,
                )}
            >
                <Icon className={dims.icon} strokeWidth={2.2} />
            </span>
        );
    }

    const others = otherMembers(channel, people, viewerId);

    if (channel.type === 'group') {
        const [first, second] = others;

        return (
            <span
                aria-hidden
                className={cn('relative shrink-0', dims.box.split(' ')[0])}
            >
                {first && (
                    <UserAvatar
                        name={first.name}
                        src={first.avatar}
                        className="absolute top-0 left-0 size-[70%] text-[11px]"
                    />
                )}
                {second && (
                    <UserAvatar
                        name={second.name}
                        src={second.avatar}
                        className="absolute right-0 bottom-0 size-[70%] text-[11px] ring-2 ring-surface"
                    />
                )}
            </span>
        );
    }

    const partner = others[0];

    return (
        <span aria-hidden className="relative shrink-0">
            <UserAvatar
                name={partner?.name ?? 'Anda'}
                src={partner?.avatar}
                className={cn(dims.box.split(' ')[0], 'text-[14px]')}
            />
            {partner && (
                <PresenceDot online={partner.online} className={dims.dot} />
            )}
        </span>
    );
}
