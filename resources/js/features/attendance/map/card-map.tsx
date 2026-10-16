import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { OfficeLocationPoint } from '@/types/attendance';
import { GeofenceSketch } from './geofence-sketch';
import { GeofenceMap } from './lazy';
import type { MapPosition } from './geofence-map';

type Props = {
    locations: OfficeLocationPoint[];
    position: MapPosition | null;
    /** Frame height in px. */
    height?: number;
    /**
     * Bottom strip hidden under the sheet that overlaps the frame; the map
     * stops above it so its attribution stays readable.
     */
    bottomInset?: number;
    className?: string;
};

/** Catches a failed lazy chunk or a Leaflet crash and reports it once. */
class MapBoundary extends Component<
    { children: ReactNode; onFail: () => void },
    { failed: boolean }
> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(_error: Error, _info: ErrorInfo) {
        this.props.onFail();
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

function useOnline(): boolean {
    const [online, setOnline] = useState(
        typeof navigator === 'undefined' ? true : navigator.onLine,
    );

    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);

        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);

    return online;
}

/**
 * Real map of the Absensi check-in card: the office geofence circle, the
 * office marker and, once read, the employee's position (OpenStreetMap tiles,
 * Leaflet loaded lazily when the browser is idle, a skeleton meanwhile). The
 * map is a still picture (no panning, so it never fights page scrolling).
 * When Leaflet or the tiles cannot load (offline, blocked) the old SVG sketch
 * is shown with a one-line explanation, so the card never shows a blank box.
 */
export function CardMap({
    locations,
    position,
    height = 200,
    bottomInset = 0,
    className,
}: Props) {
    const [failed, setFailed] = useState(false);
    const online = useOnline();
    const nothingToShow = locations.length === 0 && position === null;
    const sketch = failed || !online || nothingToShow;
    const mapHeight = Math.max(80, height - bottomInset);

    return (
        <div
            className={cn('relative bg-grad-soft', className)}
            style={{ height }}
        >
            {sketch ? (
                <GeofenceSketch
                    locations={locations}
                    position={position}
                    height={height}
                    className="w-full"
                />
            ) : (
                <MapBoundary onFail={() => setFailed(true)}>
                    <div style={{ height: mapHeight }}>
                        <GeofenceMap
                            locations={locations}
                            position={position}
                            className="h-full w-full"
                            onTilesFailed={() => setFailed(true)}
                        />
                    </div>
                </MapBoundary>
            )}
            {sketch && (failed || !online) && (
                <p
                    role="status"
                    className="absolute bottom-9 left-4 max-w-[70%] rounded-full bg-surface/90 px-3 py-1 text-[13px] leading-5 text-text-muted"
                >
                    {online
                        ? 'Peta tidak dapat dimuat. Menampilkan sketsa lokasi.'
                        : 'Anda sedang offline. Menampilkan sketsa lokasi.'}
                </p>
            )}
        </div>
    );
}
