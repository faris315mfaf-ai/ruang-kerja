import { cn } from '@/lib/utils';

/**
 * Loading placeholder the size of the real content (MFondasi "Memuat"):
 * surface-2 block, radius 12, gentle pulse (frozen by reduced motion).
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="skeleton"
            aria-hidden
            className={cn('animate-pulse rounded-md bg-surface-2', className)}
            {...props}
        />
    );
}

export { Skeleton };
