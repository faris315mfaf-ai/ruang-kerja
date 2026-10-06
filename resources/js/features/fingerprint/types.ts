/**
 * ZKTeco fingerprint devices pushing logs over ADMS/iclock (Fase 3,
 * docs/PRD.md §7 "Mesin fingerprint", docs/DATABASE.md §8 `devices`). Punches
 * become `attendance_logs` with `method = fingerprint`. Shapes mirror what a
 * future controller would send as props.
 */

export type PersonRef = { id: string; name: string };

export type OfficeLocationRef = { id: string; name: string };

/** Derived from the last push: online ≤ 5 min, pending = never pushed. */
export type DeviceStatus = 'online' | 'offline' | 'pending';

export type DeviceTimezone = 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura';

export type FingerprintDevice = {
    id: string;
    name: string;
    /** Serial number reported by the device in every iclock request. */
    serial_number: string;
    model: string | null;
    firmware: string | null;
    office_location: OfficeLocationRef;
    ip_address: string | null;
    timezone: DeviceTimezone;
    last_push_at: string | null;
    /** Users (fingerprint templates) enrolled on the device. */
    users_count: number;
    created_at: string;
};

export type VerifyType = 'fingerprint' | 'face' | 'card' | 'password';

export type PunchState = 'check_in' | 'check_out';

/** One ATTLOG line received from a device. */
export type DevicePunch = {
    id: string;
    device_id: string;
    /** User id on the device (PIN). */
    pin: string;
    /** Mapped employee, null when the PIN is not mapped yet. */
    user: PersonRef | null;
    punched_at: string;
    verify_type: VerifyType;
    punch_state: PunchState;
};

/** PIN on a device ↔ employee. */
export type PinMapping = {
    device_id: string;
    pin: string;
    /** Name stored on the device (USERINFO). */
    device_name: string;
    user: PersonRef | null;
};

export type FingerprintPageProps = {
    now: string;
    devices: FingerprintDevice[];
    punches: DevicePunch[];
    mappings: PinMapping[];
    locations: OfficeLocationRef[];
    employees: PersonRef[];
};
