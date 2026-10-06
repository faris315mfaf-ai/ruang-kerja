import type {
    DevicePunch,
    FingerprintDevice,
    FingerprintPageProps,
    PersonRef,
    PinMapping,
    PunchState,
    VerifyType,
} from './types';

// Sample data. "Now" = Mon, 5 Oct 2026 08.45 WIB.

export const FINGERPRINT_NOW = '2026-10-05T01:45:00Z';

const person = (id: string, name: string): PersonRef => ({ id, name });

export const EMPLOYEES: PersonRef[] = [
    person('u-dimas', 'Dimas Pratama'),
    person('u-hana', 'Hana Nuraini'),
    person('u-hendra', 'Hendra Wijaya'),
    person('u-rizky', 'Rizky Aditya'),
    person('u-sari', 'Sari Wulandari'),
    person('u-maya', 'Maya Lestari'),
    person('u-tono', 'Tono Wibisono'),
    person('u-gilang', 'Gilang Ramadhan'),
    person('u-sekar', 'Sekar Ayu'),
];

const byId = (id: string) => EMPLOYEES.find((item) => item.id === id) ?? null;

export const LOCATIONS = [
    { id: 'loc-hq', name: 'Kantor Pusat' },
    { id: 'loc-wh', name: 'Gudang Cikarang' },
    { id: 'loc-rs', name: 'RS Harapan Sehat (on-site)' },
];

export const DEVICES: FingerprintDevice[] = [
    {
        id: 'dev-lobi',
        name: 'Lobi Kantor Pusat',
        serial_number: 'CQZ7232460123',
        model: 'SpeedFace-V5L',
        firmware: 'ZAM180 Ver 6.60',
        office_location: LOCATIONS[0],
        ip_address: '192.168.10.21',
        timezone: 'Asia/Jakarta',
        last_push_at: '2026-10-05T01:41:00Z',
        users_count: 41,
        created_at: '2026-09-14T03:00:00Z',
    },
    {
        id: 'dev-lt2',
        name: 'Lantai 2 Kantor Pusat',
        serial_number: 'CQZ7232460188',
        model: 'MB460',
        firmware: 'Ver 6.4.1',
        office_location: LOCATIONS[0],
        ip_address: '192.168.10.22',
        timezone: 'Asia/Jakarta',
        last_push_at: '2026-10-05T01:40:30Z',
        users_count: 38,
        created_at: '2026-09-14T03:20:00Z',
    },
    {
        id: 'dev-gudang',
        name: 'Gudang Cikarang',
        serial_number: 'BRM9201830045',
        model: 'K40 Pro',
        firmware: 'Ver 6.5.4',
        office_location: LOCATIONS[1],
        ip_address: '10.8.0.14',
        timezone: 'Asia/Jakarta',
        last_push_at: '2026-10-04T10:12:00Z',
        users_count: 9,
        created_at: '2026-09-21T02:00:00Z',
    },
    {
        id: 'dev-rs',
        name: 'Ruang tim RS Harapan Sehat',
        serial_number: 'CQZ7232460301',
        model: 'SpeedFace-V5L',
        firmware: null,
        office_location: LOCATIONS[2],
        ip_address: null,
        timezone: 'Asia/Jakarta',
        last_push_at: null,
        users_count: 0,
        created_at: '2026-10-02T07:00:00Z',
    },
];

const punch = (
    id: string,
    device: string,
    pin: string,
    userId: string | null,
    time: string,
    verify: VerifyType,
    state: PunchState = 'check_in',
): DevicePunch => ({
    id,
    device_id: device,
    pin,
    user: userId ? byId(userId) : null,
    punched_at: `2026-10-05T${time}:00Z`,
    verify_type: verify,
    punch_state: state,
});

/** Latest punches, newest first (UTC; 00.38 UTC = 07.38 WIB). */
export const PUNCHES: DevicePunch[] = [
    punch('p12', 'dev-lobi', '1107', null, '01:41', 'face'),
    punch('p11', 'dev-lt2', '1006', 'u-maya', '01:40', 'fingerprint'),
    punch('p10', 'dev-lobi', '1004', 'u-rizky', '01:31', 'fingerprint'),
    punch('p09', 'dev-lobi', '1093', null, '01:12', 'fingerprint'),
    punch('p08', 'dev-lt2', '1005', 'u-sari', '00:59', 'card'),
    punch('p07', 'dev-lobi', '1003', 'u-hendra', '00:55', 'face'),
    punch('p06', 'dev-lobi', '1001', 'u-dimas', '00:41', 'fingerprint'),
    punch('p05', 'dev-lt2', '1002', 'u-hana', '00:38', 'fingerprint'),
    punch('p04', 'dev-lobi', '1008', 'u-sekar', '00:36', 'fingerprint'),
    punch(
        'p03',
        'dev-gudang',
        '2001',
        'u-gilang',
        '10:11',
        'fingerprint',
        'check_out',
    ),
    punch(
        'p02',
        'dev-gudang',
        '2002',
        'u-tono',
        '10:02',
        'password',
        'check_out',
    ),
].map((item) =>
    // gudang punches happened yesterday afternoon (offline since)
    item.device_id === 'dev-gudang'
        ? {
              ...item,
              punched_at: item.punched_at.replace('2026-10-05', '2026-10-04'),
          }
        : item,
);

const map = (
    device: string,
    pin: string,
    name: string,
    userId: string | null,
): PinMapping => ({
    device_id: device,
    pin,
    device_name: name,
    user: userId ? byId(userId) : null,
});

export const MAPPINGS: PinMapping[] = [
    map('dev-lobi', '1001', 'DIMAS P', 'u-dimas'),
    map('dev-lobi', '1003', 'HENDRA W', 'u-hendra'),
    map('dev-lobi', '1004', 'RIZKY A', 'u-rizky'),
    map('dev-lobi', '1008', 'SEKAR', 'u-sekar'),
    map('dev-lobi', '1093', 'TONO W', null),
    map('dev-lobi', '1107', 'USER 1107', null),
    map('dev-lt2', '1002', 'HANA N', 'u-hana'),
    map('dev-lt2', '1005', 'SARI W', 'u-sari'),
    map('dev-lt2', '1006', 'MAYA L', 'u-maya'),
    map('dev-gudang', '2001', 'GILANG', 'u-gilang'),
    map('dev-gudang', '2002', 'TONO', 'u-tono'),
];

export const FINGERPRINT_PAGE: FingerprintPageProps = {
    now: FINGERPRINT_NOW,
    devices: DEVICES,
    punches: PUNCHES,
    mappings: MAPPINGS,
    locations: LOCATIONS,
    employees: EMPLOYEES,
};
