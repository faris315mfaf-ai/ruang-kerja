import { lazy, Suspense, useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const GeofenceMapImpl = lazy(() => import('./geofence-map'));
const LocationPickerMapImpl = lazy(() => import('./location-picker-map'));

type GeofenceProps = ComponentProps<typeof GeofenceMapImpl>;
type PickerProps = ComponentProps<typeof LocationPickerMapImpl>;

/**
 * True once the browser is idle after the first render. Leaflet (~45 kB gz)
 * is then fetched and initialised without competing with the screen's own
 * content for the network and main thread (Sprint 10 performance).
 */
function useIdle(): boolean {
    const [idle, setIdle] = useState(false);

    useEffect(() => {
        if (typeof window.requestIdleCallback === 'function') {
            const handle = window.requestIdleCallback(() => setIdle(true), {
                timeout: 1500,
            });

            return () => window.cancelIdleCallback(handle);
        }

        const timer = window.setTimeout(() => setIdle(true), 300);

        return () => window.clearTimeout(timer);
    }, []);

    return idle;
}

/** Leaflet is code-split and loaded when idle; the screen renders first. */
export function GeofenceMap(props: GeofenceProps) {
    const idle = useIdle();
    const fallback = (
        <Skeleton className={cn('rounded-none', props.className)} />
    );

    if (!idle) {
        return fallback;
    }

    return (
        <Suspense fallback={fallback}>
            <GeofenceMapImpl {...props} />
        </Suspense>
    );
}

export function LocationPickerMap(props: PickerProps) {
    return (
        <Suspense
            fallback={
                <Skeleton className={cn('rounded-none', props.className)} />
            }
        >
            <LocationPickerMapImpl {...props} />
        </Suspense>
    );
}
