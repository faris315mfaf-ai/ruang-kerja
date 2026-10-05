import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { fieldClasses } from '@/components/ui/input';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import type { Person } from '@/features/tasks/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { HEALTH_LABELS, HEALTH_TONES, percent } from './lib';
import type { ProjectHealth } from './types';

const HEALTH_BADGE: Record<ProjectHealth, BadgeTone> = {
    on_track: 'success',
    at_risk: 'warning',
    off_track: 'danger',
};

/** Health set by the PIC (DPortofolio "● Berisiko"): Arus status pill. */
export function HealthBadge({
    health,
    className,
}: {
    health: ProjectHealth | null;
    className?: string;
}) {
    if (health === null) {
        return (
            <Badge
                variant="status"
                tone="neutral"
                className={cn('h-[30px] text-[14px]', className)}
            >
                Belum ada update
            </Badge>
        );
    }

    return (
        <Badge
            variant="status"
            tone={HEALTH_BADGE[health]}
            dot
            className={cn('h-[30px]', className)}
        >
            {HEALTH_LABELS[health]}
        </Badge>
    );
}

/** System flag ("⚠ Milestone terlewat"): red text with a warning icon. */
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
                'inline-flex shrink-0 items-center gap-1 text-[14px] leading-[19px] font-semibold text-danger',
                className,
            )}
        >
            <TriangleAlert aria-hidden className="size-3.5" />
            {children}
        </span>
    );
}

/**
 * Actual progress bar with the planned marker (DPortofolio "garis hitam =
 * rencana hari ini"): 10px track, fill in the health colour.
 */
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
    const tone = health ? HEALTH_TONES[health].bar : 'bg-grad-merek-x';

    return (
        <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={actual === null ? undefined : Math.round(actual)}
            aria-label={`Progres ${percent(actual)}, rencana ${percent(planned)}`}
            className={cn(
                'relative h-2.5 rounded-full bg-surface-2',
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
                    className="absolute -top-1 h-[18px] w-[3px] -translate-x-1/2 rounded-[2px] bg-marker"
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
            className={cn('inline-flex min-w-0 items-center gap-2', className)}
        >
            <UserAvatar
                name={person.name}
                src={person.avatar}
                className="size-7 text-[12px]"
            />
            <span className="truncate">{person.name}</span>
            {suffix}
        </span>
    );
}

/**
 * Bordered panel with a header row. Still used by features/projects (project
 * summary); the portfolio page itself uses the Arus `Panel`.
 */
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

/** Arus field look for plain textareas/inputs (17px on phones). */
export const fieldClass = cn(fieldClasses, 'py-2.5 max-md:text-[17px]');
