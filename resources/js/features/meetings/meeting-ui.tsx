import { router } from '@inertiajs/react';
import { AlertTriangle, CalendarOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { isInternalLink, joinLink, personById, PLATFORM_LABEL } from './lib';
import { useMeetingsContext } from './meetings-context';
import type {
    Meeting,
    MinutesStatus,
    Participant,
    Person,
    PersonId,
    Platform,
} from './types';

const PLATFORM_TONE: Record<Platform, string> = {
    meet: 'bg-link-soft text-link',
    zoom: 'bg-info-soft text-info',
    room: 'bg-surface-2 text-text-muted',
    client: 'bg-warning-soft text-warning',
    video: 'bg-link-soft text-link',
};

/** Fill for the 4px edge of agenda rows per platform. */
export const PLATFORM_EDGE: Record<Platform, string> = {
    meet: 'bg-primary',
    zoom: 'bg-accent-blue-strong',
    room: 'bg-text-subtle',
    client: 'bg-fill-warning',
    video: 'bg-primary',
};

export function PlatformBadge({
    platform,
    className,
}: {
    platform: Platform;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex h-[26px] shrink-0 items-center rounded-sm px-2.5 text-[14px] font-extrabold',
                PLATFORM_TONE[platform],
                className,
            )}
        >
            {PLATFORM_LABEL[platform]}
        </span>
    );
}

const MINUTES_BADGE: Record<
    MinutesStatus,
    { label: string; tone: 'warning' | 'success' | 'neutral' }
> = {
    draft: { label: 'Notulen draf', tone: 'warning' },
    final: { label: 'Notulen final', tone: 'success' },
    none: { label: 'Belum ada notulen', tone: 'neutral' },
};

export function MinutesBadge({
    status,
    className,
}: {
    status: MinutesStatus;
    className?: string;
}) {
    const badge = MINUTES_BADGE[status];

    return (
        <Badge
            variant="status"
            tone={badge.tone}
            className={cn('h-7 px-2.5 text-[13px] font-extrabold', className)}
        >
            {badge.label}
        </Badge>
    );
}

/** "Dibatalkan" chip of a canceled meeting. */
export function CanceledBadge({ className }: { className?: string }) {
    return (
        <Badge
            variant="status"
            tone="danger"
            dot
            className={cn('h-8 text-[14px]', className)}
        >
            Dibatalkan
        </Badge>
    );
}

export function participantName(
    participant: Participant,
    people: Person[],
    me: PersonId,
): string {
    const person = personById(people, participant.user_id);

    if (!person) {
        return participant.email ?? 'Tamu';
    }

    return person.id === me ? `${person.name} (Anda)` : person.name;
}

/** Overlapping initials avatars with a "+N" chip. */
export function AvatarStack({
    participants,
    max = 3,
    className,
    ringClassName = 'ring-surface',
}: {
    participants: Participant[];
    max?: number;
    className?: string;
    /** Ring colour separating the avatars (the background behind them). */
    ringClassName?: string;
}) {
    const { people } = useMeetingsContext();
    const shown = participants.slice(0, max);
    const rest = participants.length - shown.length;

    return (
        <span className={cn('flex', className)} aria-hidden>
            {shown.map((participant, index) => (
                <UserAvatar
                    key={participant.user_id ?? participant.email ?? index}
                    name={
                        personById(people, participant.user_id)?.name ??
                        participant.email ??
                        'Tamu'
                    }
                    className={cn(
                        'size-8 text-[12px] ring-2',
                        ringClassName,
                        index > 0 && '-ml-2',
                    )}
                />
            ))}
            {rest > 0 && (
                <span
                    className={cn(
                        '-ml-2 flex size-8 items-center justify-center rounded-full bg-surface-2 text-[12px] font-extrabold text-text-muted ring-2',
                        ringClassName,
                    )}
                >
                    +{rest}
                </span>
            )}
        </span>
    );
}

/**
 * Google Calendar/Meet integration is on hold (owner's decision): a neutral
 * chip in place of the sync status and buttons of the prototype.
 */
export function HeldChip({
    label = 'Sinkron Google Calendar',
    className,
}: {
    label?: string;
    className?: string;
}) {
    return (
        <Badge
            variant="status"
            tone="neutral"
            className={cn('h-11 gap-2 rounded-control px-3.5', className)}
        >
            <CalendarOff aria-hidden className="size-4 shrink-0" />
            <span>
                {label} · <span className="font-extrabold">Ditahan</span>
            </span>
        </Badge>
    );
}

/** Error state with a retry (reloads the page props). */
export function ErrorState({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <EmptyState
            icon={AlertTriangle}
            title={title}
            description={description}
            action={
                <Button variant="outline" onClick={() => router.reload()}>
                    <RefreshCw aria-hidden />
                    Coba lagi
                </Button>
            }
        />
    );
}

/** Skeleton rows the size of agenda rows. */
export function ListSkeleton({
    rows = 4,
    className,
}: {
    rows?: number;
    className?: string;
}) {
    return (
        <div aria-busy className={cn('flex flex-col gap-3', className)}>
            <span className="sr-only">Memuat…</span>
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-[72px] w-full rounded-lg" />
            ))}
        </div>
    );
}

/**
 * Join + copy the link: a pasted Meet/Zoom link opens in a new tab; Video
 * RuangKerja opens the in-app pre-join screen (/rapat/{id}/gabung) in this
 * tab and copies its full URL.
 */
export function useMeetingActions(meeting: Meeting | null) {
    const [joined, setJoined] = useState(false);
    const [copied, setCopied] = useState(false);
    const link = meeting ? joinLink(meeting) : null;
    const video = meeting?.platform === 'video';
    const app = video
        ? 'Video RuangKerja'
        : meeting?.platform === 'zoom'
          ? 'Zoom'
          : 'Google Meet';

    const join = () => {
        if (!link) {
            toast.error('Tautan rapat belum diisi', {
                description:
                    'Minta penyelenggara menempelkan tautan Meet atau Zoom di rapat ini.',
            });

            return;
        }

        if (isInternalLink(link)) {
            router.visit(link);

            return;
        }

        window.open(link, '_blank', 'noopener,noreferrer');
        setJoined(true);
    };

    const copy = async () => {
        if (!link) {
            return;
        }

        const absolute = isInternalLink(link)
            ? `${window.location.origin}${link}`
            : link;

        try {
            await navigator.clipboard?.writeText(absolute);
        } catch {
            // Clipboard may be blocked (permissions, insecure context): the toast still shows the link.
        }

        setCopied(true);
        toast.success('Tautan rapat disalin', { description: absolute });
    };

    return { joined, copied, link, app, join, copy };
}
