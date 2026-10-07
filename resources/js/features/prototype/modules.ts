import type { LucideIcon } from 'lucide-react';
import { Fingerprint, Smartphone, Workflow } from 'lucide-react';

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
        key: 'automation',
        phase: 'Fase 2',
        sprint: 'F2-4',
        // Otomasi, tugas berulang, template and Kinerja saya are real now
        // (routes/automation.php, FEATURE_AUTOMATION). WhatsApp stays a
        // preview: held by the owner until the provider is chosen.
        title: 'Notifikasi WhatsApp (ditahan)',
        description:
            'Pratinjau saja: verifikasi nomor, opt-in per kejadian, dan template pesan. Ditahan sampai penyedia WhatsApp diputuskan.',
        icon: Workflow,
        gradient: 'bg-grad-indigo',
        screens: [{ label: 'WhatsApp', href: '/pengaturan/whatsapp' }],
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
];
