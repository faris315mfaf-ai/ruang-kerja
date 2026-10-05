import { describe, expect, it } from 'vite-plus/test';
import {
    distanceMeters,
    formatDistance,
    nearestLocation,
    sketchLayout,
} from './geo';

const office = {
    id: 'a',
    name: 'Kantor Pusat',
    latitude: -6.2,
    longitude: 106.816666,
    radiusM: 100,
};

describe('distanceMeters', () => {
    it('matches the server haversine', () => {
        expect(
            distanceMeters(
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 0 },
            ),
        ).toBeCloseTo(111_195.08, 0);
        expect(distanceMeters(office, office)).toBe(0);
    });

    it('measures a few hundred metres', () => {
        const point = {
            latitude: -6.2 + 340 / 111_195.08,
            longitude: 106.816666,
        };

        expect(Math.round(distanceMeters(point, office))).toBe(340);
    });
});

describe('nearestLocation', () => {
    it('prefers a location whose radius contains the point', () => {
        const warehouse = {
            ...office,
            id: 'b',
            name: 'Gudang',
            latitude: -6.203,
            radiusM: 500,
        };
        const match = nearestLocation([office, warehouse], {
            latitude: -6.201,
            longitude: 106.816666,
        });

        expect(match?.location.name).toBe('Gudang');
        expect(match?.inside).toBe(true);
    });

    it('falls back to the closest location', () => {
        const match = nearestLocation([office], {
            latitude: -6.2031,
            longitude: 106.816666,
        });

        expect(match?.inside).toBe(false);
        expect(Math.round(match?.distanceM ?? 0)).toBe(345);
    });

    it('returns null without locations', () => {
        expect(nearestLocation([], { latitude: 0, longitude: 0 })).toBeNull();
    });
});

describe('formatDistance', () => {
    it('uses metres then kilometres', () => {
        expect(formatDistance(38.4)).toBe('38 m');
        expect(formatDistance(1234)).toBe('1,2 km');
    });
});

describe('sketchLayout', () => {
    const near = { latitude: -6.2 + 38 / 111_195, longitude: 106.816666 };

    it('fills the frame height with the geofence when there is no position', () => {
        expect(sketchLayout(office, null, 400, 120)).toEqual({
            radius: 48,
            marker: null,
        });
    });

    it('places a position inside the radius at scale, north is up', () => {
        const { radius, marker } = sketchLayout(office, near, 400, 120);

        expect(radius).toBeCloseTo(48, 5);
        expect(marker?.clamped).toBe(false);
        expect(marker?.x).toBeCloseTo(200, 3);
        // 38 m of 100 m radius → 0.38 × 48 units above the centre.
        expect(marker?.y).toBeCloseTo(60 - 0.38 * 48, 1);
    });

    it('keeps a position east of the radius at scale (the frame is wide)', () => {
        const east = { latitude: -6.2, longitude: 106.816666 + 0.0018 }; // ~199 m east
        const { radius, marker } = sketchLayout(office, east, 400, 120);

        expect(radius).toBeCloseTo(48, 5);
        expect(marker?.clamped).toBe(false);
        expect(marker!.x).toBeGreaterThan(200 + radius);
    });

    it('shrinks the circle to fit a position north of the radius', () => {
        const north = { latitude: -6.2 + 150 / 111_195, longitude: 106.816666 };
        const { radius, marker } = sketchLayout(office, north, 400, 120);

        expect(radius).toBeCloseTo(32, 0);
        expect(marker?.clamped).toBe(false);
        expect(marker!.y).toBeCloseTo(12, 0);
    });

    it('pins a far-away position to the frame edge in its direction', () => {
        const bandung = { latitude: -6.91, longitude: 107.61 };
        const { radius, marker } = sketchLayout(office, bandung, 400, 120);

        expect(radius).toBe(16);
        expect(marker?.clamped).toBe(true);
        expect(marker!.x).toBeGreaterThan(200);
        expect(marker!.y).toBeCloseTo(108, 5);
    });
});
