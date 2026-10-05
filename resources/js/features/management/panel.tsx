import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Keyboard focus ring used across the Arus page. */
export const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arus-accent focus-visible:ring-offset-2 focus-visible:ring-offset-arus-surface';

/** Card of the Arus design: surface, 24px radius, soft shadow, h2 + optional link. */
export function Panel({
    title,
    action,
    children,
    className,
    bodyClassName,
    flush = false,
}: {
    title: string;
    /** Right side of the header (link or counter). */
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
    /** No horizontal padding on the body (tables with full-width rows). */
    flush?: boolean;
}) {
    const id = useId();

    return (
        <section
            aria-labelledby={id}
            className={cn(
                'flex min-w-0 flex-col rounded-arus-panel border border-arus-border bg-arus-surface py-6 shadow-arus-card',
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
                    className="text-[20px] leading-7 font-bold md:text-[22px]"
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

/** "Detail", "Semua proyek": teal text link with a 44px hit area. */
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
                '-my-2 inline-flex min-h-arus-control items-center rounded-arus-control px-1 text-[16px] font-semibold text-arus-link transition-opacity duration-120 ease-brand hover:opacity-80',
                FOCUS_RING,
            )}
        >
            {children}
        </Link>
    );
}

/** Pulsing placeholder in Arus colours (frozen by prefers-reduced-motion). */
export function ArusSkeleton({
    className,
    style,
}: {
    className?: string;
    style?: CSSProperties;
}) {
    return (
        <div
            aria-hidden
            style={style}
            className={cn(
                'animate-pulse rounded-arus-control bg-arus-surface-2',
                className,
            )}
        />
    );
}

/** Empty state: line icon, one sentence, optional explanation (DESIGN §6). */
export function EmptyState({
    icon: Icon,
    title,
    children,
    className,
}: {
    icon: LucideIcon;
    title: string;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-1 flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-arus-border-strong bg-arus-surface-2/60 px-5 py-8 text-center',
                className,
            )}
        >
            <Icon
                aria-hidden
                className="size-8 text-arus-text-3"
                strokeWidth={1.75}
            />
            <p className="text-[16px] font-bold">{title}</p>
            {children && (
                <p className="max-w-sm text-[15px] leading-[22px] text-arus-text-2">
                    {children}
                </p>
            )}
        </div>
    );
}
