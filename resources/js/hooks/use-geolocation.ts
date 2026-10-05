import { useCallback, useEffect, useRef, useState } from 'react';

export type GeoPosition = {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
};

export type GeolocationState =
    | 'idle'
    | 'locating'
    | 'ready'
    | 'denied'
    | 'unavailable'
    | 'timeout'
    | 'unsupported';

/** Location request timeout (docs/PROMPTS.md Sprint 2). */
export const GEOLOCATION_TIMEOUT_MS = 15_000;

export const GEOLOCATION_MESSAGES: Record<
    Exclude<GeolocationState, 'idle' | 'locating' | 'ready'>,
    string
> = {
    denied: 'Akses lokasi ditolak. Izinkan lokasi untuk situs ini di pengaturan browser, lalu coba lagi.',
    unavailable:
        'Lokasi tidak tersedia. Pastikan GPS/lokasi perangkat menyala.',
    timeout:
        'Lokasi tidak terbaca dalam 15 detik. Coba di dekat jendela atau tempat terbuka.',
    unsupported:
        'Browser ini tidak mendukung lokasi. Pakai Chrome atau Safari versi terbaru.',
};

export function geolocationErrorState(code: number): GeolocationState {
    switch (code) {
        case 1:
            return 'denied';
        case 3:
            return 'timeout';
        default:
            return 'unavailable';
    }
}

/**
 * One-shot high-accuracy location for check-in. Location is only read when
 * the employee starts a check-in/out or taps "Perbarui lokasi" (UU PDP).
 */
export function useGeolocation() {
    const [state, setState] = useState<GeolocationState>('idle');
    const [position, setPosition] = useState<GeoPosition | null>(null);
    const pending = useRef<Promise<GeoPosition | null> | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const request = useCallback((): Promise<GeoPosition | null> => {
        if (pending.current) {
            return pending.current;
        }

        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
            setState('unsupported');

            return Promise.resolve(null);
        }

        setState('locating');

        pending.current = new Promise<GeoPosition | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (result) => {
                    const next = {
                        latitude: result.coords.latitude,
                        longitude: result.coords.longitude,
                        accuracy: result.coords.accuracy,
                        timestamp: result.timestamp,
                    };

                    if (mounted.current) {
                        setPosition(next);
                        setState('ready');
                    }

                    resolve(next);
                },
                (error) => {
                    if (mounted.current) {
                        setState(geolocationErrorState(error.code));
                    }

                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: GEOLOCATION_TIMEOUT_MS,
                    maximumAge: 0,
                },
            );
        }).finally(() => {
            pending.current = null;
        });

        return pending.current;
    }, []);

    const error =
        state === 'denied' ||
        state === 'unavailable' ||
        state === 'timeout' ||
        state === 'unsupported'
            ? GEOLOCATION_MESSAGES[state]
            : null;

    return { state, position, error, request };
}
