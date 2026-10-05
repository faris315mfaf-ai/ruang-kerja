/** Client-side geofence preview; the server (GeofenceService) decides. */

export type LatLng = { latitude: number; longitude: number };

export type GeofenceTarget = LatLng & { radiusM: number };

/** Mean Earth radius (IUGG), metres — same as App\Domain\Attendance\Services\GeofenceService. */
export const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Haversine great-circle distance in metres. */
export function distanceMeters(from: LatLng, to: LatLng): number {
    const dLat = toRad(to.latitude - from.latitude);
    const dLng = toRad(to.longitude - from.longitude);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(from.latitude)) *
            Math.cos(toRad(to.latitude)) *
            Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type GeofenceMatch<T extends GeofenceTarget> = {
    location: T;
    distanceM: number;
    inside: boolean;
};

/** Closest location containing the point, else the closest one overall. */
export function nearestLocation<T extends GeofenceTarget>(
    locations: readonly T[],
    point: LatLng,
): GeofenceMatch<T> | null {
    let bestInside: GeofenceMatch<T> | null = null;
    let bestOverall: GeofenceMatch<T> | null = null;

    for (const location of locations) {
        const distanceM = distanceMeters(point, location);
        const match = {
            location,
            distanceM,
            inside: distanceM <= location.radiusM,
        };

        if (match.inside && (!bestInside || distanceM < bestInside.distanceM)) {
            bestInside = match;
        }

        if (!bestOverall || distanceM < bestOverall.distanceM) {
            bestOverall = match;
        }
    }

    return bestInside ?? bestOverall;
}

/** "38 m", "1,2 km". */
export function formatDistance(metres: number): string {
    if (metres < 1000) {
        return `${Math.round(metres)} m`;
    }

    return `${(metres / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
}

/** East/north offset of `point` from `origin` in metres (local flat approximation). */
export function offsetMeters(
    origin: LatLng,
    point: LatLng,
): { east: number; north: number } {
    return {
        east:
            toRad(point.longitude - origin.longitude) *
            EARTH_RADIUS_M *
            Math.cos(toRad(origin.latitude)),
        north: toRad(point.latitude - origin.latitude) * EARTH_RADIUS_M,
    };
}

export type SketchLayout = {
    /** Geofence circle radius in sketch units. */
    radius: number;
    /** Position marker, clamped inside the frame (null without a position). */
    marker: { x: number; y: number; clamped: boolean } | null;
};

/**
 * Lays out the Absensi mini map (a schematic, no map tiles): the geofence is
 * centred in a `width` × `height` frame and scaled so that the circle and the
 * employee's position both fit; a position too far away to show at a useful
 * scale sits on the frame edge in its real direction.
 */
export function sketchLayout(
    target: GeofenceTarget,
    position: LatLng | null,
    width: number,
    height: number,
    padding = 12,
): SketchLayout {
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = cy - padding;
    // The circle never shrinks below a third of the frame height.
    const minRadius = Math.max(8, maxRadius / 3);

    if (!position) {
        return { radius: maxRadius, marker: null };
    }

    const { east, north } = offsetMeters(target, position);
    const extentX = Math.max(target.radiusM, Math.abs(east));
    const extentY = Math.max(target.radiusM, Math.abs(north));
    const scale = Math.min(
        (cx - padding) / extentX,
        (cy - padding) / extentY,
        maxRadius / target.radiusM,
    );
    const radius = Math.max(minRadius, target.radiusM * scale);
    const metresPerUnit = target.radiusM / radius;
    let x = cx + east / metresPerUnit;
    let y = cy - north / metresPerUnit;
    const clamped =
        x < padding ||
        x > width - padding ||
        y < padding ||
        y > height - padding;

    if (clamped) {
        // Walk back towards the centre along the same direction until inside.
        const dx = x - cx;
        const dy = y - cy;
        const factor = Math.min(
            dx === 0 ? Infinity : (cx - padding) / Math.abs(dx),
            dy === 0 ? Infinity : (cy - padding) / Math.abs(dy),
        );
        x = cx + dx * factor;
        y = cy + dy * factor;
    }

    return { radius, marker: { x, y, clamped } };
}
