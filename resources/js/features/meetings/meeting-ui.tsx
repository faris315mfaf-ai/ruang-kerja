import { Link } from '@inertiajs/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';
import { formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { ME, PEOPLE } from './fixtures';
import { joinLink, personById, PLATFORM_LABEL } from './lib';
import type {
    GoogleSync,
    Meeting,
    MinutesStatus,
    Participant,
    Platform,
} from './types';
import { usePreviewState } from './use-preview';

export type PreviewOption = { label: string; query: string };

const BASE_OPTIONS: PreviewOption[] = [
    { label: 'Normal', query: '' },
    { label: 'Memuat', query: 'keadaan=memuat' },
    { label: 'Kosong', query: 'keadaan=kosong' },
    { label: 'Galat', query: 'keadaan=galat' },
];

/**
 * Prototype banner + links to preview the loading, empty and error states
 * (and page-specific ones like "Rapat berlangsung") of the screen.
 */
export function PreviewBar({
    extra = [],
    without = [],
    className,
}: {
    extra?: PreviewOption[];
    /** Base states that make no sense on this screen ("Kosong" on a form). */
    without?: string[];
    className?: string;
}) {
    const { path, query: current } = usePreviewState();

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-2',
                className,
            )}
        >
            <PrototypeBanner phase="Fase 2" />
            <nav
                aria-label="Pratinjau keadaan layar"
                className="-mx-4 flex w-[calc(100%+2rem)] [scrollbar-width:none] items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:w-auto md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
            >
                <span className="shrink-0 text-[14px] font-semibold text-text-muted">
                    Keadaan:
                </span>
                {[
                    ...BASE_OPTIONS.filter(
                        (option) => !without.includes(option.label),
                    ),
                    ...extra,
                ].map((option) => {
                    const active = option.query === current;

                    return (
                        <Link
                            key={option.label}
                            href={
                                option.query ? `${path}?${option.query}` : path
                            }
                            preserveScroll
                            aria-current={active ? 'true' : undefined}
                            className={cn(
                                'inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-[14px] font-semibold transition-colors duration-120 ease-brand md:min-h-9',
                                active
                                    ? 'border-transparent bg-link-soft text-link'
                                    : 'border-border bg-surface text-text-muted hover:text-text',
                                focusRing,
                            )}
                        >
                            {option.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

const PLATFORM_TONE: Record<Platform, string> = {
    meet: 'bg-link-soft text-link',
    zoom: 'bg-info-soft text-info',
    room: 'bg-surface-2 text-text-muted',
    client: 'bg-warning-soft text-warning',
};

/** Fill for the 4px edge of agenda rows per platform. */
export const PLATFORM_EDGE: Record<Platform, string> = {
    meet: 'bg-primary',
    zoom: 'bg-accent-blue-strong',
    room: 'bg-text-subtle',
    client: 'bg-fill-warning',
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

export function participantName(participant: Participant): string {
    const person = personById(PEOPLE, participant.user_id);

    if (!person) {
        return participant.email ?? 'Tamu';
    }

    return person.id === ME ? `${person.name} (Anda)` : person.name;
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
    const shown = participants.slice(0, max);
    const rest = participants.length - shown.length;

    return (
        <span className={cn('flex', className)} aria-hidden>
            {shown.map((participant, index) => (
                <UserAvatar
                    key={participant.user_id ?? participant.email ?? index}
                    name={
                        personById(PEOPLE, participant.user_id)?.name ??
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

/** "Google Calendar tersinkron" chip (or "belum terhubung"). */
export function SyncChip({
    sync,
    now,
    className,
}: {
    sync: GoogleSync;
    now: number;
    className?: string;
}) {
    if (!sync.connected) {
        return (
            <Badge
                variant="status"
                tone="warning"
                dot
                className={cn('h-11 rounded-control px-3.5', className)}
            >
                Google Calendar belum terhubung
            </Badge>
        );
    }

    return (
        <Badge
            variant="status"
            tone="success"
            dot
            className={cn('h-11 rounded-control px-3.5', className)}
        >
            <span>
                Google Calendar tersinkron
                {sync.last_synced_at && (
                    <span className="font-semibold opacity-80">
                        {' '}
                        · {formatRelative(sync.last_synced_at, now)}
                    </span>
                )}
            </span>
        </Badge>
    );
}

/** Error state with a retry link back to the normal page. */
export function ErrorState({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    const { path } = usePreviewState();

    return (
        <EmptyState
            icon={AlertTriangle}
            title={title}
            description={description}
            action={
                <Button variant="outline" asChild>
                    <Link href={path}>
                        <RefreshCw aria-hidden />
                        Coba lagi
                    </Link>
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

/** Join + copy link actions with toasts (preview: nothing is opened). */
export function useMeetingActions(meeting: Meeting | null) {
    const [joined, setJoined] = useState(false);
    const [copied, setCopied] = useState(false);
    const link = meeting ? joinLink(meeting) : null;
    const app = meeting?.platform === 'zoom' ? 'Zoom' : 'Google Meet';

    const join = () => {
        setJoined(true);
        toast.success(`Membuka ${app}…`, {
            description:
                'Kehadiran tercatat untuk notulen. Pratinjau: tautan contoh tidak dibuka.',
        });
    };

    const copy = async () => {
        if (!link) {
            return;
        }

        try {
            await navigator.clipboard?.writeText(link);
        } catch {
            // Clipboard may be blocked (permissions, insecure context): the toast still shows the link.
        }

        setCopied(true);
        toast.success('Tautan rapat disalin', { description: link });
    };

    return { joined, copied, link, app, join, copy };
}
