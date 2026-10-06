import type {
    DevicePunch,
    DeviceStatus,
    DeviceTimezone,
    FingerprintDevice,
    PinMapping,
    VerifyType,
} from './types';

/** A device counts as online when it pushed within this window. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function deviceStatus(
    device: FingerprintDevice,
    now: string,
): DeviceStatus {
    if (!device.last_push_at) {
        return 'pending';
    }

    const age = Date.parse(now) - Date.parse(device.last_push_at);

    return age <= ONLINE_WINDOW_MS ? 'online' : 'offline';
}

export const STATUS_LABELS: Record<DeviceStatus, string> = {
    online: 'Online',
    offline: 'Offline',
    pending: 'Menunggu push pertama',
};

export const VERIFY_LABELS: Record<VerifyType, string> = {
    fingerprint: 'Sidik jari',
    face: 'Wajah',
    card: 'Kartu',
    password: 'Sandi',
};

export const TIMEZONES: { value: DeviceTimezone; label: string }[] = [
    { value: 'Asia/Jakarta', label: 'WIB · Asia/Jakarta' },
    { value: 'Asia/Makassar', label: 'WITA · Asia/Makassar' },
    { value: 'Asia/Jayapura', label: 'WIT · Asia/Jayapura' },
];

/** ADMS "Cloud Server Setting" values for the device, from the app URL. */
export function admsSettings(appUrl: string) {
    const url = new URL(appUrl);
    const https = url.protocol === 'https:';

    return {
        server: url.hostname,
        port: url.port || (https ? '443' : '80'),
        https,
        endpoint: `${url.origin}/iclock/cdata`,
    };
}

export type DeviceDraft = {
    serial_number: string;
    name: string;
    location_id: string;
    timezone: DeviceTimezone;
};

export type DeviceDraftErrors = Partial<Record<keyof DeviceDraft, string>>;

/** Normalises a serial number as printed on the device label. */
export function normalizeSerial(value: string): string {
    return value.replace(/[\s-]/g, '').toUpperCase();
}

export function validateDeviceDraft(
    draft: DeviceDraft,
    existing: FingerprintDevice[],
): DeviceDraftErrors {
    const errors: DeviceDraftErrors = {};
    const serial = normalizeSerial(draft.serial_number);

    if (serial === '') {
        errors.serial_number = 'Isi nomor seri (SN) dari label mesin.';
    } else if (!/^[A-Z0-9]{8,20}$/.test(serial)) {
        errors.serial_number = 'Nomor seri 8–20 huruf/angka.';
    } else if (existing.some((device) => device.serial_number === serial)) {
        errors.serial_number = 'Mesin dengan nomor seri ini sudah terdaftar.';
    }

    if (draft.name.trim().length < 3) {
        errors.name = 'Beri nama minimal 3 karakter, mis. "Lobi Kantor Pusat".';
    }

    if (!draft.location_id) {
        errors.location_id = 'Pilih lokasi kantor.';
    }

    return errors;
}

export function unmappedCount(
    mappings: PinMapping[],
    deviceId?: string,
): number {
    return mappings.filter(
        (mapping) =>
            !mapping.user && (!deviceId || mapping.device_id === deviceId),
    ).length;
}

/** Punches on the office date of `now` (Asia/Jakarta). */
export function punchesToday(
    punches: DevicePunch[],
    now: string,
): DevicePunch[] {
    const day = (iso: string) =>
        new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

    return punches.filter((item) => day(item.punched_at) === day(now));
}

/** Applies a PIN mapping to the list and to past punches with that PIN. */
export function mapPin(
    mappings: PinMapping[],
    punches: DevicePunch[],
    target: { device_id: string; pin: string },
    user: PinMapping['user'],
) {
    const same = (item: { device_id: string; pin: string }) =>
        item.device_id === target.device_id && item.pin === target.pin;

    return {
        mappings: mappings.map((item) =>
            same(item) ? { ...item, user } : item,
        ),
        punches: punches.map((item) => (same(item) ? { ...item, user } : item)),
    };
}
