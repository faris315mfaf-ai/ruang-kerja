import { Loader2, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GeolocationState, GeoPosition } from '@/hooks/use-geolocation';
import type { StatusTone } from '@/lib/attendance';
import { TONE_CLASSES } from '@/lib/attendance';
import { formatDistance } from '@/lib/geo';
import type { GeofenceMatch } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { DaySchedule, OfficeLocationPoint } from '@/types/attendance';
import { GeofenceSketch } from './map/geofence-sketch';

export type LocationProps = {
    locations: OfficeLocationPoint[];
    schedule: DaySchedule;
    position: GeoPosition | null;
    geoState: GeolocationState;
    geoError: string | null;
    match: GeofenceMatch<OfficeLocationPoint> | null;
    onRefresh: () => void;
};

export type LocationStatus = {
    /** "Kantor Pusat · dalam radius". */
    title: string;
    /** "38 m dari titik · akurasi 12 m". */
    detail: string;
    tone: StatusTone;
};

/** What the location row says for the current GPS reading (DAbsensi / MAbsen). */
export function locationStatus({
    locations,
    schedule,
    position,
    geoState,
    geoError,
    match,
}: LocationProps): LocationStatus {
    const name =
        match?.location.name ??
        (locations.length === 1 ? locations[0].name : 'Lokasi kantor');
    const accuracy = position
        ? ` · akurasi ${Math.round(position.accuracy)} m`
        : '';

    if (geoState === 'locating') {
        return { title: name, detail: 'Membaca lokasi…', tone: 'neutral' };
    }

    if (geoError) {
        return { title: name, detail: geoError, tone: 'danger' };
    }

    if (!position) {
        return {
            title: name,
            detail: 'Lokasi dibaca saat Anda check-in.',
            tone: 'neutral',
        };
    }

    if (!match) {
        return locations.length === 0 && schedule.allowsRemote
            ? {
                  title: 'WFH/lapangan',
                  detail: `Check-in sebagai WFH/lapangan${accuracy}`,
                  tone: 'info',
              }
            : {
                  title: name,
                  detail: 'Belum ada lokasi kantor aktif',
                  tone: 'neutral',
              };
    }

    const distance = formatDistance(match.distanceM);

    if (match.inside) {
        return {
            title: `${name} · dalam radius`,
            detail: `${distance} dari titik${accuracy}`,
            tone: 'success',
        };
    }

    if (schedule.allowsRemote) {
        return {
            title: `${name} · di luar radius`,
            detail: `${distance} dari kantor · check-in sebagai WFH/lapangan`,
            tone: 'info',
        };
    }

    return {
        title: `${name} · di luar radius ${match.location.radiusM} m`,
        detail: `${distance} dari titik${accuracy}`,
        tone: 'danger',
    };
}

function RefreshButton({
    geoState,
    onRefresh,
    className,
}: Pick<LocationProps, 'geoState' | 'onRefresh'> & { className?: string }) {
    const locating = geoState === 'locating';

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={locating}
            aria-label="Perbarui lokasi"
            className={cn('shrink-0 text-text-muted', className)}
        >
            {locating ? (
                <Loader2 className="animate-spin" aria-hidden />
            ) : (
                <RefreshCw strokeWidth={1.9} aria-hidden />
            )}
        </Button>
    );
}

/**
 * Bordered location row of the check-in card (DAbsensi "Kantor Pusat ·
 * dalam radius"): 40px teal pin tile, place + distance, refresh.
 */
export function LocationRow({
    className,
    ...props
}: LocationProps & { className?: string }) {
    const status = locationStatus(props);
    const bad = status.tone === 'danger';

    return (
        <div
            className={cn(
                'flex min-w-0 items-center gap-3 rounded-lg border border-border py-3 pr-2 pl-4',
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-control',
                    bad
                        ? 'bg-danger-soft text-danger'
                        : 'bg-link-soft text-link',
                )}
            >
                <MapPin className="size-[22px]" strokeWidth={1.9} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] leading-6 font-semibold text-text">
                    {status.title}
                </span>
                <span
                    aria-live="polite"
                    className={cn(
                        'text-[15px] leading-[22px]',
                        status.tone === 'neutral' || status.tone === 'success'
                            ? 'text-text-muted'
                            : TONE_CLASSES[status.tone].text,
                    )}
                >
                    {status.detail}
                </span>
            </span>
            <RefreshButton
                geoState={props.geoState}
                onRefresh={props.onRefresh}
            />
        </div>
    );
}

/**
 * Map header of the phone check-in screen (MAbsen): schematic geofence with
 * a glass GPS chip and the refresh button floating on top.
 */
export function LocationMap({
    height = 220,
    className,
    ...props
}: LocationProps & { height?: number; className?: string }) {
    const { position, geoState, onRefresh, locations } = props;
    const accurate = position !== null && position.accuracy <= 50;

    return (
        <div className={cn('relative overflow-hidden', className)}>
            <GeofenceSketch
                locations={locations}
                position={position}
                height={height}
                className="w-full"
            />
            <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
                <span className="glass-strong inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[15px] font-bold text-text shadow-float">
                    <span
                        aria-hidden
                        className={cn(
                            'size-2 rounded-full',
                            position
                                ? accurate
                                    ? 'bg-success'
                                    : 'bg-fill-warning'
                                : 'bg-text-subtle',
                        )}
                    />
                    {position
                        ? `GPS ${accurate ? 'akurat' : 'kurang akurat'} · ${Math.round(position.accuracy)} m`
                        : geoState === 'locating'
                          ? 'Membaca GPS…'
                          : 'GPS belum dibaca'}
                </span>
                <RefreshButton
                    geoState={geoState}
                    onRefresh={onRefresh}
                    className="glass-strong rounded-full text-text shadow-float"
                />
            </div>
        </div>
    );
}
