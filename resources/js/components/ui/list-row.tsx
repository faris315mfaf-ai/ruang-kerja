import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, focusRing } from '@/lib/utils';

/**
 * List row (Komponen "Baris daftar", MBeranda tasks): ≥ 72px, leading avatar
 * or icon, title 17/600 + meta 15 muted, trailing text or chevron. Rows are
 * separated by a divider; put them in a card with `divide-y divide-divider`.
 * With `href` the whole row is one link (keyboard focusable).
 */
export function ListRow({
    href,
    leading,
    title,
    meta,
    trailing,
    chevron = Boolean(href),
    className,
}: {
    href?: string;
    leading?: ReactNode;
    title: ReactNode;
    meta?: ReactNode;
    /** Right side: time, status pill, count. */
    trailing?: ReactNode;
    /** Chevron on the right (default for links without `trailing`). */
    chevron?: boolean;
    className?: string;
}) {
    const body = (
        <>
            {leading && <span className="shrink-0">{leading}</span>}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[17px] leading-6 font-semibold text-text">
                    {title}
                </span>
                {meta && (
                    <span className="truncate text-[15px] leading-[22px] text-text-muted">
                        {meta}
                    </span>
                )}
            </span>
            {trailing && (
                <span className="shrink-0 text-[14px] text-text-muted">
                    {trailing}
                </span>
            )}
            {chevron && !trailing && (
                <ChevronRight
                    aria-hidden
                    className="size-[18px] shrink-0 text-text-subtle"
                    strokeWidth={2.4}
                />
            )}
        </>
    );
    const classes = cn(
        'flex min-h-[72px] items-center gap-3.5 px-5 py-2 md:px-7',
        className,
    );

    if (href) {
        return (
            <Link
                href={href}
                prefetch
                className={cn(
                    classes,
                    'transition-colors duration-120 ease-brand hover:bg-background',
                    focusRing,
                    'focus-visible:ring-inset',
                )}
            >
                {body}
            </Link>
        );
    }

    return <div className={classes}>{body}</div>;
}
