import type {
    ActionItem,
    ApprovedLeave,
    BusyBlock,
    GoogleSync,
    Holiday,
    Meeting,
    Minutes,
    Participant,
    Person,
    PersonId,
    Platform,
    Recurrence,
    RelatedDocument,
    TaskDue,
} from './types';

/**
 * Sample data for the meetings preview. "Today" is Monday 5 Oct 2026, 10.25
 * WIB; the viewer is Dimas Pratama (Kepala Divisi Operasional).
 */
export const NOW = '2026-10-05T10:25:00+07:00';
export const TODAY = '2026-10-05';
export const ME: PersonId = 'dimas';

export const PEOPLE: Person[] = [
    {
        id: 'dimas',
        name: 'Dimas Pratama',
        title: 'Kepala Divisi Operasional',
        division: 'Operasional',
    },
    { id: 'hana', name: 'Hana Nuraini', title: 'Kepala HR', division: 'HR' },
    {
        id: 'hendra',
        name: 'Hendra Wijaya',
        title: 'Direktur Utama',
        division: 'Direksi',
    },
    {
        id: 'agus',
        name: 'Agus Setiawan',
        title: 'Direktur',
        division: 'Direksi',
    },
    {
        id: 'rizky',
        name: 'Rizky Aditya',
        title: 'Staf Operasional',
        division: 'Operasional',
    },
    {
        id: 'sari',
        name: 'Sari Wulandari',
        title: 'Staf Gudang',
        division: 'Operasional',
    },
    {
        id: 'maya',
        name: 'Maya Lestari',
        title: 'Staf Marketing',
        division: 'Branding & Marketing',
    },
    {
        id: 'putri',
        name: 'Putri Ramadhani',
        title: 'Koordinator Branding',
        division: 'Branding & Marketing',
    },
    {
        id: 'bayu',
        name: 'Bayu Saputra',
        title: 'Staf Logistik',
        division: 'Operasional',
    },
    {
        id: 'fitri',
        name: 'Fitri Handayani',
        title: 'Staf Administrasi',
        division: 'Operasional',
    },
    {
        id: 'yoga',
        name: 'Yoga Permana',
        title: 'Programmer',
        division: 'Programming',
    },
    {
        id: 'nadia',
        name: 'Nadia Putri',
        title: 'Sekretaris Perusahaan',
        division: 'Sekretariat',
    },
    { id: 'rina', name: 'Rina Oktaviani', title: 'Analis', division: 'Analis' },
    {
        id: 'andi',
        name: 'Andi Kurniawan',
        title: 'Staf Gudang',
        division: 'Operasional',
    },
    {
        id: 'tono',
        name: 'Tono Wibowo',
        title: 'Pengemudi',
        division: 'Operasional',
    },
    {
        id: 'lina',
        name: 'Lina Marlina',
        title: 'Implementer',
        division: 'Implementer',
    },
    {
        id: 'hadi',
        name: 'Hadi Susanto',
        title: 'Staf Gudang',
        division: 'Operasional',
    },
    {
        id: 'wulan',
        name: 'Wulan Anggraini',
        title: 'Staf Pembelian',
        division: 'Operasional',
    },
];

const OPS_TEAM: PersonId[] = [
    'dimas',
    'rizky',
    'sari',
    'maya',
    'bayu',
    'yoga',
    'fitri',
    'rina',
    'nadia',
    'andi',
    'tono',
    'lina',
    'hadi',
    'wulan',
];

const at = (date: string, time: string) => `${date}T${time}:00+07:00`;

const going = (ids: PersonId[], rsvp: Participant['rsvp'] = 'accepted') =>
    ids.map((user_id): Participant => ({ user_id, rsvp }));

const event = (
    id: string,
    platform: Platform,
    synced = '2026-10-05T10:23:00+07:00',
) => ({
    google_event_id: `evt_${id.replace(/-/g, '')}`,
    calendar_id: 'primary',
    meet_link:
        platform === 'meet'
            ? `https://meet.google.com/${id.slice(0, 3)}-rkja-${id.length.toString().padStart(3, '0')}`
            : null,
    synced_at: synced,
});

type Draft = {
    id: string;
    title: string;
    date: string;
    start: string;
    end: string;
    platform: Platform;
    organizer: PersonId;
    participants: Participant[];
    agenda: string[];
    location?: string;
    join_url?: string;
    minute_taker?: PersonId | null;
    workspace?: Meeting['workspace'];
    recurrence?: Recurrence;
    minutes?: Meeting['minutes_status'];
    documents?: RelatedDocument[];
    note?: string;
    leadership?: boolean;
};

const OPS = { key: 'OPS', name: 'Divisi Operasional' };
const PLQ = { key: 'PLQ', name: 'Peluncuran Q4' };

function meeting(d: Draft): Meeting {
    return {
        id: d.id,
        title: d.title,
        starts_at: at(d.date, d.start),
        ends_at: at(d.date, d.end),
        platform: d.platform,
        location: d.location ?? null,
        join_url: d.join_url ?? null,
        organizer_id: d.organizer,
        minute_taker_id: d.minute_taker ?? null,
        workspace: d.workspace ?? null,
        participants: d.participants,
        agenda: d.agenda,
        recurrence: d.recurrence ?? 'none',
        reminders: [15, 5],
        calendar_event:
            d.platform === 'client' ? null : event(d.id, d.platform),
        documents: d.documents ?? [],
        minutes_status: d.minutes ?? 'none',
        note: d.note,
        leadership: d.leadership,
    };
}

const STANDUP_AGENDA = [
    'Status stok & gudang',
    'Tugas terlambat divisi',
    'Persiapan audit stok Oktober',
];

const standup = (
    id: string,
    date: string,
    minutes: Meeting['minutes_status'] = 'none',
) =>
    meeting({
        id,
        title: 'Stand-up Divisi Operasional',
        date,
        start: '09:00',
        end: '09:30',
        platform: 'meet',
        organizer: 'dimas',
        minute_taker: 'dimas',
        workspace: OPS,
        recurrence: 'mon_wed_fri',
        participants: going(OPS_TEAM),
        agenda: STANDUP_AGENDA,
        minutes,
        documents: [
            {
                id: 'rec-standup',
                name: 'Rekaman Meet · 28 menit',
                kind: 'video',
                source: 'Drive · Divisi Operasional',
            },
            {
                id: 'rekap-stok',
                name: 'Rekap stok September',
                kind: 'sheet',
                source: 'Sheets · dari OPS-142',
            },
        ],
    });

export const MEETINGS: Meeting[] = [
    // Past week, with final minutes.
    meeting({
        id: 'koordinasi-plq-28sep',
        title: 'Koordinasi peluncuran PLQ',
        date: '2026-09-28',
        start: '10:30',
        end: '11:30',
        platform: 'meet',
        organizer: 'putri',
        minute_taker: 'maya',
        workspace: PLQ,
        participants: going([
            'putri',
            'dimas',
            'maya',
            'sari',
            'hendra',
            'rizky',
        ]),
        agenda: [
            'Materi peluncuran',
            'Anggaran vendor video',
            'Jadwal presentasi ke Direksi',
        ],
        minutes: 'final',
    }),
    meeting({
        id: 'rapat-direksi-28sep',
        title: 'Rapat direksi mingguan',
        date: '2026-09-28',
        start: '10:00',
        end: '11:30',
        platform: 'room',
        location: 'Ruang Direksi Lt. 5',
        organizer: 'hendra',
        minute_taker: 'nadia',
        participants: going(['hendra', 'agus', 'hana', 'nadia']),
        agenda: [
            'Tender Dinas Kominfo',
            'Kebutuhan programmer KMB',
            'Go-live SIMRS',
            'Logo baru SPKD',
        ],
        minutes: 'final',
        leadership: true,
    }),
    meeting({
        id: 'sprint-review-rk',
        title: 'Sprint review RuangKerja',
        date: '2026-09-30',
        start: '14:00',
        end: '15:00',
        platform: 'meet',
        organizer: 'yoga',
        minute_taker: 'fitri',
        participants: going(['yoga', 'hendra', 'fitri', 'rina']),
        agenda: ['Demo fitur rapat', 'Rencana sprint berikutnya'],
        minutes: 'final',
        leadership: true,
    }),
    meeting({
        id: 'eskalasi-dep',
        title: 'Eskalasi proyek DEP',
        date: '2026-10-01',
        start: '13:00',
        end: '14:00',
        platform: 'room',
        location: 'Ruang Rapat Lt. 3',
        organizer: 'agus',
        minute_taker: 'rina',
        participants: going(['agus', 'hendra', 'rina', 'yoga']),
        agenda: ['Keterlambatan akses API Pemda', 'Opsi perpanjangan timeline'],
        minutes: 'final',
        leadership: true,
    }),
    meeting({
        id: 'retro-sprint5-kmb',
        title: 'Retro Sprint 5 KMB',
        date: '2026-10-02',
        start: '15:00',
        end: '16:00',
        platform: 'meet',
        organizer: 'yoga',
        minute_taker: 'yoga',
        participants: going(['yoga', 'rina', 'lina', 'agus']),
        agenda: ['Yang berjalan baik', 'Yang perlu diperbaiki'],
        minutes: 'final',
        leadership: true,
    }),
    meeting({
        id: 'golive-simrs',
        title: 'Persiapan go-live SIMRS',
        date: '2026-10-02',
        start: '09:00',
        end: '10:00',
        platform: 'zoom',
        join_url: 'https://zoom.us/j/81234567890',
        organizer: 'lina',
        minute_taker: 'lina',
        participants: going(['lina', 'dimas', 'yoga', 'agus']),
        agenda: ['Kesiapan server', 'Pelatihan pengguna RS'],
        minutes: 'final',
        leadership: true,
    }),

    // Monday 5 Oct (today).
    standup('standup-ops', TODAY, 'draft'),
    meeting({
        id: 'standup-lintas',
        title: 'Stand-up lintas divisi teknis',
        date: TODAY,
        start: '09:30',
        end: '10:00',
        platform: 'meet',
        organizer: 'yoga',
        minute_taker: 'fitri',
        participants: going(['yoga', 'rina', 'lina', 'fitri', 'agus']),
        agenda: ['Blokir lintas divisi', 'Rilis minggu ini'],
        minutes: 'draft',
        recurrence: 'mon_wed_fri',
        leadership: true,
    }),
    meeting({
        id: 'rapat-direksi',
        title: 'Rapat direksi mingguan',
        date: TODAY,
        start: '10:00',
        end: '11:30',
        platform: 'room',
        location: 'Ruang Direksi Lt. 5',
        organizer: 'hendra',
        minute_taker: 'nadia',
        participants: going(['hendra', 'agus', 'hana', 'nadia']),
        agenda: [
            'Perpanjangan timeline DEP',
            'Status go-live SIMRS',
            'Kontrak Sinar Logistik',
        ],
        recurrence: 'weekly',
        leadership: true,
    }),
    meeting({
        id: 'koordinasi-q4',
        title: 'Koordinasi peluncuran Q4',
        date: TODAY,
        start: '10:30',
        end: '11:30',
        platform: 'meet',
        organizer: 'putri',
        minute_taker: 'maya',
        workspace: PLQ,
        participants: [
            ...going(['putri', 'dimas', 'sari', 'maya', 'rizky']),
            { user_id: 'hendra', rsvp: 'tentative', optional: true },
        ],
        agenda: [
            'Status landing page',
            'Kutipan direksi untuk siaran pers',
            'Anggaran vendor video',
        ],
        documents: [
            {
                id: 'brief-plq',
                name: 'Brief peluncuran Q4',
                kind: 'doc',
                source: 'Docs · Peluncuran Q4',
            },
            {
                id: 'anggaran-plq',
                name: 'Anggaran vendor video',
                kind: 'sheet',
                source: 'Sheets · dari PLQ-19',
            },
            {
                id: 'deck-plq',
                name: 'Materi presentasi Direksi',
                kind: 'slide',
                source: 'Slides · PLQ-22',
            },
        ],
    }),
    meeting({
        id: 'demo-simrs',
        title: 'Demo SIMRS ke RS Harapan Sehat',
        date: TODAY,
        start: '13:00',
        end: '14:00',
        platform: 'zoom',
        join_url: 'https://zoom.us/j/84455667788',
        organizer: 'lina',
        participants: [
            ...going(['lina', 'rina', 'agus']),
            {
                user_id: null,
                email: 'it@rsharapansehat.co.id',
                rsvp: 'accepted',
            },
        ],
        agenda: ['Alur pendaftaran pasien', 'Laporan harian'],
        note: 'Implementer & Analis',
        leadership: true,
    }),
    meeting({
        id: 'review-vendor',
        title: 'Review vendor logistik',
        date: TODAY,
        start: '13:30',
        end: '14:30',
        platform: 'zoom',
        join_url: 'https://zoom.us/j/81122334455',
        organizer: 'dimas',
        minute_taker: 'fitri',
        workspace: OPS,
        participants: [
            ...going(['dimas', 'bayu', 'rizky', 'fitri']),
            {
                user_id: null,
                email: 'logistik@sinarlogistik.co.id',
                rsvp: 'accepted',
            },
            {
                user_id: null,
                email: 'sales@sinarlogistik.co.id',
                rsvp: 'pending',
            },
        ],
        agenda: [
            'Evaluasi ketepatan pengiriman September',
            'Penawaran harga kuartal IV',
            'SLA klaim barang rusak',
        ],
        note: 'Anda penyelenggara · 2 tamu eksternal',
    }),
    meeting({
        id: 'review-kmb',
        title: 'Review arsitektur KMB',
        date: TODAY,
        start: '14:00',
        end: '15:00',
        platform: 'meet',
        organizer: 'yoga',
        participants: going(['yoga', 'rina', 'agus']),
        agenda: ['Pemisahan layanan', 'Rencana uji beban'],
        note: 'Programming & Analis',
        leadership: true,
    }),
    meeting({
        id: 'sinkron-gudang',
        title: 'Sinkronisasi migrasi gudang',
        date: TODAY,
        start: '15:00',
        end: '15:30',
        platform: 'meet',
        organizer: 'sari',
        participants: [
            ...going(['sari', 'andi', 'hadi']),
            { user_id: 'dimas', rsvp: 'pending', optional: true },
        ],
        agenda: ['Hasil impor batch 2', 'Kode SKU ganda'],
        note: 'Sari Wulandari · Anda opsional',
    }),

    // Rest of the week.
    meeting({
        id: 'review-keuangan-q3',
        title: 'Review keuangan Q3',
        date: '2026-10-06',
        start: '09:00',
        end: '10:00',
        platform: 'room',
        location: 'Ruang Direksi Lt. 5',
        organizer: 'agus',
        participants: going(['agus', 'hendra', 'hana']),
        agenda: ['Arus kas Q3', 'Proyeksi Q4'],
        note: 'Direksi',
        leadership: true,
    }),
    meeting({
        id: 'renovasi-lt2',
        title: 'Evaluasi renovasi lantai 2',
        date: '2026-10-06',
        start: '10:00',
        end: '11:00',
        platform: 'room',
        location: 'Ruang Rapat Lt. 3',
        organizer: 'dimas',
        participants: going(['dimas', 'tono', 'hadi', 'wulan', 'hana']),
        agenda: ['Progres kontraktor', 'Pindah meja tim gudang'],
        note: 'Ruang Rapat Lt. 3 · 5 peserta',
    }),
    meeting({
        id: 'one-on-one-hendra',
        title: '1-on-1 dengan Hendra Wijaya',
        date: '2026-10-06',
        start: '14:00',
        end: '14:30',
        platform: 'meet',
        organizer: 'hendra',
        participants: going(['hendra', 'dimas']),
        agenda: ['Target divisi Q4', 'Kebutuhan tambahan orang'],
        note: 'Hendra Wijaya · 2 peserta',
    }),
    meeting({
        id: 'tender-kominfo',
        title: 'Review materi tender Kominfo',
        date: '2026-10-06',
        start: '14:00',
        end: '15:00',
        platform: 'meet',
        organizer: 'nadia',
        participants: going(['nadia', 'putri', 'hendra']),
        agenda: ['Dokumen administrasi', 'Materi teknis'],
        note: 'Branding & Sekretariat',
        leadership: true,
    }),
    standup('standup-ops-rab', '2026-10-07'),
    meeting({
        id: 'logo-spkd',
        title: 'Persetujuan logo baru SPKD',
        date: '2026-10-07',
        start: '10:00',
        end: '11:00',
        platform: 'room',
        location: 'Ruang Direksi Lt. 5',
        organizer: 'putri',
        participants: going(['putri', 'hendra', 'agus']),
        agenda: ['Tiga alternatif logo'],
        note: '3 alternatif',
        leadership: true,
    }),
    meeting({
        id: 'uji-beban-simrs',
        title: 'Uji beban server SIMRS',
        date: '2026-10-07',
        start: '13:00',
        end: '14:30',
        platform: 'meet',
        organizer: 'yoga',
        participants: going(['yoga', 'lina', 'dimas']),
        agenda: ['Skenario uji', 'Hasil & tindak lanjut'],
        note: 'Programming & Implementer',
        leadership: true,
    }),
    meeting({
        id: 'kontrak-sinar',
        title: 'Tanda tangan kontrak Sinar Logistik',
        date: '2026-10-08',
        start: '09:00',
        end: '11:00',
        platform: 'client',
        location: 'Kantor Sinar Logistik, Jl. Gatot Subroto',
        organizer: 'hendra',
        participants: going(['hendra', 'nadia', 'agus']),
        agenda: ['Penandatanganan kontrak'],
        note: 'berkas oleh Nadia',
        leadership: true,
    }),
    meeting({
        id: 'presentasi-direksi',
        title: 'Presentasi materi peluncuran ke Direksi',
        date: '2026-10-08',
        start: '13:00',
        end: '14:00',
        platform: 'meet',
        organizer: 'dimas',
        workspace: PLQ,
        participants: going(['dimas', 'putri', 'hendra', 'agus', 'maya']),
        agenda: ['Materi peluncuran', 'Anggaran', 'Keputusan tanggal rilis'],
        note: 'Anda penyelenggara · terkait PLQ-22',
    }),
    meeting({
        id: 'uat-simrs',
        title: 'UAT SIMRS sesi 3',
        date: '2026-10-08',
        start: '13:00',
        end: '15:00',
        platform: 'client',
        location: 'RS Harapan Sehat',
        organizer: 'lina',
        participants: going(['lina', 'rina']),
        agenda: ['Modul rawat jalan'],
        note: 'RS Harapan Sehat',
        leadership: true,
    }),
    standup('standup-ops-jum', '2026-10-09'),
    meeting({
        id: 'standup-lintas-jum',
        title: 'Stand-up lintas divisi teknis',
        date: '2026-10-09',
        start: '09:30',
        end: '10:00',
        platform: 'meet',
        organizer: 'yoga',
        participants: going(['yoga', 'rina', 'lina', 'fitri', 'agus']),
        agenda: ['Blokir lintas divisi'],
        recurrence: 'mon_wed_fri',
        note: 'berulang',
        leadership: true,
    }),
    meeting({
        id: 'sprint-review-kmb',
        title: 'Sprint review KMB',
        date: '2026-10-09',
        start: '15:00',
        end: '16:00',
        platform: 'meet',
        organizer: 'yoga',
        participants: going(['yoga', 'agus', 'rina']),
        agenda: ['Demo ke klien'],
        note: 'demo ke klien',
        leadership: true,
    }),
    meeting({
        id: 'retro-divisi',
        title: 'Retro mingguan divisi',
        date: '2026-10-09',
        start: '16:00',
        end: '16:45',
        platform: 'room',
        location: 'Ruang Rapat Lt. 2',
        organizer: 'dimas',
        participants: going(OPS_TEAM),
        agenda: ['Yang berjalan baik', 'Yang perlu diperbaiki'],
        note: 'Ruang Rapat Lt. 2',
    }),
];

/** Deadlines shown on the leadership schedule (MgJadwal "Tenggat"). */
export const LEADERSHIP_DEADLINES = [
    {
        id: 'tenggat-tender',
        title: 'Kirim materi tender Kominfo',
        at: at('2026-10-09', '13:00'),
        meta: 'Branding',
    },
];

const action = (
    id: string,
    text: string,
    assignee_id: PersonId,
    due_date: string,
    task_key: string | null = null,
    done = false,
): ActionItem => ({ id, text, assignee_id, due_date, task_key, done });

const allPresent = (ids: PersonId[]) =>
    ids.map((user_id) => ({ user_id, present: true }));

export const MINUTES: Minutes[] = [
    {
        meeting_id: 'standup-ops',
        status: 'draft',
        saved_at: '2026-10-05T10:18:00+07:00',
        version_count: 4,
        co_editor_id: 'fitri',
        attendance: OPS_TEAM.map((user_id) =>
            user_id === 'nadia'
                ? { user_id, present: false, reason: 'cuti' }
                : user_id === 'andi'
                  ? { user_id, present: false, reason: 'sakit' }
                  : { user_id, present: true },
        ),
        sections: [
            {
                title: 'Status stok & gudang',
                body: 'Selisih stok rak C turun dari 42 ke 18 SKU setelah hitung ulang.\nMigrasi batch 2 sedang diimpor; 12 SKU kode ganda sudah dibersihkan.',
            },
            {
                title: 'Tugas terlambat divisi',
                body: 'Lima tugas terlambat, tiga milik Rizky. Rizky minta bantuan Fitri untuk input tagihan vendor (OPS-127).',
            },
            {
                title: 'Persiapan audit stok Oktober',
                body: 'Jadwal hitung fisik Sabtu, 17 Okt. Butuh 4 orang; lembur diajukan minggu ini.',
            },
        ],
        decisions: [
            'Fitri membantu OPS-127 sampai Rabu; Rizky fokus ke rekap stok.',
            'Hitung fisik audit stok dilakukan Sabtu, 17 Okt pukul 08.00–12.00.',
            'Laporan selisih stok mingguan dikirim setiap Jumat ke Kepala Divisi.',
        ],
        action_items: [
            action(
                'a1',
                'Selesaikan rekap stok September',
                'rizky',
                '2026-10-07',
                'OPS-142',
            ),
            action(
                'a2',
                'Kirim jadwal servis 2 kendaraan ke vendor',
                'dimas',
                '2026-10-07',
            ),
            action('a3', 'Kalibrasi timbangan rak C', 'yoga', '2026-10-08'),
            action(
                'a4',
                'Bagikan hasil impor batch 2 ke tim gudang',
                'sari',
                '2026-10-06',
                'OPS-151',
            ),
        ],
        task_prefix: 'OPS',
        next_task_number: 156,
    },
    {
        meeting_id: 'koordinasi-plq-28sep',
        status: 'final',
        saved_at: '2026-09-28T12:02:00+07:00',
        version_count: 6,
        co_editor_id: null,
        attendance: allPresent([
            'putri',
            'dimas',
            'maya',
            'sari',
            'hendra',
            'rizky',
        ]),
        sections: [
            {
                title: 'Materi peluncuran',
                body: 'Draf landing page selesai 80%. Foto produk dijadwalkan ulang ke Kamis.',
            },
            {
                title: 'Anggaran vendor video',
                body: 'Penawaran vendor A lebih murah 12% tetapi waktu produksi 3 minggu.',
            },
            {
                title: 'Jadwal presentasi ke Direksi',
                body: 'Presentasi dijadwalkan Kamis, 8 Okt pukul 13.00.',
            },
        ],
        decisions: [
            'Vendor video diputuskan setelah konfirmasi anggaran.',
            'Presentasi ke Direksi Kamis, 8 Okt.',
        ],
        action_items: [
            action(
                'b1',
                'Siapkan materi presentasi untuk Direksi',
                'dimas',
                '2026-10-08',
                'PLQ-22',
            ),
            action(
                'b2',
                'Konfirmasi anggaran vendor video ke Putri',
                'dimas',
                '2026-10-04',
            ),
            action(
                'b3',
                'Selesaikan draf landing page',
                'maya',
                '2026-10-02',
                'PLQ-18',
                true,
            ),
        ],
        task_prefix: 'PLQ',
        next_task_number: 24,
    },
    {
        meeting_id: 'rapat-direksi-28sep',
        status: 'final',
        saved_at: '2026-09-28T12:10:00+07:00',
        version_count: 3,
        co_editor_id: null,
        attendance: allPresent(['hendra', 'agus', 'hana', 'nadia']),
        sections: [
            {
                title: 'Tender Dinas Kominfo',
                body: 'Peluang menang tinggi; dokumen administrasi lengkap.',
            },
            {
                title: 'Kebutuhan programmer KMB',
                body: 'Tim KMB kekurangan 1 programmer backend.',
            },
            { title: 'Go-live SIMRS', body: 'Uji beban dijadwalkan 7 Okt.' },
            { title: 'Logo baru SPKD', body: 'Putri menyiapkan 3 alternatif.' },
        ],
        decisions: [
            'Ikut tender Dinas Kominfo.',
            'Rekrut 1 programmer untuk KMB.',
            'Go-live SIMRS tetap 19 Okt.',
            'Logo baru dipilih Rab, 7 Okt.',
        ],
        action_items: [
            action(
                'c1',
                'Siapkan 3 alternatif logo',
                'putri',
                '2026-10-02',
                null,
                true,
            ),
            action(
                'c2',
                'Tanda tangani NDA RS Harapan Sehat',
                'nadia',
                '2026-10-02',
                null,
                true,
            ),
            action(
                'c3',
                'Kirim proposal ke Sinar Logistik',
                'agus',
                '2026-09-30',
                null,
                true,
            ),
            action(
                'c4',
                'Jadwalkan demo SIMRS ke RS',
                'bayu',
                '2026-10-01',
                null,
                true,
            ),
            action('c5', 'Lengkapi berkas izin usaha', 'nadia', '2026-10-30'),
            action('c6', 'Rekrut 1 programmer untuk KMB', 'hana', '2026-10-30'),
        ],
        task_prefix: 'DIR',
        next_task_number: 41,
    },
    {
        meeting_id: 'eskalasi-dep',
        status: 'final',
        saved_at: '2026-10-01T14:20:00+07:00',
        version_count: 2,
        co_editor_id: null,
        attendance: allPresent(['agus', 'hendra', 'rina', 'yoga']),
        sections: [
            {
                title: 'Keterlambatan akses API Pemda',
                body: 'Akses API belum diberikan sejak 2 minggu.',
            },
            {
                title: 'Opsi perpanjangan timeline',
                body: 'Opsi perpanjangan 3 minggu dibahas.',
            },
        ],
        decisions: [
            'Eskalasi tertulis ke Pemda.',
            'Keputusan perpanjangan oleh Direktur Utama.',
        ],
        action_items: [
            action(
                'd1',
                'Putuskan perpanjangan timeline DEP',
                'hendra',
                '2026-10-07',
            ),
            action('d2', 'Surati Pemda soal akses API', 'agus', '2026-10-02'),
            action(
                'd3',
                'Kirim log galat API ke Pemda',
                'rina',
                '2026-10-01',
                null,
                true,
            ),
        ],
        task_prefix: 'DEP',
        next_task_number: 77,
    },
    {
        meeting_id: 'retro-sprint5-kmb',
        status: 'final',
        saved_at: '2026-10-02T16:30:00+07:00',
        version_count: 2,
        co_editor_id: null,
        attendance: allPresent(['yoga', 'rina', 'lina', 'agus']),
        sections: [
            { title: 'Yang berjalan baik', body: 'Review kode lebih cepat.' },
            {
                title: 'Yang perlu diperbaiki',
                body: 'Lingkungan sandbox sering mati.',
            },
        ],
        decisions: [
            'Sandbox dipantau otomatis.',
            'Review kode maksimal 1 hari.',
        ],
        action_items: [
            action(
                'e1',
                'Kirim kredensial sandbox ke tim',
                'yoga',
                '2026-10-06',
            ),
            action(
                'e2',
                'Pasang pemantau sandbox',
                'yoga',
                '2026-10-05',
                null,
                true,
            ),
            action(
                'e3',
                'Perbarui panduan review kode',
                'rina',
                '2026-10-05',
                null,
                true,
            ),
            action(
                'e4',
                'Rapikan backlog sprint 6',
                'lina',
                '2026-10-05',
                null,
                true,
            ),
            action('e5', 'Jadwalkan demo ke klien', 'agus', '2026-10-09'),
        ],
        task_prefix: 'KMB',
        next_task_number: 88,
    },
    {
        meeting_id: 'golive-simrs',
        status: 'final',
        saved_at: '2026-10-02T10:40:00+07:00',
        version_count: 3,
        co_editor_id: null,
        attendance: allPresent(['lina', 'dimas', 'yoga', 'agus']),
        sections: [
            {
                title: 'Kesiapan server',
                body: 'Server produksi siap, uji beban belum.',
            },
            {
                title: 'Pelatihan pengguna RS',
                body: 'Pelatihan dua sesi minggu depan.',
            },
        ],
        decisions: [
            'Uji beban Rabu, 7 Okt.',
            'Go-live tetap 19 Okt.',
            'Pelatihan pengguna 12–13 Okt.',
        ],
        action_items: [
            action('f1', 'Uji beban server SIMRS', 'dimas', '2026-10-07'),
            action(
                'f2',
                'Siapkan materi pelatihan',
                'lina',
                '2026-10-02',
                null,
                true,
            ),
            action(
                'f3',
                'Konfirmasi jadwal pelatihan ke RS',
                'lina',
                '2026-10-02',
                null,
                true,
            ),
            action(
                'f4',
                'Siapkan akun pengguna RS',
                'yoga',
                '2026-10-05',
                null,
                true,
            ),
            action('f5', 'Siapkan rencana rollback', 'yoga', '2026-10-09'),
        ],
        task_prefix: 'SIM',
        next_task_number: 61,
    },
    {
        meeting_id: 'sprint-review-rk',
        status: 'final',
        saved_at: '2026-09-30T15:12:00+07:00',
        version_count: 2,
        co_editor_id: null,
        attendance: allPresent(['yoga', 'hendra', 'fitri', 'rina']),
        sections: [
            {
                title: 'Demo fitur rapat',
                body: 'Pratinjau rapat & notulen diterima baik.',
            },
            {
                title: 'Rencana sprint berikutnya',
                body: 'Fokus ke kalender & sinkron Google.',
            },
        ],
        decisions: [
            'Lanjut ke sinkron Google Calendar.',
            'Uji coba internal 2 minggu.',
        ],
        action_items: [
            action(
                'g1',
                'Siapkan proyek Google Cloud',
                'yoga',
                '2026-10-02',
                null,
                true,
            ),
            action(
                'g2',
                'Tulis panduan pengguna rapat',
                'fitri',
                '2026-10-02',
                null,
                true,
            ),
            action('g3', 'Undang 10 penguji internal', 'rina', '2026-10-12'),
        ],
        task_prefix: 'RK',
        next_task_number: 120,
    },
    {
        meeting_id: 'standup-lintas',
        status: 'draft',
        saved_at: '2026-10-05T10:02:00+07:00',
        version_count: 1,
        co_editor_id: null,
        attendance: allPresent(['yoga', 'rina', 'lina', 'fitri', 'agus']),
        sections: [
            {
                title: 'Blokir lintas divisi',
                body: 'Akses API Pemda masih tertahan.',
            },
            { title: 'Rilis minggu ini', body: '' },
        ],
        decisions: [
            'Rilis SIMRS 1.4 Rabu malam.',
            'Sandbox dibuka untuk Implementer.',
            'Demo KMB Jumat.',
        ],
        action_items: [
            action(
                'h1',
                'Bagikan catatan rilis SIMRS 1.4',
                'yoga',
                '2026-10-07',
            ),
            action(
                'h2',
                'Buka akses sandbox Implementer',
                'yoga',
                '2026-10-06',
            ),
            action('h3', 'Siapkan data demo KMB', 'rina', '2026-10-08'),
            action(
                'h4',
                'Konfirmasi jadwal demo ke klien',
                'agus',
                '2026-10-08',
            ),
        ],
        task_prefix: 'TEK',
        next_task_number: 33,
    },
];

/** Busy time outside RuangKerja meetings (from participants' Google Calendar). */
export const BUSY: BusyBlock[] = [
    {
        user_id: 'bayu',
        starts_at: at('2026-10-06', '13:00'),
        ends_at: at('2026-10-06', '14:00'),
        title: 'Rapat lain',
    },
    {
        user_id: 'putri',
        starts_at: at('2026-10-06', '09:00'),
        ends_at: at('2026-10-06', '11:00'),
        title: 'Pemotretan produk',
    },
    {
        user_id: 'hendra',
        starts_at: at('2026-10-07', '13:00'),
        ends_at: at('2026-10-07', '16:00'),
        title: 'Kunjungan klien',
    },
];

export const ROOMS = [
    'Ruang Rapat Lt. 2 · kapasitas 8',
    'Ruang Rapat Lt. 3 · kapasitas 10',
    'Ruang Direksi Lt. 5 · kapasitas 12',
];

export const TASKS_DUE: TaskDue[] = [
    {
        key: 'OPS-127',
        title: 'Input tagihan vendor September',
        due_date: '2026-10-02',
        done: false,
    },
    {
        key: 'OPS-142',
        title: 'Rekap stok September',
        due_date: '2026-10-07',
        done: false,
    },
    {
        key: 'OPS-151',
        title: 'Bagikan hasil impor batch 2',
        due_date: '2026-10-06',
        done: false,
    },
    {
        key: 'PLQ-22',
        title: 'Materi presentasi peluncuran',
        due_date: '2026-10-08',
        done: false,
    },
    {
        key: 'PLQ-19',
        title: 'Anggaran vendor video',
        due_date: '2026-10-04',
        done: false,
    },
    {
        key: 'OPS-138',
        title: 'Servis forklift gudang',
        due_date: '2026-10-01',
        done: true,
    },
    {
        key: 'OPS-145',
        title: 'Audit stok hitung fisik',
        due_date: '2026-10-17',
        done: false,
    },
    {
        key: 'OPS-149',
        title: 'Perpanjang kontrak sewa gudang',
        due_date: '2026-10-21',
        done: false,
    },
    {
        key: 'PLQ-25',
        title: 'Siaran pers peluncuran',
        due_date: '2026-10-26',
        done: false,
    },
    {
        key: 'OPS-150',
        title: 'Laporan bulanan Oktober',
        due_date: '2026-10-30',
        done: false,
    },
];

export const LEAVES: ApprovedLeave[] = [
    {
        id: 'cuti-nadia',
        user_id: 'nadia',
        type: 'Cuti tahunan',
        start_date: '2026-10-05',
        end_date: '2026-10-07',
    },
    {
        id: 'sakit-andi',
        user_id: 'andi',
        type: 'Sakit',
        start_date: '2026-10-05',
        end_date: '2026-10-05',
    },
    {
        id: 'cuti-sari',
        user_id: 'sari',
        type: 'Cuti tahunan',
        start_date: '2026-10-19',
        end_date: '2026-10-21',
    },
    {
        id: 'dinas-bayu',
        user_id: 'bayu',
        type: 'Dinas luar',
        start_date: '2026-10-13',
        end_date: '2026-10-14',
    },
];

export const HOLIDAYS: Holiday[] = [
    {
        date: '2026-10-23',
        name: 'HUT perusahaan (libur kantor)',
        type: 'company',
    },
    { date: '2026-11-02', name: 'Cuti bersama', type: 'collective_leave' },
];

export const GOOGLE_SYNC: GoogleSync = {
    connected: true,
    account: 'dimas@spkd.co.id',
    last_synced_at: '2026-10-05T10:23:00+07:00',
};
