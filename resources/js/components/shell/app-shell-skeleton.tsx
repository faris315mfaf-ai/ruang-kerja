import { Skeleton } from '@/components/ui/skeleton';

/**
 * Neutral first paint before the breakpoint is known on the client
 * (docs/PLATFORM.md §5 rule 5: avoid hydration mismatch).
 */
export function AppShellSkeleton() {
    return (
        <div className="flex min-h-svh w-full" aria-busy="true">
            <div className="hidden w-14 shrink-0 border-r border-border md:block lg:w-60" />
            <div className="flex flex-1 flex-col">
                <div className="h-14 border-b border-border" />
                <div className="space-y-4 p-4 lg:p-6">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-72" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </div>
        </div>
    );
}
