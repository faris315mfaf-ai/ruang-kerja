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
