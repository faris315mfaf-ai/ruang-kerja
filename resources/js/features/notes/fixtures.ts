import { sampleTime } from '@/features/chat/lib';
import type { RichDoc, RichNode } from '@/features/tasks/editor/types';
import type {
    Note,
    NotePerson,
    NoteShare,
    NotesState,
    NoteVersion,
    NoteWorkspace,
} from './types';

/** Seen by the persona Dimas Pratama; "today" = Monday 5 Oct 2026. */
export const NOTES_VIEWER_ID = 'u-dimas';

export const NOTE_PEOPLE: NotePerson[] = [
    {
        id: 'u-dimas',
        name: 'Dimas Pratama',
        avatar: null,
        title: 'Kepala Divisi Operasional',
    },
    {
        id: 'u-hana',
        name: 'Hana Pratiwi',
        avatar: null,
        title: 'Kepala Divisi SDM',
    },
    {
        id: 'u-dewi',
        name: 'Dewi Kartika',
        avatar: null,
        title: 'Staf Rekrutmen',
    },
    {
        id: 'u-sari',
        name: 'Sari Wulandari',
        avatar: null,
        title: 'Ketua Tim Gudang',
    },
    {
        id: 'u-rizky',
        name: 'Rizky Aditya',
        avatar: null,
        title: 'Staf Operasional',
    },
    {
        id: 'u-maya',
        name: 'Maya Lestari',
        avatar: null,
        title: 'Staf Pemasaran',
    },
    {
        id: 'u-hendra',
        name: 'Hendra Wijaya',
        avatar: null,
        title: 'Direktur Utama',
    },
];

export const NOTE_WORKSPACES: NoteWorkspace[] = [
    { id: 'w-sdm', key: 'SDM', name: 'Divisi SDM', color: 'teal' },
    { id: 'w-ops', key: 'OPS', name: 'Divisi Operasional', color: 'blue' },
    { id: 'w-gdg', key: 'GDG', name: 'Tim Gudang', color: 'green' },
    { id: 'w-plq', key: 'PLQ', name: 'Proyek Peluncuran Q4', color: 'violet' },
];

// Small builders for Tiptap JSON.
const t = (text: string, bold = false): RichNode =>
    bold
        ? { type: 'text', text, marks: [{ type: 'bold' }] }
        : { type: 'text', text };
const p = (...content: (string | RichNode)[]): RichNode => ({
    type: 'paragraph',
    content: content.map((item) => (typeof item === 'string' ? t(item) : item)),
});
const h = (level: 1 | 2 | 3, text: string): RichNode => ({
    type: 'heading',
    attrs: { level },
    content: [t(text)],
});
const ul = (...items: string[]): RichNode => ({
    type: 'bulletList',
    content: items.map((item) => ({ type: 'listItem', content: [p(item)] })),
});
const ol = (...items: string[]): RichNode => ({
    type: 'orderedList',
    attrs: { start: 1 },
    content: items.map((item) => ({ type: 'listItem', content: [p(item)] })),
});
const tasks = (...items: [boolean, string][]): RichNode => ({
    type: 'taskList',
    content: items.map(([checked, text]) => ({
        type: 'taskItem',
        attrs: { checked },
        content: [p(text)],
    })),
});
const quote = (text: string): RichNode => ({
    type: 'blockquote',
    content: [p(text)],
});
const doc = (...content: RichNode[]): RichDoc => ({ type: 'doc', content });

const ONBOARDING_V1 = doc(
    p('Panduan untuk HR dan atasan saat menyambut karyawan baru.'),
    h(2, 'Sebelum hari pertama'),
    ul(
        'Kirim surat penawaran yang sudah ditandatangani',
        'Siapkan meja dan perangkat',
    ),
);

const ONBOARDING_V2 = doc(
    p(
        'Panduan untuk HR dan atasan saat menyambut karyawan baru. Berlaku sejak Oktober 2026.',
    ),
    h(2, 'Sebelum hari pertama'),
    ul(
        'Kirim surat penawaran yang sudah ditandatangani',
        'Siapkan meja, laptop, dan kartu akses',
        'Daftarkan email di Google Workspace',
    ),
    h(2, 'Hari pertama'),
    ol('Sambutan oleh atasan langsung', 'Tur kantor dan perkenalan tim'),
);

const ONBOARDING_CURRENT = doc(
    p(
        'Panduan untuk HR dan atasan langsung saat menyambut karyawan baru. Berlaku sejak ',
        t('1 Oktober 2026', true),
        '.',
    ),
    h(2, 'Sebelum hari pertama'),
    ul(
        'Kirim surat penawaran yang sudah ditandatangani dan jadwal hari pertama',
        'Siapkan meja, laptop, dan kartu akses lantai',
        'Daftarkan email kantor di Google Workspace dan tambahkan ke RuangKerja',
    ),
    h(2, 'Hari pertama'),
    ol(
        'Sambutan oleh atasan langsung pukul 09.00',
        'Tur kantor dan perkenalan dengan tim',
        'Persetujuan data lokasi & selfie untuk absensi',
        'Makan siang bersama buddy',
    ),
    h(2, 'Minggu pertama'),
    tasks(
        [true, 'Pelatihan K3 dasar'],
        [true, 'Akses workspace divisi dan tugas pertama'],
        [false, 'Evaluasi singkat bersama atasan di hari Jumat'],
    ),
    quote(
        'Tip: tunjuk satu buddy dari tim yang sama untuk dua minggu pertama.',
    ),
);

function note(
    id: string,
    workspaceId: string,
    parentId: string | null,
    title: string,
    content: RichDoc,
    by: string,
    updated: [number, string],
    created: [number, string] = [-40, '09:00'],
): Note {
    return {
        id,
        workspace_id: workspaceId,
        parent_id: parentId,
        title,
        content,
        created_by: by,
        updated_by: by,
        created_at: sampleTime(created[0], created[1]),
        updated_at: sampleTime(updated[0], updated[1]),
    };
}

export const NOTES: Note[] = [
    note(
        'sop-onboarding',
        'w-sdm',
        null,
        'SOP Onboarding Karyawan Baru',
        ONBOARDING_CURRENT,
        'u-hana',
        [0, '10:12'],
    ),
    note(
        'checklist-hari-pertama',
        'w-sdm',
        'sop-onboarding',
        'Checklist hari pertama',
        doc(
            tasks(
                [true, 'Kartu akses aktif'],
                [true, 'Laptop terpasang'],
                [false, 'Foto profil di RuangKerja'],
            ),
        ),
        'u-dewi',
        [-1, '15:30'],
    ),
    note(
        'akun-sistem',
        'w-sdm',
        'sop-onboarding',
        'Pembuatan akun & akses sistem',
        doc(
            p('Urutan pembuatan akun untuk karyawan baru.'),
            ol(
                'Google Workspace (oleh Super Admin)',
                'RuangKerja: HR menambah karyawan',
                'Workspace divisi tersinkron otomatis',
            ),
        ),
        'u-hana',
        [-3, '11:00'],
    ),
    note(
        'kebijakan-wfh',
        'w-sdm',
        null,
        'Kebijakan WFH & hybrid',
        doc(
            p(
                'Karyawan hybrid boleh WFH maksimal 2 hari per minggu sesuai jadwal shift.',
            ),
            ul(
                'Check-in WFH tetap memakai selfie',
                'Wajib catatan aktivitas harian',
            ),
        ),
        'u-hana',
        [-7, '09:30'],
    ),
    note(
        'sop-penerimaan',
        'w-ops',
        null,
        'SOP Penerimaan Barang',
        doc(
            p(
                'Langkah penerimaan barang di gudang Cikarang. Revisi dibahas di OPS-12.',
            ),
            ol(
                'Cocokkan surat jalan dengan PO',
                'Periksa kondisi fisik barang',
                'Input ke sistem stok sebelum pukul 16.00',
            ),
        ),
        'u-dimas',
        [-1, '16:40'],
    ),
    note(
        'format-surat-jalan',
        'w-ops',
        'sop-penerimaan',
        'Format surat jalan',
        doc(
            p(
                'Nomor surat jalan: SJ/OPS/2026/10/0001. Wajib cap vendor dan tanda tangan sopir.',
            ),
        ),
        'u-rizky',
        [-4, '14:20'],
    ),
    note(
        'notulen-ops-28-sep',
        'w-ops',
        null,
        'Notulen rapat mingguan 28 Sep',
        doc(
            h(2, 'Keputusan'),
            ul(
                'Stok opname dipercepat ke 2 Oktober',
                'Armada peluncuran: 4 truk',
            ),
            h(2, 'Tindak lanjut'),
            tasks(
                [true, 'Sari: jadwal stok opname'],
                [false, 'Rizky: konfirmasi vendor panggung'],
            ),
        ),
        'u-dimas',
        [-7, '11:30'],
    ),
    note(
        'panduan-shift',
        'w-gdg',
        null,
        'Panduan shift gudang',
        doc(
            p(
                'Shift pagi 06.00–14.00, shift malam 22.00–06.00. Tukar shift diajukan lewat Pengajuan.',
            ),
        ),
        'u-sari',
        [-2, '08:00'],
    ),
    note(
        'brief-peluncuran',
        'w-plq',
        null,
        'Brief peluncuran Q4',
        doc(
            p(
                'Peluncuran produk baru pada 27 Oktober 2026 di Jakarta Convention Center.',
            ),
            h(2, 'Target'),
            ul(
                '200 tamu undangan',
                'Liputan 15 media',
                '1.000 pendaftar demo dalam seminggu',
            ),
        ),
        'u-maya',
        [0, '09:05'],
    ),
    note(
        'notulen-kickoff',
        'w-plq',
        'brief-peluncuran',
        'Notulen kickoff 7 Sep',
        doc(
            p('Hadir: Hendra, Putri, Dimas, Maya, Rizky.'),
            ul('Anggaran disetujui dengan catatan', 'PIC logistik: Dimas'),
        ),
        'u-maya',
        [-28, '15:00'],
    ),
];

export const NOTE_VERSIONS: NoteVersion[] = [
    {
        id: 'v-onb-1',
        note_id: 'sop-onboarding',
        created_by: 'u-hana',
        created_at: sampleTime(-14, '10:00'),
        title: 'SOP Onboarding',
        content: ONBOARDING_V1,
        label: null,
    },
    {
        id: 'v-onb-2',
        note_id: 'sop-onboarding',
        created_by: 'u-dewi',
        created_at: sampleTime(-3, '14:25'),
        title: 'SOP Onboarding Karyawan Baru',
        content: ONBOARDING_V2,
        label: null,
    },
    {
        id: 'v-onb-3',
        note_id: 'sop-onboarding',
        created_by: 'u-hana',
        created_at: sampleTime(-1, '16:02'),
        title: 'SOP Onboarding Karyawan Baru',
        content: doc(...(ONBOARDING_CURRENT.content ?? []).slice(0, 6)),
        label: null,
    },
    {
        id: 'v-onb-4',
        note_id: 'sop-onboarding',
        created_by: 'u-dimas',
        created_at: sampleTime(0, '09:40'),
        title: 'SOP Onboarding Karyawan Baru',
        content: doc(...(ONBOARDING_CURRENT.content ?? []).slice(0, 8)),
        label: null,
    },
    {
        id: 'v-onb-5',
        note_id: 'sop-onboarding',
        created_by: 'u-hana',
        created_at: sampleTime(0, '10:12'),
        title: 'SOP Onboarding Karyawan Baru',
        content: ONBOARDING_CURRENT,
        label: null,
    },
];

export const NOTE_SHARES: NoteShare[] = [
    {
        note_id: 'sop-onboarding',
        access: 'workspace',
        people: [
            { user_id: 'u-hana', role: 'edit' },
            { user_id: 'u-dewi', role: 'edit' },
            { user_id: 'u-dimas', role: 'edit' },
            { user_id: 'u-hendra', role: 'view' },
        ],
    },
];

export function initialNotesState(): NotesState {
    return {
        viewerId: NOTES_VIEWER_ID,
        people: NOTE_PEOPLE,
        workspaces: NOTE_WORKSPACES,
        notes: NOTES,
        versions: NOTE_VERSIONS,
        shares: NOTE_SHARES,
        activeEditors: {
            'sop-onboarding': ['u-hana', 'u-dewi'],
            'brief-peluncuran': ['u-maya'],
        },
    };
}
