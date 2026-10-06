import type { WhatsappSettings } from '@/features/automation/types';

/**
 * Sample data of the WhatsApp settings preview (F2-4). WhatsApp is held by
 * the owner until the provider is chosen (PRD §10 no. 2), so this page still
 * runs on sample data. Otomasi, tugas berulang, template and Kinerja saya
 * use real controller props now (their sample data moved to
 * AutomationDemoSeeder and the tests).
 */

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
