/**
 * Kiosk QR helpers (docs/ARCHITECTURE.md §3.2). The server signs and validates
 * the code; the client only recognises it and times the refresh.
 */

export const KIOSK_SCHEME = 'ruangkerja://checkin?';

/** Whether a scanned text looks like a RuangKerja kiosk code. */
export function isKioskPayload(text: string): boolean {
    const value = text.trim();

    if (!value.startsWith(KIOSK_SCHEME) || value.length > 512) {
        return false;
    }

    const params = new URLSearchParams(value.slice(KIOSK_SCHEME.length));

    return (
        /^[0-9a-z]{26}$/i.test(params.get('l') ?? '') &&
        /^\d+$/.test(params.get('w') ?? '') &&
        /^[0-9a-f]{32}$/.test(params.get('s') ?? '')
    );
}

/** Milliseconds between the server clock and this device (server − device). */
export function clockOffset(serverTime: string, receivedAt: number): number {
    const server = Date.parse(serverTime);

    return Number.isNaN(server) ? 0 : server - receivedAt;
}

/** Whole seconds until the code expires, never negative. */
export function secondsLeft(validUntil: string, serverNow: number): number {
    const until = Date.parse(validUntil);

    if (Number.isNaN(until)) {
        return 0;
    }

    return Math.max(0, Math.ceil((until - serverNow) / 1000));
}

/** Remaining share of the window, 0–1, for the countdown bar. */
export function remainingFraction(
    validFrom: string,
    validUntil: string,
    serverNow: number,
): number {
    const from = Date.parse(validFrom);
    const until = Date.parse(validUntil);

    if (Number.isNaN(from) || Number.isNaN(until) || until <= from) {
        return 0;
    }

    return Math.min(1, Math.max(0, (until - serverNow) / (until - from)));
}

/**
 * Delay before fetching the next code: just after the window ends (small
 * margin so the server is surely in the next window), at least 1 s.
 */
export function refreshDelay(validUntil: string, serverNow: number): number {
    const until = Date.parse(validUntil);

    if (Number.isNaN(until)) {
        return 5_000;
    }

    return Math.max(1_000, until - serverNow + 300);
}
