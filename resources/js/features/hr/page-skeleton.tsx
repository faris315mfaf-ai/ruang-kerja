import { Skeleton } from '@/components/ui/skeleton';

/** Neutral placeholder before the client knows its breakpoint. */
export function HubSkeleton() {
    return (
        <div className="flex flex-col gap-5" aria-busy>
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-11 w-full max-w-xl" />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-32 rounded-card" />
                ))}
            </div>
            <Skeleton className="h-72 w-full rounded-panel" />
        </div>
    );
}
