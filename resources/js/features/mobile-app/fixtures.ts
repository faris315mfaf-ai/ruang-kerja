import type {
    BiometricPolicy,
    Device,
    FaceConsent,
    FaceTemplate,
    LockNotification,
    QuickCreated,
    ShiftToday,
    SyncItem,
    WidgetTask,
} from './types';

/**
 * Sample data for the Fase 3 phone previews. "Today" is Monday 5 Oct 2026
 * (Asia/Jakarta); the signed-in person is Dimas (Kepala Divisi Operasional).
 * Times are stored in UTC like the database (07.52 WIB = 00:52Z).
 */
export const NOW = '2026-10-05T00:52:00Z';

export const PERSONA = {
    id: 'usr_dimas',
    name: 'Dimas Pratama',
    firstName: 'Dimas',
    role: 'Kepala Divisi Operasional',
} as const;

export const SHIFT_TODAY: ShiftToday = {
    name: 'Reguler 08–17',
    start: '08.00',
    end: '17.00',
    location: 'Kantor Pusat',
    distance_m: 38,
    radius_m: 100,
};

export const BIOMETRIC_POLICY: BiometricPolicy = {
    version: 'v1.0',
    published_on: '2026-10-01',
    points: [
        'Wajah Anda diubah menjadi template angka di ponsel. Foto wajah tidak disimpan.',
        'Template disimpan terenkripsi dan hanya dipakai untuk check-in. Tidak untuk penilaian kinerja.',
        'Hanya Anda yang bisa mendaftarkan atau menghapus data wajah. HR tidak bisa melihatnya.',
        'Persetujuan bisa dicabut kapan saja di Pengaturan › Perangkat. Template ikut terhapus otomatis.',
        'Jika tidak setuju, Anda tetap bisa check-in dengan GPS + selfie atau QR.',
    ],
};

export const FACE_CONSENT: FaceConsent = {
    id: 'cns_face_01',
    type: 'face',
    version: 'v1.0',
    granted_at: '2026-10-01T01:10:00Z',
    revoked_at: null,
};

export const FACE_TEMPLATE: FaceTemplate = {
    id: 'fct_01',
    user_id: PERSONA.id,
    model_version: 'FaceNet-lite 2.1',
    consent_id: FACE_CONSENT.id,
    created_at: '2026-10-01T01:12:00Z',
};

export const DEVICES: Device[] = [
    {
        id: 'dev_iphone13',
        user_id: PERSONA.id,
        platform: 'ios',
        name: 'iPhone 13',
        os_version: 'iOS 18.6',
        app_version: '1.0.0 (42)',
        integrity_verdict: { checked_at: '2026-10-05T00:41:00Z', failed: [] },
        last_seen_at: '2026-10-05T00:47:00Z',
        is_trusted: true,
        is_current: true,
        biometric_login: true,
    },
    {
        id: 'dev_galaxy_a54',
        user_id: PERSONA.id,
        platform: 'android',
        name: 'Samsung Galaxy A54',
        os_version: 'Android 15',
        app_version: '1.0.0 (42)',
        integrity_verdict: { checked_at: '2026-10-02T09:15:00Z', failed: [] },
        last_seen_at: '2026-10-02T09:15:00Z',
        is_trusted: true,
        is_current: false,
        biometric_login: false,
    },
    {
        id: 'dev_redmi_note12',
        user_id: PERSONA.id,
        platform: 'android',
        name: 'Xiaomi Redmi Note 12',
        os_version: 'Android 14',
        app_version: '0.9.4 (37)',
        integrity_verdict: {
            checked_at: '2026-09-14T23:58:00Z',
            failed: ['rooted', 'mock_location'],
            mock_app: 'Fake GPS Go',
        },
        last_seen_at: '2026-09-14T23:58:00Z',
        is_trusted: false,
        is_current: false,
        biometric_login: false,
    },
];

export const SYNC_QUEUE: SyncItem[] = [
    {
        id: 'q1',
        kind: 'check_in',
        title: 'Check-in dinas luar 07.50',
        meta: 'GPS di luar radius kantor · selfie 180 KB',
        queued_at: '2026-10-05T00:50:00Z',
        status: 'pending',
        attempts: 0,
    },
    {
        id: 'q2',
        kind: 'status',
        title: 'OPS-41 → Sedang dikerjakan',
        meta: 'Label farmasi tidak terbaca · 2 foto',
        queued_at: '2026-10-05T01:05:00Z',
        status: 'pending',
        attempts: 0,
        fails_once: true,
    },
    {
        id: 'q3',
        kind: 'comment',
        title: 'Komentar di OPS-38',
        meta: '“Printer label perlu driver versi baru”',
        queued_at: '2026-10-05T01:12:00Z',
        status: 'pending',
        attempts: 0,
    },
    {
        id: 'q4',
        kind: 'note',
        title: 'Catatan kunjungan RS Harapan Sehat',
        meta: '8 butir checklist UAT lulus',
        queued_at: '2026-10-05T01:30:00Z',
        status: 'pending',
        attempts: 0,
    },
];

export const LOCK_NOTIFICATIONS: LockNotification[] = [
    {
        id: 'n1',
        kind: 'check_in_reminder',
        title: 'Belum check-in',
        body: 'Shift Reguler mulai 08.00 · Anda di Kantor Pusat',
        time: 'sekarang',
        primary: 'Check-in sekarang',
        secondary: 'Nanti',
        href: '/absensi/wajah',
    },
    {
        id: 'n2',
        kind: 'leave_request',
        title: 'Pengajuan cuti · Sari Wulandari',
        body: 'Cuti tahunan 7–9 Okt (3 hari) · saldo cukup',
        time: '07.40',
        primary: 'Setujui',
        secondary: 'Lihat',
        needs_auth: true,
        href: '/persetujuan',
    },
    {
        id: 'n3',
        kind: 'overtime_group',
        title: '3 pengajuan lembur',
        body: 'Rizky, Maya, dan Yoga menunggu persetujuan Anda',
        time: '07.12',
        href: '/persetujuan',
    },
    {
        id: 'n4',
        kind: 'task',
        title: 'OPS-38 ditugaskan ke Anda',
        body: 'Hana: “Tolong cek ulang rekap lembur September”',
        time: '06.58',
        href: '/tugas',
    },
];

export const WIDGET_TASKS: WidgetTask[] = [
    {
        id: 't1',
        key: 'OPS-38',
        title: 'Rekap lembur September',
        done: false,
        overdue: true,
    },
    {
        id: 't2',
        key: 'OPS-41',
        title: 'Cek printer label gudang',
        done: false,
        overdue: true,
    },
    {
        id: 't3',
        key: 'OPS-44',
        title: 'Jadwal shift minggu depan',
        done: false,
        overdue: false,
    },
    {
        id: 't4',
        key: 'OPS-29',
        title: 'Briefing tim pagi',
        done: true,
        overdue: false,
    },
    {
        id: 't5',
        key: 'OPS-31',
        title: 'Balas vendor ATK',
        done: true,
        overdue: false,
    },
    {
        id: 't6',
        key: 'OPS-35',
        title: 'Review SOP gudang',
        done: true,
        overdue: false,
    },
    {
        id: 't7',
        key: 'OPS-46',
        title: 'Update PIC proyek gudang',
        done: false,
        overdue: false,
    },
];

export const QUICK_CREATED: QuickCreated[] = [
    {
        id: 'qc1',
        kind: 'note',
        title: 'Catatan: stok kardus tinggal 40',
        meta: 'Workspace Operasional',
        created_at: '2026-10-05T00:31:00Z',
    },
    {
        id: 'qc2',
        kind: 'task',
        title: 'OPS-46 Update PIC proyek gudang',
        meta: 'Workspace Operasional · tenggat hari ini',
        created_at: '2026-10-04T10:05:00Z',
    },
];

/** Remaining annual leave shown in the quick-add hint. */
export const LEAVE_BALANCE_DAYS = 7;
