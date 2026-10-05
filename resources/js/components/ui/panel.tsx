import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { cn, focusRing } from '@/lib/utils';

/**
 * Titled section card of the screens (DBeranda, MgDashboard "Tren
 * penyelesaian", "Beban kerja"): surface, radius 24, soft elevation, h2 in
 * the h3 scale (22/30 desktop, 20 phone) and an optional action on the right.
 */
export function Panel({
    title,
    action,
    children,
    className,
    bodyClassName,
    flush = false,
}: {
    title: ReactNode;
    /** Right side of the header (link or counter). */
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
    /** No horizontal padding on the body (lists with full-width rows). */
    flush?: boolean;
}) {
    const id = useId();

    return (
        <section
            aria-labelledby={id}
            className={cn(
                'flex min-w-0 flex-col rounded-panel border border-border bg-surface py-6 shadow-card',
                className,
            )}
        >
            <div
                className={cn(
                    'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3',
                    flush ? 'px-6 md:px-7' : 'px-5 md:px-6',
                )}
            >
                <h2
                    id={id}
                    className="flex items-center gap-2.5 text-[20px] leading-7 font-bold md:text-[22px]"
                >
                    {title}
                </h2>
                {action}
            </div>
            <div
                className={cn(
                    'flex min-w-0 flex-1 flex-col',
                    !flush && 'px-5 md:px-6',
                    bodyClassName,
                )}
            >
                {children}
            </div>
        </section>
    );
}

/** "Detail", "Lihat semua": teal text link with a 44px hit area. */
export function PanelLink({
    href,
    children,
    label,
}: {
    href: string;
    children: ReactNode;
    /** Accessible name when the visible text is ambiguous ("Detail"). */
    label?: string;
}) {
    return (
        <Link
            href={href}
            prefetch
            aria-label={label}
            className={cn(
                '-my-2 inline-flex min-h-control items-center rounded-control px-1 text-[16px] font-semibold text-link transition-opacity duration-120 ease-brand hover:opacity-80',
                focusRing,
            )}
        >
            {children}
        </Link>
    );
}
