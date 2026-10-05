import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
    title: ReactNode;
    /** Right side of the header: a hint, a count or a link. */
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
    /** Body without padding (lists that run edge to edge). */
    flush?: boolean;
    id?: string;
};

/** Dashboard block: titled card (mockups Main, DashboardHR). */
export function Panel({
    title,
    aside,
    children,
    className,
    flush = false,
    id,
}: Props) {
    return (
        <section
            aria-labelledby={id}
            className={cn(
                'min-w-0 rounded-xl border border-border bg-surface shadow-card',
                className,
            )}
        >
            <header className="flex min-h-12 items-center justify-between gap-3 px-4 pt-3.5 pb-2">
                <h2
                    id={id}
                    className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-text"
                >
                    {title}
                </h2>
                {aside && (
                    <div className="shrink-0 text-[13px] text-text-muted">
                        {aside}
                    </div>
                )}
            </header>
            <div className={cn(flush ? 'pb-2' : 'px-4 pb-4')}>{children}</div>
        </section>
    );
}

export function PanelSkeleton({
    className,
    rows = 4,
}: {
    className?: string;
    rows?: number;
}) {
    return (
        <div
            aria-hidden
            className={cn(
                'rounded-xl border border-border bg-surface p-4 shadow-card',
                className,
            )}
        >
            <Skeleton className="h-5 w-40" />
            <div className="mt-4 space-y-3">
                {Array.from({ length: rows }, (_, index) => (
                    <Skeleton key={index} className="h-5 w-full" />
                ))}
            </div>
        </div>
    );
}

/** One-line empty message inside a panel. */
export function PanelEmpty({ children }: { children: ReactNode }) {
    return (
        <p className="px-4 py-6 text-center text-[13px] text-text-muted">
            {children}
        </p>
    );
}
