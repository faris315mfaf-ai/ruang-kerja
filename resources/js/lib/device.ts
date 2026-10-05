const STORAGE_KEY = 'rk-device-id';

let fallback: string | null = null;

function randomId(): string {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Stable random id of this browser install, sent with check-ins so HR can see
 * "perangkat baru" (FraudDetector). Contains no personal or hardware data.
 */
export function deviceId(): string {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);

        if (stored) {
            return stored;
        }

        const id = randomId();
        window.localStorage.setItem(STORAGE_KEY, id);

        return id;
    } catch {
        fallback ??= randomId();

        return fallback;
    }
}
