import { Link, router } from '@inertiajs/react';
import { AlertTriangle, Construction, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, focusRing } from '@/lib/utils';
import { BADGE_TONE, kindOf, rowMeta, TAG_CLASSES } from './lib';
import type { RoleAction, RoleDashboard, RoleRow, ScheduleKind } from './types';

/** Leading code tile of a list row ("DEP", "CUT"). */
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
 * One list row (RoleDesk list): code tile, title + meta, status pill. A flow
 * row is a button that opens the job's task flow for that item; a row with a
 * link navigates; otherwise it is plain text.
 */
export function RoleListRow({
    row,
    compact = false,
    onOpen,
}: {
    row: RoleRow;
    compact?: boolean;
    onOpen?: (row: RoleRow) => void;
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
                            : 'line-clamp-2 text-[17px] leading-6',
                    )}
                >
                    {row.title}
                </span>
                <span
                    className={cn(
                        'text-text-muted',
                        compact
                            ? 'truncate text-[13px]'
                            : 'truncate text-[15px] leading-[22px]',
                    )}
                >
                    {rowMeta(row)}
                </span>
            </span>
            <Badge
                variant="status"
                tone={BADGE_TONE[row.tone]}
                className={cn(
                    'shrink-0',
                    compact
                        ? 'h-[26px] px-2.5 text-[13px]'
                        : 'h-[30px] text-[14px]',
                )}
            >
                {row.badge}
            </Badge>
        </>
    );
    const classes = cn(
        'flex w-full items-center',
        compact ? 'min-h-[62px] gap-3' : 'min-h-[72px] gap-4 px-6 py-2 md:px-7',
    );
    const interactive = cn(
        classes,
        'transition-colors duration-120 ease-brand hover:bg-background',
        focusRing,
        'focus-visible:ring-inset',
    );

    if (row.flow && onOpen) {
        return (
            <button
                type="button"
                onClick={() => onOpen(row)}
                className={interactive}
            >
                {body}
            </button>
        );
    }

    if (row.href) {
        return (
            <Link href={row.href} className={interactive}>
                {body}
            </Link>
        );
    }

    return <div className={classes}>{body}</div>;
}

/** Schedule kind chip ("Tenggat", "Milestone", "Cuti"). */
export function KindChip({ kind }: { kind: ScheduleKind }) {
    const style = kindOf(kind);

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

/** Link (or flow trigger) rendered as the panel action. */
export function ActionLink({
    action,
    onFlow,
}: {
    action: RoleAction | null;
    onFlow?: () => void;
}) {
    if (!action) {
        return null;
    }

    const classes = cn(
        'inline-flex h-11 items-center rounded-control px-2 text-[15px] font-bold text-link hover:underline',
        focusRing,
    );

    if (action.flow || !action.href) {
        return (
            <button type="button" className={classes} onClick={onFlow}>
                {action.label}
            </button>
        );
    }

    return (
        <Link href={action.href} className={classes}>
            {action.label}
        </Link>
    );
}

/**
 * "Ditahan · butuh modul baru": the job's design flow (disposition, client
 * tickets, UAT …) needs a module that does not exist yet. Honest card, no
 * fake button.
 */
export function HeldCard({
    held,
    compact = false,
}: {
    held: NonNullable<RoleDashboard['held']>;
    compact?: boolean;
}) {
    return (
        <section
            aria-label={`Ditahan: ${held.title}`}
            className={cn(
                'flex gap-3.5 rounded-panel border border-dashed border-border-strong bg-surface',
                compact ? 'p-4' : 'p-6',
            )}
        >
            <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-grad-soft text-link"
            >
                <Construction className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-1.5">
                <Badge variant="status" tone="neutral" dot className="w-fit">
                    Ditahan · butuh modul baru
                </Badge>
                <span className="text-[17px] leading-6 font-bold text-text">
                    {held.title}
                </span>
                <span className="text-[15px] leading-[22px] text-text-muted">
                    {held.description}
                </span>
            </span>
        </section>
    );
}

/** Error state of the dashboard (deferred prop failed to load). */
export function DashboardError() {
    return (
        <EmptyState
            icon={AlertTriangle}
            title="Dashboard gagal dimuat"
            description="Data jabatan tidak bisa diambil. Periksa koneksi lalu coba lagi."
            action={
                <Button
                    variant="outline"
                    onClick={() =>
                        router.reload({ only: ['dashboard', 'flow'] })
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
            <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
                {[0, 1, 2, 3].map((key) => (
                    <Skeleton key={key} className="h-36 rounded-card" />
                ))}
            </div>
            <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
                <Skeleton className="h-96 rounded-panel" />
                <Skeleton className="h-96 rounded-panel" />
            </div>
        </div>
    );
}
