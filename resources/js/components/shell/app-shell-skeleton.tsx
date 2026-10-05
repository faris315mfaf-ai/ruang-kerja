import { Skeleton } from '@/components/ui/skeleton';

/**
 * Neutral first paint before the breakpoint is known on the client
 * (docs/PLATFORM.md §5 rule 5: avoid hydration mismatch). Mirrors the desktop
 * shell's geometry (64px menu bar, 1280px column with 40px padding) so
 * nothing jumps.
 */
export function AppShellSkeleton() {
    return (
        <div className="min-h-svh w-full" aria-busy="true">
            <div className="h-(--menu-bar-height) border-b border-border" />
            <div className="mx-auto max-w-(--page-max) space-y-5 px-4 pt-6 md:px-(--page-pad) md:pt-(--page-pad)">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-11 w-72" />
                <Skeleton className="h-40 w-full rounded-card" />
            </div>
        </div>
    );
}
