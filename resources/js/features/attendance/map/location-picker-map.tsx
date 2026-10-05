import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import {
    Circle,
    MapContainer,
    Marker,
    ScaleControl,
    TileLayer,
    useMap,
    useMapEvents,
} from 'react-leaflet';
import './map.css';

type Props = {
    latitude: number;
    longitude: number;
    radiusM: number;
    onChange: (latitude: number, longitude: number) => void;
    className?: string;
};

const pinIcon = L.divIcon({
    className: 'rk-pin-icon',
    html: '<span class="rk-pin"></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
});

function ClickToMove({ onChange }: Pick<Props, 'onChange'>) {
    useMapEvents({
        click(event) {
            onChange(event.latlng.lat, event.latlng.lng);
        },
    });

    return null;
}

function FollowCenter({
    latitude,
    longitude,
    radiusM,
}: Omit<Props, 'onChange' | 'className'>) {
    const map = useMap();
    const previous = useRef<string | null>(null);

    useEffect(() => {
        const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

        // Recenter only when the point moved outside the current view (e.g. typed coordinates).
        if (
            previous.current !== key &&
            !map.getBounds().contains([latitude, longitude])
        ) {
            map.fitBounds(L.latLng(latitude, longitude).toBounds(radiusM * 3));
        }

        previous.current = key;
    }, [map, latitude, longitude, radiusM]);

    return null;
}

/**
 * Admin map to place a geofence: drag the pin or click the map; the circle
 * shows the radius (mockup LokasiShift).
 */
export default function LocationPickerMap({
    latitude,
    longitude,
    radiusM,
    onChange,
    className,
}: Props) {
    const handlers = useMemo<L.LeafletEventHandlerFnMap>(
        () => ({
            dragend(event) {
                const marker = event.target as L.Marker;
                const next = marker.getLatLng();
                onChange(next.lat, next.lng);
            },
        }),
        [onChange],
    );

    return (
        <MapContainer
            center={[latitude, longitude]}
            bounds={L.latLng(latitude, longitude).toBounds(radiusM * 3)}
            className={`rk-map z-0 ${className ?? ''}`}
            scrollWheelZoom
        >
            <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                maxZoom={19}
            />
            <Circle
                center={[latitude, longitude]}
                radius={radiusM}
                pathOptions={{ className: 'rk-geofence' }}
            />
            <Marker
                position={[latitude, longitude]}
                icon={pinIcon}
                draggable
                eventHandlers={handlers}
                alt="Titik pusat lokasi"
            />
            <ClickToMove onChange={onChange} />
            <FollowCenter
                latitude={latitude}
                longitude={longitude}
                radiusM={radiusM}
            />
            <ScaleControl position="bottomright" imperial={false} />
        </MapContainer>
    );
}
