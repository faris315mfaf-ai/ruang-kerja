import { router } from '@inertiajs/react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, focusRing } from '@/lib/utils';
import { BADGE_TONE, placeOf, TAG_CLASSES } from './lib';
import type { RoleRow, RoleScheduleItem } from './types';

/** Leading code tile of a list row ("DEP", "P1"). */
export function TagTile({
    row,
    size = 'md',
}: {
    row: RoleRow;
    size?: 'md' | 'sm';
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex shrink-0 items-center justify-center font-extrabold',
                size === 'md'
                    ? 'size-11 rounded-[14px] text-[14px]'
                    : 'size-[38px] rounded-control text-[12px]',
                TAG_CLASSES[row.tone],
            )}
        >
            {row.tag}
        </span>
    );
}

/**
 * One list row (RoleDesk list): code tile, title + meta, status pill. With
 * `onOpen` it becomes a button that opens the role's task flow.
 */
export function RoleListRow({
    row,
    compact = false,
    onOpen,
}: {
    row: RoleRow;
    compact?: boolean;
    onOpen?: () => void;
}) {
    const body = (
        <>
            <TagTile row={row} size={compact ? 'sm' : 'md'} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <span
                    className={cn(
                        'font-semibold text-text',
                        compact
                            ? 'truncate text-[15px] font-bold'
                            : 'text-[17px] leading-6',
                    )}
                >
                    {row.title}
                </span>
                <span
                    className={cn(
                        'text-text-muted',
                        compact
                            ? 'truncate text-[13px]'
                            : 'text-[15px] leading-[22px]',
                    )}
                >
                    {row.meta}
                </span>
            </span>
            <Badge
                variant="status"
                tone={BADGE_TONE[row.tone]}
                className={
                    compact
                        ? 'h-[26px] px-2.5 text-[13px]'
                        : 'h-[30px] text-[14px]'
                }
            >
                {row.badge}
            </Badge>
        </>
    );
    const classes = cn(
        'flex w-full items-center',
        compact ? 'min-h-[62px] gap-3' : 'min-h-[72px] gap-4 px-6 py-2 md:px-7',
    );

    if (onOpen) {
        return (
            <button
                type="button"
                onClick={onOpen}
                className={cn(
                    classes,
                    'transition-colors duration-120 ease-brand hover:bg-background',
                    focusRing,
                    'focus-visible:ring-inset',
                )}
            >
                {body}
            </button>
        );
    }

    return <div className={classes}>{body}</div>;
}

/** Meeting place chip ("Google Meet", "Tatap muka"). */
export function PlaceChip({ place }: { place: RoleScheduleItem['place'] }) {
    const style = placeOf(place);

    return (
        <span
            className={cn(
                'inline-flex h-[22px] shrink-0 items-center rounded-xs px-2 text-[13px] font-extrabold',
                style.classes,
            )}
        >
            {style.label}
        </span>
    );
}

/** Small empty block inside a panel. */
export function PanelEmpty({
    title,
    children,
}: {
    title: string;
    children?: ReactNode;
}) {
    return (
        <EmptyState size="sm" icon={Inbox} title={title}>
            {children}
        </EmptyState>
    );
}

/** Error state of the whole dashboard (`?keadaan=galat`). */
export function DashboardError() {
    return (
        <EmptyState
            icon={AlertTriangle}
            title="Dashboard gagal dimuat"
            description="Data peran tidak bisa diambil. Periksa koneksi lalu coba lagi."
            action={
                <Button
                    variant="outline"
                    onClick={() =>
                        router.get(
                            window.location.pathname,
                            {},
                            { preserveScroll: true },
                        )
                    }
                >
                    <RefreshCw aria-hidden />
                    Coba lagi
                </Button>
            }
        />
    );
}

/** Skeleton of the dashboard (layout-shaped). */
export function DashboardSkeleton({ mobile }: { mobile: boolean }) {
    if (mobile) {
        return (
            <div className="flex flex-col gap-3" aria-busy aria-label="Memuat">
                <Skeleton className="h-10 w-56" />
                <Skeleton className="h-32 w-full rounded-panel" />
                <div className="grid grid-cols-2 gap-2.5">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
                <Skeleton className="h-64 w-full rounded-panel" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6" aria-busy aria-label="Memuat">
            <Skeleton className="h-11 w-full max-w-3xl" />
            <Skeleton className="h-24 w-full max-w-xl" />
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                {[0, 1, 2, 3].map((key) => (
                    <Skeleton key={key} className="h-36 rounded-card" />
                ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
                <Skeleton className="h-96 rounded-panel" />
                <Skeleton className="h-96 rounded-panel" />
            </div>
        </div>
    );
}
