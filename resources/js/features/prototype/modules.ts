import type { LucideIcon } from 'lucide-react';
import {
    CalendarDays,
    Fingerprint,
    NotebookPen,
    Smartphone,
    Target,
    UsersRound,
    Workflow,
} from 'lucide-react';

export type PrototypeScreen = { label: string; href: string };

export type PrototypeModule = {
    key: string;
    phase: 'Fase 2' | 'Fase 3';
    /** Sprint id in docs/PROMPTS.md (F2-1 …). */
    sprint: string;
    title: string;
    description: string;
    icon: LucideIcon;
    /** bg-grad-* class for the icon tile. */
    gradient: string;
    screens: PrototypeScreen[];
};

/** Every Fase 2 & 3 preview, in the order of docs/PROMPTS.md. */
export const PROTOTYPE_MODULES: PrototypeModule[] = [
    {
        key: 'notes',
        phase: 'Fase 2',
        sprint: 'F2-2',
        title: 'Catatan bersama',
        description:
            'Wiki, SOP dan notulen ringan yang diedit bersamaan, dengan riwayat versi.',
        icon: NotebookPen,
        gradient: 'bg-grad-indigo',
        screens: [{ label: 'Semua catatan', href: '/catatan' }],
    },
    {
        key: 'meetings',
        phase: 'Fase 2',
        sprint: 'F2-3',
        title: 'Rapat & kalender',
        description:
            'Jadwalkan rapat dengan Google Meet, notulen dengan tindak lanjut, dan kalender tenggat & cuti.',
        icon: CalendarDays,
        gradient: 'bg-grad-merek',
        screens: [
            { label: 'Rapat', href: '/rapat' },
            { label: 'Jadwalkan rapat', href: '/rapat/baru' },
            { label: 'Kalender', href: '/kalender' },
            {
                label: 'Jadwal & notulensi (manajemen)',
                href: '/manajemen/jadwal',
            },
        ],
    },
    {
        key: 'automation',
        phase: 'Fase 2',
        sprint: 'F2-4',
        title: 'Otomasi & WhatsApp',
        description:
            'Notifikasi WhatsApp, tugas berulang, template, aturan otomatis, dan Kinerja saya.',
        icon: Workflow,
        gradient: 'bg-grad-indigo',
        screens: [
            { label: 'Aturan otomasi', href: '/otomasi' },
            { label: 'Tugas berulang', href: '/otomasi/berulang' },
            { label: 'Template', href: '/otomasi/template' },
            { label: 'WhatsApp', href: '/pengaturan/whatsapp' },
            { label: 'Kinerja saya', href: '/kinerja' },
        ],
    },
    {
        key: 'mobile-app',
        phase: 'Fase 3',
        sprint: 'F3-1 · F3-2',
        title: 'Aplikasi ponsel',
        description:
            'Masuk biometrik, check-in wajah dengan liveness, deteksi fake GPS, mode offline, widget dan layar kunci.',
        icon: Smartphone,
        gradient: 'bg-grad-merek',
        screens: [
            { label: 'Ringkasan aplikasi ponsel', href: '/pratinjau/ponsel' },
            { label: 'Check-in wajah', href: '/absensi/wajah' },
            { label: 'Perangkat saya', href: '/pengaturan/perangkat' },
        ],
    },
    {
        key: 'okr',
        phase: 'Fase 3',
        sprint: 'F3-3',
        title: 'OKR divisi',
        description:
            'Objective per kuartal dengan key result yang ditautkan ke tugas.',
        icon: Target,
        gradient: 'bg-grad-indigo',
        screens: [{ label: 'OKR', href: '/okr' }],
    },
    {
        key: 'fingerprint',
        phase: 'Fase 3',
        sprint: 'F3-3',
        title: 'Mesin fingerprint',
        description:
            'Mesin ZKTeco yang mengirim log lewat ADMS, status koneksi dan log masuk.',
        icon: Fingerprint,
        gradient: 'bg-grad-slate',
        screens: [{ label: 'Mesin absensi', href: '/admin/mesin-absensi' }],
    },
    {
        key: 'roles',
        phase: 'Fase 3',
        sprint: 'SPKD',
        title: 'Dashboard per peran',
        description:
            'Beranda khusus Direktur Utama, Direktur, HR, Sekretaris, dan divisi SPKD.',
        icon: UsersRound,
        gradient: 'bg-grad-merek',
        screens: [
            { label: 'Direktur Utama', href: '/peran/dirut' },
            { label: 'Direktur', href: '/peran/direktur' },
            { label: 'HR', href: '/peran/hr' },
            { label: 'Sekretaris Perusahaan', href: '/peran/corsec' },
            { label: 'Branding & Marketing', href: '/peran/marketing' },
            { label: 'Programming', href: '/peran/programming' },
            { label: 'Implementer', href: '/peran/implementer' },
            { label: 'Analis', href: '/peran/analis' },
        ],
    },
];
