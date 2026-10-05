import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import type { Person } from '@/features/tasks/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { HEALTH_LABELS, HEALTH_TONES, percent } from './lib';
import type { ProjectHealth } from './types';

/** Health set by the PIC: "● Berisiko". */
export function HealthBadge({
    health,
    className,
}: {
    health: ProjectHealth | null;
    className?: string;
}) {
    if (health === null) {
        return (
            <span
                className={cn(
                    'inline-flex h-6 items-center rounded-full bg-surface-2 px-2 text-[12px] text-text-muted',
                    className,
                )}
            >
                Belum ada update
            </span>
        );
    }

    const tone = HEALTH_TONES[health];

    return (
        <span
            className={cn(
                'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2 text-[12px] font-medium',
                tone.pill,
                className,
            )}
        >
            <span
                aria-hidden
                className={cn('size-1.5 rounded-full', tone.dot)}
            />
            {HEALTH_LABELS[health]}
        </span>
    );
}

/** System flag pill ("⚠ Milestone terlewat"), outlined in danger. */
export function FlagPill({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-danger/50 px-1.5 text-[12px] text-danger',
                className,
            )}
        >
            <TriangleAlert aria-hidden className="size-3" />
            {children}
        </span>
    );
}

/** Actual progress bar with the planned marker (thin vertical line). */
export function ProgressMeter({
    actual,
    planned,
    health,
    className,
}: {
    actual: number | null;
    planned: number | null;
    health?: ProjectHealth | null;
    className?: string;
}) {
    const tone = health ? HEALTH_TONES[health].bar : 'bg-primary';

    return (
        <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={actual === null ? undefined : Math.round(actual)}
            aria-label={`Progres ${percent(actual)}, rencana ${percent(planned)}`}
            className={cn(
                'relative h-1.5 rounded-full bg-surface-2',
                className,
            )}
        >
            <div
                className={cn('h-full rounded-full', tone)}
                style={{ width: `${actual ?? 0}%` }}
            />
            {planned !== null && (
                <span
                    aria-hidden
                    className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-text"
                    style={{ left: `${planned}%` }}
                />
            )}
        </div>
    );
}

/** Avatar + name. */
export function PersonChip({
    person,
    className,
    suffix,
}: {
    person: Person | null;
    className?: string;
    suffix?: ReactNode;
}) {
    if (!person) {
        return <span className="text-text-muted">–</span>;
    }

    return (
        <span
            className={cn(
                'inline-flex min-w-0 items-center gap-1.5',
                className,
            )}
        >
            <UserAvatar
                name={person.name}
                src={person.avatar}
                className="size-5 text-[9px]"
            />
            <span className="truncate">{person.name}</span>
            {suffix}
        </span>
    );
}

/** Bordered panel with a header row. */
export function Panel({
    title,
    count,
    aside,
    children,
    className,
    id,
}: {
    title: ReactNode;
    count?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
    id?: string;
}) {
    return (
        <section
            id={id}
            className={cn(
                'scroll-mt-20 overflow-hidden rounded-lg border border-border bg-surface',
                className,
            )}
        >
            <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-text">
                    {title}
                    {count !== undefined && (
                        <span className="text-[13px] font-normal text-text-muted tnum">
                            {count}
                        </span>
                    )}
                </h2>
                {aside}
            </header>
            {children}
        </section>
    );
}

/** Dialog on desktop, bottom sheet on mobile. */
export function ResponsiveSheet({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer: ReactNode;
}) {
    const breakpoint = useBreakpoint();

    if (breakpoint === 'mobile') {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title={title}
                description={description}
                footer={footer}
            >
                {children}
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription
                        className={description ? undefined : 'sr-only'}
                    >
                        {description ?? title}
                    </DialogDescription>
                </DialogHeader>
                {children}
                <DialogFooter>{footer}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export const fieldClass =
    'w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:text-[13px]';
