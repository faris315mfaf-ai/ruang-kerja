/**
 * Tampilan saluran notifikasi Android (id & isinya dari server:
 * `push.android_channels`); ikon, nada, dan deskripsi pendek hanya untuk
 * tampilan. Saluran teknis `rk_sinkron` tidak ditampilkan.
 */
import type { AnyIconName, IconTileTone } from '@/ui';

export const SALURAN_TERSEMBUNYI = ['rk_sinkron'];

export const TAMPILAN_SALURAN: Record<string, { icon: AnyIconName; tone: IconTileTone; deskripsi: string }> = {
  rk_mendesak: { icon: 'alarm-clock', tone: 'warn', deskripsi: 'Persetujuan, tugas terlambat, keputusan' },
  rk_tugas: { icon: 'square-check-big', tone: 'teal', deskripsi: 'Ditugaskan, disebut, komentar, tenggat' },
  rk_obrolan: { icon: 'message-circle', tone: 'blue', deskripsi: 'Pesan langsung & grup' },
  rk_rapat: { icon: 'video', tone: 'warn', deskripsi: 'Undangan, mulai 15 menit lagi, notulen' },
  rk_pengajuan: { icon: 'receipt-text', tone: 'blue', deskripsi: 'Hasil keputusan pengajuan Anda' },
  rk_pengingat: { icon: 'bell-ring', tone: 'warn', deskripsi: 'Check-in, check-out, laporan 16.30' },
  rk_proyek: { icon: 'target', tone: 'blue', deskripsi: 'Update, arahan, check-in OKR, kandidat' },
  rk_info: { icon: 'megaphone', tone: 'neutral', deskripsi: 'Informatif, tanpa suara' },
  rk_keamanan: { icon: 'key-round', tone: 'bad', deskripsi: 'Kata sandi diatur HR, permintaan reset' },
};

export function labelKepentingan(nilai: string): string {
  switch (nilai) {
    case 'high':
      return 'Tinggi';
    case 'default':
      return 'Sedang';
    case 'low':
      return 'Rendah';
    default:
      return 'Minimal';
  }
}
