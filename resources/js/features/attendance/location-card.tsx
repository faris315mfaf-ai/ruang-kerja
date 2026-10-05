import { Loader2, MapPin, RefreshCw } from 'lucide-react';
import type { GeolocationState, GeoPosition } from '@/hooks/use-geolocation';
import { formatDistance } from '@/lib/geo';
import type { GeofenceMatch } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { DaySchedule, OfficeLocationPoint } from '@/types/attendance';
import { GeofenceSketch } from './map/geofence-sketch';

type Props = {
    locations: OfficeLocationPoint[];
    schedule: DaySchedule;
    position: GeoPosition | null;
    geoState: GeolocationState;
    geoError: string | null;
    match: GeofenceMatch<OfficeLocationPoint> | null;
    onRefresh: () => void;
    mapClassName?: string;
    /** Mini map height in px (120 on phones). */
    mapHeight?: number;
    className?: string;
};

function summary({
    locations,
    schedule,
    position,
    geoState,
    geoError,
    match,
}: Props): { text: string; tone: string } {
    if (geoState === 'locating') {
        return { text: 'Membaca lokasi…', tone: 'text-text-muted' };
    }

    if (geoError) {
        return { text: geoError, tone: 'text-danger' };
    }

    if (!position) {
        return {
            text: 'Lokasi dibaca saat Anda check-in.',
            tone: 'text-text-muted',
        };
    }

    if (!match) {
        return locations.length === 0 && schedule.allowsRemote
            ? { text: 'Check-in sebagai WFH/lapangan', tone: 'text-info' }
            : {
                  text: 'Belum ada lokasi kantor aktif',
                  tone: 'text-text-muted',
              };
    }

    const distance = formatDistance(match.distanceM);

    if (match.inside) {
        return {
            text: `${distance} dari titik · dalam radius ${match.location.radiusM} m`,
            tone: 'text-success',
        };
    }

    if (schedule.allowsRemote) {
        return {
            text: `${distance} dari kantor · check-in sebagai WFH/lapangan`,
            tone: 'text-info',
        };
    }

    return {
        text: `${distance} dari titik · di luar radius ${match.location.radiusM} m`,
        tone: 'text-danger',
    };
}

/** Schematic mini map + distance to the nearest geofence (mockup Absensi). */
export function LocationCard(props: Props) {
    const {
        locations,
        position,
        match,
        geoState,
        onRefresh,
        mapClassName,
        mapHeight,
        className,
    } = props;
    const line = summary(props);
    const title =
        match?.location.name ??
        (locations.length === 1 ? locations[0].name : 'Lokasi kantor');
    const showMap = locations.length > 0 || position !== null;

    return (
        <section
            aria-label="Lokasi"
            className={cn(
                'overflow-hidden rounded-xl border border-border bg-surface shadow-card',
                className,
            )}
        >
            {showMap && (
                <GeofenceSketch
                    locations={locations}
                    position={position}
                    height={mapHeight}
                    className={cn('w-full', mapClassName)}
                />
            )}
            <div className="flex items-center gap-3 px-4 py-3">
                <MapPin
                    aria-hidden
                    strokeWidth={1.75}
                    className={cn(
                        'size-6 shrink-0',
                        match && !match.inside ? 'text-danger' : 'text-primary',
                    )}
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-medium text-text">
                        {title}
                    </p>
                    <p className={cn('text-sm', line.tone)} aria-live="polite">
                        {line.text}
                    </p>
                </div>
                {position && (
                    <span className="shrink-0 text-[13px] text-text-muted">
                        Akurasi ±{Math.round(position.accuracy)} m
                    </span>
                )}
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={geoState === 'locating'}
                    aria-label="Perbarui lokasi"
                    className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                >
                    {geoState === 'locating' ? (
                        <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                        <RefreshCw
                            className="size-5"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    )}
                </button>
            </div>
        </section>
    );
}
