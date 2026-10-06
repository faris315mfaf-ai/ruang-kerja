import type {
    AutomationProps,
    LabelRef,
    PerformanceProps,
    Person,
    RecurringProps,
    TemplatesProps,
    WhatsappSettings,
    WorkspaceRef,
} from '@/features/automation/types';

/**
 * Sample data for the F2-4 previews. "Today" is Monday 5 Oct 2026 (office
 * time); personas from docs/mockups/INDEX.md. Replace with controller props
 * of the same shape (types.ts) when the backend lands.
 */
export const TODAY = '2026-10-05';

export const PEOPLE: Person[] = [
    {
        id: '01J9P0DIMAS0000000000000001',
        name: 'Dimas Pratama',
        title: 'Kepala Divisi Operasional',
    },
    { id: '01J9P0HANA00000000000000002', name: 'Hana Pratiwi', title: 'HR' },
    {
        id: '01J9P0HENDRA00000000000003',
        name: 'Hendra Wijaya',
        title: 'Direktur Utama',
    },
    {
        id: '01J9P0RIZKY0000000000000004',
        name: 'Rizky Aditya',
        title: 'Staf Gudang',
    },
    {
        id: '01J9P0SARI00000000000000005',
        name: 'Sari Wulandari',
        title: 'Staf Data',
    },
    {
        id: '01J9P0MAYA00000000000000006',
        name: 'Maya Lestari',
        title: 'Staf Konten',
    },
];

const [DIMAS, HANA, , RIZKY, SARI, MAYA] = PEOPLE.map((p) => p.id);

export const WORKSPACES: WorkspaceRef[] = [
    {
        id: '01J9P0WSOPS00000000000000A',
        key: 'OPS',
        name: 'Divisi Operasional',
        color: 'teal',
    },
    {
        id: '01J9P0WSGDG00000000000000B',
        key: 'GDG',
        name: 'Tim Gudang',
        color: 'amber',
    },
    {
        id: '01J9P0WSPLQ00000000000000C',
        key: 'PLQ',
        name: 'Peluncuran Q4',
        color: 'violet',
    },
    {
        id: '01J9P0WSMSG00000000000000D',
        key: 'MSG',
        name: 'Migrasi sistem gudang',
        color: 'blue',
    },
];

const [OPS, GDG, PLQ, MSG] = WORKSPACES.map((w) => w.id);

export const LABELS: LabelRef[] = [
    { id: '01J9P0LBREV0000000000000001', name: 'Ditinjau', color: 'violet' },
    { id: '01J9P0LBURG0000000000000002', name: 'Mendesak', color: 'red' },
    { id: '01J9P0LBKLI0000000000000003', name: 'Klien', color: 'blue' },
    { id: '01J9P0LBRUT0000000000000004', name: 'Rutin', color: 'gray' },
    { id: '01J9P0LBKEU0000000000000005', name: 'Keuangan', color: 'green' },
    { id: '01J9P0LBDOK0000000000000006', name: 'Dokumentasi', color: 'teal' },
];

const [L_REVIEW, L_URGENT, L_CLIENT, L_ROUTINE, L_FINANCE, L_DOCS] = LABELS.map(
    (l) => l.id,
);

// ---------------------------------------------------------------------------

export const WHATSAPP: WhatsappSettings = {
    status: 'disconnected',
    phone: null,
    connected_at: null,
    quiet_hours: {
        enabled: true,
        start: '21:00',
        end: '06:00',
        allow_high_priority: true,
    },
    events: [
        {
            event: 'task.assigned',
            category: 'tasks',
            label: 'Ditugaskan tugas baru',
            description: 'Saat seseorang menugaskan tugas kepada Anda.',
            in_app: true,
            email: true,
            whatsapp: true,
            high_priority: false,
        },
        {
            event: 'mention',
            category: 'tasks',
            label: 'Disebut (@mention)',
            description: 'Di komentar atau deskripsi tugas.',
            in_app: true,
            email: true,
            whatsapp: false,
            high_priority: false,
        },
        {
            event: 'task.commented',
            category: 'tasks',
            label: 'Komentar di tugas yang saya ikuti',
            description: 'Digabung bila ada beberapa komentar berdekatan.',
            in_app: true,
            email: false,
            whatsapp: false,
            high_priority: false,
        },
        {
            event: 'task.due_soon',
            category: 'tasks',
            label: 'Tenggat H-1',
            description: 'Sehari sebelum tenggat, pukul 08.00.',
            in_app: true,
            email: true,
            whatsapp: true,
            high_priority: false,
        },
        {
            event: 'task.overdue',
            category: 'tasks',
            label: 'Tugas lewat tenggat',
            description: 'Sekali, pagi setelah tenggat terlewat.',
            in_app: true,
            email: true,
            whatsapp: false,
            high_priority: true,
        },
        {
            event: 'request.pending',
            category: 'requests',
            label: 'Pengajuan menunggu persetujuan saya',
            description: 'Digabung: "3 pengajuan baru".',
            in_app: true,
            email: true,
            whatsapp: true,
            high_priority: true,
        },
        {
            event: 'request.decided',
            category: 'requests',
            label: 'Status pengajuan saya',
            description: 'Disetujui, ditolak, atau diminta revisi.',
            in_app: true,
            email: true,
            whatsapp: true,
            high_priority: false,
        },
        {
            event: 'attendance.check_in_reminder',
            category: 'attendance',
            label: 'Pengingat check-in',
            description: '15 menit setelah jam masuk bila belum check-in.',
            in_app: true,
            email: false,
            whatsapp: true,
            high_priority: true,
        },
        {
            event: 'attendance.check_out_reminder',
            category: 'attendance',
            label: 'Pengingat check-out',
            description: '30 menit setelah jam pulang.',
            in_app: true,
            email: false,
            whatsapp: false,
            high_priority: false,
        },
        {
            event: 'digest.daily',
            category: 'digest',
            label: 'Ringkasan harian 07.30',
            description: 'Tugas hari ini, terlambat, dan persetujuan.',
            in_app: false,
            email: true,
            whatsapp: false,
            high_priority: false,
        },
    ],
    templates: [
        {
            event: 'task.assigned',
            name: 'tugas_baru_v1',
            body: '*RuangKerja* · Tugas baru\n{{1}} menugaskan *{{2}}* kepada Anda.\nTenggat: {{3}}.',
            sample: [
                'Dimas Pratama',
                'OPS-112 Rekap stok gudang',
                'Rab, 7 Okt 2026',
            ],
            button: 'Buka tugas',
        },
        {
            event: 'task.due_soon',
            name: 'tenggat_besok_v1',
            body: '*RuangKerja* · Tenggat besok\n*{{1}}* jatuh tempo {{2}}. Status sekarang: {{3}}.',
            sample: [
                'GDG-48 Opname rak B',
                'Sel, 6 Okt 2026',
                'Sedang dikerjakan',
            ],
            button: 'Buka tugas',
        },
        {
            event: 'request.pending',
            name: 'persetujuan_baru_v1',
            body: '*RuangKerja* · Persetujuan\n{{1}} pengajuan menunggu keputusan Anda: {{2}}.',
            sample: ['3', 'cuti Rizky, lembur Sari, izin Maya'],
            button: 'Buka persetujuan',
        },
        {
            event: 'request.decided',
            name: 'pengajuan_diputus_v1',
            body: '*RuangKerja* · Pengajuan {{1}}\n*{{2}}* {{3}} oleh {{4}}.',
            sample: [
                'CUT-2026-10-0012',
                'Cuti tahunan 12–14 Okt',
                'disetujui',
                'Dimas Pratama',
            ],
            button: 'Lihat pengajuan',
        },
        {
            event: 'attendance.check_in_reminder',
            name: 'pengingat_checkin_v1',
            body: '*RuangKerja* · Belum check-in\nShift {{1}} dimulai {{2}}. Check-in dari aplikasi bila sudah tiba.',
            sample: ['Reguler 08–17', '08.00'],
            button: 'Check-in',
        },
    ],
    provider: {
        name: null,
        options: ['Meta Cloud API (resmi)', 'Gateway pihak ketiga'],
        sender: null,
        daily_limit: null,
    },
};

/** Code the fake verification accepts (shown on screen; preview only). */
export const DEMO_OTP = '246810';

// ---------------------------------------------------------------------------

export const AUTOMATION: AutomationProps = {
    workspaces: WORKSPACES,
    labels: LABELS,
    people: PEOPLE,
    rules: [
        {
            id: '01J9P0RULE0000000000000001',
            name: 'Review selesai → kabari Kadiv',
            workspace_id: OPS,
            trigger: { type: 'task_moved', category: 'done' },
            condition: { type: 'priority', priority: 1 },
            actions: [
                { type: 'notify', target: { kind: 'user', id: DIMAS } },
                { type: 'add_label', label_id: L_REVIEW },
            ],
            is_active: true,
            last_run_at: '2026-10-05T02:12:00Z',
            run_count: 128,
            created_by: DIMAS,
        },
        {
            id: '01J9P0RULE0000000000000002',
            name: 'Terlambat → tandai mendesak',
            workspace_id: GDG,
            trigger: { type: 'task_overdue' },
            condition: null,
            actions: [
                { type: 'add_label', label_id: L_URGENT },
                { type: 'notify', target: { kind: 'assignees' } },
            ],
            is_active: true,
            last_run_at: '2026-10-05T00:30:00Z',
            run_count: 46,
            created_by: DIMAS,
        },
        {
            id: '01J9P0RULE0000000000000003',
            name: 'Label Klien → tugaskan ke Maya',
            workspace_id: PLQ,
            trigger: { type: 'task_created_with_label', label_id: L_CLIENT },
            condition: null,
            actions: [
                { type: 'assign', user_id: MAYA },
                { type: 'move_status', category: 'todo' },
            ],
            is_active: true,
            last_run_at: '2026-10-02T07:41:00Z',
            run_count: 19,
            created_by: DIMAS,
        },
        {
            id: '01J9P0RULE0000000000000004',
            name: 'Masuk review → beri tahu pengamat',
            workspace_id: MSG,
            trigger: { type: 'task_moved', category: 'review' },
            condition: null,
            actions: [{ type: 'notify', target: { kind: 'watchers' } }],
            is_active: false,
            last_run_at: '2026-09-18T09:05:00Z',
            run_count: 7,
            created_by: SARI,
        },
        {
            id: '01J9P0RULE0000000000000005',
            name: 'Keuangan → HR ikut tahu',
            workspace_id: OPS,
            trigger: { type: 'task_created_with_label', label_id: L_FINANCE },
            condition: { type: 'assignee', user_id: RIZKY },
            actions: [{ type: 'notify', target: { kind: 'role', role: 'hr' } }],
            is_active: true,
            last_run_at: null,
            run_count: 0,
            created_by: DIMAS,
        },
    ],
    runs: [
        {
            id: 'run-01',
            rule_id: '01J9P0RULE0000000000000001',
            task_key: 'OPS-112',
            task_title: 'Rekap stok gudang September',
            result: 'success',
            detail: 'Dimas diberi tahu, label Ditinjau ditambahkan.',
            ran_at: '2026-10-05T02:12:00Z',
        },
        {
            id: 'run-02',
            rule_id: '01J9P0RULE0000000000000002',
            task_key: 'GDG-48',
            task_title: 'Opname rak B',
            result: 'success',
            detail: 'Label Mendesak ditambahkan, 2 penanggung jawab diberi tahu.',
            ran_at: '2026-10-05T00:30:00Z',
        },
        {
            id: 'run-03',
            rule_id: '01J9P0RULE0000000000000002',
            task_key: 'GDG-51',
            task_title: 'Cek suhu cold storage',
            result: 'skipped',
            detail: 'Label Mendesak sudah ada.',
            ran_at: '2026-10-05T00:30:00Z',
        },
        {
            id: 'run-04',
            rule_id: '01J9P0RULE0000000000000001',
            task_key: 'OPS-109',
            task_title: 'SOP penerimaan barang',
            result: 'failed',
            detail: 'Label Ditinjau dihapus dari workspace. Perbarui aturan.',
            ran_at: '2026-10-03T08:20:00Z',
        },
        {
            id: 'run-05',
            rule_id: '01J9P0RULE0000000000000003',
            task_key: 'PLQ-18',
            task_title: 'Brief materi klien Sentosa',
            result: 'success',
            detail: 'Ditugaskan ke Maya, dipindah ke Todo.',
            ran_at: '2026-10-02T07:41:00Z',
        },
        {
            id: 'run-06',
            rule_id: '01J9P0RULE0000000000000001',
            task_key: 'OPS-104',
            task_title: 'Laporan pengiriman mingguan',
            result: 'success',
            detail: 'Dimas diberi tahu, label Ditinjau ditambahkan.',
            ran_at: '2026-10-01T10:02:00Z',
        },
        {
            id: 'run-07',
            rule_id: '01J9P0RULE0000000000000004',
            task_key: 'MSG-33',
            task_title: 'Uji migrasi data SKU',
            result: 'success',
            detail: '3 pengamat diberi tahu.',
            ran_at: '2026-09-18T09:05:00Z',
        },
    ],
};

// ---------------------------------------------------------------------------

export const RECURRING: RecurringProps = {
    workspaces: WORKSPACES,
    people: PEOPLE,
    recurring: [
        {
            id: '01J9P0REC00000000000000001',
            title: 'Rekap stok mingguan',
            workspace_id: GDG,
            assignee_id: RIZKY,
            priority: 3,
            pattern: { kind: 'weekly', weekdays: [1] },
            starts_on: '2026-08-03',
            ends_on: null,
            is_active: true,
            created_count: 10,
            last_created_on: '2026-10-05',
        },
        {
            id: '01J9P0REC00000000000000002',
            title: 'Cek suhu cold storage',
            workspace_id: GDG,
            assignee_id: RIZKY,
            priority: 2,
            pattern: { kind: 'daily', weekdays_only: true },
            starts_on: '2026-09-01',
            ends_on: null,
            is_active: true,
            created_count: 25,
            last_created_on: '2026-10-05',
        },
        {
            id: '01J9P0REC00000000000000003',
            title: 'Laporan bulanan divisi',
            workspace_id: OPS,
            assignee_id: SARI,
            priority: 2,
            pattern: { kind: 'monthly', day_of_month: 25 },
            starts_on: '2026-01-25',
            ends_on: null,
            is_active: true,
            created_count: 9,
            last_created_on: '2026-09-25',
        },
        {
            id: '01J9P0REC00000000000000004',
            title: 'Sinkron konten media sosial',
            workspace_id: PLQ,
            assignee_id: MAYA,
            priority: 3,
            pattern: { kind: 'every_n_weeks', interval: 2, weekdays: [2, 4] },
            starts_on: '2026-09-15',
            ends_on: '2026-12-31',
            is_active: true,
            created_count: 4,
            last_created_on: '2026-10-01',
        },
        {
            id: '01J9P0REC00000000000000005',
            title: 'Backup database gudang',
            workspace_id: MSG,
            assignee_id: null,
            priority: 4,
            pattern: { kind: 'weekly', weekdays: [5] },
            starts_on: '2026-07-03',
            ends_on: null,
            is_active: false,
            created_count: 8,
            last_created_on: '2026-08-21',
        },
    ],
};

// ---------------------------------------------------------------------------

const label = (id: string) => LABELS.find((l) => l.id === id)!;

export const TEMPLATES: TemplatesProps = {
    workspaces: WORKSPACES,
    task_templates: [
        {
            id: '01J9P0TPT00000000000000001',
            name: 'Penerimaan barang',
            description:
                'Langkah standar saat barang dari pemasok tiba di gudang.',
            title: 'Penerimaan barang dari [pemasok]',
            priority: 2,
            estimate_hours: 3,
            checklist: [
                'Cocokkan surat jalan dengan PO',
                'Periksa kondisi kemasan',
                'Hitung jumlah fisik',
                'Foto barang rusak (bila ada)',
                'Input ke sistem stok',
            ],
            labels: [label(L_ROUTINE)],
            used_count: 42,
        },
        {
            id: '01J9P0TPT00000000000000002',
            name: 'Onboarding karyawan baru',
            description: 'Disiapkan HR dan atasan sebelum hari pertama.',
            title: 'Onboarding [nama karyawan]',
            priority: 3,
            estimate_hours: 6,
            checklist: [
                'Buat akun Google Workspace',
                'Daftarkan di RuangKerja',
                'Siapkan perangkat kerja',
                'Jadwalkan perkenalan tim',
                'Atur shift & lokasi absensi',
                'Kirim dokumen kebijakan privasi',
            ],
            labels: [label(L_DOCS)],
            used_count: 7,
        },
        {
            id: '01J9P0TPT00000000000000003',
            name: 'Laporan bulanan',
            description: 'Rekap kinerja divisi untuk rapat Direksi.',
            title: 'Laporan bulanan [bulan]',
            priority: 2,
            estimate_hours: 4,
            checklist: [
                'Tarik data dashboard',
                'Tulis ringkasan',
                'Review Kadiv',
                'Kirim ke Direksi',
            ],
            labels: [label(L_REVIEW), label(L_FINANCE)],
            used_count: 9,
        },
        {
            id: '01J9P0TPT00000000000000004',
            name: 'Permintaan klien',
            description:
                'Tindak lanjut permintaan klien dengan tenggat 2 hari.',
            title: 'Permintaan [klien]: [ringkas]',
            priority: 1,
            estimate_hours: null,
            checklist: [
                'Konfirmasi kebutuhan',
                'Kerjakan',
                'Kirim hasil ke klien',
            ],
            labels: [label(L_CLIENT), label(L_URGENT)],
            used_count: 15,
        },
    ],
    workspace_templates: [
        {
            id: '01J9P0TPW00000000000000001',
            name: 'Proyek standar',
            description: 'Alur 5 kolom dengan review sebelum selesai.',
            type: 'project',
            statuses: [
                { name: 'Backlog', category: 'backlog', color: 'gray' },
                { name: 'Akan dikerjakan', category: 'todo', color: 'slate' },
                {
                    name: 'Sedang dikerjakan',
                    category: 'in_progress',
                    color: 'amber',
                },
                { name: 'Review', category: 'review', color: 'violet' },
                { name: 'Selesai', category: 'done', color: 'green' },
            ],
            labels: [label(L_CLIENT), label(L_URGENT), label(L_REVIEW)],
            used_count: 6,
        },
        {
            id: '01J9P0TPW00000000000000002',
            name: 'Operasional harian',
            description: 'Untuk tim yang banyak tugas rutin, tanpa review.',
            type: 'team',
            statuses: [
                { name: 'Hari ini', category: 'todo', color: 'blue' },
                { name: 'Dikerjakan', category: 'in_progress', color: 'amber' },
                { name: 'Beres', category: 'done', color: 'green' },
                { name: 'Batal', category: 'canceled', color: 'gray' },
            ],
            labels: [label(L_ROUTINE), label(L_URGENT)],
            used_count: 3,
        },
        {
            id: '01J9P0TPW00000000000000003',
            name: 'Kampanye konten',
            description: 'Dari ide sampai tayang, dengan persetujuan klien.',
            type: 'project',
            statuses: [
                { name: 'Ide', category: 'backlog', color: 'pink' },
                { name: 'Produksi', category: 'in_progress', color: 'orange' },
                {
                    name: 'Persetujuan klien',
                    category: 'review',
                    color: 'violet',
                },
                { name: 'Tayang', category: 'done', color: 'teal' },
            ],
            labels: [label(L_CLIENT), label(L_DOCS)],
            used_count: 2,
        },
    ],
};

// ---------------------------------------------------------------------------

export const PERFORMANCE: PerformanceProps = {
    periods: {
        '8w': {
            label: '8 minggu',
            due: 45,
            done_of_due: 37,
            done_with_due: 37,
            on_time: 33,
            lead_times: [
                1.5, 2, 2.2, 2.4, 2.6, 2.6, 2.8, 3, 3.5, 4.1, 1.2, 2.6, 5,
            ],
            division_lead_time: 3.2,
            scheduled_days: 21,
            on_time_days: 20,
            attendance_label: 'September',
        },
        month: {
            label: 'Bulan ini',
            due: 3,
            done_of_due: 2,
            done_with_due: 2,
            on_time: 2,
            lead_times: [1.8, 2.4],
            division_lead_time: 3.2,
            scheduled_days: 3,
            on_time_days: 3,
            attendance_label: 'Oktober',
        },
        quarter: {
            label: 'Kuartal',
            due: 78,
            done_of_due: 62,
            done_with_due: 62,
            on_time: 53,
            lead_times: [2, 2.5, 2.8, 3, 3.1, 2.8, 2.2, 4, 1.6],
            division_lead_time: 3.4,
            scheduled_days: 64,
            on_time_days: 60,
            attendance_label: 'Jul–Sep',
        },
    },
    weeks: [
        { week_start: '2026-08-17', on_time: 4, late: 1 },
        { week_start: '2026-08-24', on_time: 5, late: 0 },
        { week_start: '2026-08-31', on_time: 3, late: 1 },
        { week_start: '2026-09-07', on_time: 5, late: 0 },
        { week_start: '2026-09-14', on_time: 4, late: 1 },
        { week_start: '2026-09-21', on_time: 5, late: 0 },
        { week_start: '2026-09-28', on_time: 4, late: 1 },
        { week_start: '2026-10-05', on_time: 3, late: 0 },
    ],
    by_workspace: [
        { workspace: WORKSPACES[3], done: 16 },
        { workspace: WORKSPACES[1], done: 11 },
        { workspace: WORKSPACES[2], done: 6 },
        { workspace: WORKSPACES[0], done: 4 },
    ],
    overdue: [
        {
            key: 'PLQ-15',
            title: 'Draf rilis pers peluncuran',
            due_date: '2026-10-02',
        },
        { key: 'GDG-48', title: 'Opname rak B', due_date: '2026-10-03' },
    ],
    attendance: {
        month_label: 'September',
        on_time_rate: 95,
        average_check_in: '07.52',
    },
};

/** Ids used by the forms' defaults. */
export const DEFAULT_IDS = { DIMAS, HANA, OPS, GDG };
