import { parseMessage, sampleTime } from './lib';
import type {
    Channel,
    ChannelMember,
    ChatPerson,
    ChatState,
    ChatTask,
    Message,
    MessageAttachment,
    MessageReaction,
} from './types';

/**
 * Sample data for the Obrolan preview, seen by the persona Dimas Pratama
 * (Kepala Divisi Operasional). "Today" = Monday 5 Oct 2026.
 */
export const VIEWER_ID = 'u-dimas';

export const CHAT_PEOPLE: ChatPerson[] = [
    {
        id: 'u-dimas',
        name: 'Dimas Pratama',
        avatar: null,
        title: 'Kepala Divisi Operasional',
        online: true,
    },
    {
        id: 'u-sari',
        name: 'Sari Wulandari',
        avatar: null,
        title: 'Ketua Tim Gudang',
        online: true,
    },
    {
        id: 'u-rizky',
        name: 'Rizky Aditya',
        avatar: null,
        title: 'Staf Operasional',
        online: true,
    },
    {
        id: 'u-maya',
        name: 'Maya Lestari',
        avatar: null,
        title: 'Staf Pemasaran',
        online: false,
    },
    {
        id: 'u-hana',
        name: 'Hana Pratiwi',
        avatar: null,
        title: 'Kepala Divisi SDM',
        online: true,
    },
    {
        id: 'u-hendra',
        name: 'Hendra Wijaya',
        avatar: null,
        title: 'Direktur Utama',
        online: false,
    },
    {
        id: 'u-nadia',
        name: 'Nadia Putri',
        avatar: null,
        title: 'Staf Gudang',
        online: false,
    },
    {
        id: 'u-putri',
        name: 'Putri Ramadhani',
        avatar: null,
        title: 'Kepala Divisi Pemasaran',
        online: true,
    },
];

export const CHAT_TASKS: ChatTask[] = [
    {
        id: 't-plq-18',
        key: 'PLQ-18',
        title: 'Finalisasi materi presentasi peluncuran',
        status_category: 'in_progress',
        url: '/w/PLQ/tasks/18',
    },
    {
        id: 't-plq-21',
        key: 'PLQ-21',
        title: 'Konfirmasi vendor panggung & sound',
        status_category: 'todo',
        url: '/w/PLQ/tasks/21',
    },
    {
        id: 't-plq-9',
        key: 'PLQ-9',
        title: 'Susun rundown acara peluncuran',
        status_category: 'done',
        url: '/w/PLQ/tasks/9',
    },
    {
        id: 't-gdg-7',
        key: 'GDG-7',
        title: 'Stok opname gudang Oktober',
        status_category: 'review',
        url: '/w/GDG/tasks/7',
    },
    {
        id: 't-ops-12',
        key: 'OPS-12',
        title: 'Revisi SOP penerimaan barang',
        status_category: 'todo',
        url: '/w/OPS/tasks/12',
    },
];

export const CHAT_DRIVE_FILES: MessageAttachment[] = [
    {
        id: 'f-rundown',
        name: 'Rundown Peluncuran Q4',
        kind: 'doc',
        web_view_link: 'https://docs.google.com/document/',
        size_bytes: null,
        owner_email: 'maya.lestari@demo.test',
    },
    {
        id: 'f-anggaran',
        name: 'Anggaran Acara Q4',
        kind: 'sheet',
        web_view_link: 'https://docs.google.com/spreadsheets/',
        size_bytes: null,
        owner_email: 'putri.ramadhani@demo.test',
    },
    {
        id: 'f-deck',
        name: 'Deck Peluncuran v3',
        kind: 'slide',
        web_view_link: 'https://docs.google.com/presentation/',
        size_bytes: null,
        owner_email: 'maya.lestari@demo.test',
    },
    {
        id: 'f-denah',
        name: 'Denah Gudang Cikarang.pdf',
        kind: 'pdf',
        web_view_link: 'https://drive.google.com/',
        size_bytes: 2_480_000,
        owner_email: 'sari.wulandari@demo.test',
    },
    {
        id: 'f-foto-rak',
        name: 'Foto stok rak B.jpg',
        kind: 'image',
        web_view_link: 'https://drive.google.com/',
        size_bytes: 1_150_000,
        owner_email: 'sari.wulandari@demo.test',
    },
];

const WORKSPACES = {
    PLQ: { key: 'PLQ', name: 'Proyek Peluncuran Q4', color: 'violet' },
    GDG: { key: 'GDG', name: 'Tim Gudang', color: 'teal' },
    OPS: { key: 'OPS', name: 'Divisi Operasional', color: 'blue' },
};

function members(
    ids: string[],
    lastRead: Record<string, string | null> = {},
    muted: string[] = [],
): ChannelMember[] {
    return ids.map((id, index) => ({
        user_id: id,
        last_read_message_id: lastRead[id] ?? null,
        muted: muted.includes(id),
        role: index === 0 ? 'owner' : 'member',
    }));
}

type Extra = {
    parent?: string;
    edited?: boolean;
    deleted?: boolean;
    reactions?: MessageReaction[];
    files?: string[];
};

function message(
    id: string,
    channelId: string,
    userId: string,
    day: number,
    time: string,
    text: string,
    extra: Extra = {},
): Message {
    const createdAt = sampleTime(day, time);

    return {
        id,
        channel_id: channelId,
        user_id: userId,
        parent_id: extra.parent ?? null,
        body: extra.deleted
            ? null
            : parseMessage(text, CHAT_PEOPLE, CHAT_TASKS),
        body_text: extra.deleted ? '' : text,
        created_at: createdAt,
        edited_at: extra.edited
            ? new Date(Date.parse(createdAt) + 4 * 60_000).toISOString()
            : null,
        deleted_at: extra.deleted
            ? new Date(Date.parse(createdAt) + 2 * 60_000).toISOString()
            : null,
        reactions: extra.reactions ?? [],
        attachments: (extra.files ?? [])
            .map((fileId) =>
                CHAT_DRIVE_FILES.find((file) => file.id === fileId),
            )
            .filter((file): file is MessageAttachment => file !== undefined),
    };
}

const r = (emoji: string, ...users: string[]): MessageReaction => ({
    emoji,
    user_ids: users,
});

export const CHAT_MESSAGES: Message[] = [
    // #Proyek Peluncuran Q4
    message(
        'm-plq-1',
        'plq',
        'u-putri',
        -3,
        '09:12',
        'Pagi semua. Anggaran acara sudah final, mohon dicek sebelum Senin ya.',
        { files: ['f-anggaran'], reactions: [r('👍', 'u-dimas', 'u-maya')] },
    ),
    message(
        'm-plq-2',
        'plq',
        'u-dimas',
        -3,
        '09:20',
        'Siap, Bu Putri. Logistik dari Operasional aman, tinggal PLQ-21 vendor panggung.',
    ),
    message(
        'm-plq-3',
        'plq',
        'u-maya',
        -3,
        '15:42',
        'Rundown versi terbaru sudah saya unggah. PLQ-9 saya tandai selesai.',
        {
            files: ['f-rundown'],
            reactions: [r('🎉', 'u-putri', 'u-dimas', 'u-rizky')],
        },
    ),
    message(
        'm-plq-4',
        'plq',
        'u-maya',
        0,
        '08:31',
        '@Dimas Pratama draft deck peluncuran untuk PLQ-18 sudah siap direview. Bagian logistik di slide 12–15.',
        { files: ['f-deck'], reactions: [r('👀', 'u-dimas')] },
    ),
    message(
        'm-plq-4a',
        'plq',
        'u-dimas',
        0,
        '08:40',
        'Terima kasih Maya, saya lihat siang ini.',
        { parent: 'm-plq-4' },
    ),
    message(
        'm-plq-4b',
        'plq',
        'u-rizky',
        0,
        '08:52',
        'Slide 14 jumlah armada masih 3, seharusnya 4 truk ya.',
        { parent: 'm-plq-4' },
    ),
    message(
        'm-plq-4c',
        'plq',
        'u-maya',
        0,
        '09:05',
        'Siap, sudah saya perbaiki 👍',
        { parent: 'm-plq-4', edited: true },
    ),
    message(
        'm-plq-5',
        'plq',
        'u-rizky',
        0,
        '09:14',
        'Vendor panggung minta konfirmasi jumlah kursi paling lambat Rabu.',
    ),
    message(
        'm-plq-6',
        'plq',
        'u-rizky',
        0,
        '09:15',
        'Saya usul 180 kursi + 20 cadangan.',
    ),
    message(
        'm-plq-7',
        'plq',
        'u-putri',
        0,
        '09:48',
        'Setuju 200 total. @Rizky Aditya tolong update di PLQ-21 sekalian.',
        { reactions: [r('✅', 'u-rizky')] },
    ),
    message(
        'm-plq-8',
        'plq',
        'u-maya',
        0,
        '10:02',
        'Saya hapus pesan tadi, salah kirim channel.',
        { deleted: true },
    ),

    // #Tim Gudang
    message(
        'm-gdg-1',
        'gdg',
        'u-sari',
        -1,
        '16:10',
        'Stok opname rak A–C selesai. Rak B ada selisih 4 karton, fotonya saya lampirkan.',
        { files: ['f-foto-rak'] },
    ),
    message(
        'm-gdg-2',
        'gdg',
        'u-dimas',
        -1,
        '16:25',
        'Oke Sari, catat di GDG-7 ya. Besok kita cek bareng.',
    ),
    message(
        'm-gdg-3',
        'gdg',
        'u-nadia',
        0,
        '07:58',
        'Shift pagi sudah lengkap, 6 orang hadir.',
        { reactions: [r('🙏', 'u-sari', 'u-dimas')] },
    ),
    message(
        'm-gdg-4',
        'gdg',
        'u-sari',
        0,
        '08:15',
        'Denah gudang baru untuk area penerimaan barang.',
        { files: ['f-denah'] },
    ),

    // #Divisi Operasional
    message(
        'm-ops-1',
        'ops',
        'u-dimas',
        -3,
        '13:00',
        'Reminder: draft revisi SOP penerimaan barang (OPS-12) dibahas Rabu pukul 10.00.',
    ),
    message('m-ops-2', 'ops', 'u-rizky', -3, '13:06', 'Siap Pak.', {
        reactions: [r('👍', 'u-dimas')],
    }),

    // #umum (muted)
    message(
        'm-umum-1',
        'umum',
        'u-hana',
        -3,
        '10:00',
        'Selamat pagi rekan-rekan! Jadwal medical check-up tahunan sudah keluar, cek email masing-masing ya.',
        { reactions: [r('🙏', 'u-rizky', 'u-sari', 'u-maya', 'u-nadia')] },
    ),
    message(
        'm-umum-2',
        'umum',
        'u-hendra',
        0,
        '07:30',
        'Selamat pagi. Minggu ini fokus kita peluncuran Q4. Terima kasih atas kerja kerasnya.',
        {
            reactions: [
                r('🚀', 'u-putri', 'u-maya', 'u-dimas'),
                r('❤️', 'u-hana'),
            ],
        },
    ),
    message(
        'm-umum-3',
        'umum',
        'u-hana',
        0,
        '08:05',
        'Pengingat: batas pengajuan cuti bersama Desember tanggal 15 Oktober.',
    ),
    message(
        'm-umum-4',
        'umum',
        'u-maya',
        0,
        '09:30',
        'Ada yang ketinggalan payung biru di pantry lantai 2 😄',
    ),
    message(
        'm-umum-5',
        'umum',
        'u-nadia',
        0,
        '09:41',
        'Punya saya, terima kasih Kak Maya!',
    ),

    // #acara-peluncuran (private)
    message(
        'm-acara-1',
        'acara',
        'u-putri',
        -1,
        '19:20',
        'Channel ini khusus panitia inti, tolong jangan bagikan detail tamu VIP ke luar.',
    ),
    message(
        'm-acara-2',
        'acara',
        'u-dimas',
        0,
        '08:00',
        'Noted. Transport tamu VIP saya koordinasikan dengan Sari.',
    ),

    // DM Sari
    message(
        'm-dm-sari-1',
        'dm-sari',
        'u-dimas',
        -1,
        '17:02',
        'Sari, besok bisa ke gudang jam 9 untuk cek rak B?',
    ),
    message(
        'm-dm-sari-2',
        'dm-sari',
        'u-sari',
        -1,
        '17:10',
        'Bisa Pak, saya siapkan datanya.',
    ),
    message(
        'm-dm-sari-3',
        'dm-sari',
        'u-dimas',
        0,
        '08:20',
        'Saya agak telat, mulai 09.30 ya.',
    ),
    message(
        'm-dm-sari-4',
        'dm-sari',
        'u-sari',
        0,
        '09:58',
        'Baik Pak. Selisih rak B ternyata salah input, sudah saya koreksi di GDG-7.',
    ),

    // DM Hendra
    message(
        'm-dm-hendra-1',
        'dm-hendra',
        'u-hendra',
        -3,
        '18:30',
        'Dimas, tolong siapkan ringkasan kesiapan logistik untuk rapat direksi Selasa.',
    ),
    message(
        'm-dm-hendra-2',
        'dm-hendra',
        'u-dimas',
        -3,
        '18:45',
        'Baik Pak, saya kirim Senin siang.',
        { reactions: [r('👍', 'u-hendra')] },
    ),

    // Group: shift gudang
    message(
        'm-grp-1',
        'grp-shift',
        'u-sari',
        0,
        '06:50',
        'Nadia tukar shift dengan Yoga hari Kamis, sudah diajukan ke sistem.',
    ),
    message(
        'm-grp-2',
        'grp-shift',
        'u-nadia',
        0,
        '06:55',
        'Betul Pak, mohon disetujui 🙏',
    ),
];

export const CHAT_CHANNELS: Channel[] = [
    {
        id: 'plq',
        workspace_id: 'w-plq',
        workspace: WORKSPACES.PLQ,
        type: 'workspace',
        name: 'Proyek Peluncuran Q4',
        topic: 'Koordinasi lintas divisi peluncuran produk Q4 · target 27 Okt',
        created_by: 'u-dimas',
        created_at: sampleTime(-30, '09:00'),
        archived_at: null,
        members: members(
            ['u-dimas', 'u-putri', 'u-maya', 'u-rizky', 'u-sari', 'u-hendra'],
            {
                'u-dimas': 'm-plq-3',
                'u-putri': 'm-plq-7',
                'u-maya': 'm-plq-7',
                'u-rizky': 'm-plq-7',
                'u-sari': 'm-plq-5',
            },
        ),
    },
    {
        id: 'gdg',
        workspace_id: 'w-gdg',
        workspace: WORKSPACES.GDG,
        type: 'workspace',
        name: 'Tim Gudang',
        topic: 'Operasional gudang Cikarang: stok, shift, penerimaan barang',
        created_by: 'u-sari',
        created_at: sampleTime(-120, '09:00'),
        archived_at: null,
        members: members(['u-sari', 'u-dimas', 'u-nadia', 'u-rizky'], {
            'u-dimas': 'm-gdg-4',
            'u-sari': 'm-gdg-4',
            'u-nadia': 'm-gdg-3',
            'u-rizky': 'm-gdg-4',
        }),
    },
    {
        id: 'ops',
        workspace_id: 'w-ops',
        workspace: WORKSPACES.OPS,
        type: 'workspace',
        name: 'Divisi Operasional',
        topic: 'Seluruh anggota Divisi Operasional (sinkron otomatis)',
        created_by: 'u-dimas',
        created_at: sampleTime(-200, '09:00'),
        archived_at: null,
        members: members(['u-dimas', 'u-sari', 'u-rizky', 'u-nadia'], {
            'u-dimas': 'm-ops-2',
            'u-rizky': 'm-ops-2',
            'u-sari': 'm-ops-2',
        }),
    },
    {
        id: 'umum',
        workspace_id: null,
        workspace: null,
        type: 'public',
        name: 'umum',
        topic: 'Pengumuman & obrolan seluruh kantor',
        created_by: 'u-hana',
        created_at: sampleTime(-300, '09:00'),
        archived_at: null,
        members: members(
            [
                'u-hana',
                'u-dimas',
                'u-sari',
                'u-rizky',
                'u-maya',
                'u-hendra',
                'u-nadia',
                'u-putri',
            ],
            {
                'u-dimas': 'm-umum-1',
                'u-hana': 'm-umum-5',
                'u-maya': 'm-umum-5',
            },
            ['u-dimas'],
        ),
    },
    {
        id: 'acara',
        workspace_id: null,
        workspace: null,
        type: 'private',
        name: 'acara-peluncuran',
        topic: 'Panitia inti acara peluncuran (privat)',
        created_by: 'u-putri',
        created_at: sampleTime(-10, '09:00'),
        archived_at: null,
        members: members(['u-putri', 'u-dimas', 'u-sari', 'u-maya'], {
            'u-dimas': 'm-acara-2',
            'u-putri': 'm-acara-2',
        }),
    },
    {
        id: 'dm-sari',
        workspace_id: null,
        workspace: null,
        type: 'dm',
        name: null,
        topic: null,
        created_by: 'u-dimas',
        created_at: sampleTime(-60, '09:00'),
        archived_at: null,
        members: members(['u-dimas', 'u-sari'], {
            'u-dimas': 'm-dm-sari-3',
            'u-sari': 'm-dm-sari-3',
        }),
    },
    {
        id: 'dm-hendra',
        workspace_id: null,
        workspace: null,
        type: 'dm',
        name: null,
        topic: null,
        created_by: 'u-hendra',
        created_at: sampleTime(-90, '09:00'),
        archived_at: null,
        members: members(['u-hendra', 'u-dimas'], {
            'u-dimas': 'm-dm-hendra-2',
            'u-hendra': 'm-dm-hendra-2',
        }),
    },
    {
        id: 'grp-shift',
        workspace_id: null,
        workspace: null,
        type: 'group',
        name: null,
        topic: null,
        created_by: 'u-sari',
        created_at: sampleTime(-20, '09:00'),
        archived_at: null,
        members: members(['u-sari', 'u-dimas', 'u-nadia'], {
            'u-sari': 'm-grp-2',
            'u-nadia': 'm-grp-2',
        }),
    },
];

/** Canned replies for the simulated "someone answers" after you send. */
export const AUTO_REPLIES: Record<string, { userId: string; text: string }> = {
    plq: { userId: 'u-rizky', text: 'Siap, saya update di PLQ-21 sore ini.' },
    gdg: { userId: 'u-sari', text: 'Noted Pak 👍' },
    ops: { userId: 'u-rizky', text: 'Baik Pak, dicatat.' },
    acara: { userId: 'u-putri', text: 'Terima kasih, Dimas.' },
    'dm-sari': { userId: 'u-sari', text: 'Siap Pak, saya tunggu di gudang.' },
    'dm-hendra': { userId: 'u-hendra', text: 'Baik, terima kasih.' },
    'grp-shift': { userId: 'u-nadia', text: 'Terima kasih Pak 🙏' },
};

export function initialChatState(): ChatState {
    return {
        viewerId: VIEWER_ID,
        people: CHAT_PEOPLE,
        channels: CHAT_CHANNELS,
        messages: CHAT_MESSAGES,
        tasks: CHAT_TASKS,
        driveFiles: CHAT_DRIVE_FILES,
        typing: { plq: ['u-rizky'] },
    };
}
