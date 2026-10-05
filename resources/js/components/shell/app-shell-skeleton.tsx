import { Skeleton } from '@/components/ui/skeleton';

/**
 * Neutral first paint before the breakpoint is known on the client
 * (docs/PLATFORM.md §5 rule 5: avoid hydration mismatch). Mirrors the desktop
 * shell's geometry (menu bar, 10px gutter, Dock space) so nothing jumps.
 */
export function AppShellSkeleton() {
    return (
        <div className="min-h-svh w-full" aria-busy="true">
            <div className="h-(--menu-bar-height) border-b border-border" />
            <div className="space-y-4 p-(--screen-gutter)">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-40 w-full" />
            </div>
        </div>
    );
}
