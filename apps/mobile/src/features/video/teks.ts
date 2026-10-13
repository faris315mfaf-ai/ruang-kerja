/** Teks & format kecil ruang video (WIB, Bahasa Indonesia). */
import { ApiError } from '@/api/client';
import type { KodeTolakVideo } from '@/api/video';
import { jam } from '@/lib/format';

const HARI = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });

/** "Sel, 13 Okt · 09.00–10.00" */
export function rentangRapat(mulai: string, selesai: string): string {
  const d = new Date(mulai);
  const hari = Number.isNaN(d.getTime()) ? '' : HARI.format(d).replace('.', '');
  return `${hari} · ${jam(mulai)}–${jam(selesai)}`;
}

/** Hitung mundur "14:32" / "1:02:05". */
export function hitungMundur(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const j = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const d = total % 60;
  const dd = String(d).padStart(2, '0');
  return j > 0 ? `${j}:${String(m).padStart(2, '0')}:${dd}` : `${m}:${dd}`;
}

/** Kode penolakan dari galat token/ruang (403 berkode, 503 video_belum_siap). */
export function kodeTolak(err: unknown): KodeTolakVideo | null {
  if (!(err instanceof ApiError)) {
    return null;
  }
  if (err.status === 503 && err.code === 'video_belum_siap') {
    return 'video_belum_siap';
  }
  if (err.status === 403) {
    const c = err.code;
    if (c === 'ruang_belum_dibuka' || c === 'ruang_ditutup' || c === 'dikeluarkan' || c === 'tidak_diizinkan') {
      return c;
    }
    return 'tidak_diizinkan';
  }
  return null;
}

export function namaDepan(nama: string): string {
  return nama.trim().split(/\s+/)[0] ?? nama;
}
