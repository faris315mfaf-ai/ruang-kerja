import type { LucideIcon } from 'lucide-react';
import {
    BellRing,
    CloudOff,
    Fingerprint,
    LayoutGrid,
    Plus,
    ScanFace,
    ShieldAlert,
    Smartphone,
} from 'lucide-react';

export type PhoneScreen = {
    href: string;
    title: string;
    description: string;
    icon: LucideIcon;
    /** bg-grad-* class of the icon tile. */
    tile: string;
    /** Design reference in docs/ruangkerja-design/screens. */
    design: string;
    sprint: 'F3-1' | 'F3-2';
};

/** OS-level screens: simulated in a phone frame on desktop. */
export const OS_SCREENS: PhoneScreen[] = [
    {
        href: '/pratinjau/ponsel/masuk',
        title: 'Masuk biometrik',
        description:
            'Sidik jari atau Face ID di perangkat terdaftar, kunci setelah 3 gagal, cadangan Google.',
        icon: Fingerprint,
        tile: 'bg-grad-merek',
        design: 'MLogin',
        sprint: 'F3-1',
    },
    {
        href: '/pratinjau/ponsel/kunci',
        title: 'Layar kunci',
        description:
            'Notifikasi dengan aksi: setujui cuti dengan Face ID, check-in sekarang, tunda pengingat.',
        icon: BellRing,
        tile: 'bg-grad-indigo',
        design: 'MLockScreen',
        sprint: 'F3-1',
    },
    {
        href: '/pratinjau/ponsel/widget',
        title: 'Widget layar utama',
        description:
            'Ukuran kecil & sedang: status absensi dengan tombol check-in dan tugas hari ini.',
        icon: LayoutGrid,
        tile: 'bg-grad-merek',
        design: 'MWidget',
        sprint: 'F3-1',
    },
];

/** Regular app features: phone shell on phones, sensible desktop layout. */
export const APP_SCREENS: PhoneScreen[] = [
    {
        href: '/absensi/wajah',
        title: 'Check-in wajah',
        description:
            'Persetujuan biometrik UU PDP, daftar wajah dengan liveness, check-in metode wajah.',
        icon: ScanFace,
        tile: 'bg-grad-aksi',
        design: 'MAbsen · MSukses · PImplCheckin',
        sprint: 'F3-1',
    },
    {
        href: '/pratinjau/ponsel/integritas',
        title: 'Integritas perangkat',
        description:
            'Deteksi lokasi palsu, root/jailbreak, aplikasi tidak resmi dengan penolakan yang ramah.',
        icon: ShieldAlert,
        tile: 'bg-grad-slate',
        design: 'MFondasi (keadaan Gagal)',
        sprint: 'F3-2',
    },
    {
        href: '/pratinjau/ponsel/offline',
        title: 'Offline & antrean sinkron',
        description:
            'Aksi tersimpan di perangkat tanpa sinyal, dikirim saat online, konflik bisa dicoba lagi.',
        icon: CloudOff,
        tile: 'bg-grad-indigo',
        design: 'MOffline',
        sprint: 'F3-2',
    },
    {
        href: '/pratinjau/ponsel/aksi-cepat',
        title: 'Aksi cepat',
        description:
            'Tombol + membuka lembar: check-in, tugas baru, ajukan cuti, catatan, catatan suara.',
        icon: Plus,
        tile: 'bg-grad-aksi',
        design: 'MQuickAdd',
        sprint: 'F3-1',
    },
    {
        href: '/pengaturan/perangkat',
        title: 'Perangkat saya',
        description:
            'Perangkat tepercaya, status integritas, cabut perangkat, hapus data wajah.',
        icon: Smartphone,
        tile: 'bg-grad-slate',
        design: 'MSPengaturan (gaya)',
        sprint: 'F3-2',
    },
];

/** MFondasi "Prinsip": rules every phone screen follows. */
export const PRINCIPLES = [
    {
        title: 'Satu tangan',
        body: 'Aksi utama selalu di sepertiga bawah layar. Tidak ada tombol penting di pojok atas.',
    },
    {
        title: 'Satu tujuan per layar',
        body: 'Yang harus dikerjakan hari ini dulu; detail satu ketukan di bawahnya.',
    },
    {
        title: 'Tahan sinyal lemah',
        body: 'Check-in, komentar, dan status tersimpan dulu di perangkat lalu dikirim saat sinyal kembali.',
    },
    {
        title: 'Cepat terasa',
        body: 'Respons sentuh di bawah 100 ms, getar halus untuk konfirmasi, skeleton saat memuat.',
    },
];

/** MFondasi "Lima keadaan setiap layar". */
export const SCREEN_STATES = [
    {
        title: 'Memuat',
        body: 'Skeleton seukuran isi asli, bukan spinner di tengah layar.',
        tone: 'neutral',
    },
    {
        title: 'Kosong',
        body: 'Jelaskan kenapa kosong dan beri satu aksi berikutnya.',
        tone: 'success',
    },
    {
        title: 'Offline',
        body: 'Data terakhir tetap tampil, perubahan masuk antrean sinkron.',
        tone: 'warning',
    },
    {
        title: 'Gagal',
        body: 'Bahasa manusia, tanpa kode error, dengan tombol coba lagi.',
        tone: 'danger',
    },
    {
        title: 'Berhasil',
        body: 'Konfirmasi singkat dengan getar ringan, bisa diurungkan.',
        tone: 'info',
    },
] as const;
