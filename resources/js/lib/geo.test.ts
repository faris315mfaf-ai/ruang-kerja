import { describe, expect, it } from 'vite-plus/test';
import { distanceMeters, formatDistance, nearestLocation } from './geo';

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
