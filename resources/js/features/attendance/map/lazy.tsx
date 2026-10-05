import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const GeofenceMapImpl = lazy(() => import('./geofence-map'));
const LocationPickerMapImpl = lazy(() => import('./location-picker-map'));

type GeofenceProps = ComponentProps<typeof GeofenceMapImpl>;
type PickerProps = ComponentProps<typeof LocationPickerMapImpl>;

/** Leaflet is code-split; the check-in screen renders before the map loads. */
export function GeofenceMap(props: GeofenceProps) {
    return (
        <Suspense
            fallback={
                <Skeleton className={cn('rounded-none', props.className)} />
            }
        >
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
