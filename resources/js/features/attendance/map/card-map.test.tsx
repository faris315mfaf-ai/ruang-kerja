import { cleanup, render, screen } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import type { OfficeLocationPoint } from '@/types/attendance';
import { CardMap } from './card-map';

const office: OfficeLocationPoint = {
    id: 'o1',
    name: 'Kantor Pusat',
    address: null,
    latitude: -6.2,
    longitude: 106.816666,
    radiusM: 100,
};

beforeEach(() => {
    // jsdom has no ResizeObserver (the sketch measures its width with one).
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('CardMap fallback', () => {
    it('shows the sketch with an explanation while offline', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

        render(<CardMap locations={[office]} position={null} height={200} />);

        expect(screen.getByRole('img', { name: /Sketsa lokasi/ })).toBeTruthy();
        expect(screen.getByRole('status').textContent).toContain('offline');
    });

    it('shows the sketch without a status line when there is nothing to map', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

        render(<CardMap locations={[]} position={null} height={200} />);

        expect(screen.getByRole('img', { name: /Sketsa lokasi/ })).toBeTruthy();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('keeps a skeleton for the map while Leaflet loads', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

        const { container } = render(
            <CardMap locations={[office]} position={null} height={200} />,
        );

        // Leaflet is loaded when idle: the sketch is not shown, a placeholder is.
        expect(screen.queryByRole('img', { name: /Sketsa lokasi/ })).toBeNull();
        expect(
            container.querySelector(
                '[class*="animate-pulse"], [data-slot="skeleton"]',
            ),
        ).not.toBeNull();
    });
});
