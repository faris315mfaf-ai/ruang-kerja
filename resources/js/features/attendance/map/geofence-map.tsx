import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import {
    Circle,
    MapContainer,
    Marker,
    Polyline,
    TileLayer,
    Tooltip,
    useMap,
} from 'react-leaflet';
import { formatDistance, nearestLocation } from '@/lib/geo';
import type { OfficeLocationPoint } from '@/types/attendance';
import './map.css';

export type MapPosition = {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
};

type Props = {
    locations: OfficeLocationPoint[];
    position?: MapPosition | null;
    /** Draw the dashed line + distance label to the nearest location when outside. */
    showDistance?: boolean;
    /** Show location names under the geofence. */
    showLabels?: boolean;
    interactive?: boolean;
    className?: string;
};

const officeIcon = L.divIcon({
    className: 'rk-office-icon',
    html: '<span class="rk-office-dot"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
});

const userIcon = L.divIcon({
    className: 'rk-user-icon',
    html: '<span class="rk-user-dot"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

const DEFAULT_CENTER: L.LatLngTuple = [-6.2, 106.816666];

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
    const map = useMap();

    useEffect(() => {
        if (bounds?.isValid()) {
            map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
        }
    }, [map, bounds]);

    return null;
}

/**
 * OpenStreetMap view of office geofences and the employee's position
 * (screens Absensi, CheckinGagal). Loaded lazily: Leaflet is ~40 KB gzip.
 */
export default function GeofenceMap({
    locations,
    position,
    showDistance = false,
    showLabels = false,
    interactive = false,
    className,
}: Props) {
    const match = position ? nearestLocation(locations, position) : null;

    const bounds = useMemo(() => {
        const points: L.LatLngExpression[] = [];
        const focus = match ? [match.location] : locations;

        for (const location of focus) {
            const circle = L.latLng(
                location.latitude,
                location.longitude,
            ).toBounds(location.radiusM * 2);
            points.push(circle.getNorthEast(), circle.getSouthWest());
        }

        if (position) {
            points.push([position.latitude, position.longitude]);
        }

        return points.length > 0 ? L.latLngBounds(points) : null;
    }, [locations, match, position]);

    const center: L.LatLngTuple = position
        ? [position.latitude, position.longitude]
        : locations[0]
          ? [locations[0].latitude, locations[0].longitude]
          : DEFAULT_CENTER;

    return (
        <MapContainer
            center={center}
            zoom={17}
            className={`rk-map z-0 ${className ?? ''}`}
            zoomControl={interactive}
            dragging={interactive}
            scrollWheelZoom={false}
            doubleClickZoom={interactive}
            touchZoom={interactive}
            boxZoom={false}
            keyboard={interactive}
            attributionControl
        >
            <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                maxZoom={19}
            />
            {locations.map((location) => (
                <Circle
                    key={location.id}
                    center={[location.latitude, location.longitude]}
                    radius={location.radiusM}
                    pathOptions={{
                        className:
                            match && match.location.id !== location.id
                                ? 'rk-geofence rk-geofence--muted'
                                : 'rk-geofence',
                    }}
                >
                    {showLabels && (
                        <Tooltip
                            permanent
                            direction="bottom"
                            offset={[0, 6]}
                            className="rk-location-label"
                        >
                            {location.name}
                        </Tooltip>
                    )}
                </Circle>
            ))}
            {locations.map((location) => (
                <Marker
                    key={`${location.id}-center`}
                    position={[location.latitude, location.longitude]}
                    icon={officeIcon}
                    interactive={false}
                    keyboard={false}
                />
            ))}
            {position && (
                <>
                    {position.accuracy ? (
                        <Circle
                            center={[position.latitude, position.longitude]}
                            radius={position.accuracy}
                            pathOptions={{ className: 'rk-accuracy' }}
                        />
                    ) : null}
                    <Marker
                        position={[position.latitude, position.longitude]}
                        icon={userIcon}
                        interactive={false}
                        keyboard={false}
                        alt="Posisi Anda"
                    />
                </>
            )}
            {showDistance && position && match && !match.inside && (
                <Polyline
                    positions={[
                        [position.latitude, position.longitude],
                        [match.location.latitude, match.location.longitude],
                    ]}
                    pathOptions={{ className: 'rk-distance-line' }}
                >
                    <Tooltip
                        permanent
                        direction="center"
                        className="rk-distance-label"
                    >
                        {formatDistance(match.distanceM)}
                    </Tooltip>
                </Polyline>
            )}
            <FitBounds bounds={bounds} />
        </MapContainer>
    );
}
